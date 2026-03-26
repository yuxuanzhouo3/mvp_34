-- ============================================================================
-- 为deduct_build_quota函数添加行级安全策略
-- ============================================================================
--
-- 问题：
-- 007迁移授予了authenticated角色执行deduct_build_quota的权限
-- 理论上任何认证用户都可以调用此函数扣减任意用户的额度
--
-- 解决方案：
-- 添加RLS策略确保用户只能扣减自己的额度
-- ============================================================================

-- 确保user_wallets表启用了RLS
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "Users can only deduct own quota" ON public.user_wallets;

-- 创建策略：用户只能更新自己的钱包
CREATE POLICY "Users can only deduct own quota"
ON public.user_wallets
FOR UPDATE
USING (auth.uid() = user_id);

-- 添加注释
COMMENT ON POLICY "Users can only deduct own quota" ON public.user_wallets IS
'确保用户只能通过deduct_build_quota函数扣减自己的额度，防止越权操作';
