import webview from '@ohos.web.webview';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { preferences } from '@kit.ArkData';

const DOMAIN = 0x0000;
const TAG = 'WebContainer';
// 应用配置接口
interface GeneralConfig {
  initialUrl: string;
  appName: string;
  bundleName: string;
  versionName: string;
  versionCode: number;
}

interface AppConfig {
  general: GeneralConfig;
}
interface ProgressChangeEvent {
  newProgress: number;
}

interface MarkdownElement {
  type: string;
  content: string;
  level?: number;
}

@Entry
@Component
struct Index {
  controller: webview.WebviewController = new webview.WebviewController();
  @State loading: boolean = true;
  @State loadError: string = '';
  @State showDialog: boolean = false;
  @State privacyContent: string = '';
  @State appConfig: AppConfig | null = null;
  private preferencesName: string = 'AppPreferences';

  aboutToAppear() {
    this.loadAppConfig();
    this.loadPrivacyPolicy();
    this.checkFirstLaunch();
  }

  // 加载应用配置
  private loadAppConfig() {
    try {
      let context = getContext(this);
      let resourceMgr = context.resourceManager;
      let configData = resourceMgr.getRawFileContentSync('appConfig.json');
      let configStr = this.uint8ArrayToString(configData);
      this.appConfig = JSON.parse(configStr) as AppConfig;
      hilog.info(DOMAIN, TAG, 'App config loaded: %{public}s', this.appConfig.general.appName);
    } catch (err) {
      hilog.error(DOMAIN, TAG, 'Error loading app config: %{public}s', JSON.stringify(err));
      // 使用默认配置
      this.appConfig = {
        general: {
          initialUrl: 'https://example.com',
          appName: 'MyApp',
          bundleName: 'com.example_harmony.app',
          versionName: '1.0.0',
          versionCode: 1
        }
      } as AppConfig;
    }
  }

  // 加载隐私政策 Markdown 文件
  private loadPrivacyPolicy() {
    try {
      let context = getContext(this);
      let resourceMgr = context.resourceManager;
      let privacyData = resourceMgr.getRawFileContentSync('privacy_policy.md');
      this.privacyContent = this.uint8ArrayToString(privacyData);
      hilog.info(DOMAIN, TAG, 'Privacy policy loaded successfully');
    } catch (err) {
      hilog.error(DOMAIN, TAG, 'Error loading privacy policy: %{public}s', JSON.stringify(err));
      this.privacyContent = '# 服务条款与隐私政策\n\n请联系开发者获取完整的隐私政策内容。';
    }
  }

  // Uint8Array 转字符串
  private uint8ArrayToString(array: Uint8Array): string {
    let result = '';
    for (let i = 0; i < array.length; i++) {
      result += String.fromCharCode(array[i]);
    }
    // 处理 UTF-8 编码
    try {
      return decodeURIComponent(escape(result));
    } catch (e) {
      return result;
    }
  }

  private checkFirstLaunch() {
    try {
      let context = getContext(this);
      let prefsMgr = preferences.getPreferencesSync(context, { name: this.preferencesName });
      let isFirstLaunch = prefsMgr.getSync('isFirstLaunch', true) as boolean;

      if (isFirstLaunch) {
        this.showDialog = true;
        hilog.info(DOMAIN, TAG, 'First launch detected, showing dialog');
      }
    } catch (err) {
      hilog.error(DOMAIN, TAG, 'Error checking first launch: %{public}s', JSON.stringify(err));
    }
  }
  // 解析 Markdown 为结构化内容
  private parseMarkdown(markdown: string): Array<MarkdownElement> {
    let lines = markdown.split('\n');
    let result: Array<MarkdownElement> = [];

    for (let line of lines) {
      let trimmed = line.trim();
      if (trimmed.startsWith('### ')) {
        result.push({ type: 'h3', content: trimmed.substring(4) } as MarkdownElement);
      } else if (trimmed.startsWith('## ')) {
        result.push({ type: 'h2', content: trimmed.substring(3) } as MarkdownElement);
      } else if (trimmed.startsWith('# ')) {
        result.push({ type: 'h1', content: trimmed.substring(2) } as MarkdownElement);
      } else if (trimmed.startsWith('- ')) {
        result.push({ type: 'list', content: trimmed.substring(2) } as MarkdownElement);
      } else if (trimmed.startsWith('> ')) {
        result.push({ type: 'quote', content: trimmed.substring(2) } as MarkdownElement);
      } else if (trimmed.startsWith('---')) {
        result.push({ type: 'divider', content: '' } as MarkdownElement);
      } else if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        // 表格行
        if (!trimmed.includes('---')) {
          result.push({ type: 'table', content: trimmed } as MarkdownElement);
        }
      } else if (/^\d+\.\s/.test(trimmed)) {
        result.push({ type: 'ordered', content: trimmed.replace(/^\d+\.\s/, '') } as MarkdownElement);
      } else if (trimmed.startsWith('*') && trimmed.endsWith('*') && trimmed.length > 2) {
        result.push({ type: 'italic', content: trimmed.slice(1, -1) } as MarkdownElement);
      } else if (trimmed !== '') {
        result.push({ type: 'text', content: trimmed } as MarkdownElement);
      } else {
        result.push({ type: 'space', content: '' } as MarkdownElement);
      }
    }

    return result;
  }

  // 处理文本中的粗体标记
  private formatText(text: string): string {
    return text.replace(/\*\*([^*]+)\*\*/g, '$1');
  }

  // 检查文本是否包含粗体
  private hasBold(text: string): boolean {
    return /\*\*[^*]+\*\*/.test(text);
  }

  build() {
    Stack() {
      // WebView 主内容
      if (this.appConfig) {
        Web({
          src: this.appConfig.general.initialUrl,
          controller: this.controller
        })
          .javaScriptAccess(true)
          .domStorageAccess(true)
          .fileAccess(false)
          .horizontalScrollBarAccess(false)
          .verticalScrollBarAccess(false)
          .onProgressChange((e: ProgressChangeEvent) => {
            this.loading = (e.newProgress < 100);
            hilog.info(DOMAIN, TAG, 'Progress: %{public}d', e.newProgress);
          })
          .onPageEnd(() => {
            this.loading = false;
            hilog.info(DOMAIN, TAG, 'Page loaded successfully');
          })
          .width('100%')
          .height('100%')
      }

      // 加载中状态
      if (this.loading) {
        Column() {
          Progress({ value: 0, total: 100, style: ProgressStyle.Ring })
            .width(60)
            .height(60)
          Text('加载中...')
            .fontSize(16)
            .fontColor('#666666')
            .margin({ top: 12 })
        }
        .width('100%')
        .height('100%')
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .backgroundColor('#FFFFFF')
      }

      // 加载错误状态
      if (this.loadError !== '') {
        Column() {
          Text('加载失败')
            .fontSize(18)
            .fontColor('#FF0000')
            .margin({ bottom: 8 })
          Text(this.loadError)
            .fontSize(14)
            .fontColor('#666666')
            .margin({ bottom: 16 })
          Button('重新加载')
            .onClick(() => {
              this.loadError = '';
              this.loading = true;
              this.controller.refresh();
            })
        }
        .width('100%')
        .height('100%')
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .backgroundColor('#FFFFFF')
      }

      // 首次启动隐私政策弹窗
      if (this.showDialog) {
        Column() {
          // 标题区域
          Text(`欢迎使用 ${this.appConfig?.general.appName || 'App'}`)
            .fontSize(28)
            .fontWeight(FontWeight.Bold)
            .textAlign(TextAlign.Center)
            .width('100%')
            .padding({ top: 40, bottom: 20 })
            .fontColor('#000000')

          // 分割线
          Divider()
            .strokeWidth(1)
            .color('#E0E0E0')
            .margin({ bottom: 16 })
            .width('90%')

          // Markdown 内容滚动区
          Scroll() {
            Column() {
              ForEach(this.parseMarkdown(this.privacyContent), (item: MarkdownElement) => {
                if (item.type === 'h1') {
                  Text(item.content)
                    .fontSize(20)
                    .fontWeight(FontWeight.Bold)
                    .fontColor('#000000')
                    .margin({ top: 16, bottom: 8 })
                    .width('100%')
                } else if (item.type === 'h2') {
                  Text(item.content)
                    .fontSize(17)
                    .fontWeight(FontWeight.Bold)
                    .fontColor('#333333')
                    .margin({ top: 14, bottom: 6 })
                    .width('100%')
                } else if (item.type === 'h3') {
                  Text(item.content)
                    .fontSize(15)
                    .fontWeight(FontWeight.Medium)
                    .fontColor('#333333')
                    .margin({ top: 10, bottom: 4 })
                    .width('100%')
                } else if (item.type === 'list') {
                  Row() {
                    Text('•')
                      .fontSize(14)
                      .fontColor('#666666')
                      .margin({ right: 8 })
                    Text(this.formatText(item.content))
                      .fontSize(14)
                      .fontColor('#333333')
                      .layoutWeight(1)
                  }
                  .width('100%')
                  .margin({ top: 2, bottom: 2 })
                  .alignItems(VerticalAlign.Top)
                } else if (item.type === 'ordered') {
                  Row() {
                    Text('•')
                      .fontSize(14)
                      .fontColor('#666666')
                      .margin({ right: 8 })
                    Text(this.formatText(item.content))
                      .fontSize(14)
                      .fontColor('#333333')
                      .layoutWeight(1)
                  }
                  .width('100%')
                  .margin({ top: 2, bottom: 2 })
                  .alignItems(VerticalAlign.Top)
                } else if (item.type === 'quote') {
                  Row() {
                    Divider()
                      .vertical(true)
                      .strokeWidth(3)
                      .color('#0066FF')
                      .height('100%')
                    Text(this.formatText(item.content))
                      .fontSize(14)
                      .fontColor('#555555')
                      .fontStyle(FontStyle.Italic)
                      .margin({ left: 8 })
                      .layoutWeight(1)
                  }
                  .width('100%')
                  .padding({ left: 8, top: 4, bottom: 4 })
                  .margin({ top: 4, bottom: 4 })
                  .backgroundColor('#F5F5F5')
                  .borderRadius(4)
                } else if (item.type === 'divider') {
                  Divider()
                    .strokeWidth(1)
                    .color('#E0E0E0')
                    .margin({ top: 12, bottom: 12 })
                    .width('100%')
                } else if (item.type === 'table') {
                  Text(item.content.replace(/\|/g, '  '))
                    .fontSize(13)
                    .fontColor('#333333')
                    .fontFamily('monospace')
                    .margin({ top: 2, bottom: 2 })
                    .width('100%')
                } else if (item.type === 'italic') {
                  Text(item.content)
                    .fontSize(13)
                    .fontColor('#666666')
                    .fontStyle(FontStyle.Italic)
                    .margin({ top: 8 })
                    .width('100%')
                } else if (item.type === 'space') {
                  Text('')
                    .height(8)
                } else if (item.type === 'text') {
                  Text(this.formatText(item.content))
                    .fontSize(14)
                    .fontColor('#333333')
                    .margin({ top: 2, bottom: 2 })
                    .width('100%')
                }
              })
            }
            .width('100%')
            .padding(12)
          }
          .width('90%')
          .layoutWeight(1)
          .margin({ bottom: 16 })
          .backgroundColor('#F9F9F9')
          .borderRadius(8)
          .border({ width: 1, color: '#E0E0E0' })

          // 分割线
          Divider()
            .strokeWidth(1)
            .color('#E0E0E0')
            .margin({ bottom: 12 })
            .width('90%')

          // 底部提示
          Text('继续使用即表示您已同意本服务条款和隐私政策')
            .fontSize(13)
            .fontColor('#999999')
            .textAlign(TextAlign.Center)
            .width('90%')
            .margin({ bottom: 16 })

          // 同意按钮
          Button('我已同意')
            .width('85%')
            .height(48)
            .backgroundColor('#0066FF')
            .fontColor('#FFFFFF')
            .fontSize(16)
            .fontWeight(FontWeight.Medium)
            .borderRadius(8)
            .margin({ bottom: 24 })
            .onClick(() => {
              try {
                let context = getContext(this);
                let prefsMgr = preferences.getPreferencesSync(context, { name: this.preferencesName });
                prefsMgr.putSync('isFirstLaunch', false);
                prefsMgr.flush();
                hilog.info(DOMAIN, TAG, 'User agreed to terms, flag saved');
              } catch (err) {
                hilog.error(DOMAIN, TAG, 'Error saving first launch flag: %{public}s', JSON.stringify(err));
              }

              this.showDialog = false;
            })
        }
        .width('100%')
        .height('100%')
        .backgroundColor('#FFFFFF')
        .alignItems(HorizontalAlign.Center)
      }
    }
    .width('100%')
    .height('100%')
  }
}
