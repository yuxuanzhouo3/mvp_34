-- 邀请好友 + 会员时长奖励 功能的数据库结构
-- ------------------------------------------------------------
-- 本文件只作为文档/迁移脚本备份，实际你已经在 Supabase 控制台执行过同样的 SQL。
-- 后续交接给别人时，可以直接把这份脚本作为“邀请会员时长模块”的说明。
--
-- 主要表说明：
-- 1) referral_links      每个用户的邀请链接（包含 share_code）
-- 2) referral_clicks     每次点击邀请链接的记录（点击统计用）
-- 3) referral_relations  邀请关系：谁邀请了谁（用于发放奖励）
-- 4) referral_rewards    奖励记录：给哪个用户发了多少天会员时长（amount 字段存储天数）
--
-- 奖励机制：
-- - 邀请人：默认获得 7 天会员时长（可通过环境变量 REFERRAL_INVITER_SIGNUP_BONUS_DAYS 调整）
-- - 被邀请人：默认获得 3 天会员时长（可通过环境变量 REFERRAL_INVITED_SIGNUP_BONUS_DAYS 调整）
-- - 奖励会直接延长 user_wallets 表的 plan_exp 字段（会员到期时间）
-- - 如果用户当前是 Free 计划，会自动升级到 Pro 计划
-- - referral_rewards 表用于统计累计奖励的天数（所有 amount 字段的总和）

-- 1. 邀请链接表
create table if not exists public.referral_links (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null,
  tool_slug text not null,
  share_code text not null unique,
  source_default text,
  is_active boolean not null default true,
  click_count bigint not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists idx_referral_links_creator_created
  on public.referral_links (creator_user_id, created_at desc);

create index if not exists idx_referral_links_share_active
  on public.referral_links (share_code, is_active);

-- 2. 点击记录表（每次有人点击邀请链接都会插一条）
create table if not exists public.referral_clicks (
  id uuid primary key default gen_random_uuid(),
  share_code text not null,
  source text,
  ip_hash text,
  user_agent_hash text,
  landing_path text,
  created_at timestamptz not null default now(),
  registered_user_id uuid
);

create index if not exists idx_referral_clicks_share_created
  on public.referral_clicks (share_code, created_at desc);

create index if not exists idx_referral_clicks_created
  on public.referral_clicks (created_at desc);

create index if not exists idx_referral_clicks_registered_user
  on public.referral_clicks (registered_user_id);

-- 3. 邀请关系表（一个受邀用户只会有一条记录）
create table if not exists public.referral_relations (
  id uuid primary key default gen_random_uuid(),
  inviter_user_id uuid not null,
  invited_user_id uuid not null,
  share_code text not null,
  tool_slug text,
  first_tool_id text,
  status text not null default 'bound',
  created_at timestamptz not null default now(),
  activated_at timestamptz
);

-- 每个受邀用户只能被一个人绑定
create unique index if not exists idx_referral_relations_invited_unique
  on public.referral_relations (invited_user_id);

-- 防止同一对 inviter/invited 重复插入
create unique index if not exists idx_referral_relations_pair_unique
  on public.referral_relations (inviter_user_id, invited_user_id);

create index if not exists idx_referral_relations_inviter_created
  on public.referral_relations (inviter_user_id, created_at desc);

create index if not exists idx_referral_relations_activated
  on public.referral_relations (activated_at desc);

-- 4. 奖励记录表（会员时长奖励明细）
-- amount 字段存储的是奖励的会员天数（不是积分）
create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  relation_id uuid references public.referral_relations (id) on delete set null,
  user_id uuid not null,
  reward_type text not null,
  amount integer not null check (amount > 0), -- 存储奖励的会员天数
  status text not null default 'granted',
  reference_id text not null unique,
  created_at timestamptz not null default now(),
  granted_at timestamptz
);

create index if not exists idx_referral_rewards_user_created
  on public.referral_rewards (user_id, created_at desc);

create index if not exists idx_referral_rewards_relation
  on public.referral_rewards (relation_id);

