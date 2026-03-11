# 国际版（Supabase）本地与上线配置说明

本项目分 **国内版（CloudBase）** / **国际版（Supabase）** 两套后端。

- **开关**：由 `NEXT_PUBLIC_DEFAULT_LANGUAGE` 决定
  - `zh` => 国内版（CloudBase）
  - `en` => 国际版（Supabase）

如果你本地没配 CloudBase，会出现类似：
- 前端控制台：`[AuthContext] Fetch domestic user timeout`
- 终端日志：`Missing CloudBase env vars: WECHAT_CLOUDBASE_ID, CLOUDBASE_SECRET_ID, CLOUDBASE_SECRET_KEY`

按下面步骤切到国际版即可。

---

## 本地开发（走国际版）

### 1) 创建 `.env.local`

项目里提供了模板：`env.local.example`

把它复制成 `.env.local`，并填写 Supabase 信息：

```env
NEXT_PUBLIC_DEFAULT_LANGUAGE=en
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

说明：
- `.env.local` 不要提交到仓库（已在 `.gitignore` 忽略）
- `NEXT_PUBLIC_*` 会进入浏览器 bundle，**只能放可公开的 key**（如 anon key）

### 2) 重启开发服务

环境变量是启动时加载的，改完必须重启：

```bash
npm run dev
```

### 3) Supabase 控制台配置（邮箱验证/回调）

国际版注册使用 Supabase Email OTP / Magic Link，需要配置回调域名：

- **Supabase Dashboard → Authentication → URL Configuration**
  - **Site URL**：`http://localhost:3000`
  - **Redirect URLs**：添加 `http://localhost:3000/auth/confirm`

> 代码里注册时的跳转地址：`/auth/confirm?next=/`（见 `context/AuthContext.tsx`）

---

## 上线部署（走国际版）

在部署平台的 **环境变量** 中配置同样的 3 个变量：

```env
NEXT_PUBLIC_DEFAULT_LANGUAGE=en
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

然后在 Supabase 配置生产域名：
- **Site URL**：`https://你的域名`
- **Redirect URLs**：添加 `https://你的域名/auth/confirm`

---

## 可选：服务端 Admin Key（用于部分 Server API）

有些 Server API（例如 `app/api/releases/active/route.ts`、`app/api/social-links/active/route.ts`）在国际版分支会用到 `supabaseAdmin`。

如果你希望这些 API 在生产环境能读到数据，需要在**服务端环境变量**配置：

```env
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
```

注意：
- **不要**用 `NEXT_PUBLIC_` 前缀
- **不要**暴露到浏览器

---

## 常见问题

### 1) 我已经把 `NEXT_PUBLIC_DEFAULT_LANGUAGE=en` 写进 `.env.local` 了，还是走国内版？

请确认：
- 你确实创建了 `.env.local`（不是 `.env.local.txt`）
- 修改后 **重启** 了 `npm run dev`
- 终端里会看到类似：`Reload env: .env.local`

### 2) 仍看到 `[AuthContext] Fetch domestic user timeout`？

这表示当前运行仍是国内版（`zh`）。切国际版后不应再请求 `/api/domestic/auth/me`。

---

## 相关文件

- `config/index.ts`：版本判断（`NEXT_PUBLIC_DEFAULT_LANGUAGE`）
- `context/AuthContext.tsx`：国内/国际登录注册逻辑分流
- `app/auth/confirm/route.ts`：Supabase 邮箱验证回调处理
- `env.local.example`：本地环境变量模板（复制为 `.env.local`）

