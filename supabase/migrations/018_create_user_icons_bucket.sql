-- =====================================================
-- 创建 user-icons Storage Bucket
-- 用于客户端直接上传图标，避免 Vercel 4.5MB 请求体限制
-- =====================================================

-- 1. 创建 user-icons bucket（公开访问）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-icons',
  'user-icons',
  true, -- 公开访问
  10485760, -- 10MB 文件大小限制
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS 策略：允许认证用户上传到自己的目录
DROP POLICY IF EXISTS "Users can upload icons to their own folder" ON storage.objects;
CREATE POLICY "Users can upload icons to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-icons'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. RLS 策略：允许所有人读取图标（公开访问）
DROP POLICY IF EXISTS "Anyone can read icons" ON storage.objects;
CREATE POLICY "Anyone can read icons"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'user-icons');

-- 4. RLS 策略：允许用户删除自己的图标
DROP POLICY IF EXISTS "Users can delete their own icons" ON storage.objects;
CREATE POLICY "Users can delete their own icons"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-icons'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. RLS 策略：允许用户更新自己的图标
DROP POLICY IF EXISTS "Users can update their own icons" ON storage.objects;
CREATE POLICY "Users can update their own icons"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-icons'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
