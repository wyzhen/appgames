package com.arcade.jungleassault;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/** A small, offline-only host. The complete game is bundled under assets/game. */
public final class MainActivity extends Activity {
    private static final String GAME_URL = "file:///android_asset/game/index.html";
    private static final int FIRST_FILE_REQUEST = 0x4100;
    private static final int LAST_FILE_REQUEST = 0x7ffe;
    private WebView game;
    private ValueCallback<Uri[]> fileChoice;
    private int fileChoiceRequest = -1;
    private int nextFileRequest = FIRST_FILE_REQUEST;
    private boolean destroying;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);
        game = new WebView(this);
        game.setBackgroundColor(0xff071a1c);
        game.setOverScrollMode(View.OVER_SCROLL_NEVER);
        game.setHorizontalScrollBarEnabled(false);
        game.setVerticalScrollBarEnabled(false);
        WebSettings settings = game.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        // The document picker grants access only to the selected audio document.
        // WebView needs content access to expose that document as an HTML File.
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setBlockNetworkLoads(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        game.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view,
                    ValueCallback<Uri[]> callback, FileChooserParams params) {
                completeFileChoice(null);
                if (destroying || isFinishing() || !isGamePage(Uri.parse(view.getUrl() == null
                        ? "" : view.getUrl()))) {
                    callback.onReceiveValue(null);
                    return true;
                }
                fileChoice = callback;
                fileChoiceRequest = nextFileRequest;
                nextFileRequest = nextFileRequest == LAST_FILE_REQUEST
                        ? FIRST_FILE_REQUEST : nextFileRequest + 1;
                Intent pickAudio = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                pickAudio.addCategory(Intent.CATEGORY_OPENABLE);
                pickAudio.setType("audio/*");
                pickAudio.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false);
                pickAudio.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try {
                    startActivityForResult(pickAudio, fileChoiceRequest);
                } catch (ActivityNotFoundException | SecurityException unavailable) {
                    completeFileChoice(null);
                }
                return true;
            }
        });
        game.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !isGamePage(Uri.parse(url));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,
                    WebResourceRequest request) {
                return !isGamePage(request.getUrl());
            }
            @Override public void onPageFinished(WebView view, String url) {
                immersive();
            }
        });
        final FrameLayout container = new FrameLayout(this);
        container.setBackgroundColor(0xff071a1c);
        container.addView(game, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(container);
        if (Build.VERSION.SDK_INT >= 28) {
            container.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
                @Override public WindowInsets onApplyWindowInsets(View view, WindowInsets insets) {
                    android.view.DisplayCutout cutout = insets.getDisplayCutout();
                    FrameLayout.LayoutParams layout = (FrameLayout.LayoutParams) game.getLayoutParams();
                    if (cutout == null) layout.setMargins(0, 0, 0, 0);
                    else layout.setMargins(cutout.getSafeInsetLeft(), cutout.getSafeInsetTop(),
                            cutout.getSafeInsetRight(), cutout.getSafeInsetBottom());
                    game.setLayoutParams(layout);
                    return insets;
                }
            });
        }
        game.loadUrl(GAME_URL);
        immersive();
    }

    private static boolean isGamePage(Uri uri) {
        return uri != null && "file".equals(uri.getScheme())
                && (uri.getAuthority() == null || uri.getAuthority().isEmpty())
                && "/android_asset/game/index.html".equals(uri.getPath());
    }

    private void completeFileChoice(Uri[] result) {
        ValueCallback<Uri[]> callback = fileChoice;
        fileChoice = null;
        fileChoiceRequest = -1;
        if (callback != null) {
            try {
                callback.onReceiveValue(result);
            } catch (IllegalStateException disposedWebView) {
                // A destroyed WebView no longer has a live chooser to notify.
            }
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        // A superseded chooser must never deliver its result to a newer callback.
        if (requestCode != fileChoiceRequest || fileChoice == null) return;
        Uri selected = null;
        if (!destroying && resultCode == RESULT_OK && data != null) {
            ClipData clips = data.getClipData();
            if (clips == null || clips.getItemCount() == 1) {
                selected = data.getData();
                if (selected == null && clips != null) selected = clips.getItemAt(0).getUri();
                if (selected != null && !"content".equals(selected.getScheme())) selected = null;
            }
        }
        // HTML reads and stores the selected bytes; no persistent URI grant is needed.
        completeFileChoice(selected == null ? null : new Uri[] { selected });
        immersive();
    }

    private void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN |
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.systemBars());
                controller.setSystemBarsBehavior(
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        }
    }

    private void lifecycle(boolean active) {
        if (game != null) game.evaluateJavascript(
                "window.gameLifecycle && window.gameLifecycle(" + active + ");", null);
    }

    @Override protected void onPause() {
        lifecycle(false);
        if (game != null) game.onPause();
        super.onPause();
    }

    @Override protected void onResume() {
        super.onResume();
        if (game != null) game.onResume();
        lifecycle(true);
        immersive();
    }

    @Override public void onWindowFocusChanged(boolean focused) {
        super.onWindowFocusChanged(focused);
        if (focused) immersive();
        else lifecycle(false);
    }

    @Override public void onBackPressed() {
        if (game != null) game.evaluateJavascript(
                "window.gameBack && window.gameBack();", null);
    }

    @Override protected void onDestroy() {
        destroying = true;
        completeFileChoice(null);
        if (game != null) {
            game.stopLoading();
            game.destroy();
            game = null;
        }
        super.onDestroy();
    }
}
