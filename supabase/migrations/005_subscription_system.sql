-- ============================================================================
-- MornClient 国际版 - 订阅系统数据库迁移
-- 包含：user_wallets、subscriptions、payments、user_analytics 表
-- ============================================================================

-- ============================================================================
-- 1. 用户钱包表 (user_wallets)
-- 存储用户订阅状态、额度信息
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 订阅状态
  plan TEXT DEFAULT 'Free',                    -- 当前套餐: Free, Pro, Team
  plan_exp TIMESTAMPTZ,                        -- 套餐到期时间
  pending_downgrade JSONB,                     -- 待生效降级队列: [{targetPlan, effectiveAt}, ...]

  -- 每日构建额度
  daily_builds_limit INTEGER DEFAULT 5,        -- 每日构建上限 (Free:5, Pro:50, Team:500)
  daily_builds_used INTEGER DEFAULT 0,         -- 今日已用构建次数
  daily_builds_reset_at DATE DEFAULT CURRENT_DATE, -- 每日额度重置日期

  -- 文件保留天数 (根据套餐自动设置)
  file_retention_days INTEGER DEFAULT 3,       -- Free:3, Pro:14, Team:90

  -- 分享功能
  share_enabled BOOLEAN DEFAULT FALSE,         -- 是否启用自定义分享
  share_duration_days INTEGER DEFAULT 0,       -- 分享链接有效天数 (Pro:7, Team:30)

  -- 批量构建
  batch_build_enabled BOOLEAN DEFAULT FALSE,   -- 是否启用批量构建

  -- 账单周期锚点 (防止日期漂移)
  billing_cycle_anchor INTEGER,                -- 账单日 (1-31)

  -- 数据来源标识 (区分国内外版本)
  source TEXT DEFAULT 'global',                -- 'global' = 国际版, 'cn' = 国内版

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添加表注释
COMMENT ON TABLE public.user_wallets IS '用户钱包表 - 存储订阅状态和额度信息';
COMMENT ON COLUMN public.user_wallets.plan IS '当前套餐: Free, Pro, Team';
COMMENT ON COLUMN public.user_wallets.pending_downgrade IS '待生效降级队列，jsonb格式';
COMMENT ON COLUMN public.user_wallets.source IS '数据来源: global=国际版, cn=国内版';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_wallets_plan ON public.user_wallets(plan);
CREATE INDEX IF NOT EXISTS idx_user_wallets_source ON public.user_wallets(source);
CREATE INDEX IF NOT EXISTS idx_user_wallets_plan_exp ON public.user_wallets(plan_exp);

-- RLS策略
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wallet" ON public.user_wallets;
CREATE POLICY "Users can view own wallet" ON public.user_wallets
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- 2. 订阅记录表 (subscriptions)
-- 存储订阅历史和当前订阅状态
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 订阅信息
  plan TEXT NOT NULL,                          -- 套餐: Free, Pro, Team
  period TEXT NOT NULL,                        -- 周期: monthly, yearly
  status TEXT NOT NULL DEFAULT 'active',       -- 状态: active, expired, cancelled, pending
  type TEXT DEFAULT 'SUBSCRIPTION',            -- 类型: SUBSCRIPTION, UPGRADE, DOWNGRADE, RENEWAL

  -- 支付信息
  provider TEXT,                               -- 支付渠道: stripe, paypal
  provider_order_id TEXT,                      -- 支付渠道订单号
  amount NUMERIC(10,2),                        -- 支付金额
  currency TEXT DEFAULT 'USD',                 -- 货币: USD, CNY

  -- 时间信息
  started_at TIMESTAMPTZ DEFAULT NOW(),        -- 订阅开始时间
  expires_at TIMESTAMPTZ,                      -- 订阅到期时间

  -- 数据来源
  source TEXT DEFAULT 'global',

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 唯一约束 (每个用户只有一个活跃订阅)
  CONSTRAINT subscriptions_user_id_key UNIQUE (user_id)
);

-- 添加表注释
COMMENT ON TABLE public.subscriptions IS '订阅记录表 - 存储用户订阅历史';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON public.subscriptions(plan);
CREATE INDEX IF NOT EXISTS idx_subscriptions_source ON public.subscriptions(source);

-- RLS策略
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- 3. 支付记录表 (payments)
-- 存储所有支付交易记录
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 支付信息
  amount NUMERIC(10,2) NOT NULL,               -- 支付金额
  currency TEXT DEFAULT 'USD',                 -- 货币
  status TEXT NOT NULL,                        -- 状态: pending, success, failed, refunded
  type TEXT NOT NULL,                          -- 类型: subscription, upgrade, renewal

  -- 支付渠道
  provider TEXT,                               -- stripe, paypal, alipay, wechat
  provider_order_id TEXT,                      -- 渠道订单号
  provider_transaction_id TEXT,                -- 渠道交易号

  -- 关联信息
  subscription_id UUID REFERENCES public.subscriptions(id),
  plan TEXT,                                   -- 购买的套餐
  period TEXT,                                 -- 购买的周期

  -- 数据来源
  source TEXT DEFAULT 'global',

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添加表注释
COMMENT ON TABLE public.payments IS '支付记录表 - 存储所有支付交易';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON public.payments(provider);
CREATE INDEX IF NOT EXISTS idx_payments_source ON public.payments(source);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);

-- RLS策略
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- 4. 用户分析表 (user_analytics)
-- 记录用户行为、设备信息等埋点数据
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 来源标识
  source TEXT NOT NULL DEFAULT 'global',       -- 'global' = 国际版, 'cn' = 国内版

  -- 设备信息
  device_type TEXT,                            -- 'desktop', 'mobile', 'tablet'
  os TEXT,                                     -- 'Windows', 'macOS', 'iOS', 'Android', 'Linux'
  browser TEXT,                                -- 'Chrome', 'Safari', 'Firefox', 'Edge'
  app_version TEXT,                            -- 客户端版本号
  screen_resolution TEXT,                      -- 屏幕分辨率
  language TEXT,                               -- 浏览器语言

  -- 地理信息
  country TEXT,                                -- 国家代码
  region TEXT,                                 -- 地区/省份
  city TEXT,                                   -- 城市

  -- 事件信息
  event_type TEXT NOT NULL,                    -- 事件类型
  -- 'session_start'    - 会话开始
  -- 'session_end'      - 会话结束
  -- 'page_view'        - 页面访问
  -- 'build_start'      - 开始构建
  -- 'build_complete'   - 构建完成
  -- 'build_download'   - 下载构建
  -- 'payment'          - 支付行为
  -- 'subscription'     - 订阅变更
  -- 'error'            - 错误上报

  event_data JSONB DEFAULT '{}'::jsonb,        -- 事件详细数据
  session_id TEXT,                             -- 会话ID
  referrer TEXT,                               -- 来源页面

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添加表注释
COMMENT ON TABLE public.user_analytics IS '用户行为分析表 - 记录用户访问、活动、设备信息';
COMMENT ON COLUMN public.user_analytics.event_type IS '事件类型: session_start/page_view/build_start/build_complete/payment/subscription/error';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_analytics_source_time ON public.user_analytics(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_user_time ON public.user_analytics(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_event_time ON public.user_analytics(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_device ON public.user_analytics(device_type, os);
CREATE INDEX IF NOT EXISTS idx_analytics_created_source ON public.user_analytics(created_at, source);

-- RLS策略
ALTER TABLE public.user_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own analytics" ON public.user_analytics;
CREATE POLICY "Users can view own analytics" ON public.user_analytics
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access analytics" ON public.user_analytics;
CREATE POLICY "Service role full access analytics" ON public.user_analytics
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 5. 为 profiles 表添加 source 字段
-- ============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'global';

COMMENT ON COLUMN public.profiles.source IS '数据来源: global=国际版, cn=国内版';

-- ============================================================================
-- 6. 为 builds 表添加统计字段
-- ============================================================================

ALTER TABLE public.builds
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'global',
ADD COLUMN IF NOT EXISTS build_duration_ms INTEGER,      -- 构建耗时(毫秒)
ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0; -- 下载次数

COMMENT ON COLUMN public.builds.source IS '数据来源: global=国际版, cn=国内版';
COMMENT ON COLUMN public.builds.build_duration_ms IS '构建耗时(毫秒)';
COMMENT ON COLUMN public.builds.download_count IS '下载次数';

-- ============================================================================
-- 7. 更新 handle_new_user 触发器函数
-- 新用户注册时自动创建 user_wallets 记录
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. 插入 Profile 记录
  INSERT INTO public.profiles (id, email, name, avatar, source)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    'global'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    avatar = COALESCE(NULLIF(EXCLUDED.avatar, ''), public.profiles.avatar),
    updated_at = NOW();

  -- 2. 插入 User Wallet 记录 (Free 套餐默认值)
  INSERT INTO public.user_wallets (
    user_id,
    plan,
    daily_builds_limit,
    daily_builds_used,
    file_retention_days,
    share_enabled,
    share_duration_days,
    batch_build_enabled,
    source
  )
  VALUES (
    NEW.id,
    'Free',
    5,      -- Free: 5次/天
    0,
    3,      -- Free: 3天保留
    FALSE,  -- Free: 无自定义分享
    0,
    FALSE,  -- Free: 无批量构建
    'global'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Handle new user trigger failed: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 8. 每日构建额度重置函数 (RPC)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reset_daily_builds_if_needed(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_wallet public.user_wallets%ROWTYPE;
BEGIN
  SELECT * INTO v_wallet FROM public.user_wallets WHERE user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- 检查是否需要重置 (日期变更)
  IF v_wallet.daily_builds_reset_at < CURRENT_DATE THEN
    UPDATE public.user_wallets
    SET
      daily_builds_used = 0,
      daily_builds_reset_at = CURRENT_DATE,
      updated_at = NOW()
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'reset', true,
      'daily_builds_limit', v_wallet.daily_builds_limit
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'reset', false,
    'daily_builds_used', v_wallet.daily_builds_used,
    'daily_builds_limit', v_wallet.daily_builds_limit
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 9. 构建额度扣减函数 (RPC) - 原子操作防止并发问题
-- ============================================================================

CREATE OR REPLACE FUNCTION public.deduct_build_quota(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_wallet public.user_wallets%ROWTYPE;
BEGIN
  -- 锁定行防止并发
  SELECT * INTO v_wallet FROM public.user_wallets WHERE user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- 检查是否需要重置每日额度
  IF v_wallet.daily_builds_reset_at < CURRENT_DATE THEN
    UPDATE public.user_wallets
    SET
      daily_builds_used = 0,
      daily_builds_reset_at = CURRENT_DATE
    WHERE user_id = p_user_id;

    v_wallet.daily_builds_used := 0;
  END IF;

  -- 检查额度是否足够
  IF v_wallet.daily_builds_used >= v_wallet.daily_builds_limit THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Daily build limit exceeded',
      'daily_builds_used', v_wallet.daily_builds_used,
      'daily_builds_limit', v_wallet.daily_builds_limit
    );
  END IF;

  -- 扣减额度
  UPDATE public.user_wallets
  SET
    daily_builds_used = daily_builds_used + 1,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'daily_builds_used', v_wallet.daily_builds_used + 1,
    'daily_builds_limit', v_wallet.daily_builds_limit,
    'remaining', v_wallet.daily_builds_limit - v_wallet.daily_builds_used - 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. 统计视图 (后台管理用)
-- ============================================================================

-- 每日用户统计视图
CREATE OR REPLACE VIEW public.v_daily_user_stats AS
SELECT
  DATE(created_at) as stat_date,
  source,
  COUNT(DISTINCT user_id) as active_users,
  COUNT(*) FILTER (WHERE event_type = 'session_start') as sessions,
  COUNT(*) FILTER (WHERE event_type = 'page_view') as page_views,
  COUNT(*) FILTER (WHERE event_type = 'build_start') as builds_started,
  COUNT(*) FILTER (WHERE event_type = 'build_complete') as builds_completed
FROM public.user_analytics
GROUP BY DATE(created_at), source
ORDER BY stat_date DESC;

-- 付费统计视图
CREATE OR REPLACE VIEW public.v_payment_stats AS
SELECT
  source,
  DATE(created_at) as stat_date,
  COUNT(*) as payment_count,
  COUNT(DISTINCT user_id) as paying_users,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount,
  currency
FROM public.payments
WHERE status = 'success'
GROUP BY source, DATE(created_at), currency
ORDER BY stat_date DESC;

-- 订阅分布视图
CREATE OR REPLACE VIEW public.v_subscription_stats AS
SELECT
  source,
  plan,
  COUNT(*) as user_count,
  COUNT(*) FILTER (WHERE status = 'active') as active_count
FROM public.subscriptions
GROUP BY source, plan
ORDER BY plan;

-- ============================================================================
-- 11. 后台统计函数 (RPC)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_stats(
  p_source TEXT DEFAULT 'all',
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_start DATE;
  v_end DATE;
BEGIN
  v_start := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
  v_end := COALESCE(p_end_date, CURRENT_DATE);

  SELECT jsonb_build_object(
    'users', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'new_today', COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE),
        'new_this_week', COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
        'new_this_month', COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days')
      )
      FROM public.profiles
      WHERE (p_source = 'all' OR source = p_source)
    ),
    'payments', (
      SELECT jsonb_build_object(
        'total_amount', COALESCE(SUM(amount), 0),
        'total_count', COUNT(*),
        'paying_users', COUNT(DISTINCT user_id),
        'today_amount', COALESCE(SUM(amount) FILTER (WHERE DATE(created_at) = CURRENT_DATE), 0)
      )
      FROM public.payments
      WHERE status = 'success'
        AND (p_source = 'all' OR source = p_source)
    ),
    'subscriptions', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'active', COUNT(*) FILTER (WHERE status = 'active'),
        'by_plan', (
          SELECT jsonb_object_agg(plan, cnt)
          FROM (
            SELECT plan, COUNT(*) as cnt
            FROM public.user_wallets
            WHERE (p_source = 'all' OR source = p_source)
            GROUP BY plan
          ) sub
        )
      )
      FROM public.subscriptions
      WHERE (p_source = 'all' OR source = p_source)
    ),
    'builds', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'today', COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE),
        'completed', COUNT(*) FILTER (WHERE status = 'completed'),
        'failed', COUNT(*) FILTER (WHERE status = 'failed')
      )
      FROM public.builds
      WHERE (p_source = 'all' OR source = p_source)
    ),
    'query_params', jsonb_build_object(
      'source', p_source,
      'start_date', v_start,
      'end_date', v_end,
      'generated_at', NOW()
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 12. 权限设置
-- ============================================================================

-- 授权给 service_role
GRANT ALL PRIVILEGES ON public.user_wallets TO postgres, service_role;
GRANT ALL PRIVILEGES ON public.subscriptions TO postgres, service_role;
GRANT ALL PRIVILEGES ON public.payments TO postgres, service_role;
GRANT ALL PRIVILEGES ON public.user_analytics TO postgres, service_role;

-- 授权视图访问 (仅后台)
GRANT SELECT ON public.v_daily_user_stats TO postgres, service_role;
GRANT SELECT ON public.v_payment_stats TO postgres, service_role;
GRANT SELECT ON public.v_subscription_stats TO postgres, service_role;

-- 撤销普通用户对统计视图的访问
REVOKE ALL ON public.v_daily_user_stats FROM anon, authenticated;
REVOKE ALL ON public.v_payment_stats FROM anon, authenticated;
REVOKE ALL ON public.v_subscription_stats FROM anon, authenticated;

-- 授权 RPC 函数
GRANT EXECUTE ON FUNCTION public.reset_daily_builds_if_needed TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_build_quota TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_stats TO service_role;

-- 撤销普通用户对统计函数的访问
REVOKE EXECUTE ON FUNCTION public.get_admin_stats FROM anon, authenticated;

-- ============================================================================
-- 完成
-- ============================================================================
