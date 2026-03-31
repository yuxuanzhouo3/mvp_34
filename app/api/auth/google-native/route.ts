import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Google Native Sign-In API
 * 处理来自 Android 原生 Google Sign-In SDK 的认证请求
 * 
 * 核心思路：使用 Supabase 的 signInWithIdToken 方法，
 * 将 Google ID Token 直接交给 Supabase 验证并创建真正的 session，
 * 这样后续所有 API 调用（supabase.auth.getUser()）都能正确识别用户。
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

    // 使用 Supabase 的 signInWithIdToken
    // 这会创建一个真正的 Supabase session（包含 access_token 和 refresh_token）
    // 并通过 cookie 自动持久化，后续 supabase.auth.getUser() 就能识别
    const supabase = await createClient();
    
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      console.error('Supabase signInWithIdToken error:', error);
      return NextResponse.json(
        { error: error.message || 'Authentication failed' },
        { status: 401 }
      );
    }

    if (!data.session || !data.user) {
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    console.log('[google-native] User signed in successfully:', data.user.id, data.user.email);

    // 返回 session 和 user 信息给前端
    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.full_name || displayName || '',
        avatar: data.user.user_metadata?.avatar_url || '',
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        token_type: data.session.token_type,
      },
    });
  } catch (error) {
    console.error('Google native sign-in error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Authentication failed' },
      { status: 500 }
    );
  }
}
