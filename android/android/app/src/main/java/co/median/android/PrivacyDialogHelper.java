package co.median.android;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.widget.ScrollView;
import android.widget.TextView;

import com.google.android.material.dialog.MaterialAlertDialogBuilder;

import io.noties.markwon.Markwon;
import io.noties.markwon.html.HtmlPlugin;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;

/**
 * 隐私政策弹窗帮助类
 * 使用安卓原生 MaterialAlertDialog 实现
 * 支持 Markdown 格式渲染
 * 内容优先从 assets/privacy_policy.md 加载，若不存在则从 privacy_policy.txt 加载
 */
public class PrivacyDialogHelper {
    private static final String PREF_NAME = "PrivacyPrefs";
    private static final String PREF_AGREED = "agreed_to_privacy";
    private static final String PRIVACY_FILE_MD = "privacy_policy.md";
    private static final String PRIVACY_FILE_TXT = "privacy_policy.txt";

    /**
     * 检查用户是否已同意隐私政策
     */
    public static boolean hasAgreed(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return prefs.getBoolean(PREF_AGREED, false);
    }

    /**
     * 保存用户已同意隐私政策
     */
    private static void saveAgreement(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(PREF_AGREED, true).apply();
    }

    /**
     * 显示隐私政策弹窗
     * @param activity 当前 Activity
     * @param onAgree 同意后的回调
     */
    public static void showPrivacyDialog(Activity activity, Runnable onAgree) {
        // 创建 Markwon 实例，支持 HTML 标签
        Markwon markwon = Markwon.builder(activity)
                .usePlugin(HtmlPlugin.create())
                .build();

        // 创建可滚动的 TextView
        ScrollView scrollView = new ScrollView(activity);
        TextView textView = new TextView(activity);
        textView.setPadding(48, 32, 48, 32);
        textView.setTextSize(14);
        textView.setLineSpacing(0, 1.3f);

        // 加载并渲染 Markdown 内容
        String markdownContent = loadPrivacyPolicyFromAssets(activity);
        markwon.setMarkdown(textView, markdownContent);

        scrollView.addView(textView);

        new MaterialAlertDialogBuilder(activity)
                .setTitle(activity.getString(R.string.privacy_dialog_title))
                .setView(scrollView)
                .setCancelable(false)
                .setPositiveButton(activity.getString(R.string.privacy_agree), (dialog, which) -> {
                    saveAgreement(activity);
                    if (onAgree != null) {
                        onAgree.run();
                    }
                })
                .setNegativeButton(activity.getString(R.string.privacy_exit), (dialog, which) -> {
                    activity.finish();
                    System.exit(0);
                })
                .show();
    }

    /**
     * 从 assets 文件夹加载隐私政策文本
     * 优先加载 .md 文件，若不存在则加载 .txt 文件
     * @param context 上下文
     * @return 隐私政策文本内容（Markdown 格式）
     */
    private static String loadPrivacyPolicyFromAssets(Context context) {
        StringBuilder content = new StringBuilder();

        // 优先尝试加载 .md 文件
        String fileToLoad = PRIVACY_FILE_MD;
        try {
            context.getAssets().open(PRIVACY_FILE_MD).close();
        } catch (IOException e) {
            // .md 文件不存在，使用 .txt 文件
            fileToLoad = PRIVACY_FILE_TXT;
        }

        try {
            InputStream inputStream = context.getAssets().open(fileToLoad);
            BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, "UTF-8"));
            String line;
            while ((line = reader.readLine()) != null) {
                content.append(line).append("\n");
            }
            reader.close();
            inputStream.close();
        } catch (IOException e) {
            // 如果文件读取失败，返回默认文本
            content.append("# 服务条款与隐私政策\n\n");
            content.append("请联系开发者获取完整的隐私政策内容。");
        }
        return content.toString();
    }
}
