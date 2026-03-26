'use client';

import { useState } from 'react';
import { signInWithGoogle, signOutGoogle, getCurrentUser, isAndroidWebView } from '@/lib/google-signin-bridge';

/**
 * Google Sign-In 示例组件
 *
 * 使用方法：
 * 1. 在 Android WebView 中打开应用
 * 2. 点击"Google 登录"按钮
 * 3. 系统会显示原生的 Google 账号选择器
 * 4. 选择账号后，会返回用户信息
 */
export default function GoogleSignInExample() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 从环境变量获取 Google OAuth 客户端 ID
  const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  const handleSignIn = async () => {
    if (!isAndroidWebView()) {
      setError('此功能仅在 Android 应用中可用');
      return;
    }

    if (!GOOGLE_CLIENT_ID) {
      setError('未配置 Google Client ID');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await signInWithGoogle(GOOGLE_CLIENT_ID);
      setUser(result);
      console.log('Google 登录成功:', result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
      console.error('Google 登录失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!isAndroidWebView()) {
      setError('此功能仅在 Android 应用中可用');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await signOutGoogle();
      setUser(null);
      console.log('Google 登出成功');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登出失败');
      console.error('Google 登出失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkCurrentUser = () => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      console.log('当前用户:', currentUser);
    } else {
      setError('未找到已登录的用户');
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4">Google Sign-In (Android WebView)</h2>

      {!isAndroidWebView() && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          ⚠️ 此功能仅在 Android 应用的 WebView 中可用
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {user ? (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <h3 className="font-bold mb-2">登录成功！</h3>
          <p><strong>邮箱：</strong>{user.email}</p>
          <p><strong>姓名：</strong>{user.displayName}</p>
          <p className="text-xs mt-2 break-all"><strong>ID Token：</strong>{user.idToken?.substring(0, 50)}...</p>
        </div>
      ) : (
        <div className="bg-gray-100 px-4 py-3 rounded mb-4">
          <p>未登录</p>
        </div>
      )}

      <div className="space-y-3">
        {!user ? (
          <button
            onClick={handleSignIn}
            disabled={loading || !isAndroidWebView()}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
          >
            {loading ? '登录中...' : 'Google 登录'}
          </button>
        ) : (
          <button
            onClick={handleSignOut}
            disabled={loading}
            className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
          >
            {loading ? '登出中...' : 'Google 登出'}
          </button>
        )}

        <button
          onClick={checkCurrentUser}
          disabled={loading || !isAndroidWebView()}
          className="w-full bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
        >
          检查当前用户
        </button>
      </div>

      <div className="mt-6 text-sm text-gray-600">
        <h3 className="font-bold mb-2">使用说明：</h3>
        <ol className="list-decimal list-inside space-y-1">
          <li>确保在 Android 应用的 WebView 中打开</li>
          <li>点击"Google 登录"按钮</li>
          <li>在原生账号选择器中选择 Google 账号</li>
          <li>登录成功后会显示用户信息</li>
        </ol>
      </div>
    </div>
  );
}
