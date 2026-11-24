package in.themakeupstore.hrm;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.Configuration;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;
import android.view.Gravity;
import android.view.HapticFeedbackConstants;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.URLUtil;
import android.webkit.PermissionRequest;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.BridgeWebChromeClient;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private final Handler ui = new Handler(Looper.getMainLooper());
    private BrandLaunchView launch;
    private WorkspaceOrigin workspace;
    private String workspaceUrl;
    private String lastWorkspaceUrl;
    private String experienceScript = "";
    private String experienceCss = "";
    private long launchedAt;
    private boolean pageReady;
    private boolean mainFrameFailed;
    private boolean connected = true;
    private boolean keyboardVisible;
    private boolean destroyed;
    private int launchAttempt = 1;
    private TextView connectionBanner;
    private ConnectivityManager connectivity;
    private ConnectivityManager.NetworkCallback networkCallback;
    private ViewTreeObserver.OnGlobalLayoutListener keyboardListener;

    @Override public void onCreate(Bundle state) {
        registerPlugin(ReportFilesPlugin.class);
        registerPlugin(AppExperiencePlugin.class);
        super.onCreate(state);
        if (getBridge() == null) return;
        workspaceUrl = getBridge().getServerUrl();
        lastWorkspaceUrl = workspaceUrl;
        workspace = new WorkspaceOrigin(workspaceUrl);
        launchedAt = SystemClock.uptimeMillis();
        boolean dark = initialDark();
        applyAppearance(dark);
        launch = new BrandLaunchView(this, dark, this::retryWorkspace, this::openConnectionSettings);
        addContentView(launch, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        ui.postDelayed(() -> { if (launchAttempt == 1 && !pageReady && !mainFrameFailed && launch != null) launch.waiting(); }, 2500);
        deadline(launchAttempt);
        try {
            experienceScript = assetText("native-experience.js");
            experienceCss = assetText("native-experience.css");
        } catch (IOException ignored) { /* Workspace and native retry remain usable. */ }
        WebView webView = getBridge().getWebView();
        attachConnectionBanner(webView);
        webView.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setHapticFeedbackEnabled(true);
        webView.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
            @Override public void onPermissionRequest(PermissionRequest request) {
                String[] resources = request.getResources();
                if (!workspace.allowsCamera(request.getOrigin().toString(), webView.getUrl(), resources)) {
                    request.deny();
                    return;
                }
                // Capacitor requests Android CAMERA permission; no microphone access.
                super.onPermissionRequest(request);
            }
        });
        getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (workspace.contains(url)) { lastWorkspaceUrl = url; mainFrameFailed = false; }
                super.onPageStarted(view, url, favicon);
            }
            @Override public void onPageCommitVisible(WebView view, String url) {
                super.onPageCommitVisible(view, url);
                if (workspace.contains(url) && !mainFrameFailed) { injectExperience(); workspaceReady(); }
            }
            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (workspace.contains(url) && !mainFrameFailed) { injectExperience(); workspaceReady(); }
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) failedWorkspace();
                super.onReceivedError(view, request, error);
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                // Let the app render its own 4xx screens. Subresource/API errors
                // never replace an employee's current form with the launch view.
                if (!request.isForMainFrame() || response.getStatusCode() < 500) return;
                failedWorkspace();
                super.onReceivedHttpError(view, request, response);
            }
        });
        attachDownloads();
        attachBackBehavior();
        attachKeyboardBehavior();
        attachConnectionBehavior();
        if (webView.getProgress() == 100 && workspace.contains(webView.getUrl())) {
            injectExperience();
            workspaceReady();
        }
    }

    void workspaceReady() {
        if (destroyed || mainFrameFailed || pageReady || launch == null || launch.getVisibility() == View.GONE) return;
        pageReady = true;
        long minimum = BrandLaunchView.animationsEnabled(this) ? 850 : 0;
        ui.postDelayed(() -> { if (!destroyed && pageReady && !mainFrameFailed) {
            getBridge().getWebView().setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_AUTO);
            launch.dismiss();
        } },
            Math.max(0, minimum - (SystemClock.uptimeMillis() - launchedAt)));
    }

    private void failedWorkspace() {
        mainFrameFailed = true;
        pageReady = false;
        getBridge().getWebView().setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
        if (launch != null) {
            launch.animate().cancel();
            launch.showError();
        }
    }

    private void retryWorkspace() {
        mainFrameFailed = false;
        pageReady = false;
        launch.retrying();
        String url = workspace.contains(lastWorkspaceUrl) ? lastWorkspaceUrl : workspaceUrl;
        getBridge().getWebView().loadUrl(url);
        deadline(++launchAttempt);
    }

    private void deadline(int attempt) {
        ui.postDelayed(() -> { if (attempt == launchAttempt && !pageReady && !destroyed) launch.showError(); }, 14000);
    }

    private void attachConnectionBanner(WebView webView) {
        ViewGroup parent = (ViewGroup) webView.getParent();
        int index = parent.indexOfChild(webView);
        ViewGroup.LayoutParams original = webView.getLayoutParams();
        parent.removeView(webView);
        LinearLayout column = new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);
        parent.addView(column, index, original);
        connectionBanner = new TextView(this);
        connectionBanner.setText("You’re offline. Changes need a connection to save.");
        connectionBanner.setTextSize(12);
        connectionBanner.setGravity(Gravity.CENTER);
        int padding = Math.round(10 * getResources().getDisplayMetrics().density);
        connectionBanner.setPadding(padding, padding, padding, padding);
        connectionBanner.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        connectionBanner.setVisibility(View.GONE);
        connectionBanner.setOnClickListener(view -> { view.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK); openConnectionSettings(); });
        column.addView(connectionBanner, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        column.addView(webView, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        applyAppearance(initialDark());
    }

    private void openConnectionSettings() {
        try { startActivity(new Intent(Settings.ACTION_WIRELESS_SETTINGS)); }
        catch (ActivityNotFoundException ignored) { /* Retry button remains available. */ }
    }

    private void injectExperience() {
        if (destroyed || !workspace.contains(getBridge().getWebView().getUrl())) return;
        String css = "(()=>{if(document.getElementById('hrm-native-style'))return;const s=document.createElement('style');"
            + "s.id='hrm-native-style';s.textContent=" + JSONObject.quote(experienceCss) + ";(document.head||document.documentElement).appendChild(s);})();";
        getBridge().eval("window.__hrmConnected=" + connected + ";" + css + experienceScript, ignored -> {});
    }

    private void attachBackBehavior() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (keyboardVisible) {
                    WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).hide(WindowInsetsCompat.Type.ime());
                    return;
                }
                WebView view = getBridge().getWebView();
                if (!workspace.contains(view.getUrl())) { moveTaskToBack(true); return; }
                view.evaluateJavascript("window.__hrmNative ? window.__hrmNative.back() : 'unhandled'", result -> {
                    if (destroyed || "\"handled\"".equals(result)) return;
                    if (workspace.isHome(view.getUrl()) || !view.canGoBack()) moveTaskToBack(true);
                    else view.goBack();
                });
            }
        });
    }

    private void attachKeyboardBehavior() {
        View decor = getWindow().getDecorView();
        keyboardListener = () -> {
            WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(decor);
            boolean open = insets != null && insets.isVisible(WindowInsetsCompat.Type.ime());
            if (open == keyboardVisible) return;
            keyboardVisible = open;
            if (!destroyed && workspace.contains(getBridge().getWebView().getUrl()))
                getBridge().eval("window.__hrmNative?.keyboard(" + open + ")", ignored -> {});
        };
        decor.getViewTreeObserver().addOnGlobalLayoutListener(keyboardListener);
    }

    private void attachConnectionBehavior() {
        connectivity = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (connectivity == null) return;
        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override public void onAvailable(Network network) { connectionChanged(); }
            @Override public void onLost(Network network) { connectionChanged(); }
            @Override public void onCapabilitiesChanged(Network network, NetworkCapabilities capabilities) { connectionChanged(); }
        };
        connectivity.registerDefaultNetworkCallback(networkCallback);
        connectionChanged();
    }

    private void connectionChanged() {
        runOnUiThread(() -> {
            if (destroyed || connectivity == null) return;
            Network active = connectivity.getActiveNetwork();
            NetworkCapabilities caps = active == null ? null : connectivity.getNetworkCapabilities(active);
            connected = caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
            if (connectionBanner != null) connectionBanner.setVisibility(connected ? View.GONE : View.VISIBLE);
            if (workspace.contains(getBridge().getWebView().getUrl()))
                getBridge().eval("window.__hrmConnected=" + connected + ";window.__hrmNative?.connection(" + connected + ")", ignored -> {});
        });
    }

    @SuppressWarnings("deprecation")
    void applyAppearance(boolean dark) {
        int color = android.graphics.Color.parseColor(dark ? "#171b18" : "#ffffff");
        getPreferences(MODE_PRIVATE).edit().putString("appearance", dark ? "dark" : "light").apply();
        getWindow().getDecorView().setBackgroundColor(color);
        getWindow().setStatusBarColor(color);
        getWindow().setNavigationBarColor(color);
        if (android.os.Build.VERSION.SDK_INT >= 29) getWindow().setNavigationBarContrastEnforced(false);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(!dark);
        controller.setAppearanceLightNavigationBars(!dark);
        if (getBridge() != null) getBridge().getWebView().setBackgroundColor(color);
        if (connectionBanner != null) {
            connectionBanner.setBackgroundColor(android.graphics.Color.parseColor(dark ? "#35232b" : "#efe5e9"));
            connectionBanner.setTextColor(android.graphics.Color.parseColor(dark ? "#edc8d8" : "#633849"));
        }
    }

    private boolean initialDark() {
        String appearance = getPreferences(MODE_PRIVATE).getString("appearance", "system");
        return "dark".equals(appearance) || ("system".equals(appearance)
            && (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES);
    }

    @Override public void onResume() {
        super.onResume();
        if (workspace != null && getBridge() != null && workspace.contains(getBridge().getWebView().getUrl())) {
            getBridge().eval("window.__hrmNative?.resume()", ignored -> {});
            connectionChanged();
        }
    }

    @Override public void onDestroy() {
        destroyed = true;
        ui.removeCallbacksAndMessages(null);
        if (launch != null) launch.dispose();
        if (connectivity != null && networkCallback != null) connectivity.unregisterNetworkCallback(networkCallback);
        if (keyboardListener != null) getWindow().getDecorView().getViewTreeObserver().removeOnGlobalLayoutListener(keyboardListener);
        super.onDestroy();
    }

    private String assetText(String name) throws IOException {
        try (InputStream input = getAssets().open(name); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private void attachDownloads() {
        // WebView does not save blob downloads itself. Preserve the existing PDF/CSV exports
        // by passing them to Android's document picker, without broad storage permissions.
        getBridge().getWebView().setDownloadListener((url, userAgent, disposition, mimeType, length) -> {
            if (!workspace.contains(getBridge().getWebView().getUrl())) return;
            if (url == null || !(url.startsWith("blob:") || url.startsWith("data:") || url.startsWith("https://"))) return;
            String type = mimeType == null || mimeType.isEmpty() ? "application/octet-stream" : mimeType;
            String fileName = URLUtil.guessFileName(url, disposition, type);
            String script = "(async()=>{try{"
                + "const response=await fetch(" + JSONObject.quote(url) + ",{credentials:'same-origin'});"
                + "if(!response.ok)throw new Error('Download failed');"
                + "const blob=await response.blob();if(blob.size>20971520)throw new Error('File is too large');"
                + "const data=await new Promise((resolve,reject)=>{const reader=new FileReader();"
                + "reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});"
                + "await window.Capacitor.nativePromise('ReportFiles','save',{name:" + JSONObject.quote(fileName)
                + ",mimeType:" + JSONObject.quote(type) + ",data:data.substring(data.indexOf(',')+1)});"
                + "}catch(error){alert('Could not save the file. Please try again.');}})();";
            getBridge().eval(script, ignored -> {});
        });

    }
}
