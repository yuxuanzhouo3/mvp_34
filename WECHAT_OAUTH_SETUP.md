# 微信登录配置指南（本地开发）

## 方案一：使用 ngrok 内网穿透（推荐）

### 步骤 1：安装 ngrok

#### Windows 方式 1：使用 Chocolatey
```powershell
choco install ngrok
```

#### Windows 方式 2：手动安装
1. 访问 https://ngrok.com/download
2. 下载 Windows 版本
3. 解压到任意目录（如 `C:\ngrok`）
4. 将 `ngrok.exe` 所在目录添加到系统 PATH 环境变量

#### Windows 方式 3：使用 Scoop
```powershell
scoop install ngrok
```

### 步骤 2：注册 ngrok 账号（免费）

1. 访问 https://dashboard.ngrok.com/signup
2. 注册账号（可以使用 GitHub/Google 快速注册）
3. 登录后，在 https://dashboard.ngrok.com/get-started/your-authtoken 获取你的 authtoken

### 步骤 3：配置 ngrok authtoken

在 PowerShell 中运行：
```powershell
ngrok config add-authtoken YOUR_AUTHTOKEN
```

### 步骤 4：启动 ngrok 隧道

在**新的 PowerShell 窗口**中运行（保持运行）：
```powershell
ngrok http 3000
```

你会看到类似输出：
```
Forwarding  https://abc123-def456.ngrok-free.app -> http://localhost:3000
```

**重要**：复制 `https://abc123-def456.ngrok-free.app` 这个地址（每次启动 ngrok 可能会变化，免费版每次重启都会变）。

### 步骤 5：更新环境变量

在项目根目录的 `.env.local` 文件中，更新以下配置：

```env
# 使用 ngrok 生成的公网地址（不要包含端口号）
NEXT_PUBLIC_APP_URL=https://abc123-def456.ngrok-free.app
NEXT_PUBLIC_SITE_URL=https://abc123-def456.ngrok-free.app
```

**注意**：
- 使用 `https://` 协议（ngrok 默认提供 HTTPS）
- **不要包含端口号**（微信要求）
- 每次重启 ngrok 后，如果地址变化，需要更新这个配置

### 步骤 6：配置微信开放平台回调域名

1. 登录 [微信开放平台](https://open.weixin.qq.com/)
2. 进入你的应用（AppID: `wx48a648f967ee565f`）
3. 找到 **"开发信息"** 或 **"授权回调域名"** 设置
4. 在 **"授权回调域名"** 中添加：`abc123-def456.ngrok-free.app`
   - **只填域名部分**，不要包含 `https://` 和路径
   - 例如：`abc123-def456.ngrok-free.app` ✅
   - 错误示例：`https://abc123-def456.ngrok-free.app` ❌

### 步骤 7：重启开发服务器

更新 `.env.local` 后，需要重启 Next.js 开发服务器：

```powershell
# 停止当前服务器（Ctrl+C），然后重新启动
npm run dev
```

### 步骤 8：测试微信登录

1. 访问 `http://localhost:3000/auth/login`
2. 点击"使用微信登录"
3. 应该能正常跳转到微信扫码页面

---

## 常见问题

### Q1: ngrok 免费版地址每次重启都变化怎么办？

**A**: 有两个解决方案：

1. **使用 ngrok 固定域名**（需要付费计划）
   ```powershell
   ngrok http 3000 --domain=your-fixed-domain.ngrok-free.app
   ```

2. **使用其他内网穿透工具**：
   - [localtunnel](https://localtunnel.github.io/www/) - 免费，但地址也会变化
   - [serveo](https://serveo.net/) - 免费 SSH 隧道
   - [cloudflare tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) - 免费，可配置固定域名

### Q2: 微信开放平台提示"域名未备案"？

**A**: 这是正常的。微信开放平台对**网站应用**的回调域名有备案要求，但：
- 如果是**移动应用**，通常不需要备案
- 如果是**网站应用**，可能需要使用已备案的域名

**临时解决方案**：使用测试账号或联系微信开放平台客服申请测试权限。

### Q3: ngrok 连接超时？

**A**: 
- 检查防火墙是否阻止了 ngrok
- 确保 ngrok 进程正在运行
- 尝试使用 `ngrok http 3000 --region us` 切换到其他区域

### Q4: 如何让 ngrok 地址固定？

**A**: 免费版不支持固定域名。可以：
1. 升级到付费计划（$8/月起）
2. 使用其他工具（如 cloudflare tunnel，免费且支持固定域名）

---

## 快速启动脚本

你可以创建一个批处理文件 `start-ngrok.bat` 来快速启动：

```batch
@echo off
echo Starting ngrok tunnel for port 3000...
ngrok http 3000
pause
```

或者 PowerShell 脚本 `start-ngrok.ps1`：

```powershell
Write-Host "Starting ngrok tunnel for port 3000..." -ForegroundColor Green
ngrok http 3000
```

---

## 验证配置

运行以下命令检查配置是否正确：

```powershell
# 1. 检查 ngrok 是否运行
curl http://localhost:4040/api/tunnels

# 2. 检查环境变量（需要重启 dev 服务器后）
# 访问 http://localhost:3000/auth/login，点击微信登录
# 查看浏览器控制台和网络请求
```

---

## 注意事项

1. **每次重启 ngrok，地址会变化**（免费版），需要：
   - 更新 `.env.local` 中的 `NEXT_PUBLIC_APP_URL`
   - 更新微信开放平台的回调域名
   - 重启 Next.js 开发服务器

2. **ngrok 免费版有限制**：
   - 连接数限制
   - 带宽限制
   - 地址会变化

3. **生产环境**：
   - 使用你自己的域名
   - 确保域名已备案（如需要）
   - 在微信开放平台配置生产域名
