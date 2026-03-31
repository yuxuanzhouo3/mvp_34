package co.median.android;

import android.app.Activity;
import android.content.Intent;
import android.text.TextUtils;
import android.util.Log;
import android.webkit.JavascriptInterface;

import com.google.android.gms.common.api.ApiException;

import org.json.JSONException;
import org.json.JSONObject;

import co.median.median_core.GNLog;
import co.median.median_core.LeanUtils;

public class GoogleSignInBridge {
    private static final String TAG = "GoogleSignInBridge";
    private static final int REQUEST_CODE_GOOGLE_SIGN_IN = 9101;

    private final MainActivity activity;
    private final GoogleSignInHelper helper;
    private String pendingSignInCallback;
    private String pendingSignOutCallback;

    public GoogleSignInBridge(MainActivity activity) {
        this.activity = activity;
        this.helper = new GoogleSignInHelper(activity);
    }

    @JavascriptInterface
    public void signIn(String clientId, String callback) {
        activity.runOnUiThread(() -> {
            Log.d(TAG, "signIn requested. callback=" + callback + ", clientIdPresent=" + !TextUtils.isEmpty(clientId));
            if (TextUtils.isEmpty(clientId) || TextUtils.isEmpty(callback)) {
                dispatch(callback, errorPayload("Missing clientId or callback"));
                return;
            }

            if (!helper.isGooglePlayServicesAvailable()) {
                dispatch(callback, errorPayload("Google Play services unavailable"));
                return;
            }

            pendingSignInCallback = callback;

            try {
                Intent signInIntent = helper.buildSignInIntent(clientId);
                activity.startActivityForResult(signInIntent, REQUEST_CODE_GOOGLE_SIGN_IN);
            } catch (Exception e) {
                pendingSignInCallback = null;
                GNLog.getInstance().logError(TAG, "Failed to launch Google sign-in", e);
                dispatch(callback, errorPayload(e.getMessage()));
            }
        });
    }

    @JavascriptInterface
    public void signOut(String callback) {
        activity.runOnUiThread(() -> {
            Log.d(TAG, "signOut requested. callback=" + callback);
            pendingSignOutCallback = callback;
            helper.signOut(() -> {
                dispatch(pendingSignOutCallback, successPayload());
                pendingSignOutCallback = null;
            });
        });
    }

    @JavascriptInterface
    public String getCurrentUser() {
        Log.d(TAG, "getCurrentUser requested");
        JSONObject user = helper.getCurrentUserJson();
        return user == null ? null : user.toString();
    }

    public boolean onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != REQUEST_CODE_GOOGLE_SIGN_IN) {
            return false;
        }

        Log.d(TAG, "onActivityResult received. resultCode=" + resultCode + ", hasData=" + (data != null));

        String callback = pendingSignInCallback;
        pendingSignInCallback = null;

        try {
            if (data == null) {
                String message = resultCode == Activity.RESULT_CANCELED
                        ? "User cancelled sign in (no data)"
                        : "Sign in failed: resultCode=" + resultCode;
                dispatch(callback, errorPayload(message));
                return true;
            }

            dispatch(callback, helper.parseSignInResult(data));
        } catch (ApiException e) {
            int statusCode = e.getStatusCode();
            GNLog.getInstance().logError(TAG, "Google sign-in failed: " + statusCode + ", resultCode=" + resultCode, e);

            if (statusCode == 12501 || statusCode == 16) {
                dispatch(callback, errorPayload("User cancelled sign in (" + statusCode + ")"));
            } else {
                dispatch(callback, errorPayload("Sign in failed: " + statusCode));
            }
        } catch (Exception e) {
            GNLog.getInstance().logError(TAG, "Google sign-in failed", e);
            dispatch(callback, errorPayload(e.getMessage()));
        }

        return true;
    }

    private void dispatch(String callback, JSONObject payload) {
        if (TextUtils.isEmpty(callback)) {
            return;
        }

        activity.runJavascript(LeanUtils.createJsForCallback(callback, payload));
    }

    private JSONObject successPayload() {
        JSONObject payload = new JSONObject();
        try {
            payload.put("success", true);
        } catch (JSONException ignored) {
        }
        return payload;
    }

    private JSONObject errorPayload(String message) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("success", false);
            payload.put("error", TextUtils.isEmpty(message) ? "Unknown error" : message);
        } catch (JSONException ignored) {
        }
        return payload;
    }
}
