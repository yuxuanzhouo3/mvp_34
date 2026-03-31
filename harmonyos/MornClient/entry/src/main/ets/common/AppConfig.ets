import { common } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { util } from '@kit.ArkTS';

/**
 * Navigation mode enum matching appConfig.json rules
 */
export enum NavigationMode {
  INTERNAL = 'internal',
  EXTERNAL = 'external',
  APPBROWSER = 'appbrowser'
}

/**
 * Navigation rule interface
 */
interface NavigationRule {
  regex: string;
  mode: string;
  label: string;
}

/**
 * App configuration manager
 * Reads from resources/rawfile/appConfig.json
 */
export class AppConfigManager {
  private static instance: AppConfigManager;

  private initialUrl: string = 'https://www.mornscience.biz';
  private appName: string = 'MornClient';
  private bundleName: string = 'com.mornclient_harmony.app';
  private versionName: string = '1.0.0';
  private versionCode: number = 1;
  private pullToRefresh: boolean = true;
  private showOfflinePage: boolean = true;
  private navigationRules: NavigationRule[] = [];
  private isLoaded: boolean = false;

  private constructor() {}

  static getInstance(): AppConfigManager {
    if (!AppConfigManager.instance) {
      AppConfigManager.instance = new AppConfigManager();
    }
    return AppConfigManager.instance;
  }

  /**
   * Load configuration from rawfile/appConfig.json
   */
  loadConfig(context: common.UIAbilityContext): void {
    if (this.isLoaded) return;

    try {
      const resourceManager = context.resourceManager;
      const configData = resourceManager.getRawFileContentSync('appConfig.json');

      const textDecoder = util.TextDecoder.create('utf-8');
      const configString = textDecoder.decodeToString(configData);
      const config = JSON.parse(configString) as Record<string, Record<string, Object>>;

      // Parse general settings
      if (config['general']) {
        const general = config['general'];
        this.initialUrl = (general['initialUrl'] as string) || this.initialUrl;
        this.appName = (general['appName'] as string) || this.appName;
        this.bundleName = (general['bundleName'] as string) || this.bundleName;
        this.versionName = (general['versionName'] as string) || this.versionName;
        this.versionCode = (general['versionCode'] as number) || this.versionCode;
      }

      // Parse navigation settings
      if (config['navigation']) {
        const navigation = config['navigation'];
        this.pullToRefresh = (navigation['pullToRefresh'] as boolean) !== false;
        this.showOfflinePage = (navigation['showOfflinePage'] as boolean) !== false;

        const regexRules = navigation['regexInternalExternal'] as Record<string, Object>;
        if (regexRules && regexRules['rules']) {
          this.navigationRules = regexRules['rules'] as NavigationRule[];
        }
      }

      this.isLoaded = true;
      hilog.info(0x0000, 'MornClient', 'Config loaded: url=%{public}s, app=%{public}s', this.initialUrl, this.appName);
    } catch (e) {
      hilog.error(0x0000, 'MornClient', 'Failed to load appConfig.json');
    }
  }

  getInitialUrl(): string {
    return this.initialUrl;
  }

  getAppName(): string {
    return this.appName;
  }

  getVersionName(): string {
    return this.versionName;
  }

  getShowOfflinePage(): boolean {
    return this.showOfflinePage;
  }

  getPullToRefresh(): boolean {
    return this.pullToRefresh;
  }

  /**
   * Determine navigation mode for a given URL
   */
  getNavigationMode(url: string): NavigationMode {
    for (const rule of this.navigationRules) {
      try {
        // Unescape double-escaped backslashes from JSON
        const cleanRegex = rule.regex.replace(/\\\\/g, '\\');
        const regex = new RegExp(cleanRegex);

        if (regex.test(url)) {
          switch (rule.mode) {
            case 'internal':
              return NavigationMode.INTERNAL;
            case 'external':
              return NavigationMode.EXTERNAL;
            case 'appbrowser':
              return NavigationMode.APPBROWSER;
            default:
              return NavigationMode.INTERNAL;
          }
        }
      } catch (e) {
        // Skip invalid regex
        hilog.warn(0x0000, 'MornClient', 'Invalid regex in navigation rules: %{public}s', rule.regex);
      }
    }

    return NavigationMode.APPBROWSER;
  }
}
