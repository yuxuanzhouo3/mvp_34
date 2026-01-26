-- ============================================================================
-- 为 build_shares 表添加访问秘钥和有效期功能
-- ============================================================================

-- 1. 添加秘钥和有效期相关字段
-- ============================================================================
ALTER TABLE public.build_shares
ADD COLUMN IF NOT EXISTS secret VARCHAR(20),
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS expires_in_days INTEGER DEFAULT 7;

-- 2. 添加注释
-- ============================================================================
COMMENT ON COLUMN public.build_shares.secret IS '访问秘钥（私密分享时使用）';
COMMENT ON COLUMN public.build_shares.is_public IS '是否为公开分享';
COMMENT ON COLUMN public.build_shares.expires_in_days IS '分享链接有效期（天数，1-30天）';

-- 3. 创建索引（可选，用于查询优化）
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_build_shares_is_public ON public.build_shares(is_public);

-- ============================================================================
-- 说明
-- ============================================================================
-- 本次迁移为 build_shares 表添加访问秘钥和有效期功能：
-- 1. secret 字段：存储访问秘钥（8位大写字母数字组合）
-- 2. is_public 字段：标识是否为公开分享
--    - true: 公开分享，任何人都可以访问
--    - false: 私密分享，需要输入秘钥才能访问
-- 3. expires_in_days 字段：分享链接有效期（1-30天，默认7天）
--
-- CloudBase 集合名称：build_shares
-- 需要在 CloudBase 中添加相同的字段：
-- - secret: String
-- - is_public: Boolean
-- - expires_in_days: Number
-- ============================================================================
