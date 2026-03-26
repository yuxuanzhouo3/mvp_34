-- 添加文件大小字段
-- 用于存储构建产物的文件大小（字节）

ALTER TABLE builds ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT NULL;

-- 添加注释
COMMENT ON COLUMN builds.file_size IS '构建产物文件大小（字节）';
