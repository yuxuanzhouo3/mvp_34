-- ============================================================================
-- 添加 version_name 字段到 builds 表
-- version_name: 显示给用户的版本号，如 "1.0.0"
-- version_code: 内部构建号，整数，如 1, 2, 3
-- ============================================================================

ALTER TABLE public.builds
ADD COLUMN IF NOT EXISTS version_name TEXT DEFAULT '1.0.0';

-- 为现有记录设置默认值
UPDATE public.builds
SET version_name = '1.0.0'
WHERE version_name IS NULL;
