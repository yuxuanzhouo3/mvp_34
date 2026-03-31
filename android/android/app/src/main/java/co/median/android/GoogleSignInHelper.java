package co.median.android;

import android.content.Intent;
import android.text.TextUtils;

import androidx.annotation.Nullable;

import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

import org.json.JSONException;
import org.json.JSONObject;

class GoogleSignInHelper {
    private final MainActivity activity;
    private GoogleSignInClient googleSignInClient;

    GoogleSignInHelper(MainActivity activity) {
        this.activity = activity;
    }

    boolean isGooglePlayServicesAvailable() {
        return GoogleApiAvailability.getInstance()
                .isGooglePlayServicesAvailable(activity) == ConnectionResult.SUCCESS;
    }

    Intent buildSignInIntent(String clientId) {
        GoogleSignInOptions options = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestEmail()
                .requestProfile()
                .requestIdToken(clientId)
                .build();

        googleSignInClient = GoogleSignIn.getClient(activity, options);
        return googleSignInClient.getSignInIntent();
    }

    void signOut(Runnable onComplete) {
        if (googleSignInClient == null) {
            googleSignInClient = GoogleSignIn.getClient(
                    activity,
                    new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN).build()
            );
        }

        googleSignInClient.signOut().addOnCompleteListener(activity, task -> onComplete.run());
    }

    @Nullable
    JSONObject getCurrentUserJson() {
        GoogleSignInAccount account = GoogleSignIn.getLastSignedInAccount(activity);
        return account == null ? null : toJson(account, false);
    }

    JSONObject parseSignInResult(Intent data) throws ApiException {
        Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
        GoogleSignInAccount account = task.getResult(ApiException.class);
        return toJson(account, true);
    }

    private JSONObject toJson(GoogleSignInAccount account, boolean includeIdToken) {
        JSONObject json = new JSONObject();
        try {
            json.put("success", true);
            json.put("email", account.getEmail());
            json.put("displayName", account.getDisplayName());
            json.put("photoUrl", account.getPhotoUrl() != null ? account.getPhotoUrl().toString() : JSONObject.NULL);

            if (includeIdToken && !TextUtils.isEmpty(account.getIdToken())) {
                json.put("idToken", account.getIdToken());
            }
        } catch (JSONException ignored) {
        }
        return json;
    }
}
