-- ============================================================================
-- 性能优化：为统计查询添加索引
-- ============================================================================
--
-- 问题：
-- 1. user_analytics表的查询非常慢（>3秒）
-- 2. 没有针对统计查询的索引
-- 3. 时间范围查询和事件类型过滤效率低
--
-- 解决方案：
-- 添加复合索引优化常见查询模式
-- ============================================================================

-- 1. 优化活跃用户统计（按日期+事件类型+来源）
CREATE INDEX IF NOT EXISTS idx_user_analytics_date_event_source
ON public.user_analytics (created_at, event_type, source)
WHERE event_type IN ('session_start', 'build_complete');

-- 2. 优化用户ID去重查询
CREATE INDEX IF NOT EXISTS idx_user_analytics_user_date
ON public.user_analytics (user_id, created_at);

-- 3. 优化设备统计查询
CREATE INDEX IF NOT EXISTS idx_user_analytics_device_stats
ON public.user_analytics (event_type, os, device_type, created_at)
WHERE event_type = 'session_start';

-- 4. 优化订单统计查询
CREATE INDEX IF NOT EXISTS idx_orders_paid_date_source
ON public.orders (payment_status, paid_at, source)
WHERE payment_status = 'paid';

-- 5. 优化用户创建时间查询
CREATE INDEX IF NOT EXISTS idx_profiles_created_source
ON public.profiles (created_at, source);

-- 添加注释
COMMENT ON INDEX idx_user_analytics_date_event_source IS
'优化活跃用户统计查询，支持按日期、事件类型和来源过滤';

COMMENT ON INDEX idx_user_analytics_user_date IS
'优化用户ID去重查询，加速DAU/WAU/MAU统计';

COMMENT ON INDEX idx_user_analytics_device_stats IS
'优化设备统计查询，支持按OS和设备类型分组';

COMMENT ON INDEX idx_orders_paid_date_source IS
'优化收入统计查询，支持按支付状态和日期过滤';

COMMENT ON INDEX idx_profiles_created_source IS
'优化新用户统计查询，支持按创建日期和来源过滤';
