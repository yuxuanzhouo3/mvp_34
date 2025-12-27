-- ============================================================================
-- MornClient 国际版 - 数据库迁移文件
-- 包含：profiles表、builds表及相关触发器
-- ============================================================================

-- ============================================================================
-- 1. 用户资料表 (profiles)
-- 与 auth.users 关联，存储用户额外信息
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  avatar TEXT,
  region TEXT DEFAULT 'US',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- RLS策略
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果存在）
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- 创建RLS策略
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 2. 构建记录表 (builds)
-- 存储用户的应用构建任务
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  app_name TEXT NOT NULL,
  package_name TEXT NOT NULL,
  version_code TEXT NOT NULL,
  privacy_policy TEXT,
  url TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  progress INTEGER DEFAULT 0,
  output_file_path TEXT,
  error_message TEXT,
  icon_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_builds_user_id ON public.builds(user_id);
CREATE INDEX IF NOT EXISTS idx_builds_status ON public.builds(status);
CREATE INDEX IF NOT EXISTS idx_builds_created_at ON public.builds(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_builds_expires_at ON public.builds(expires_at);

-- RLS策略：用户只能查看自己的构建记录
ALTER TABLE public.builds ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果存在）
DROP POLICY IF EXISTS "Users can view own builds" ON public.builds;
DROP POLICY IF EXISTS "Users can create own builds" ON public.builds;
DROP POLICY IF EXISTS "Users can update own builds" ON public.builds;

-- 创建RLS策略
CREATE POLICY "Users can view own builds" ON public.builds
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own builds" ON public.builds
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own builds" ON public.builds
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- 3. 通用触发器函数 - 更新 updated_at 字段
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- profiles表更新触发器
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- builds表更新触发器
DROP TRIGGER IF EXISTS update_builds_updated_at ON public.builds;
CREATE TRIGGER update_builds_updated_at
  BEFORE UPDATE ON public.builds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 4. 自动创建用户资料的触发器
-- 当新用户在 auth.users 中创建时，自动在 profiles 表中创建对应记录
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 插入Profile记录
  INSERT INTO public.profiles (id, email, name, avatar)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    avatar = COALESCE(NULLIF(EXCLUDED.avatar, ''), public.profiles.avatar),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 删除已存在的触发器（如果存在）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 创建触发器：当新用户注册时自动创建profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 5. 用户更新时同步资料的触发器
-- 处理OAuth更新头像等情况
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  -- 更新Profile记录（仅当有变化时）
  UPDATE public.profiles SET
    email = COALESCE(NEW.email, email),
    name = COALESCE(NEW.raw_user_meta_data->>'full_name', name),
    avatar = COALESCE(NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''), avatar),
    updated_at = NOW()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 删除已存在的触发器（如果存在）
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

-- 创建触发器：当用户信息更新时同步profile
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (
    OLD.email IS DISTINCT FROM NEW.email OR
    OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data
  )
  EXECUTE FUNCTION public.handle_user_update();

-- ============================================================================
-- 完成
-- ============================================================================
