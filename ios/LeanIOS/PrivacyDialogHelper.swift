//
//  PrivacyDialogHelper.swift
//  LeanIOS
//
//  Created for privacy policy dialog
//  Copyright © 2024. All rights reserved.
//

import UIKit
import Foundation

/**
 隐私政策弹窗帮助类
 使用 iOS 原生 UIAlertController 实现
 支持 Markdown 格式渲染
 内容优先从 privacy_policy.md 加载，若不存在则从 privacy_policy.txt 加载
 */
@objc public class PrivacyDialogHelper: NSObject {

    private static let prefsKey = "PrivacyAgreed"
    private static let privacyFileMd = "privacy_policy.md"
    private static let privacyFileTxt = "privacy_policy.txt"

    /// 检查用户是否已同意隐私政策
    @objc public static func hasAgreed() -> Bool {
        return UserDefaults.standard.bool(forKey: prefsKey)
    }

    /// 保存用户已同意隐私政策
    private static func saveAgreement() {
        UserDefaults.standard.set(true, forKey: prefsKey)
        UserDefaults.standard.synchronize()
    }

    /// 显示隐私政策弹窗
    /// - Parameters:
    ///   - viewController: 当前视图控制器
    ///   - onAgree: 同意后的回调
    @objc public static func showPrivacyDialog(from viewController: UIViewController, onAgree: (() -> Void)?) {
        // 加载 Markdown 内容
        let markdownContent = loadPrivacyPolicy()

        // 解析 Markdown（iOS 15+ 使用原生 Markdown 解析；失败则降级为纯文本）
        let attributedString = renderMarkdown(markdownContent)

        // 创建自定义弹窗
        let alertController = UIAlertController(
            title: NSLocalizedString("privacy_dialog_title", comment: "Privacy Policy"),
            message: nil,
            preferredStyle: .alert
        )

        // 创建可滚动的文本视图
        let textView = UITextView()
        textView.attributedText = attributedString
        textView.isEditable = false
        textView.isScrollEnabled = true
        textView.backgroundColor = .clear
        textView.font = UIFont.systemFont(ofSize: 14)
        textView.textColor = UIColor.label

        // 设置约束
        textView.translatesAutoresizingMaskIntoConstraints = false

        // 创建容器视图
        let containerView = UIView()
        containerView.addSubview(textView)

        NSLayoutConstraint.activate([
            textView.topAnchor.constraint(equalTo: containerView.topAnchor),
            textView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),
            textView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            textView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            containerView.heightAnchor.constraint(equalToConstant: 350)
        ])

        alertController.view.addSubview(containerView)
        containerView.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            containerView.topAnchor.constraint(equalTo: alertController.view.topAnchor, constant: 50),
            containerView.leadingAnchor.constraint(equalTo: alertController.view.leadingAnchor, constant: 10),
            containerView.trailingAnchor.constraint(equalTo: alertController.view.trailingAnchor, constant: -10),
            alertController.view.heightAnchor.constraint(greaterThanOrEqualToConstant: 480)
        ])

        // 同意按钮
        let agreeAction = UIAlertAction(
            title: NSLocalizedString("privacy_agree", comment: "Agree"),
            style: .default
        ) { _ in
            saveAgreement()
            onAgree?()
        }

        // 退出按钮
        let exitAction = UIAlertAction(
            title: NSLocalizedString("privacy_exit", comment: "Exit"),
            style: .destructive
        ) { _ in
            exit(0)
        }

        alertController.addAction(agreeAction)
        alertController.addAction(exitAction)

        viewController.present(alertController, animated: true)
    }

    private static func renderMarkdown(_ markdown: String) -> NSAttributedString {
        if #available(iOS 15.0, *) {
            if let attributed = try? AttributedString(markdown: markdown) {
                return NSAttributedString(attributed)
            }
        }

        return NSAttributedString(string: markdown)
    }

    /// 从 Bundle 加载隐私政策文本
    private static func loadPrivacyPolicy() -> String {
        // 优先尝试加载 .md 文件
        if let path = Bundle.main.path(forResource: "privacy_policy", ofType: "md"),
           let content = try? String(contentsOfFile: path, encoding: .utf8) {
            return content
        }

        // 其次尝试加载 .txt 文件
        if let path = Bundle.main.path(forResource: "privacy_policy", ofType: "txt"),
           let content = try? String(contentsOfFile: path, encoding: .utf8) {
            return content
        }

        // 默认文本
        return """
        # 服务条款与隐私政策

        请联系开发者获取完整的隐私政策内容。
        """
    }
}
