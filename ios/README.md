# MornClient iOS 模板

网页套壳 iOS 应用模板，支持集中配置管理。

## 配置文件

所有配置集中在 `LeanIOS/appConfig.json`：

```json
{
  "general": {
    "initialUrl": "https://your-website.com",
    "appName": "应用名称",
    "iosBundleId": "com.example.app",
    "iosVersionString": "1.0.0",
    "iosBuildNumber": "1"
  }
}
```

| 字段 | 说明 |
|------|------|
| `initialUrl` | 目标网页 URL |
| `appName` | 应用名称 |
| `iosBundleId` | Bundle ID |
| `iosVersionString` | 版本号 |
| `iosBuildNumber` | 构建号 |

## 图标替换

替换 `LeanIOS/Images.xcassets/AppIcon.appiconset/` 下的图标：

| 文件名 | 尺寸 |
|--------|------|
| `icon-29.png` | 29x29 |
| `icon-40.png` | 40x40 |
| `icon-58.png` | 58x58 |
| `icon-76.png` | 76x76 |
| `icon-80.png` | 80x80 |
| `icon-120.png` | 120x120 |
| `icon-152.png` | 152x152 |
| `icon-167.png` | 167x167 |
| `icon-180.png` | 180x180 |
| `icon-1024.png` | 1024x1024 |

## 隐私政策

修改 `LeanIOS/privacy_policy.md`，支持 Markdown 格式。

### 技术实现

- 使用 iOS 15+ 原生 `AttributedString(markdown:)` 解析
- 低版本自动降级为纯文本显示
- 无需第三方依赖
- 首次启动时显示弹窗，用户同意后记录到 `UserDefaults`

## 构建

1. 使用 Xcode 打开 `MornGPT.xcworkspace`
2. 配置签名证书
3. 构建 IPA

> 注：模板已包含预安装的 Pods 目录，无需运行 `pod install`

### 脚本权限说明

模板已配置 "Fix Script Permissions" Build Phase，编译时会**自动修复**脚本权限，无需手动执行任何命令。

> 原因：从 Windows 打包的 zip 在 Mac 解压后，.sh 文件会丢失执行权限。Build Phase 脚本会在编译开始时自动执行 `chmod +x`。

## 依赖

- GoNativeCore
- MedianIcons
- SSZipArchive
