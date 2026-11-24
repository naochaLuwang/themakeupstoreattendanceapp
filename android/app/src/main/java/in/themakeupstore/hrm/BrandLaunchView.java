package in.themakeupstore.hrm;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.content.res.ColorStateList;
import android.os.Build;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.HapticFeedbackConstants;
import android.view.animation.DecelerateInterpolator;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.ScrollView;
import java.io.IOException;
import java.io.InputStream;

/** Native, offline-capable logo reveal; it never depends on the remote page. */
final class BrandLaunchView extends FrameLayout {
    private final TextView status;
    private final LinearLayout actions;
    private final LogoView logo;
    private final int ink;
    private final boolean motion;
    private ValueAnimator animator;

    BrandLaunchView(Context context, boolean dark, Runnable retry, Runnable connections) {
        super(context);
        setBackgroundColor(Color.parseColor(dark ? "#171b18" : "#ffffff"));
        setClickable(true);
        setFocusable(true);
        ink = Color.parseColor(dark ? "#f4f6f2" : "#1c211c");
        motion = animationsEnabled(context);
        LinearLayout center = new LinearLayout(context);
        center.setOrientation(LinearLayout.VERTICAL);
        center.setGravity(Gravity.CENTER);
        center.setPadding(dp(24), 0, dp(24), 0);
        ScrollView scroll = new ScrollView(context);
        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        center.setPadding(dp(24), dp(24), dp(24), dp(24));
        scroll.addView(center, new ScrollView.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT));
        LayoutParams centered = new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT);
        centered.bottomMargin = dp(64);
        addView(scroll, centered);

        logo = new LogoView(context, dark);
        center.addView(logo, new LinearLayout.LayoutParams(dp(190), dp(190)));
        TextView name = text("THE MAKEUP STORE", 30, ink);
        try { name.setTypeface(Typeface.createFromAsset(context.getAssets(), "hrm-brand.ttf")); }
        catch (RuntimeException ignored) { name.setTypeface(Typeface.create("sans-serif-condensed", Typeface.BOLD)); }
        LinearLayout.LayoutParams nameLayout = new LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT);
        nameLayout.topMargin = dp(20);
        center.addView(name, nameLayout);
        TextView hrm = text("HRM", 13, Color.parseColor(dark ? "#d0a5b5" : "#7b4658"));
        hrm.setLetterSpacing(0.18f);
        hrm.setPadding(0, dp(7), 0, 0);
        center.addView(hrm);

        status = text("", 14, Color.parseColor(dark ? "#b5bdb4" : "#646d62"));
        status.setPadding(dp(16), dp(30), dp(16), dp(12));
        status.setMinHeight(dp(76));
        status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        center.addView(status);
        actions = new LinearLayout(context);
        actions.setOrientation(LinearLayout.VERTICAL);
        actions.setGravity(Gravity.CENTER);
        Button retryButton = button("Try again", true, dark);
        retryButton.setOnClickListener(v -> { v.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK); retry.run(); });
        actions.addView(retryButton, new LinearLayout.LayoutParams(dp(224), dp(50)));
        Button settings = button("Connection settings", false, dark);
        settings.setOnClickListener(v -> { v.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK); connections.run(); });
        LinearLayout.LayoutParams settingsLayout = new LinearLayout.LayoutParams(dp(224), dp(50));
        settingsLayout.topMargin = dp(8);
        actions.addView(settings, settingsLayout);
        actions.setVisibility(GONE);
        center.addView(actions);

        TextView descriptor = text("Attendance & store operations", 12, Color.parseColor(dark ? "#b5bdb4" : "#646d62"));
        LayoutParams footer = new LayoutParams(LayoutParams.MATCH_PARENT, dp(48), Gravity.BOTTOM);
        footer.bottomMargin = dp(18);
        addView(descriptor, footer);
        if (motion) {
            animator = ValueAnimator.ofFloat(0f, 1f);
            animator.setDuration(820);
            animator.setInterpolator(new DecelerateInterpolator(1.25f));
            animator.addUpdateListener(value -> {
                float progress = (float) value.getAnimatedValue();
                logo.progress = progress;
                logo.invalidate();
                name.setAlpha(Math.min(1f, progress * 2f));
                hrm.setAlpha(Math.max(0f, Math.min(1f, (progress - 0.25f) * 2f)));
            });
            name.setAlpha(0f);
            hrm.setAlpha(0f);
            animator.start();
        } else logo.progress = 1f;
    }

    void waiting() { status.setText("Opening your workspace…"); }

    void showError() {
        if (animator != null) animator.end();
        status.setText("Couldn’t connect to your workspace.\nCheck your connection and try again.");
        actions.setVisibility(VISIBLE);
        setAlpha(1f);
        setVisibility(VISIBLE);
    }

    void retrying() {
        status.setText("Connecting…");
        actions.setVisibility(GONE);
    }

    void dismiss() {
        if (!motion) { setVisibility(GONE); return; }
        animate().alpha(0f).setDuration(180).withEndAction(() -> setVisibility(GONE)).start();
    }

    void dispose() {
        if (animator != null) animator.cancel();
        animate().cancel();
    }

    private TextView text(String value, int size, int color) {
        TextView view = new TextView(getContext());
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        view.setGravity(Gravity.CENTER);
        view.setTypeface(Typeface.create("sans-serif", Typeface.NORMAL));
        view.setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_YES);
        return view;
    }

    private Button button(String value, boolean primary, boolean dark) {
        Button button = new Button(getContext());
        button.setText(value);
        button.setTextSize(14);
        button.setAllCaps(false);
        button.setTextColor(primary ? Color.WHITE : ink);
        button.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        GradientDrawable background = new GradientDrawable();
        background.setCornerRadius(dp(10));
        background.setColor(primary ? Color.parseColor("#7b4658") : Color.TRANSPARENT);
        if (!primary) background.setStroke(dp(1), Color.parseColor(dark ? "#4a5248" : "#dce1d8"));
        GradientDrawable mask = new GradientDrawable();
        mask.setColor(Color.WHITE);
        mask.setCornerRadius(dp(10));
        button.setBackground(new RippleDrawable(ColorStateList.valueOf(primary ? 0x33ffffff : 0x227b4658), background, mask));
        return button;
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    static boolean animationsEnabled(Context context) {
        return Build.VERSION.SDK_INT >= 26 ? ValueAnimator.areAnimatorsEnabled()
            : Settings.Global.getFloat(context.getContentResolver(), Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0;
    }

    private static final class LogoView extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        private final RectF bounds = new RectF();
        private final Path plateClip = new Path();
        private final int accent = Color.parseColor("#7b4658");
        private final Bitmap bitmap;
        private final boolean dark;
        float progress;

        LogoView(Context context, boolean dark) {
            super(context);
            this.dark = dark;
            setContentDescription("THE MAKEUP STORE HRM logo");
            Bitmap loaded = null;
            try (InputStream input = context.getAssets().open("hrm-logo.png")) {
                BitmapFactory.Options options = new BitmapFactory.Options();
                options.inSampleSize = 2;
                loaded = BitmapFactory.decodeStream(input, null, options);
            } catch (IOException ignored) { /* Text branding remains visible. */ }
            bitmap = loaded;
        }

        @Override protected void onSizeChanged(int width, int height, int oldWidth, int oldHeight) {
            super.onSizeChanged(width, height, oldWidth, oldHeight);
            bounds.set(0, 0, width, height);
            plateClip.reset();
            plateClip.addRoundRect(bounds, width * .14f, width * .14f, Path.Direction.CW);
        }

        @Override protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            float width = getWidth(), height = getHeight();
            if (dark) {
                paint.setColor(Color.WHITE);
                canvas.drawRoundRect(bounds, width * .14f, width * .14f, paint);
            }
            if (bitmap == null) return;
            float scale = .96f + .04f * progress;
            canvas.save();
            canvas.scale(scale, scale, width / 2f, height / 2f);
            if (dark) canvas.clipPath(plateClip);
            float reveal = height * (1f - progress);
            canvas.clipRect(0, reveal, width, height);
            paint.setAlpha(255);
            canvas.drawBitmap(bitmap, null, bounds, paint);
            canvas.restore();
            if (progress > .02f && progress < .98f) {
                paint.setColor(accent);
                paint.setAlpha(Math.round(80f * (1f - progress)));
                paint.setStrokeWidth(getResources().getDisplayMetrics().density);
                canvas.drawLine(width * .16f, reveal, width * .84f, reveal, paint);
                paint.setAlpha(255);
            }
        }
    }
}
