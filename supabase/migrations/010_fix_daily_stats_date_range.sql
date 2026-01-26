-- ============================================================================
-- 修复每日统计函数 - 确保返回完整的日期范围（包含今天）
-- ============================================================================

-- 更新 get_daily_active_users 函数，返回完整的日期范围
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
  WITH date_series AS (
    -- 生成完整的日期序列（从 p_days 天前到今天）
    SELECT generate_series(
      CURRENT_DATE - (p_days - 1),
      CURRENT_DATE,
      '1 day'::interval
    )::DATE as stat_date
  ),
  daily_stats AS (
    -- 计算每日统计数据
    SELECT
      DATE(ua.created_at) as stat_date,
      COUNT(DISTINCT ua.user_id) as active_users,
      COUNT(DISTINCT p.id) FILTER (WHERE DATE(p.created_at) = DATE(ua.created_at)) as new_users,
      COUNT(*) FILTER (WHERE ua.event_type = 'session_start') as sessions
    FROM public.user_analytics ua
    LEFT JOIN public.profiles p ON p.id = ua.user_id
    WHERE ua.created_at >= CURRENT_DATE - (p_days - 1)
      AND (p_source = 'all' OR ua.source = p_source)
    GROUP BY DATE(ua.created_at)
  )
  -- 左连接确保所有日期都返回，没有数据的日期填充0
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

-- 更新 get_daily_revenue 函数，返回完整的日期范围
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
  WITH date_series AS (
    -- 生成完整的日期序列（从 p_days 天前到今天）
    SELECT generate_series(
      CURRENT_DATE - (p_days - 1),
      CURRENT_DATE,
      '1 day'::interval
    )::DATE as stat_date
  ),
  daily_revenue AS (
    -- 计算每日收入数据
    SELECT
      DATE(paid_at) as stat_date,
      SUM(amount) as total_amount,
      COUNT(*) as order_count,
      COUNT(DISTINCT user_id) as paying_users
    FROM public.orders
    WHERE payment_status = 'paid'
      AND paid_at >= CURRENT_DATE - (p_days - 1)
      AND (p_source = 'all' OR source = p_source)
    GROUP BY DATE(paid_at)
  )
  -- 左连接确保所有日期都返回，没有数据的日期填充0
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
