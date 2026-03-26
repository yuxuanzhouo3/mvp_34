# 生产环境配置指南

## 国际版（Supabase）配置入口（本地/上线）

如果你要“走国际版”，请看：`INTERNATIONAL_VERSION_SETUP.md`。

最关键的开关是：

```env
NEXT_PUBLIC_DEFAULT_LANGUAGE=en
```

然后配置 Supabase：

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

> 注意：`SUPABASE_SERVICE_ROLE_KEY` 只能放服务端环境变量，不能用 `NEXT_PUBLIC_` 前缀。

## GEO_FAIL_CLOSED 环境变量配置

`GEO_FAIL_CLOSED` 控制当无法检测用户 IP 地址时的行为策略。

### 配置选项

| 值 | 行为 | 适用场景 |
|---|---|---|
| `true` (默认) | 无法检测 IP 时拒绝访问 | 需要严格 IP 检测的安全场景 |
| `false` | 无法检测 IP 时使用默认配置继续访问 | 希望服务更稳定，允许降级访问 |

### 默认行为

- **本地开发** (`NODE_ENV=development`): 自动使用默认配置，不会阻塞
- **生产环境** (`NODE_ENV=production`): 
  - 如果 `GEO_FAIL_CLOSED=true`: 无法检测 IP 时拒绝访问
  - 如果 `GEO_FAIL_CLOSED=false`: 无法检测 IP 时使用默认配置（美国）继续访问

---

## 不同部署平台的配置方法

### 1. Vercel 部署

#### 方法一：通过 Vercel Dashboard

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择你的项目
3. 进入 **Settings** → **Environment Variables**
4. 添加环境变量：
   - **Name**: `GEO_FAIL_CLOSED`
   - **Value**: `true` 或 `false`
   - **Environment**: 选择 `Production`（或 `Preview`、`Development`）
5. 点击 **Save**
6. 重新部署项目（Redeploy）

#### 方法二：通过 Vercel CLI

```bash
# 设置生产环境变量
vercel env add GEO_FAIL_CLOSED production

# 设置预览环境变量
vercel env add GEO_FAIL_CLOSED preview

# 设置开发环境变量
vercel env add GEO_FAIL_CLOSED development
```

输入时选择值 `true` 或 `false`。

#### 方法三：通过 vercel.json（不推荐）

虽然可以在 `vercel.json` 中配置，但环境变量建议通过 Dashboard 或 CLI 设置。

---

### 2. Docker / 自托管部署

#### 使用 .env 文件

在项目根目录创建 `.env.production` 文件：

```env
NODE_ENV=production
GEO_FAIL_CLOSED=true
# 或
# GEO_FAIL_CLOSED=false
```

#### Docker 部署

在 `docker-compose.yml` 中配置：

```yaml
services:
  app:
    build: .
    environment:
      - NODE_ENV=production
      - GEO_FAIL_CLOSED=true
    # 或使用 .env 文件
    env_file:
      - .env.production
```

或在 Dockerfile 中：

```dockerfile
ENV NODE_ENV=production
ENV GEO_FAIL_CLOSED=true
```

#### 直接运行

```bash
# Linux/Mac
export GEO_FAIL_CLOSED=true
npm run start

# Windows PowerShell
$env:GEO_FAIL_CLOSED="true"
npm run start

# Windows CMD
set GEO_FAIL_CLOSED=true
npm run start
```

---

### 3. 腾讯云云托管（CloudBase）

根据 `next.config.mjs` 中的注释，项目可能部署到腾讯云云托管。

#### 通过云托管控制台

1. 登录 [腾讯云云托管控制台](https://console.cloud.tencent.com/tcb)
2. 选择你的服务
3. 进入 **环境配置** → **环境变量**
4. 添加环境变量：
   - **变量名**: `GEO_FAIL_CLOSED`
   - **变量值**: `true` 或 `false`
5. 保存并重新部署

#### 通过配置文件

在云托管配置文件中添加：

```yaml
env:
  - name: GEO_FAIL_CLOSED
    value: "true"
```

---

### 4. 其他平台

#### Railway

1. 进入项目设置
2. 选择 **Variables**
3. 添加 `GEO_FAIL_CLOSED` = `true` 或 `false`

#### Netlify

1. 进入 **Site settings** → **Environment variables**
2. 添加 `GEO_FAIL_CLOSED` = `true` 或 `false`
3. 选择作用域（Production/Deploy preview/Branch deploy）

#### Render

1. 进入 **Environment** 标签
2. 添加环境变量 `GEO_FAIL_CLOSED` = `true` 或 `false`

#### 阿里云 / 华为云 / AWS / Azure

根据各自平台的环境变量配置方式设置即可。

---

## 配置建议

### 推荐配置（安全优先）

```env
GEO_FAIL_CLOSED=true
```

**优点**:
- 更安全，防止无法检测 IP 的异常访问
- 确保地理位置检测的准确性

**缺点**:
- 如果 IP 检测服务故障，可能影响正常用户访问

### 备选配置（稳定性优先）

```env
GEO_FAIL_CLOSED=false
```

**优点**:
- 服务更稳定，即使 IP 检测失败也能继续访问
- 用户体验更好，不会因为检测问题被拒绝

**缺点**:
- 安全性稍低，无法检测 IP 的请求会使用默认配置

---

## 验证配置

部署后，可以通过以下方式验证配置是否生效：

### 1. 检查日志

查看服务器日志，应该能看到类似信息：

```
[Middleware] Production: No client IP detected, using default geo config (fail-closed disabled)
```

或

```
[Middleware] Production: No client IP, access blocked (fail-closed enabled)
```

### 2. 测试访问

如果配置为 `GEO_FAIL_CLOSED=false`，即使无法检测 IP 也应该能正常访问。

如果配置为 `GEO_FAIL_CLOSED=true`，无法检测 IP 时会返回 403 错误。

---

## 注意事项

1. **环境变量区分大小写**：确保变量名完全一致 `GEO_FAIL_CLOSED`
2. **值必须是字符串**：`"true"` 或 `"false"`（代码会自动转换为布尔值）
3. **需要重新部署**：修改环境变量后需要重新部署才能生效
4. **本地开发不受影响**：本地开发时 `NODE_ENV=development`，会自动使用宽松策略

---

## 故障排查

### 问题：修改环境变量后没有生效

**解决方案**:
1. 确认环境变量名称拼写正确
2. 确认选择了正确的环境（Production/Preview/Development）
3. 重新部署项目
4. 清除浏览器缓存

### 问题：生产环境仍然无法访问

**解决方案**:
1. 检查 `GEO_FAIL_CLOSED` 是否设置为 `false`
2. 检查 IP 检测服务是否正常（查看日志）
3. 检查网络连接和代理配置
4. 查看服务器日志中的错误信息

---

## 相关文件

- `middleware.ts` - 中间件主逻辑
- `lib/core/geo-router.ts` - IP 地理位置检测核心类
- `lib/utils/ip-detection.ts` - IP 检测工具函数
