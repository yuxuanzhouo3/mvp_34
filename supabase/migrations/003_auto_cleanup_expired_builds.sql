-- ============================================================================
-- 自动清理过期构建记录
-- 方式1: 使用 pg_cron 扩展（需要在 Supabase Dashboard 启用）
-- 方式2: 手动执行清理函数
-- ============================================================================

-- 创建清理函数
CREATE OR REPLACE FUNCTION public.cleanup_expired_builds()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- 删除已过期的构建记录
  WITH deleted AS (
    DELETE FROM public.builds
    WHERE expires_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 如果你的 Supabase 项目启用了 pg_cron 扩展，可以使用以下命令设置定时任务
-- 每天凌晨 3:00 执行清理
-- ============================================================================

-- 首先需要在 Supabase Dashboard > Database > Extensions 中启用 pg_cron

-- 启用后执行以下命令：
-- SELECT cron.schedule(
--   'cleanup-expired-builds',      -- 任务名称
--   '0 3 * * *',                   -- 每天凌晨 3:00 执行
--   'SELECT public.cleanup_expired_builds();'
-- );

-- 查看已有的定时任务：
-- SELECT * FROM cron.job;

-- 删除定时任务：
-- SELECT cron.unschedule('cleanup-expired-builds');

-- ============================================================================
-- 手动执行清理（如果不使用 pg_cron）
-- ============================================================================

-- SELECT public.cleanup_expired_builds();
