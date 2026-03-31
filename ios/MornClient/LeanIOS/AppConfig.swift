import Foundation

enum NavigationMode {
    case `internal`
    case external
    case appbrowser
}

class AppConfig {
    static let shared = AppConfig()
    
    var initialUrl: String = ""
    var appName: String = ""
    var bundleId: String = ""
    var versionString: String = "1.0.0"
    var buildNumber: Int = 1
    var userAgentAdd: String = "median"
    var injectMedianJS: Bool = true
    var pullToRefresh: Bool = true
    var showOfflinePage: Bool = true
    
    private var navigationRules: [[String: Any]] = []
    
    private init() {
        loadConfig()
    }
    
    private func loadConfig() {
        guard let configPath = Bundle.main.path(forResource: "appConfig", ofType: "json"),
              let data = try? Data(contentsOf: URL(fileURLWithPath: configPath)),
              let config = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            print("[AppConfig] Failed to load appConfig.json")
            return
        }
        
        if let general = config["general"] as? [String: Any] {
            initialUrl = general["initialUrl"] as? String ?? ""
            appName = general["appName"] as? String ?? ""
            bundleId = general["iosBundleId"] as? String ?? ""
            versionString = general["iosVersionString"] as? String ?? "1.0.0"
            buildNumber = general["iosBuildNumber"] as? Int ?? 1
            userAgentAdd = general["iosUserAgentAdd"] as? String ?? general["userAgentAdd"] as? String ?? "median"
            injectMedianJS = general["injectMedianJS"] as? Bool ?? true
        }
        
        if let navigation = config["navigation"] as? [String: Any] {
            pullToRefresh = navigation["iosPullToRefresh"] as? Bool ?? true
            showOfflinePage = navigation["iosShowOfflinePage"] as? Bool ?? true
            
            if let regexRules = navigation["regexInternalExternal"] as? [String: Any],
               let rules = regexRules["rules"] as? [[String: Any]] {
                navigationRules = rules
            }
        }
    }
    
    func getNavigationMode(for urlString: String) -> NavigationMode {
        for rule in navigationRules {
            guard let regex = rule["regex"] as? String,
                  let mode = rule["mode"] as? String else { continue }
            
            // Unescape double-escaped backslashes from JSON
            let cleanRegex = regex.replacingOccurrences(of: "\\\\", with: "\\")
            
            if let _ = try? NSRegularExpression(pattern: cleanRegex, options: []),
               let range = urlString.range(of: cleanRegex, options: .regularExpression) {
                if !range.isEmpty {
                    switch mode {
                    case "internal":
                        return .internal
                    case "external":
                        return .external
                    case "appbrowser":
                        return .appbrowser
                    default:
                        return .internal
                    }
                }
            }
        }
        
        return .appbrowser
    }
}
