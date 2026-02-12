import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
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

    // 检查用户是否已存在（通过 profiles 表）
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', payload.email)
      .maybeSingle();

    let user;

    if (existingProfile) {
      // 用户已存在，更新最后登录时间
      const { data: updatedUser, error: updateError } = await supabase
        .from('profiles')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', existingProfile.id)
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
      // 创建新用户 - 使用 Admin API 创建 OAuth 用户
      console.log('Creating new user with Admin API');
      const serviceClient = createServiceClient();

      let authUserId: string;
      let isNewUser = false;

      // 尝试创建用户
      const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
        email: payload.email!,
        email_confirm: true, // OAuth 用户邮箱已验证
        user_metadata: {
          full_name: displayName || payload.name,
          avatar_url: payload.picture,
          provider: 'google',
        },
      });

      if (authError) {
        // 如果错误是邮箱已存在，获取现有用户
        if (authError.message.includes('already been registered') || authError.message.includes('email_exists')) {
          console.log('User already exists in auth.users, fetching existing user');

          // 使用 Admin API 列出用户并找到匹配的邮箱
          const { data: users, error: listError } = await serviceClient.auth.admin.listUsers();

          if (listError || !users) {
            console.error('Failed to list users:', listError);
            return NextResponse.json(
              { error: 'Failed to fetch existing user: ' + (listError?.message || 'Unknown error') },
              { status: 500 }
            );
          }

          const existingUser = users.users.find(u => u.email === payload.email);

          if (!existingUser) {
            console.error('User not found after email_exists error');
            return NextResponse.json(
              { error: 'User exists but could not be found' },
              { status: 500 }
            );
          }

          authUserId = existingUser.id;
          console.log('Found existing user:', authUserId);
        } else {
          // 其他错误
          console.error('Failed to create auth user:', authError);
          return NextResponse.json(
            { error: 'Failed to create user: ' + authError.message },
            { status: 500 }
          );
        }
      } else if (authData?.user) {
        authUserId = authData.user.id;
        isNewUser = true;
        console.log('Auth user created:', authUserId);
      } else {
        console.error('No auth data returned');
        return NextResponse.json(
          { error: 'Failed to create user: No data returned' },
          { status: 500 }
        );
      }

      // 检查 profile 是否存在
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUserId)
        .maybeSingle();

      let profile;

      if (existingProfile) {
        // Profile 已存在，更新最后登录时间
        console.log('Profile already exists, updating');
        const { data: updatedProfile, error: updateError } = await supabase
          .from('profiles')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', authUserId)
          .select()
          .single();

        if (updateError) {
          console.error('Failed to update profile:', updateError);
          return NextResponse.json(
            { error: 'Failed to update profile: ' + updateError.message },
            { status: 500 }
          );
        }

        profile = updatedProfile;
      } else {
        // Profile 不存在，创建新的
        console.log('Profile does not exist, creating with service role');
        const { data: newProfile, error: insertError } = await serviceClient
          .from('profiles')
          .insert({
            id: authUserId,
            email: payload.email,
            name: displayName || payload.name,
            avatar: payload.picture,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Failed to create profile:', insertError);
          return NextResponse.json(
            { error: 'Failed to create profile: ' + insertError.message },
            { status: 500 }
          );
        }

        profile = newProfile;
        console.log('Profile created successfully');
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
