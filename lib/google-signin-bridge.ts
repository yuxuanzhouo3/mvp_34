/**
 * Google Sign-In Bridge for Android WebView
 *
 * 通过 JavaScript Bridge 调用 Android 原生 Google Sign-In SDK
 */

interface GoogleSignInResult {
  success: boolean;
  idToken?: string;
  email?: string;
  displayName?: string;
  error?: string;
}

interface GoogleSignInBridge {
  signIn(clientId: string, callback: string): void;
  signOut(callback: string): void;
  getCurrentUser(): string | null;
}

declare global {
  interface Window {
    GoogleSignIn?: GoogleSignInBridge;
  }
}

/**
 * 检查是否在 Android WebView 环境中
 */
export function isAndroidWebView(): boolean {
  return typeof window !== 'undefined' && !!window.GoogleSignIn;
}

/**
 * Google 登录
 * @param clientId Google OAuth 客户端 ID
 * @returns Promise<GoogleSignInResult>
 */
export function signInWithGoogle(clientId: string): Promise<GoogleSignInResult> {
  return new Promise((resolve, reject) => {
    if (!isAndroidWebView()) {
      reject(new Error('Not running in Android WebView'));
      return;
    }

    // 创建全局回调函数
    const callbackName = `googleSignInCallback_${Date.now()}`;
    (window as any)[callbackName] = (result: GoogleSignInResult) => {
      // 清理回调函数
      delete (window as any)[callbackName];

      if (result.success) {
        resolve(result);
      } else {
        reject(new Error(result.error || 'Sign in failed'));
      }
    };

    // 调用 Android Bridge
    try {
      window.GoogleSignIn!.signIn(clientId, callbackName);
    } catch (error) {
      delete (window as any)[callbackName];
      reject(error);
    }
  });
}

/**
 * Google 登出
 * @returns Promise<void>
 */
export function signOutGoogle(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isAndroidWebView()) {
      reject(new Error('Not running in Android WebView'));
      return;
    }

    // 创建全局回调函数
    const callbackName = `googleSignOutCallback_${Date.now()}`;
    (window as any)[callbackName] = (result: GoogleSignInResult) => {
      // 清理回调函数
      delete (window as any)[callbackName];

      if (result.success) {
        resolve();
      } else {
        reject(new Error(result.error || 'Sign out failed'));
      }
    };

    // 调用 Android Bridge
    try {
      window.GoogleSignIn!.signOut(callbackName);
    } catch (error) {
      delete (window as any)[callbackName];
      reject(error);
    }
  });
}

/**
 * 获取当前登录的用户信息
 * @returns 用户信息 JSON 字符串或 null
 */
export function getCurrentUser(): GoogleSignInResult | null {
  if (!isAndroidWebView()) {
    return null;
  }

  try {
    const userJson = window.GoogleSignIn!.getCurrentUser();
    if (userJson) {
      return JSON.parse(userJson);
    }
  } catch (error) {
    console.error('Failed to get current user:', error);
  }

  return null;
}
