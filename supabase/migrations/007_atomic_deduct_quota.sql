-- 原子扣减构建额度函数
-- 解决并发请求导致的竞态条件问题

-- 先删除可能存在的旧版本函数
DROP FUNCTION IF EXISTS deduct_build_quota(UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS deduct_build_quota(UUID, INTEGER, DATE);
DROP FUNCTION IF EXISTS deduct_build_quota(UUID, INTEGER);
DROP FUNCTION IF EXISTS deduct_build_quota(UUID);

CREATE OR REPLACE FUNCTION deduct_build_quota(
  p_user_id UUID,
  p_count INTEGER DEFAULT 1,
  p_today DATE DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  remaining INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE;
  v_limit INTEGER;
  v_used INTEGER;
  v_new_used INTEGER;
BEGIN
  -- 获取今天的日期（使用 DATE 类型）
  v_today := COALESCE(p_today, CURRENT_DATE);

  -- 使用 FOR UPDATE 锁定行，防止并发更新
  SELECT
    COALESCE(daily_builds_limit, 3) AS limit_val,
    CASE
      WHEN daily_builds_reset_at = v_today THEN COALESCE(daily_builds_used, 0)
      ELSE 0
    END AS used_val
  INTO v_limit, v_used
  FROM user_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- 如果用户不存在
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'User wallet not found'::TEXT;
    RETURN;
  END IF;

  -- 检查额度是否足够
  IF (v_limit - v_used) < p_count THEN
    RETURN QUERY SELECT FALSE, GREATEST(0, v_limit - v_used), 'Insufficient daily build quota'::TEXT;
    RETURN;
  END IF;

  -- 原子更新
  v_new_used := v_used + p_count;

  UPDATE user_wallets
  SET
    daily_builds_used = v_new_used,
    daily_builds_reset_at = v_today,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT TRUE, v_limit - v_new_used, NULL::TEXT;
END;
$$;

-- 添加注释
COMMENT ON FUNCTION deduct_build_quota IS '原子扣减构建额度，使用行级锁防止竞态条件';

-- 授权 authenticated 用户调用此函数
GRANT EXECUTE ON FUNCTION public.deduct_build_quota(UUID, INTEGER, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_build_quota(UUID, INTEGER, DATE) TO service_role;
