import UIKit
import WebKit

class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    
    private var webView: WKWebView!
    private var activityIndicator: UIActivityIndicatorView!
    private var appConfig: AppConfig!
    private var refreshControl: UIRefreshControl?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Load config
        appConfig = AppConfig.shared
        
        // Setup WebView
        setupWebView()
        setupActivityIndicator()
        
        // Load initial URL
        if let url = URL(string: appConfig.initialUrl) {
            webView.load(URLRequest(url: url))
        }
    }
    
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        webView.frame = view.bounds
    }
    
    // MARK: - Setup
    
    private func setupWebView() {
        let config = WKWebViewConfiguration()
        
        // Enable JavaScript
        let prefs = WKWebpagePreferences()
        prefs.allowsContentJavaScript = true
        config.defaultWebpagePreferences = prefs
        
        // Setup JS Bridge
        let userContentController = WKUserContentController()
        userContentController.add(self, name: "medianBridge")
        
        // Inject custom user agent
        let userAgent = appConfig.userAgentAdd
        if !userAgent.isEmpty {
            config.applicationNameForUserAgent = userAgent
        }
        
        // Inject Median JS Bridge library
        if appConfig.injectMedianJS {
            if let jsPath = Bundle.main.path(forResource: "GoNativeJSBridgeLibrary", ofType: "js"),
               let jsContent = try? String(contentsOfFile: jsPath, encoding: .utf8) {
                let script = WKUserScript(source: jsContent, injectionTime: .atDocumentEnd, forMainFrameOnly: false)
                userContentController.addUserScript(script)
            }
        }
        
        config.userContentController = userContentController
        
        // Allow inline media playback
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        
        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        
        // Pull to refresh
        if appConfig.pullToRefresh {
            refreshControl = UIRefreshControl()
            refreshControl?.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
            webView.scrollView.addSubview(refreshControl!)
        }
        
        view.addSubview(webView)
    }
    
    private func setupActivityIndicator() {
        activityIndicator = UIActivityIndicatorView(style: .large)
        activityIndicator.center = view.center
        activityIndicator.hidesWhenStopped = true
        view.addSubview(activityIndicator)
    }
    
    @objc private func handleRefresh() {
        webView.reload()
    }
    
    // MARK: - WKNavigationDelegate
    
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        
        let urlString = url.absoluteString
        let mode = appConfig.getNavigationMode(for: urlString)
        
        switch mode {
        case .internal:
            decisionHandler(.allow)
        case .external:
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
            decisionHandler(.cancel)
        case .appbrowser:
            // Open in SFSafariViewController or external browser
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
            decisionHandler(.cancel)
        }
    }
    
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        activityIndicator.startAnimating()
    }
    
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        activityIndicator.stopAnimating()
        refreshControl?.endRefreshing()
        
        // Inject custom CSS
        if let cssPath = Bundle.main.path(forResource: "customCSS", ofType: "css"),
           let cssContent = try? String(contentsOfFile: cssPath, encoding: .utf8),
           !cssContent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let jsCSS = "var style = document.createElement('style'); style.textContent = `\(cssContent)`; document.head.appendChild(style);"
            webView.evaluateJavaScript(jsCSS, completionHandler: nil)
        }
        
        // Inject custom JS
        if let jsPath = Bundle.main.path(forResource: "customJS", ofType: "js"),
           let jsContent = try? String(contentsOfFile: jsPath, encoding: .utf8),
           !jsContent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            webView.evaluateJavaScript(jsContent, completionHandler: nil)
        }
    }
    
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        activityIndicator.stopAnimating()
        refreshControl?.endRefreshing()
        
        if appConfig.showOfflinePage {
            loadOfflinePage()
        }
    }
    
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        activityIndicator.stopAnimating()
        refreshControl?.endRefreshing()
        
        let nsError = error as NSError
        // Ignore cancelled navigation
        if nsError.code == NSURLErrorCancelled { return }
        
        if appConfig.showOfflinePage {
            loadOfflinePage()
        }
    }
    
    // MARK: - WKUIDelegate
    
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        // Handle target="_blank" links
        if navigationAction.targetFrame == nil || !navigationAction.targetFrame!.isMainFrame {
            webView.load(navigationAction.request)
        }
        return nil
    }
    
    // MARK: - WKScriptMessageHandler (JS Bridge)
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any] else { return }
        
        let command = body["command"] as? String ?? ""
        let callback = body["callback"] as? String
        
        switch command {
        case "statusbar/set":
            handleStatusBar(body)
        case "deviceInfo":
            handleDeviceInfo(callback: callback)
        case "clipboard/set":
            handleClipboardSet(body)
        default:
            print("[JSBridge] Unknown command: \(command)")
        }
    }
    
    // MARK: - JS Bridge Handlers
    
    private func handleStatusBar(_ params: [String: Any]) {
        if let style = params["style"] as? String {
            switch style {
            case "light":
                setNeedsStatusBarAppearanceUpdate()
            case "dark":
                setNeedsStatusBarAppearanceUpdate()
            default:
                break
            }
        }
    }
    
    private func handleDeviceInfo(callback: String?) {
        let info: [String: Any] = [
            "platform": "ios",
            "appId": appConfig.bundleId,
            "appVersion": appConfig.versionString,
            "distribution": "source",
            "isFirstLaunch": false
        ]
        
        if let callback = callback, let jsonData = try? JSONSerialization.data(withJSONObject: info),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            let js = "\(callback)(\(jsonString));"
            webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }
    
    private func handleClipboardSet(_ params: [String: Any]) {
        if let text = params["text"] as? String {
            UIPasteboard.general.string = text
        }
    }
    
    // MARK: - Offline Page
    
    private func loadOfflinePage() {
        if let offlinePath = Bundle.main.path(forResource: "offline", ofType: "html") {
            let offlineURL = URL(fileURLWithPath: offlinePath)
            webView.loadFileURL(offlineURL, allowingReadAccessTo: offlineURL.deletingLastPathComponent())
        }
    }
    
    // MARK: - Status Bar
    
    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .default
    }
}
