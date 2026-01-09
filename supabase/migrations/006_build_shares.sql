-- 构建分享记录表
-- 用于存储 Pro/Team 用户的分享链接和二维码

CREATE TABLE IF NOT EXISTS build_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 分享码（短链接标识）
  share_code VARCHAR(16) UNIQUE NOT NULL,
  -- 关联的构建ID
  build_id UUID NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
  -- 创建分享的用户ID
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 分享类型: link(链接), qrcode(二维码)
  share_type VARCHAR(20) NOT NULL DEFAULT 'link',
  -- 分享有效期（用户设置）
  expires_at TIMESTAMPTZ NOT NULL,
  -- 访问次数统计
  access_count INTEGER DEFAULT 0,
  -- 创建时间
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- 更新时间
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_build_shares_share_code ON build_shares(share_code);
CREATE INDEX IF NOT EXISTS idx_build_shares_build_id ON build_shares(build_id);
CREATE INDEX IF NOT EXISTS idx_build_shares_user_id ON build_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_build_shares_expires_at ON build_shares(expires_at);

-- RLS 策略
ALTER TABLE build_shares ENABLE ROW LEVEL SECURITY;

-- 用户只能查看和管理自己的分享
CREATE POLICY "Users can view own shares" ON build_shares
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own shares" ON build_shares
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shares" ON build_shares
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own shares" ON build_shares
  FOR DELETE USING (auth.uid() = user_id);

-- 更新时间触发器
CREATE OR REPLACE FUNCTION update_build_shares_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_build_shares_updated_at
  BEFORE UPDATE ON build_shares
  FOR EACH ROW
  EXECUTE FUNCTION update_build_shares_updated_at();
