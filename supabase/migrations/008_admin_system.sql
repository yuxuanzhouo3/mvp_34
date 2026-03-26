-- ============================================================================
-- MornClient 国际�?- 后台管理系统数据库迁�?-- 包含：admin_users、ads、social_links、releases、orders �?-- ============================================================================

-- ============================================================================
-- 1. 管理员用户表 (admin_users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin',                    -- admin, super_admin
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.admin_users IS '管理员用户表';

-- 创建默认管理员账�?(密码: Zyx!213416)
-- bcrypt hash for 'Zyx!213416'
INSERT INTO public.admin_users (username, password_hash, role)
VALUES (
  'mornclient',
  '$2b$10$6qAoU6mGtwkEEInWQ90tseT1Wvf.Am6h/42tayC5njjIwwAc5JSY.',
  'super_admin'
) ON CONFLICT (username) DO NOTHING;

-- ============================================================================
-- 2. 广告管理�?(ads)
-- 支持国内/国外分类，多平台安装包广告位
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 基本信息
  title TEXT NOT NULL,                          -- 广告标题
  description TEXT,                             -- 广告描述

  -- 媒体内容
  media_type TEXT NOT NULL DEFAULT 'image',     -- image, video
  media_url TEXT NOT NULL,                      -- 媒体URL
  thumbnail_url TEXT,                           -- 缩略图URL (视频�?

  -- 链接和行�?  link_url TEXT,                                -- 点击跳转链接
  link_type TEXT DEFAULT 'external',            -- external, internal, download

  -- 广告位置 (left, right, top, bottom)
  position TEXT NOT NULL DEFAULT 'bottom',

  -- 平台定向
  platform TEXT DEFAULT 'all',                  -- all, android, ios, windows, macos, linux

  -- 区域分类
  region TEXT NOT NULL DEFAULT 'global',        -- global(国外), cn(国内), all(全部)

  -- 状态和优先�?  status TEXT DEFAULT 'active',                 -- active, inactive, scheduled
  priority INTEGER DEFAULT 0,                   -- 优先级，数字越大越优�?
  -- 时间控制
  start_at TIMESTAMPTZ,                         -- 开始展示时�?  end_at TIMESTAMPTZ,                           -- 结束展示时间

  -- 统计
  impressions INTEGER DEFAULT 0,                -- 展示次数
  clicks INTEGER DEFAULT 0,                     -- 点击次数

  -- 时间�?  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.ads IS '广告管理�?- 支持国内外分类和多广告位';
COMMENT ON COLUMN public.ads.position IS '广告位置: left, right, top, bottom';
COMMENT ON COLUMN public.ads.region IS '区域: global=国外, cn=国内, all=全部';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ads_region ON public.ads(region);
CREATE INDEX IF NOT EXISTS idx_ads_position ON public.ads(position);
CREATE INDEX IF NOT EXISTS idx_ads_status ON public.ads(status);
CREATE INDEX IF NOT EXISTS idx_ads_platform ON public.ads(platform);

-- ============================================================================
-- 3. 社交链接�?(social_links)
-- 国内/国外分类同生态跳转链�?-- ============================================================================

CREATE TABLE IF NOT EXISTS public.social_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 基本信息
  name TEXT NOT NULL,                           -- 链接名称
  description TEXT,                             -- 描述

  -- 链接信息
  url TEXT NOT NULL,                            -- 跳转URL
  icon TEXT,                                    -- 图标 (URL或图标名)
  icon_type TEXT DEFAULT 'url',                 -- url, lucide, custom

  -- 平台类型
  platform_type TEXT NOT NULL,                  -- wechat, qq, weibo, twitter, facebook, instagram, youtube, tiktok, discord, telegram, github, website, other

  -- 区域分类
  region TEXT NOT NULL DEFAULT 'global',        -- global(国外), cn(国内)

  -- 状态和排序
  status TEXT DEFAULT 'active',                 -- active, inactive
  sort_order INTEGER DEFAULT 0,                 -- 排序顺序

  -- 时间�?  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.social_links IS '社交链接�?- 同生态跳转链�?;
COMMENT ON COLUMN public.social_links.region IS '区域: global=国外, cn=国内';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_social_links_region ON public.social_links(region);
CREATE INDEX IF NOT EXISTS idx_social_links_status ON public.social_links(status);
CREATE INDEX IF NOT EXISTS idx_social_links_platform_type ON public.social_links(platform_type);

-- ============================================================================
-- 4. 发布版本�?(releases)
-- 国内/国外分类发布软件的版本管�?-- ============================================================================

CREATE TABLE IF NOT EXISTS public.releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 版本信息
  version TEXT NOT NULL,                        -- 版本�?(�?1.0.0)
  version_code INTEGER NOT NULL,                -- 版本代码 (�?100)

  -- 基本信息
  title TEXT NOT NULL,                          -- 版本标题
  description TEXT,                             -- 版本描述/更新日志
  release_notes TEXT,                           -- 详细更新说明 (Markdown)

  -- 下载链接
  download_url TEXT,                            -- 主下载链�?  download_url_backup TEXT,                     -- 备用下载链接
  file_size BIGINT,                             -- 文件大小 (字节)
  file_hash TEXT,                               -- 文件哈希 (MD5/SHA256)

  -- 平台
  platform TEXT NOT NULL,                       -- android, ios, windows, macos, linux, harmonyos

  -- 区域分类
  region TEXT NOT NULL DEFAULT 'global',        -- global(国外), cn(国内)

  -- 状�?  status TEXT DEFAULT 'draft',                  -- draft, published, deprecated
  is_force_update BOOLEAN DEFAULT FALSE,        -- 是否强制更新
  min_supported_version TEXT,                   -- 最低支持版�?
  -- 发布时间
  published_at TIMESTAMPTZ,

  -- 时间�?  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.releases IS '发布版本�?- 软件版本管理';
COMMENT ON COLUMN public.releases.region IS '区域: global=国外, cn=国内';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_releases_region ON public.releases(region);
CREATE INDEX IF NOT EXISTS idx_releases_platform ON public.releases(platform);
CREATE INDEX IF NOT EXISTS idx_releases_status ON public.releases(status);
CREATE INDEX IF NOT EXISTS idx_releases_version_code ON public.releases(version_code DESC);

-- 唯一约束：同一区域、平台、版本号只能有一�?CREATE UNIQUE INDEX IF NOT EXISTS idx_releases_unique_version
  ON public.releases(region, platform, version);

-- ============================================================================
-- 5. 交易订单�?(orders)
-- 国内/国外分类详细订单，注重交易风控和溯源
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 订单�?  order_no TEXT UNIQUE NOT NULL,                -- 系统订单�?
  -- 用户信息
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,                              -- 用户邮箱 (冗余存储便于查询)

  -- 商品信息
  product_name TEXT NOT NULL,                   -- 商品名称
  product_type TEXT NOT NULL,                   -- subscription, one_time, upgrade
  plan TEXT,                                    -- Free, Pro, Team
  period TEXT,                                  -- monthly, yearly

  -- 金额信息
  amount NUMERIC(10,2) NOT NULL,                -- 订单金额
  currency TEXT DEFAULT 'USD',                  -- 货币: USD, CNY
  original_amount NUMERIC(10,2),                -- 原价
  discount_amount NUMERIC(10,2) DEFAULT 0,      -- 折扣金额

  -- 支付信息
  payment_method TEXT,                          -- stripe, paypal, wechat, alipay
  payment_status TEXT DEFAULT 'pending',        -- pending, paid, failed, refunded, cancelled
  paid_at TIMESTAMPTZ,                          -- 支付时间

  -- 第三方支付信�?  provider_order_id TEXT,                       -- 支付渠道订单�?  provider_transaction_id TEXT,                 -- 支付渠道交易�?
  -- 风控信息
  risk_score INTEGER DEFAULT 0,                 -- 风控评分 (0-100, 越高风险越大)
  risk_level TEXT DEFAULT 'low',                -- low, medium, high, blocked
  risk_factors JSONB DEFAULT '[]'::jsonb,       -- 风控因素列表
  ip_address TEXT,                              -- 下单IP
  device_fingerprint TEXT,                      -- 设备指纹
  user_agent TEXT,                              -- 用户代理

  -- 地理信息
  country TEXT,                                 -- 国家
  region_name TEXT,                             -- 地区
  city TEXT,                                    -- 城市

  -- 区域分类
  source TEXT NOT NULL DEFAULT 'global',        -- global(国外), cn(国内)

  -- 退款信�?  refund_status TEXT,                           -- none, partial, full
  refund_amount NUMERIC(10,2),
  refund_reason TEXT,
  refunded_at TIMESTAMPTZ,

  -- 备注
  notes TEXT,                                   -- 管理员备�?
  -- 时间�?  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.orders IS '交易订单�?- 注重风控和溯�?;
COMMENT ON COLUMN public.orders.risk_score IS '风控评分: 0-100, 越高风险越大';
COMMENT ON COLUMN public.orders.source IS '数据来源: global=国外, cn=国内';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_no ON public.orders(order_no);
CREATE INDEX IF NOT EXISTS idx_orders_source ON public.orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_risk_level ON public.orders(risk_level);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON public.orders(payment_method);

-- ============================================================================
-- 6. 更新触发�?-- ============================================================================

-- admin_users 更新触发�?DROP TRIGGER IF EXISTS update_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ads 更新触发�?DROP TRIGGER IF EXISTS update_ads_updated_at ON public.ads;
CREATE TRIGGER update_ads_updated_at
  BEFORE UPDATE ON public.ads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- social_links 更新触发�?DROP TRIGGER IF EXISTS update_social_links_updated_at ON public.social_links;
CREATE TRIGGER update_social_links_updated_at
  BEFORE UPDATE ON public.social_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- releases 更新触发�?DROP TRIGGER IF EXISTS update_releases_updated_at ON public.releases;
CREATE TRIGGER update_releases_updated_at
  BEFORE UPDATE ON public.releases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- orders 更新触发�?DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 7. 后台统计函数
-- ============================================================================

-- 获取数据统计概览
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats(
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
    -- 用户统计
    'users', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'today', COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE),
        'this_week', COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
        'this_month', COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days')
      )
      FROM public.profiles
      WHERE (p_source = 'all' OR source = p_source)
    ),
    -- 收入统计 (从 orders 表查询)
    'revenue', (
      SELECT jsonb_build_object(
        'total', COALESCE(SUM(amount), 0),
        'today', COALESCE(SUM(amount) FILTER (WHERE DATE(paid_at) = CURRENT_DATE), 0),
        'this_week', COALESCE(SUM(amount) FILTER (WHERE paid_at >= CURRENT_DATE - INTERVAL '7 days'), 0),
        'this_month', COALESCE(SUM(amount) FILTER (WHERE paid_at >= CURRENT_DATE - INTERVAL '30 days'), 0)
      )
      FROM public.orders
      WHERE payment_status = 'paid'
        AND (p_source = 'all' OR source = p_source)
    ),
    -- 订阅统计 (排除 Free 计划)
    'subscriptions', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'by_plan', (
          SELECT COALESCE(jsonb_object_agg(plan, cnt), '{}'::jsonb)
          FROM (
            SELECT plan, COUNT(*) as cnt
            FROM public.user_wallets
            WHERE (p_source = 'all' OR source = p_source)
              AND plan != 'Free'
            GROUP BY plan
          ) sub
        )
      )
      FROM public.user_wallets
      WHERE (p_source = 'all' OR source = p_source)
        AND plan != 'Free'
    ),
    -- 订单统计 (从 orders 表查询)
    'orders', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'today', COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE),
        'paid', COUNT(*) FILTER (WHERE payment_status = 'paid'),
        'pending', COUNT(*) FILTER (WHERE payment_status = 'pending'),
        'failed', COUNT(*) FILTER (WHERE payment_status = 'failed')
      )
      FROM public.orders
      WHERE (p_source = 'all' OR source = p_source)
    ),
    -- 设备统计
    'devices', (
      SELECT jsonb_build_object(
        'by_os', (
          SELECT COALESCE(jsonb_object_agg(os, cnt), '{}'::jsonb)
          FROM (
            SELECT COALESCE(os, 'Unknown') as os, COUNT(*) as cnt
            FROM public.user_analytics
            WHERE event_type = 'session_start'
              AND created_at >= v_start
              AND (p_source = 'all' OR source = p_source)
            GROUP BY os
            ORDER BY cnt DESC
            LIMIT 10
          ) sub
        ),
        'by_device_type', (
          SELECT COALESCE(jsonb_object_agg(device_type, cnt), '{}'::jsonb)
          FROM (
            SELECT COALESCE(device_type, 'Unknown') as device_type, COUNT(*) as cnt
            FROM public.user_analytics
            WHERE event_type = 'session_start'
              AND created_at >= v_start
              AND (p_source = 'all' OR source = p_source)
            GROUP BY device_type
          ) sub
        )
      )
    ),
    -- 查询参数
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

-- 获取每日活跃用户统计
CREATE OR REPLACE FUNCTION public.get_daily_active_users(
  p_source TEXT DEFAULT 'all',
  p_days INTEGER DEFAULT 30
) RETURNS TABLE (
  stat_date DATE,
  active_users BIGINT,
  new_users BIGINT,
  sessions BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(ua.created_at) as stat_date,
    COUNT(DISTINCT ua.user_id) as active_users,
    COUNT(DISTINCT p.id) FILTER (WHERE DATE(p.created_at) = DATE(ua.created_at)) as new_users,
    COUNT(*) FILTER (WHERE ua.event_type = 'session_start') as sessions
  FROM public.user_analytics ua
  LEFT JOIN public.profiles p ON p.id = ua.user_id
  WHERE ua.created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    AND (p_source = 'all' OR ua.source = p_source)
  GROUP BY DATE(ua.created_at)
  ORDER BY stat_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取每日收入统计 (从 orders 表查询)
CREATE OR REPLACE FUNCTION public.get_daily_revenue(
  p_source TEXT DEFAULT 'all',
  p_days INTEGER DEFAULT 30
) RETURNS TABLE (
  stat_date DATE,
  total_amount NUMERIC,
  order_count BIGINT,
  paying_users BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(paid_at) as stat_date,
    SUM(amount) as total_amount,
    COUNT(*) as order_count,
    COUNT(DISTINCT user_id) as paying_users
  FROM public.orders
  WHERE payment_status = 'paid'
    AND paid_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    AND (p_source = 'all' OR source = p_source)
  GROUP BY DATE(paid_at)
  ORDER BY stat_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. 权限设置
-- ============================================================================

-- 授权�?service_role (后台管理使用)
GRANT ALL PRIVILEGES ON public.admin_users TO postgres, service_role;
GRANT ALL PRIVILEGES ON public.ads TO postgres, service_role;
GRANT ALL PRIVILEGES ON public.social_links TO postgres, service_role;
GRANT ALL PRIVILEGES ON public.releases TO postgres, service_role;
GRANT ALL PRIVILEGES ON public.orders TO postgres, service_role;

-- 授权统计函数
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats TO service_role;
GRANT EXECUTE ON FUNCTION public.get_daily_active_users TO service_role;
GRANT EXECUTE ON FUNCTION public.get_daily_revenue TO service_role;

-- 撤销普通用户对管理表的访问
REVOKE ALL ON public.admin_users FROM anon, authenticated;
REVOKE ALL ON public.orders FROM anon, authenticated;

-- 广告和社交链接允许读�?(前端展示�?
GRANT SELECT ON public.ads TO anon, authenticated;
GRANT SELECT ON public.social_links TO anon, authenticated;
GRANT SELECT ON public.releases TO anon, authenticated;

-- RLS 策略
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 广告 RLS: 只允许查看激活的广告
DROP POLICY IF EXISTS "Public can view active ads" ON public.ads;
CREATE POLICY "Public can view active ads" ON public.ads
  FOR SELECT TO anon, authenticated
  USING (status = 'active' AND (start_at IS NULL OR start_at <= NOW()) AND (end_at IS NULL OR end_at >= NOW()));

-- 社交链接 RLS: 只允许查看激活的链接
DROP POLICY IF EXISTS "Public can view active social links" ON public.social_links;
CREATE POLICY "Public can view active social links" ON public.social_links
  FOR SELECT TO anon, authenticated
  USING (status = 'active');

-- 发布版本 RLS: 只允许查看已发布的版�?DROP POLICY IF EXISTS "Public can view published releases" ON public.releases;
CREATE POLICY "Public can view published releases" ON public.releases
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

-- Service role 完全访问
DROP POLICY IF EXISTS "Service role full access admin_users" ON public.admin_users;
CREATE POLICY "Service role full access admin_users" ON public.admin_users
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access ads" ON public.ads;
CREATE POLICY "Service role full access ads" ON public.ads
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access social_links" ON public.social_links;
CREATE POLICY "Service role full access social_links" ON public.social_links
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access releases" ON public.releases;
CREATE POLICY "Service role full access releases" ON public.releases
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access orders" ON public.orders;
CREATE POLICY "Service role full access orders" ON public.orders
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 9. 广告统计增量函数
-- ============================================================================

-- 原子性增加广告展�?点击次数
CREATE OR REPLACE FUNCTION public.increment_ad_stat(
  p_ad_id UUID,
  p_field TEXT
) RETURNS VOID AS $$
BEGIN
  IF p_field = 'impressions' THEN
    UPDATE public.ads SET impressions = impressions + 1 WHERE id = p_ad_id;
  ELSIF p_field = 'clicks' THEN
    UPDATE public.ads SET clicks = clicks + 1 WHERE id = p_ad_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授权
GRANT EXECUTE ON FUNCTION public.increment_ad_stat TO anon, authenticated, service_role;

-- ============================================================================
-- 10. 存储�?(Storage Buckets)
-- ============================================================================

-- 广告媒体存储�?INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ads',
  'ads',
  true,
  52428800,  -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm']
) ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 社交链接图标存储�?INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'icons',
  'icons',
  true,
  2097152,  -- 2MB
  ARRAY['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp', 'image/x-icon']
) ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 发布版本文件存储�?INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'releases',
  'releases',
  true,
  1073741824,  -- 1GB (安装包可能较�?
  ARRAY[
    'application/vnd.android.package-archive',  -- APK
    'application/x-msdownload',                  -- EXE
    'application/x-msi',                         -- MSI
    'application/x-apple-diskimage',             -- DMG
    'application/x-debian-package',              -- DEB
    'application/x-rpm',                         -- RPM
    'application/x-tar',                         -- TAR
    'application/gzip',                          -- GZ
    'application/zip',                           -- ZIP
    'application/octet-stream'                   -- 通用二进�?  ]
) ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- 11. 存储桶访问策�?-- ============================================================================

-- 广告存储桶策略：公开读取，仅 service_role 可写
DROP POLICY IF EXISTS "Public read ads" ON storage.objects;
CREATE POLICY "Public read ads" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'ads');

DROP POLICY IF EXISTS "Service role manage ads" ON storage.objects;
CREATE POLICY "Service role manage ads" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'ads')
  WITH CHECK (bucket_id = 'ads');

-- 图标存储桶策略：公开读取，仅 service_role 可写
DROP POLICY IF EXISTS "Public read icons" ON storage.objects;
CREATE POLICY "Public read icons" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'icons');

DROP POLICY IF EXISTS "Service role manage icons" ON storage.objects;
CREATE POLICY "Service role manage icons" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'icons')
  WITH CHECK (bucket_id = 'icons');

-- 发布版本存储桶策略：公开读取，仅 service_role 可写
DROP POLICY IF EXISTS "Public read releases" ON storage.objects;
CREATE POLICY "Public read releases" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'releases');

DROP POLICY IF EXISTS "Service role manage releases" ON storage.objects;
CREATE POLICY "Service role manage releases" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'releases')
  WITH CHECK (bucket_id = 'releases');

-- ============================================================================
-- 完成
-- ============================================================================
