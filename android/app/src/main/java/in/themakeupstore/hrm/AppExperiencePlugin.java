package in.themakeupstore.hrm;

import android.os.Build;
import android.os.SystemClock;
import android.view.HapticFeedbackConstants;
import android.view.View;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AppExperience")
public class AppExperiencePlugin extends Plugin {
    private long lastFeedback;
    private String lastKind = "";

    @PluginMethod public void feedback(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (!trusted()) { call.reject("This page is outside the workspace."); return; }
            View view = getBridge().getWebView();
            if (getActivity().isFinishing() || !view.hasWindowFocus()) { call.resolve(); return; }
            String kind = call.getString("kind", "selection");
            long now = SystemClock.uptimeMillis();
            if (kind.equals(lastKind) && now - lastFeedback < 160) { call.resolve(); return; }
            lastFeedback = now;
            lastKind = kind;
            int effect;
            switch (kind) {
                case "success": effect = Build.VERSION.SDK_INT >= 30 ? HapticFeedbackConstants.CONFIRM : HapticFeedbackConstants.LONG_PRESS; break;
                case "error": effect = Build.VERSION.SDK_INT >= 30 ? HapticFeedbackConstants.REJECT : HapticFeedbackConstants.LONG_PRESS; break;
                case "impact": effect = HapticFeedbackConstants.CONTEXT_CLICK; break;
                case "selection": effect = HapticFeedbackConstants.CLOCK_TICK; break;
                default: call.reject("Unknown feedback type."); return;
            }
            // No flags override the user's system touch-feedback setting.
            view.performHapticFeedback(effect);
            call.resolve();
        });
    }

    @PluginMethod public void appearance(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (!trusted()) { call.reject("This page is outside the workspace."); return; }
            if (getActivity() instanceof MainActivity) ((MainActivity) getActivity()).applyAppearance(call.getBoolean("dark", false));
            call.resolve();
        });
    }

    @PluginMethod public void ready(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (!trusted()) { call.reject("This page is outside the workspace."); return; }
            if (getActivity() instanceof MainActivity) ((MainActivity) getActivity()).workspaceReady();
            call.resolve();
        });
    }

    private boolean trusted() {
        return new WorkspaceOrigin(getBridge().getServerUrl()).contains(getBridge().getWebView().getUrl());
    }
}
