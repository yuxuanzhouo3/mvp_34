# 腾讯云云托管部署指南

## 构建问题已解决 ✅

**问题：** Windows符号链接权限错误 `EPERM: operation not permitted, symlink`

**解决方案：** 启用Windows开发者模式（设置 → 隐私和安全性 → 开发者选项）

## 快速部署

### 1. 登录腾讯云云托管

访问：https://console.cloud.tencent.com/tcb/service

### 2. 创建服务

- 选择"代码托管"部署方式
- 关联GitHub/GitLab仓库
- Dockerfile路径：`./Dockerfile`
- 端口：`3000`

### 3. 配置环境变量（必需）

```bash
# 应用基础配置
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://你的域名.com
ADMIN_SESSION_SECRET=生成强随机密钥
JWT_SECRET=生成强随机密钥

# Supabase（国际版）
NEXT_PUBLIC_SUPABASE_URL=你的URL
SUPABASE_URL=你的URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=你的key
SUPABASE_SERVICE_ROLE_KEY=你的key

# CloudBase（国内版）
WECHAT_CLOUDBASE_ID=你的环境ID
CLOUDBASE_SECRET_ID=你的ID
CLOUDBASE_SECRET_KEY=你的Key
CLOUDBASE_BUCKET_ID=你的Bucket

# 微信OAuth
NEXT_PUBLIC_WECHAT_APP_ID=你的AppID
WECHAT_APP_ID=你的AppID
WECHAT_APP_SECRET=你的Secret
WECHAT_APP_ANDROID_ID=Android AppID
WECHAT_APP_ANDROID_SECRET=Android Secret

# 微信小程序
WX_MINI_APPID=小程序AppID
WX_MINI_SECRET=小程序Secret

# 微信支付
WECHAT_PAY_APP_ID=支付AppID
WECHAT_PAY_MCH_ID=商户号
WECHAT_PAY_API_V3_KEY=API密钥（32字符）
WECHAT_PAY_SERIAL_NO=证书序列号
WECHAT_PAY_PRIVATE_KEY=商户私钥

# 支付宝
ALIPAY_APP_ID=支付宝AppID
ALIPAY_GATEWAY_URL=https://openapi.alipay.com/gateway.do
ALIPAY_SANDBOX=false
ALIPAY_PRIVATE_KEY=私钥
ALIPAY_PUBLIC_KEY=公钥
ALIPAY_ALIPAY_PUBLIC_KEY=支付宝公钥

# Stripe（国际版）
STRIPE_WEBHOOK_SECRET=webhook密钥
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=可发布密钥
STRIPE_SECRET_KEY=密钥

# PayPal（国际版）
PAYPAL_CLIENT_ID=Client ID
PAYPAL_CLIENT_SECRET=Client Secret
PAYPAL_ENVIRONMENT=production
PAYPAL_WEBHOOK_ID=Webhook ID
PAYPAL_SKIP_SIGNATURE_VERIFICATION=false

# 其他配置
IP_API_URL=https://ipapi.co/json/
GEO_FAIL_CLOSED=true
MAX_IMAGE_UPLOAD_MB=5
```

### 4. 部署验证

- ✅ 首页加载
- ✅ 微信登录（PC扫码 + Android WebView）
- ✅ 支付功能
- ✅ 应用构建功能

## 构建产物信息

```
.next/standalone  432MB  (独立运行时)
.next/static      3.0MB  (静态资源)
public            2.0MB  (公共文件)
```

## 安全检查

- [ ] 所有密钥已更换为生产环境密钥
- [ ] ADMIN_SESSION_SECRET已修改
- [ ] JWT_SECRET已修改
- [ ] GEO_FAIL_CLOSED=true
- [ ] 支付宝/PayPal沙箱模式已关闭
- [ ] .env文件未提交到仓库

## 技术支持

- 腾讯云云托管：https://cloud.tencent.com/document/product/1243
- CloudBase：https://docs.cloudbase.net/
