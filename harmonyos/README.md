# MornClient HarmonyOS 模板

网页套壳鸿蒙应用模板，支持集中配置管理和首次启动隐私政策弹窗。

## 环境要求

- DevEco Studio 5.0 或更高版本
- HarmonyOS SDK 6.0.1(21)
- 华为开发者账号（用于签名）

## 配置文件

所有运行时配置集中在 `entry/src/main/resources/rawfile/appConfig.json`：

```json
{
  "general": {
    "initialUrl": "https://your-website.com",
    "appName": "应用名称",
    "bundleName": "com.example_harmony.app",
    "versionName": "1.0.0",
    "versionCode": 1
  }
}
```

| 字段 | 说明 |
|------|------|
| `initialUrl` | 目标网页 URL |
| `appName` | 应用名称（显示在欢迎弹窗） |
| `bundleName` | 包名 |
| `versionName` | 版本名称 |
| `versionCode` | 版本号（整数） |

应用级配置在 `AppScope/app.json5`（需与 appConfig.json 保持一致）：

```json5
{
  "app": {
    "bundleName": "com.example_harmony.app",
    "versionName": "1.0.0",
    "versionCode": 1
  }
}
```

## 图标替换

替换以下位置的图标文件（建议上传 1024x1024 PNG，系统自动处理各尺寸）：

| 路径 | 文件名 | 尺寸 | 说明 |
|------|--------|------|------|
| `entry/src/main/resources/base/media/` | `icon.png` | 256x256 | 应用图标 |
| `entry/src/main/resources/base/media/` | `startIcon.png` | 256x256 | 启动图标 |
| `entry/src/main/resources/base/media/` | `foreground.png` | 1024x1024 | 前景图层（66%安全区） |
| `entry/src/main/resources/base/media/` | `background.png` | 1024x1024 | 背景图层 |
| `AppScope/resources/base/media/` | `foreground.png` | 1024x1024 | 前景图层（66%安全区） |
| `AppScope/resources/base/media/` | `background.png` | 1024x1024 | 背景图层 |

## 隐私政策

修改 `entry/src/main/resources/rawfile/privacy_policy.md`，支持 Markdown 格式：

- 标题：`#`、`##`、`###`
- 列表：`-` 无序列表、`1.` 有序列表
- 引用：`>` 引用块
- 粗体：`**文本**`
- 斜体：`*文本*`
- 分割线：`---`
- 表格：`| 列1 | 列2 |`

首次启动时会弹窗��示隐私政策，用户点击"我已同意"后才能使用应用。

## 构建步骤

1. 使用 DevEco Studio 打开项目
2. 登录华为开发者账号
3. 配置签名证书（File → Project Structure → Signing Configs）
4. 点击 Build → Build Hap(s)/APP(s) 构建应用

## 注意事项

- 包名格式建议：`com.{应用名}_harmony.app`（与安卓区分）
- 修改 appConfig.json 后，需同步修改 app.json5 中的对应字段
- 前景图层需要 66% 安全边距，防止系统裁剪
