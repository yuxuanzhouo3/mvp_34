-- ============================================================================
-- 统一时区计算和函数签名 - 修复DAU统计为0的问题
-- ============================================================================
--
-- 问题汇总：
-- 1. 013迁移中的时区转换逻辑错误：(CURRENT_TIMESTAMP AT TIME ZONE v_timezone)::DATE
--    正确应该是：(CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE
-- 2. 设备统计逻辑不一致：011使用COUNT(*)，013使用COUNT(DISTINCT user_id)
-- 3. 函数签名不匹配：011版本参数与013版本参数冲突
--
-- 解决方案：
-- 1. 修复时区转换逻辑，确保正确计算北京时间
-- 2. 统一使用COUNT(DISTINCT user_id)进行设备统计
-- 3. 确保所有函数使用p_timezone_offset参数
--
-- 统计语义说明：
-- - sessions字段统计的是"构建次数"（build_complete事件），而非"用户会话数"
-- - 设备统计使用session_start事件，统计打开应用的用户设备信息
-- ============================================================================

-- 删除旧版本函数
DROP FUNCTION IF EXISTS public.get_admin_dashboard_stats(TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS public.get_admin_dashboard_stats(TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.get_daily_active_users(TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.get_daily_revenue(TEXT, INTEGER);

-- ============================================================================
-- 修复 get_admin_dashboard_stats 函数
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats(
  p_source TEXT DEFAULT 'all',
  p_timezone_offset INTEGER DEFAULT 8
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_today DATE;
  v_week_ago DATE;
  v_month_ago DATE;
  v_timezone TEXT;
BEGIN
  -- 构造时区字符串
  v_timezone := CASE
    WHEN p_timezone_offset >= 0 THEN '+' || LPAD(p_timezone_offset::TEXT, 2, '0') || ':00'
    ELSE LPAD(p_timezone_offset::TEXT, 3, '0') || ':00'
  END;

  -- 修复：正确的时区转换逻辑
  -- 先将UTC时间转换为指定时区，再取日期部分
  v_today := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE;
  v_week_ago := v_today - INTERVAL '7 days';
  v_month_ago := v_today - INTERVAL '30 days';

  SELECT jsonb_build_object(
    'users', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'today', COUNT(*) FILTER (WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE = v_today),
        'this_week', COUNT(*) FILTER (WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE >= v_week_ago),
        'this_month', COUNT(*) FILTER (WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE >= v_month_ago),
        'dau', (
          SELECT COUNT(DISTINCT user_id)
          FROM public.user_analytics
          WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE = v_today
            AND (p_source = 'all' OR source = p_source)
        ),
        'wau', (
          SELECT COUNT(DISTINCT user_id)
          FROM public.user_analytics
          WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE >= v_week_ago
            AND (p_source = 'all' OR source = p_source)
        ),
        'mau', (
          SELECT COUNT(DISTINCT user_id)
          FROM public.user_analytics
          WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE >= v_month_ago
            AND (p_source = 'all' OR source = p_source)
        )
      )
      FROM public.profiles
      WHERE (p_source = 'all' OR source = p_source)
    ),
    'revenue', (
      SELECT jsonb_build_object(
        'total', COALESCE(SUM(amount), 0),
        'today', COALESCE(SUM(amount) FILTER (WHERE (paid_at AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE = v_today), 0),
        'this_week', COALESCE(SUM(amount) FILTER (WHERE (paid_at AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE >= v_week_ago), 0),
        'this_month', COALESCE(SUM(amount) FILTER (WHERE (paid_at AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE >= v_month_ago), 0)
      )
      FROM public.orders
      WHERE payment_status = 'paid'
        AND (p_source = 'all' OR source = p_source)
    ),
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
    'orders', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'today', COUNT(*) FILTER (WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE = v_today),
        'paid', COUNT(*) FILTER (WHERE payment_status = 'paid'),
        'pending', COUNT(*) FILTER (WHERE payment_status = 'pending'),
        'failed', COUNT(*) FILTER (WHERE payment_status = 'failed')
      )
      FROM public.orders
      WHERE (p_source = 'all' OR source = p_source)
    ),
    'devices', (
      SELECT jsonb_build_object(
        'by_os', (
          SELECT COALESCE(jsonb_object_agg(os, cnt), '{}'::jsonb)
          FROM (
            SELECT COALESCE(os, 'Unknown') as os, COUNT(DISTINCT user_id) as cnt
            FROM public.user_analytics
            WHERE event_type = 'session_start'
              AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE >= v_month_ago
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
              AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE >= v_month_ago
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

-- ============================================================================
-- 修复 get_daily_active_users 函数
-- ============================================================================
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

  -- 修复：正确的时区转换逻辑
  v_today := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE;
  v_start_date := v_today - (p_days - 1);

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(v_start_date, v_today, '1 day'::interval)::DATE as stat_date
  ),
  daily_stats AS (
    SELECT
      (ua.created_at AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE as stat_date,
      COUNT(DISTINCT ua.user_id) as active_users,
      COUNT(DISTINCT p.id) FILTER (WHERE (p.created_at AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE = (ua.created_at AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE) as new_users,
      COUNT(*) FILTER (WHERE ua.event_type = 'build_complete') as sessions
    FROM public.user_analytics ua
    LEFT JOIN public.profiles p ON p.id = ua.user_id
    WHERE (ua.created_at AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE >= v_start_date
      AND (p_source = 'all' OR ua.source = p_source)
    GROUP BY (ua.created_at AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE
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

-- ============================================================================
-- 修复 get_daily_revenue 函数
-- ============================================================================
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

  -- 修复：正确的时区转换逻辑
  v_today := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE;
  v_start_date := v_today - (p_days - 1);

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(v_start_date, v_today, '1 day'::interval)::DATE as stat_date
  ),
  daily_revenue AS (
    SELECT
      (paid_at AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE as stat_date,
      SUM(amount) as total_amount,
      COUNT(*) as order_count,
      COUNT(DISTINCT user_id) as paying_users
    FROM public.orders
    WHERE payment_status = 'paid'
      AND (paid_at AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE >= v_start_date
      AND (p_source = 'all' OR source = p_source)
    GROUP BY (paid_at AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE
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
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats TO service_role;
GRANT EXECUTE ON FUNCTION public.get_daily_active_users TO service_role;
GRANT EXECUTE ON FUNCTION public.get_daily_revenue TO service_role;

-- ============================================================================
-- 修复说明
-- ============================================================================
--
-- 1. 时区转换修复：
--    错误：(CURRENT_TIMESTAMP AT TIME ZONE v_timezone)::DATE
--    正确：(CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE
--
--    原因：PostgreSQL的AT TIME ZONE操作符需要明确指定源时区
--    - 第一个AT TIME ZONE 'UTC'：将TIMESTAMP WITH TIME ZONE转换为UTC的TIMESTAMP WITHOUT TIME ZONE
--    - 第二个AT TIME ZONE v_timezone：将UTC时间转换为目标时区的时间
--
-- 2. 事件类型说明：
--    - sessions字段：统计build_complete事件（构建次数），而非用户会话数
--    - 设备统计：使用session_start事件（用户打开应用）
--    - 业务语义：sessions实际反映的是"构建活跃度"而非"会话活跃度"
--
-- 3. 设备统计修复：
--    - 统一使用COUNT(DISTINCT user_id)避免重复计算
--
-- 4. 函数签名统一：
--    - 所有统计函数都接受p_timezone_offset参数
--    - 默认值为8（北京时间UTC+8）
--
-- ============================================================================
