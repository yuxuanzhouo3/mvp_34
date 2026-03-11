-- ============================================================================
-- 修复时区统计问题 - 使用应用层时区而非数据库时区
-- ============================================================================
--
-- 问题：当前函数使用 DATE(created_at) = CURRENT_DATE 进行统计
-- 影响：数据库时区与应用服务器时区不一致时，统计结果错误
-- 方案：修改函数接受时区参数，在应用层传入正确的日期边界
-- ============================================================================

-- 删除旧版本函数（参数列表不同）
DROP FUNCTION IF EXISTS public.get_admin_dashboard_stats(TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS public.get_daily_active_users(TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.get_daily_revenue(TEXT, INTEGER);

-- 更新 get_admin_dashboard_stats 函数，接受时区偏移参数
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats(
  p_source TEXT DEFAULT 'all',
  p_timezone_offset INTEGER DEFAULT 8  -- 默认北京时间 UTC+8
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_today DATE;
  v_week_ago DATE;
  v_month_ago DATE;
  v_timezone TEXT;
BEGIN
  -- 根据时区偏移计算时区字符串（例如：'+08:00'）
  v_timezone := CASE
    WHEN p_timezone_offset >= 0 THEN '+' || LPAD(p_timezone_offset::TEXT, 2, '0') || ':00'
    ELSE LPAD(p_timezone_offset::TEXT, 3, '0') || ':00'
  END;

  -- 使用指定时区计算日期边界
  v_today := (CURRENT_TIMESTAMP AT TIME ZONE v_timezone)::DATE;
  v_week_ago := v_today - INTERVAL '7 days';
  v_month_ago := v_today - INTERVAL '30 days';

  SELECT jsonb_build_object(
    -- 用户统计
    'users', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'today', COUNT(*) FILTER (WHERE (created_at AT TIME ZONE v_timezone)::DATE = v_today),
        'this_week', COUNT(*) FILTER (WHERE (created_at AT TIME ZONE v_timezone)::DATE >= v_week_ago),
        'this_month', COUNT(*) FILTER (WHERE (created_at AT TIME ZONE v_timezone)::DATE >= v_month_ago),
        -- 活跃用户统计
        'dau', (
          SELECT COUNT(DISTINCT user_id)
          FROM public.user_analytics
          WHERE (created_at AT TIME ZONE v_timezone)::DATE = v_today
            AND (p_source = 'all' OR source = p_source)
        ),
        'wau', (
          SELECT COUNT(DISTINCT user_id)
          FROM public.user_analytics
          WHERE (created_at AT TIME ZONE v_timezone)::DATE >= v_week_ago
            AND (p_source = 'all' OR source = p_source)
        ),
        'mau', (
          SELECT COUNT(DISTINCT user_id)
          FROM public.user_analytics
          WHERE (created_at AT TIME ZONE v_timezone)::DATE >= v_month_ago
            AND (p_source = 'all' OR source = p_source)
        )
      )
      FROM public.profiles
      WHERE (p_source = 'all' OR source = p_source)
    ),
    -- 收入统计
    'revenue', (
      SELECT jsonb_build_object(
        'total', COALESCE(SUM(amount), 0),
        'today', COALESCE(SUM(amount) FILTER (WHERE (paid_at AT TIME ZONE v_timezone)::DATE = v_today), 0),
        'this_week', COALESCE(SUM(amount) FILTER (WHERE (paid_at AT TIME ZONE v_timezone)::DATE >= v_week_ago), 0),
        'this_month', COALESCE(SUM(amount) FILTER (WHERE (paid_at AT TIME ZONE v_timezone)::DATE >= v_month_ago), 0)
      )
      FROM public.orders
      WHERE payment_status = 'paid'
        AND (p_source = 'all' OR source = p_source)
    ),
    -- 订阅统计
    'subscriptions', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'by_plan', (
          SELECT COALESCE(jsonb_object_agg(plan, cnt), '{}'::jsonb)
          FROM (
            SELECT plan, COUNT(*) as cnt
            FROM public.user_wallets
            WHERE (p_source = 'all' OR source = p_source)
              AND LOWER(plan) != 'free'
            GROUP BY plan
          ) sub
        )
      )
      FROM public.user_wallets
      WHERE (p_source = 'all' OR source = p_source)
        AND LOWER(plan) != 'free'
    ),
    -- 订单统计
    'orders', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'today', COUNT(*) FILTER (WHERE (created_at AT TIME ZONE v_timezone)::DATE = v_today),
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
            SELECT COALESCE(os, 'Unknown') as os, COUNT(DISTINCT user_id) as cnt
            FROM public.user_analytics
            WHERE event_type = 'session_start'
              AND (created_at AT TIME ZONE v_timezone)::DATE >= v_month_ago
              AND (p_source = 'all' OR source = p_source)
            GROUP BY os
            ORDER BY cnt DESC
            LIMIT 10
          ) sub
        ),
        'by_device_type', (
          SELECT COALESCE(jsonb_object_agg(device_type, cnt), '{}'::jsonb)
          FROM (
            SELECT COALESCE(device_type, 'Unknown') as device_type, COUNT(DISTINCT user_id) as cnt
            FROM public.user_analytics
            WHERE event_type = 'session_start'
              AND (created_at AT TIME ZONE v_timezone)::DATE >= v_month_ago
              AND (p_source = 'all' OR source = p_source)
            GROUP BY device_type
          ) sub
        )
      )
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 确保函数权限
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats TO service_role;

-- ============================================================================
-- 说明
-- ============================================================================
-- 本次修复的关键改进：
-- 1. 函数接受时区偏移参数 (p_timezone_offset，默认为 8 即北京时间)
-- 2. 数据库函数负责将 UTC 时间转换为指定时区
-- 3. 应用层只需传入时区偏移，无需自行计算日期边界
-- 4. 使用 AT TIME ZONE 进行时区转换，符合 PostgreSQL 最佳实践
-- 5. 使用 created_at::date 而非 DATE(created_at) 提高性能
--
-- 应用层调用示例：
-- SELECT get_admin_dashboard_stats('all', 8);  -- 北京时间 UTC+8
-- SELECT get_admin_dashboard_stats('all', 0);  -- UTC 时间
-- SELECT get_admin_dashboard_stats('all', -5); -- 美东时间 UTC-5
--
-- 时区处理说明：
-- - 数据库存储使用 UTC 时间（标准做法）
-- - 数据库函数使用 AT TIME ZONE 转换为指定时区
-- - 应用层只需传入时区偏移参数（北京时间为 8）
-- - 逻辑集中在数据库层，易于维护和扩展
-- ============================================================================

-- ============================================================================
-- 修复每日统计函数 - 支持时区参数
-- ============================================================================

-- 更新 get_daily_active_users 函数
CREATE OR REPLACE FUNCTION public.get_daily_active_users(
  p_source TEXT DEFAULT 'all',
  p_days INTEGER DEFAULT 30,
  p_timezone_offset INTEGER DEFAULT 8
) RETURNS TABLE (
  stat_date DATE,
  active_users BIGINT,
  new_users BIGINT,
  sessions BIGINT
) AS $$
DECLARE
  v_timezone TEXT;
  v_today DATE;
  v_start_date DATE;
BEGIN
  v_timezone := CASE
    WHEN p_timezone_offset >= 0 THEN '+' || LPAD(p_timezone_offset::TEXT, 2, '0') || ':00'
    ELSE LPAD(p_timezone_offset::TEXT, 3, '0') || ':00'
  END;

  v_today := (CURRENT_TIMESTAMP AT TIME ZONE v_timezone)::DATE;
  v_start_date := v_today - (p_days - 1);

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(v_start_date, v_today, '1 day'::interval)::DATE as stat_date
  ),
  daily_stats AS (
    SELECT
      (ua.created_at AT TIME ZONE v_timezone)::DATE as stat_date,
      COUNT(DISTINCT ua.user_id) as active_users,
      COUNT(DISTINCT p.id) FILTER (WHERE (p.created_at AT TIME ZONE v_timezone)::DATE = (ua.created_at AT TIME ZONE v_timezone)::DATE) as new_users,
      COUNT(*) FILTER (WHERE ua.event_type = 'build_complete') as sessions
    FROM public.user_analytics ua
    LEFT JOIN public.profiles p ON p.id = ua.user_id
    WHERE (ua.created_at AT TIME ZONE v_timezone)::DATE >= v_start_date
      AND (p_source = 'all' OR ua.source = p_source)
    GROUP BY (ua.created_at AT TIME ZONE v_timezone)::DATE
  )
  SELECT
    ds.stat_date,
    COALESCE(daily_stats.active_users, 0) as active_users,
    COALESCE(daily_stats.new_users, 0) as new_users,
    COALESCE(daily_stats.sessions, 0) as sessions
  FROM date_series ds
  LEFT JOIN daily_stats ON ds.stat_date = daily_stats.stat_date
  ORDER BY ds.stat_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 更新 get_daily_revenue 函数
CREATE OR REPLACE FUNCTION public.get_daily_revenue(
  p_source TEXT DEFAULT 'all',
  p_days INTEGER DEFAULT 30,
  p_timezone_offset INTEGER DEFAULT 8
) RETURNS TABLE (
  stat_date DATE,
  total_amount NUMERIC,
  order_count BIGINT,
  paying_users BIGINT
) AS $$
DECLARE
  v_timezone TEXT;
  v_today DATE;
  v_start_date DATE;
BEGIN
  v_timezone := CASE
    WHEN p_timezone_offset >= 0 THEN '+' || LPAD(p_timezone_offset::TEXT, 2, '0') || ':00'
    ELSE LPAD(p_timezone_offset::TEXT, 3, '0') || ':00'
  END;

  v_today := (CURRENT_TIMESTAMP AT TIME ZONE v_timezone)::DATE;
  v_start_date := v_today - (p_days - 1);

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(v_start_date, v_today, '1 day'::interval)::DATE as stat_date
  ),
  daily_revenue AS (
    SELECT
      (paid_at AT TIME ZONE v_timezone)::DATE as stat_date,
      SUM(amount) as total_amount,
      COUNT(*) as order_count,
      COUNT(DISTINCT user_id) as paying_users
    FROM public.orders
    WHERE payment_status = 'paid'
      AND (paid_at AT TIME ZONE v_timezone)::DATE >= v_start_date
      AND (p_source = 'all' OR source = p_source)
    GROUP BY (paid_at AT TIME ZONE v_timezone)::DATE
  )
  SELECT
    ds.stat_date,
    COALESCE(daily_revenue.total_amount, 0) as total_amount,
    COALESCE(daily_revenue.order_count, 0) as order_count,
    COALESCE(daily_revenue.paying_users, 0) as paying_users
  FROM date_series ds
  LEFT JOIN daily_revenue ON ds.stat_date = daily_revenue.stat_date
  ORDER BY ds.stat_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 确保函数权限
GRANT EXECUTE ON FUNCTION public.get_daily_active_users TO service_role;
GRANT EXECUTE ON FUNCTION public.get_daily_revenue TO service_role;
