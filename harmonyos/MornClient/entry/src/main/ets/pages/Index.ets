import { webview } from '@kit.ArkWeb';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { common } from '@kit.AbilityKit';
import { AppConfigManager, NavigationMode } from '../common/AppConfig';

@Entry
@Component
struct Index {
  @State isLoading: boolean = true;
  @State isOffline: boolean = false;
  @State pageTitle: string = '';

  private webController: webview.WebviewController = new webview.WebviewController();
  private appConfig: AppConfigManager = AppConfigManager.getInstance();

  aboutToAppear(): void {
    // Enable web debugging in dev mode
    webview.WebviewController.setWebDebuggingAccess(true);

    // Initialize config
    this.appConfig.loadConfig(getContext(this) as common.UIAbilityContext);
  }

  /**
   * Check if a URL should be loaded internally
   */
  private shouldLoadInternally(url: string): boolean {
    const mode = this.appConfig.getNavigationMode(url);
    return mode === NavigationMode.INTERNAL;
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      // WebView
      Web({
        src: this.appConfig.getInitialUrl(),
        controller: this.webController
      })
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .databaseAccess(true)
        .fileAccess(true)
        .imageAccess(true)
        .mixedMode(MixedMode.All)
        .geolocationAccess(true)
        .cacheMode(CacheMode.Default)
        .overviewModeAccess(true)
        .zoomAccess(true)
        .javaScriptProxy({
          object: this.createJSBridge(),
          name: 'medianBridge',
          methodList: ['postMessage'],
          controller: this.webController
        })
        .onPageBegin(() => {
          this.isLoading = true;
          this.isOffline = false;
        })
        .onPageEnd(() => {
          this.isLoading = false;
        })
        .onTitleReceive((event) => {
          if (event) {
            this.pageTitle = event.title;
          }
        })
        .onErrorReceive((event) => {
          hilog.error(0x0000, 'MornClient', 'Web error: %{public}s', JSON.stringify(event?.error));
          if (this.appConfig.getShowOfflinePage()) {
            this.isOffline = true;
          }
        })
        .onHttpErrorReceive((event) => {
          hilog.error(0x0000, 'MornClient', 'HTTP error: %{public}d', event?.response?.getResponseCode());
        })
        .onResourceLoad((event) => {
          // Resource loading callback
        })
        .onUrlLoadIntercept((event) => {
          const url = event?.data?.toString() || '';
          if (!this.shouldLoadInternally(url)) {
            // Open external URLs in system browser
            this.openExternalUrl(url);
            return true; // Intercept
          }
          return false; // Allow internal loading
        })
        .width('100%')
        .height('100%')

      // Loading indicator
      if (this.isLoading) {
        LoadingProgress()
          .color('#808080')
          .width(48)
          .height(48)
      }

      // Offline page
      if (this.isOffline) {
        Column() {
          Text('📡')
            .fontSize(64)
            .margin({ bottom: 20 })
          Text('No Connection')
            .fontSize(24)
            .fontWeight(FontWeight.Bold)
            .margin({ bottom: 10 })
          Text('Please check your internet connection and try again.')
            .fontSize(16)
            .fontColor('#86868b')
            .margin({ bottom: 24 })
            .textAlign(TextAlign.Center)
          Button('Try Again')
            .type(ButtonType.Capsule)
            .backgroundColor('#0071e3')
            .fontColor(Color.White)
            .fontSize(16)
            .padding({ left: 32, right: 32, top: 12, bottom: 12 })
            .onClick(() => {
              this.isOffline = false;
              this.webController.refresh();
            })
        }
        .width('100%')
        .height('100%')
        .backgroundColor('#f5f5f7')
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .padding(40)
      }
    }
    .width('100%')
    .height('100%')
  }

  /**
   * Create JS Bridge object for web-to-native communication
   */
  private createJSBridge(): Record<string, Function> {
    return {
      postMessage: (message: string) => {
        try {
          const data = JSON.parse(message) as Record<string, Object>;
          const command = data['command'] as string;

          switch (command) {
            case 'deviceInfo':
              this.handleDeviceInfo(data['callback'] as string);
              break;
            case 'clipboard/set':
              this.handleClipboardSet(data['text'] as string);
              break;
            default:
              hilog.info(0x0000, 'MornClient', 'Unknown bridge command: %{public}s', command);
          }
        } catch (e) {
          hilog.error(0x0000, 'MornClient', 'Bridge message parse error');
        }
      }
    };
  }

  /**
   * Handle device info request from JS
   */
  private handleDeviceInfo(callback: string): void {
    const info: Record<string, Object> = {
      platform: 'harmonyos',
      appVersion: this.appConfig.getVersionName(),
      distribution: 'source',
      isFirstLaunch: false
    };

    if (callback) {
      const js = `${callback}(${JSON.stringify(info)});`;
      this.webController.runJavaScript(js);
    }
  }

  /**
   * Handle clipboard set from JS
   */
  private handleClipboardSet(text: string): void {
    // HarmonyOS clipboard API
    hilog.info(0x0000, 'MornClient', 'Clipboard set: %{public}s', text);
  }

  /**
   * Open URL in external browser
   */
  private openExternalUrl(url: string): void {
    try {
      const context = getContext(this) as common.UIAbilityContext;
      const want: Record<string, Object> = {
        action: 'ohos.want.action.viewData',
        uri: url
      };
      context.startAbility(want as any);
    } catch (e) {
      hilog.error(0x0000, 'MornClient', 'Failed to open external URL');
    }
  }
}
