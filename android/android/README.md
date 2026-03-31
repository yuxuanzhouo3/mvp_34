# MornClient Android 模板

网页套壳 Android 应用模板，支持集中配置管理。

## 配置文件

所有配置集中在 `app/src/main/assets/appConfig.json`：

```json
{
  "initialUrl": "https://your-website.com",
  "appName": "应用名称",
  "packageName": "com.example.app",
  "versionName": "1.0.0"
}
```

| 字段 | 说明 |
|------|------|
| `initialUrl` | 目标网页 URL |
| `appName` | 应用名称 |
| `packageName` | 包名 |
| `versionName` | 版本号 |

## 图标替换

替换 `app/src/main/res/` 下的图标文件：

| 目录 | 尺寸 |
|------|------|
| `mipmap-mdpi/` | 48x48 |
| `mipmap-hdpi/` | 72x72 |
| `mipmap-xhdpi/` | 96x96 |
| `mipmap-xxhdpi/` | 144x144 |
| `mipmap-xxxhdpi/` | 192x192 |

文件名保持 `ic_launcher.png` 和 `ic_launcher_round.png`。

## 隐私政策

修改 `app/src/main/assets/privacy_policy.md`，支持 Markdown 格式。

## 构建

使用 Android Studio 打开项目，配置签名后构建 APK。
