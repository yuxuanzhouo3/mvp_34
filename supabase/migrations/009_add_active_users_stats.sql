-- ============================================================================
-- 修复后台统计函数 - 添加 DAU/WAU/MAU 活跃用户统计
-- ============================================================================

-- 更新 get_admin_dashboard_stats 函数，添加活跃用户统计
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
    -- 用户统计 (包含 DAU/WAU/MAU)
    'users', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'today', COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE),
        'this_week', COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
        'this_month', COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'),
        -- 活跃用户统计 (从 user_analytics 表查询唯一用户)
        'dau', (
          SELECT COUNT(DISTINCT user_id)
          FROM public.user_analytics
          WHERE DATE(created_at) = CURRENT_DATE
            AND (p_source = 'all' OR source = p_source)
        ),
        'wau', (
          SELECT COUNT(DISTINCT user_id)
          FROM public.user_analytics
          WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
            AND (p_source = 'all' OR source = p_source)
        ),
        'mau', (
          SELECT COUNT(DISTINCT user_id)
          FROM public.user_analytics
          WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
            AND (p_source = 'all' OR source = p_source)
        )
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

-- 确保函数权限
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats TO service_role;
