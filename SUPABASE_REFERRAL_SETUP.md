# 邀请系统数据库配置

## 问题说明

如果遇到错误：`Could not find the table 'public.referral_links' in the schema cache`

**注意**：国内版使用 **CloudBase（腾讯云开发）**，不是 Supabase！

- **国内版**（`NEXT_PUBLIC_DEFAULT_LANGUAGE=zh`）：使用 CloudBase，需要在 CloudBase 控制台创建集合
- **国际版**（`NEXT_PUBLIC_DEFAULT_LANGUAGE=en`）：使用 Supabase，需要运行 SQL 迁移脚本

## 国内版配置（CloudBase）

### 步骤 1：在 CloudBase 控制台创建集合

1. 登录 [CloudBase 控制台](https://console.cloud.tencent.com/tcb)
2. 选择你的环境（环境ID：`WECHAT_CLOUDBASE_ID`）
3. 进入「数据库」→「集合管理」
4. 创建以下集合（如果不存在）：

#### 1. referral_links（邀请链接集合）
字段结构：
- `creator_user_id` (String) - 创建者用户ID
- `tool_slug` (String) - 工具标识，默认 "main"
- `share_code` (String) - 分享码，唯一索引
- `source_default` (String) - 默认来源
- `is_active` (Boolean) - 是否激活
- `click_count` (Number) - 点击计数
- `created_at` (Date) - 创建时间
- `expires_at` (Date, 可选) - 过期时间

#### 2. referral_clicks（点击记录集合）
字段结构：
- `share_code` (String) - 分享码
- `source` (String, 可选) - 来源
- `ip_hash` (String, 可选) - IP哈希
- `user_agent_hash` (String, 可选) - User Agent哈希
- `landing_path` (String, 可选) - 落地页路径
- `created_at` (Date) - 创建时间
- `registered_user_id` (String, 可选) - 注册用户ID

#### 3. referral_relations（邀请关系集合）
字段结构：
- `inviter_user_id` (String) - 邀请人用户ID
- `invited_user_id` (String) - 被邀请人用户ID，唯一索引
- `share_code` (String) - 分享码
- `tool_slug` (String) - 工具标识
- `status` (String) - 状态，默认 "bound"
- `created_at` (Date) - 创建时间
- `activated_at` (Date) - 激活时间

#### 4. referral_rewards（奖励记录集合）
字段结构：
- `relation_id` (String) - 关系ID
- `user_id` (String) - 用户ID
- `reward_type` (String) - 奖励类型（signup_inviter/signup_invited）
- `amount` (Number) - 奖励天数
- `status` (String) - 状态，默认 "granted"
- `reference_id` (String) - 参考ID，唯一索引
- `created_at` (Date) - 创建时间
- `granted_at` (Date) - 发放时间

### 步骤 2：创建索引

在 CloudBase 控制台的「数据库」→「索引管理」中，为以下字段创建索引：

- `referral_links.share_code` - 唯一索引
- `referral_links.creator_user_id` - 普通索引
- `referral_clicks.share_code` - 普通索引
- `referral_relations.invited_user_id` - 唯一索引
- `referral_relations.inviter_user_id` - 普通索引
- `referral_rewards.user_id` - 普通索引
- `referral_rewards.reference_id` - 唯一索引

### 步骤 3：验证配置

确保 `.env.local` 中已配置 CloudBase：
```env
WECHAT_CLOUDBASE_ID=your_env_id
CLOUDBASE_SECRET_ID=your_secret_id
CLOUDBASE_SECRET_KEY=your_secret_key
```

---

## 国际版配置（Supabase）

如果遇到错误：`Could not find the table 'public.referral_links' in the schema cache`

这表示 Supabase 数据库中缺少邀请系统相关的表。需要运行迁移脚本创建这些表。

## 解决步骤

### 方法 1：在 Supabase 控制台运行 SQL（推荐）

1. **登录 Supabase 控制台**
   - 访问：https://app.supabase.com/
   - 选择你的项目

2. **打开 SQL Editor**
   - 点击左侧菜单的 "SQL Editor"
   - 点击 "New query"

3. **运行迁移脚本**
   - 复制 `supabase/migrations/20260306001_referrals_invite_points.sql` 文件的全部内容
   - 粘贴到 SQL Editor 中
   - 点击 "Run" 执行

4. **验证表是否创建成功**
   - 在左侧菜单点击 "Table Editor"
   - 应该能看到以下表：
     - `referral_links`
     - `referral_clicks`
     - `referral_relations`
     - `referral_rewards`

### 方法 2：使用 Supabase CLI（如果已安装）

```bash
# 确保已安装 Supabase CLI
npm install -g supabase

# 链接到你的项目
supabase link --project-ref YOUR_PROJECT_REF

# 运行迁移
supabase db push
```

## 表结构说明

### 1. referral_links（邀请链接表）
- 存储每个用户的邀请链接和分享码
- 字段：`id`, `creator_user_id`, `share_code`, `click_count` 等

### 2. referral_clicks（点击记录表）
- 记录每次点击邀请链接的行为
- 用于统计点击量

### 3. referral_relations（邀请关系表）
- 记录邀请关系：谁邀请了谁
- 用于发放奖励

### 4. referral_rewards（奖励记录表）
- 记录会员时长奖励明细
- `amount` 字段存储奖励的会员天数（不是积分）

## 环境变量配置

确保 `.env.local` 中已配置 Supabase 相关变量：

```env
# Supabase 配置（国内版也需要）
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 验证配置

运行迁移后，刷新邀请中心页面，应该不再出现表缺失的错误。

如果仍有问题，请检查：
1. Supabase 项目是否正确配置
2. 环境变量是否正确设置
3. 表是否成功创建（在 Supabase 控制台的 Table Editor 中查看）
