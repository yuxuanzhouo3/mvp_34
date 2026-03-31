package co.median.android;

import android.os.Bundle;

public class LaunchActivity extends MainActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // 检查是否已同意隐私政策
        if (!PrivacyDialogHelper.hasAgreed(this)) {
            // 先调用父类 onCreate 以初始化界面
            super.onCreate(savedInstanceState);

            // 显示隐私政策弹窗
            PrivacyDialogHelper.showPrivacyDialog(this, () -> {
                // 用户同意后，继续正常流程
                // 弹窗关闭后界面已经加载，无需额外操作
            });
        } else {
            // 已同意隐私政策，正常启动
            super.onCreate(savedInstanceState);
        }
    }
}
