# 微信登录生产环境配置指南

## 前置要求

### 1. 域名要求
- ✅ 已备案的域名（国内服务器必须）
- ✅ 已配置 HTTPS（微信要求）
- ✅ 域名解析到你的服务器
- ✅ SSL 证书有效（推荐使用 Let's Encrypt 或商业证书）

### 2. 微信开放平台账号
- ✅ 已注册并认证的微信开放平台账号
- ✅ 已创建网站应用（AppID 和 AppSecret）

---

## 配置步骤

### 步骤 1：配置环境变量

在生产环境的 `.env.local` 或部署平台的环境变量中设置：

```env
# 生产环境域名（必须使用 HTTPS，不包含端口号）
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_SITE_URL=https://yourdomain.com

# 微信 OAuth 配置
WECHAT_APP_ID=wx48a648f967ee565f
WECHAT_APP_SECRET=your_wechat_app_secret

# 其他必要配置...
NEXT_PUBLIC_DEFAULT_LANGUAGE=zh
```

**重要提示**：
- ✅ 使用 `https://` 协议
- ✅ **不要包含端口号**（微信要求）
- ✅ 不要包含路径（如 `/` 结尾）
- ✅ 使用实际的生产域名

### 步骤 2：配置微信开放平台回调域名

1. **登录微信开放平台**
   - 访问：https://open.weixin.qq.com/
   - 使用你的开发者账号登录

2. **进入应用管理**
   - 点击顶部菜单「管理中心」
   - 找到你的网站应用（AppID: `wx48a648f967ee565f`）
   - 点击「查看」进入应用详情

3. **配置授权回调域名**
   - 找到「开发信息」或「授权回调域名」设置
   - 点击「修改」或「设置」
   - 在「授权回调域名」中添加：`yourdomain.com`
     - ✅ **只填域名部分**，不要包含：
       - `https://` 协议前缀
       - `www.` 前缀（除非你的网站使用 www）
       - 端口号
       - 路径（如 `/auth/callback`）
   
   **正确示例**：
   - ✅ `yourdomain.com`
   - ✅ `api.yourdomain.com`（如果使用子域名）
   - ❌ `https://yourdomain.com`
   - ❌ `yourdomain.com:443`
   - ❌ `yourdomain.com/auth/callback`

4. **保存配置**
   - 点击「保存」或「提交」
   - 等待审核（通常几分钟内生效）

### 步骤 3：验证回调地址格式

你的回调地址应该是：
```
https://yourdomain.com/auth/callback
```

这个地址会在代码中自动构建：
- 基础 URL：`NEXT_PUBLIC_APP_URL`（如 `https://yourdomain.com`）
- 回调路径：`/auth/callback`
- 完整地址：`https://yourdomain.com/auth/callback`

### 步骤 4：测试配置

1. **部署应用**
   ```bash
   npm run build
   npm start
   # 或使用你的部署平台（Vercel、阿里云、腾讯云等）
   ```

2. **访问登录页面**
   - 打开：`https://yourdomain.com/auth/login`
   - 点击「使用微信登录」

3. **验证流程**
   - ✅ 应该能正常跳转到微信扫码页面
   - ✅ 扫码后能正常回调到你的网站
   - ✅ 登录成功后能正常跳转

---

## 常见部署平台配置

### Vercel

1. **环境变量设置**
   - 进入项目设置 → Environment Variables
   - 添加以下变量：
     ```
     NEXT_PUBLIC_APP_URL=https://yourdomain.com
     NEXT_PUBLIC_SITE_URL=https://yourdomain.com
     WECHAT_APP_ID=wx48a648f967ee565f
     WECHAT_APP_SECRET=your_secret
     ```

2. **自定义域名**
   - 在项目设置 → Domains 中添加你的域名
   - 按照提示配置 DNS 记录
   - 等待 SSL 证书自动配置

### 阿里云 / 腾讯云

1. **服务器配置**
   - 确保服务器已安装 Node.js
   - 配置 Nginx 反向代理（如需要）
   - 配置 SSL 证书（Let's Encrypt 或商业证书）

2. **环境变量**
   - 在服务器上创建 `.env.local` 文件
   - 或使用 PM2 的环境变量配置
   - 或使用 Docker 的环境变量

3. **Nginx 配置示例**（如使用）
   ```nginx
   server {
       listen 443 ssl http2;
       server_name yourdomain.com;
       
       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

### Docker

1. **环境变量配置**
   ```dockerfile
   # Dockerfile
   ENV NEXT_PUBLIC_APP_URL=https://yourdomain.com
   ENV NEXT_PUBLIC_SITE_URL=https://yourdomain.com
   ```

   或使用 `docker-compose.yml`：
   ```yaml
   services:
     app:
       environment:
         - NEXT_PUBLIC_APP_URL=https://yourdomain.com
         - NEXT_PUBLIC_SITE_URL=https://yourdomain.com
         - WECHAT_APP_ID=wx48a648f967ee565f
         - WECHAT_APP_SECRET=${WECHAT_APP_SECRET}
   ```

---

## 常见问题

### Q1: 微信提示"redirect_uri 参数错误"

**可能原因**：
1. 回调域名未在微信开放平台配置
2. 回调域名配置格式错误（包含了协议或路径）
3. 环境变量 `NEXT_PUBLIC_APP_URL` 配置错误

**解决方法**：
1. 检查微信开放平台的回调域名配置（只填域名，如 `yourdomain.com`）
2. 检查 `.env.local` 中的 `NEXT_PUBLIC_APP_URL`（应该是 `https://yourdomain.com`，不含端口和路径）
3. 重启应用使环境变量生效

### Q2: 域名未备案怎么办？

**情况说明**：
- 如果服务器在国内，域名**必须备案**
- 如果服务器在海外，通常不需要备案，但微信可能有限制

**解决方案**：
1. **国内服务器**：必须完成域名备案（通常需要 1-2 周）
2. **海外服务器**：可以尝试，但微信可能不支持海外域名
3. **临时方案**：使用已备案的测试域名进行开发

### Q3: HTTPS 证书配置

**推荐方案**：
1. **Let's Encrypt**（免费，自动续期）
   ```bash
   # 使用 certbot
   certbot --nginx -d yourdomain.com
   ```

2. **商业证书**（如阿里云、腾讯云提供的免费证书）

3. **CDN 提供**（如 Cloudflare、阿里云 CDN）

### Q4: 多个环境（开发/测试/生产）如何管理？

**推荐方案**：
1. **开发环境**：使用 ngrok（见 `WECHAT_OAUTH_SETUP.md`）
2. **测试环境**：使用测试域名（如 `test.yourdomain.com`）
3. **生产环境**：使用生产域名（如 `yourdomain.com`）

**环境变量示例**：
```env
# 开发环境 (.env.local)
NEXT_PUBLIC_APP_URL=https://dev-xxx.ngrok-free.app

# 测试环境 (.env.test)
NEXT_PUBLIC_APP_URL=https://test.yourdomain.com

# 生产环境 (.env.production)
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

**微信开放平台配置**：
- 可以配置多个回调域名（用分号分隔）
- 例如：`yourdomain.com;test.yourdomain.com`

### Q5: 如何验证配置是否正确？

**检查清单**：
- [ ] 域名已备案（如需要）
- [ ] HTTPS 证书有效
- [ ] `NEXT_PUBLIC_APP_URL` 设置为 `https://yourdomain.com`（不含端口）
- [ ] 微信开放平台回调域名配置为 `yourdomain.com`（不含协议和路径）
- [ ] 应用已重启，环境变量已生效
- [ ] 可以访问 `https://yourdomain.com/auth/login`
- [ ] 点击微信登录能正常跳转

---

## 安全建议

1. **保护 AppSecret**
   - ✅ 使用环境变量存储，不要提交到代码仓库
   - ✅ 在生产环境使用部署平台的安全存储
   - ✅ 定期轮换密钥

2. **HTTPS 必须**
   - ✅ 微信要求回调地址必须使用 HTTPS
   - ✅ 确保 SSL 证书有效且未过期

3. **域名验证**
   - ✅ 确保域名所有权验证通过
   - ✅ 定期检查域名解析是否正常

4. **日志监控**
   - ✅ 监控登录失败率
   - ✅ 记录异常回调请求
   - ✅ 设置告警机制

---

## 配置完成后

配置完成后，你的微信登录流程应该是：

1. 用户访问：`https://yourdomain.com/auth/login`
2. 点击「使用微信登录」
3. 跳转到：`https://open.weixin.qq.com/connect/qrconnect?...&redirect_uri=https://yourdomain.com/auth/callback&...`
4. 用户扫码授权
5. 微信回调到：`https://yourdomain.com/auth/callback?code=xxx&state=xxx`
6. 你的应用处理回调，完成登录
7. 跳转到用户原始访问的页面

---

## 需要帮助？

如果遇到问题，请检查：
1. 浏览器控制台的错误信息
2. 服务器日志（查看 `/api/domestic/auth/wechat/qrcode` 的日志）
3. 微信开放平台的配置是否正确
4. 环境变量是否已正确设置并生效
