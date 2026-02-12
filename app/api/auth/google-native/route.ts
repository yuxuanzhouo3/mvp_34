import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { OAuth2Client } from 'google-auth-library';

/**
 * Google Native Sign-In API
 * 处理来自 Android 原生 Google Sign-In SDK 的认证请求
 */
export async function POST(request: NextRequest) {
  try {
    const { idToken, email, displayName } = await request.json();

    if (!idToken) {
      return NextResponse.json(
        { error: 'Missing idToken' },
        { status: 400 }
      );
    }

    // 验证 Google ID Token
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: 'Google Client ID not configured' },
        { status: 500 }
      );
    }

    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // 使用 Supabase 创建或获取用户
    const supabase = await createClient();

    // 检查用户是否已存在于 auth.users
    const { data: existingAuthUser } = await supabase.auth.admin.getUserByEmail(payload.email!);

    let user;
    let authUserId: string;

    if (existingAuthUser?.user) {
      // 用户已存在，获取其 profile
      authUserId = existingAuthUser.user.id;

      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUserId)
        .single();

      if (fetchError) {
        console.error('Failed to fetch profile:', fetchError);
        return NextResponse.json(
          { error: 'Failed to fetch user profile: ' + fetchError.message },
          { status: 500 }
        );
      }

      // 更新最后登录时间
      const { data: updatedUser, error: updateError } = await supabase
        .from('profiles')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', authUserId)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to update user:', updateError);
        return NextResponse.json(
          { error: 'Failed to update user: ' + updateError.message },
          { status: 500 }
        );
      }

      user = updatedUser;
    } else {
      // 创建新用户 - 使用正确的字段名，让触发器自动创建 profile
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: payload.email!,
        password: Math.random().toString(36).slice(-16), // 随机密码
        options: {
          data: {
            full_name: displayName || payload.name,  // ✅ 使用 full_name
            avatar_url: payload.picture,             // ✅ 使用 avatar_url
          }
        }
      });

      if (authError || !authData.user) {
        console.error('Failed to create auth user:', authError);
        return NextResponse.json(
          { error: 'Failed to create user: ' + (authError?.message || 'Unknown error') },
          { status: 500 }
        );
      }

      authUserId = authData.user.id;

      // 等待触发器创建 profile（最多等待3秒）
      let profile = null;
      for (let i = 0; i < 6; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));

        const { data: newProfile, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUserId)
          .single();

        if (newProfile) {
          profile = newProfile;
          break;
        }

        if (i === 5 && fetchError) {
          console.error('Profile not created by trigger:', fetchError);
          return NextResponse.json(
            { error: 'Failed to create profile: ' + fetchError.message },
            { status: 500 }
          );
        }
      }

      user = profile;
    }

    // 确保 user 不为 null
    if (!user) {
      return NextResponse.json(
        { error: 'Failed to get user data' },
        { status: 500 }
      );
    }

    // 创建自定义会话（不使用 Supabase OAuth）
    // 生成访问令牌和刷新令牌
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';

    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: 'authenticated',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const session = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
      refresh_token_expires_in: 604800,
      token_type: 'bearer',
      user: {
        id: user.id,
        email: user.email,
        role: 'authenticated',
      },
    };

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.name,
        avatar_url: user.avatar,
      },
      session,
    });
  } catch (error) {
    console.error('Google native sign-in error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Authentication failed' },
      { status: 500 }
    );
  }
}
