"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { IS_DOMESTIC_VERSION } from "@/config";
import { trackLoginEventClient } from "@/services/analytics-client";
import { getStoredAuthState } from "@/lib/auth-state-manager";

// 国内版用户类型（兼容 Supabase User 接口的关键字段）
interface DomesticUser {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
  wechatOpenId?: string;
  created_at?: string;
  // 兼容 Supabase User 接口
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
  aud?: string;
}

interface AuthContextType {
  user: User | DomesticUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; userId?: string }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: Error | null; needsEmailVerification?: boolean; userId?: string }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateUser: (user: User | DomesticUser | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | DomesticUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const initializedRef = useRef(false);

  // 使用useMemo缓存supabase客户端（SSR时可能为null）
  const supabase = useMemo(() => createClient(), []);

  // 国内版：从 API 获取用户信息
  const fetchDomesticUser = useCallback(async () => {
    try {
      // 从 localStorage 读取 token（用于 WebView 环境）
      let token: string | null = null;
      try {
        const authState = localStorage.getItem("app-auth-state");
        if (authState) {
          const parsed = JSON.parse(authState);
          token = parsed.accessToken || null;
        }
      } catch (e) {
        // localStorage 读取失败，继续使用 cookie
      }

      // 添加超时控制，防止请求挂起导致页面一直加载
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      // 如果有 token，通过 header 发送（WebView 环境中 cookie 可能不可靠）
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/domestic/auth/me", {
        credentials: "include",
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        return data.user as DomesticUser;
      }
      return null;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error("[AuthContext] Fetch domestic user timeout");
      } else {
        console.error("[AuthContext] Failed to fetch domestic user:", error);
      }
      return null;
    }
  }, []);

  const refreshSession = useCallback(async () => {
    if (IS_DOMESTIC_VERSION) {
      // 国内版：从 API 获取用户
      try {
        const domesticUser = await fetchDomesticUser();
        setUser(domesticUser);
        setSession(null); // 国内版不使用 Supabase session
      } catch (error) {
        console.error("[AuthContext] Failed to refresh domestic session:", error);
        setUser(null);
        setSession(null);
      }
      return;
    }

    // 国际版：使�� Supabase
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
    } catch (error) {
      console.error("Failed to refresh session:", error);
      setSession(null);
      setUser(null);
    }
  }, [supabase, fetchDomesticUser]);

  useEffect(() => {
    // 防止重复初始化
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (IS_DOMESTIC_VERSION) {
      // 国内版：直接获取用户信息
      fetchDomesticUser()
        .then((domesticUser) => {
          setUser(domesticUser);
          setSession(null);
        })
        .finally(() => setLoading(false));
      return;
    }

    // 国际版：使用 Supabase
    if (!supabase) {
      setLoading(false);
      return;
    }

    // 先检查 localStorage 是否有认证状态（用于 Android Native 登录）
    const storedAuthState = getStoredAuthState();
    if (storedAuthState?.user) {
      console.log('[AuthContext] Found stored auth state, using it:', storedAuthState.user);
      setUser(storedAuthState.user);
      setSession(null); // Android Native 登录不使用 Supabase session
      setLoading(false);
      return;
    }

    // Get initial session
    refreshSession().finally(() => setLoading(false));

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // 处理特定事件
      if (event === "SIGNED_OUT") {
        router.refresh();
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        // 记录活跃用户埋点（session 恢复或登录时）
        if (session?.user?.id) {
          trackLoginEventClient(session.user.id, event === "SIGNED_IN" ? "login" : "session").catch(() => {});
        }
        if (event !== "INITIAL_SESSION") {
          router.refresh();
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, refreshSession, router, fetchDomesticUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (IS_DOMESTIC_VERSION) {
      // 国内版：调用 CloudBase API
      try {
        const res = await fetch("/api/domestic/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { error: new Error(data.error || "登录失败") };
        }
        // 登录成功后刷新用户状态
        const domesticUser = await fetchDomesticUser();
        setUser(domesticUser);
        return { error: null, userId: data.user?.id };
      } catch (err) {
        return { error: err instanceof Error ? err : new Error("登录失败") };
      }
    }

    // 国际版：使用 Supabase
    if (!supabase) {
      return { error: new Error("Auth service not available") };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: new Error(error.message) };
      }

      // 检查邮箱是否已验证
      if (data.user && !data.user.email_confirmed_at) {
        await supabase.auth.signOut();
        return { error: new Error("Please verify your email first") };
      }

      return { error: null, userId: data.user?.id };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error("Sign in failed") };
    }
  }, [supabase, fetchDomesticUser]);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    if (IS_DOMESTIC_VERSION) {
      // 国内版：调用 CloudBase API
      try {
        const res = await fetch("/api/domestic/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password, name }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { error: new Error(data.error || "注册失败") };
        }
        // 注册成功，不自动登录，让用户手动登录
        return { error: null, userId: data.user?.id };
      } catch (err) {
        return { error: err instanceof Error ? err : new Error("注册失败") };
      }
    }

    // 国际版：使用 Supabase
    if (!supabase) {
      return { error: new Error("Auth service not available") };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: name ? { full_name: name } : undefined,
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/`,
        },
      });

      if (error) {
        return { error: new Error(error.message) };
      }

      // 检查邮箱是否已被注册
      if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
        return { error: new Error("This email is already registered. Please sign in.") };
      }

      // 注册成功后登出（需要验证邮箱）
      await supabase.auth.signOut();

      return { error: null, needsEmailVerification: true, userId: data.user?.id };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error("Sign up failed") };
    }
  }, [supabase]);

  const signOut = useCallback(async () => {
    try {
      // 1. 清除所有 cookie（包括 custom-jwt-token 和 Supabase session）
      try {
        const { deleteCookie } = await import('@/lib/cookie-helper');
        // 清除自定义 JWT token
        deleteCookie('custom-jwt-token');

        // 清除所有 Supabase session cookie（sb-*-auth-token）
        if (typeof document !== 'undefined') {
          const cookies = document.cookie.split(';');
          for (const cookie of cookies) {
            const cookieName = cookie.split('=')[0].trim();
            if (cookieName.startsWith('sb-') || cookieName.includes('auth')) {
              deleteCookie(cookieName);
            }
          }
        }
      } catch (error) {
        console.error('清除 cookie 失败:', error);
      }

      // 2. 清除所有 localStorage 数据
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.clear();
        }
      } catch (error) {
        console.error('清除 localStorage 失败:', error);
      }

      // 3. 清除所有 sessionStorage 数据
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.clear();
        }
      } catch (error) {
        console.error('清除 sessionStorage 失败:', error);
      }

      // 4. 清除 Supabase session（邮箱登录）- 不等待完成，避免中断
      try {
        if (supabase) {
          supabase.auth.signOut().catch(err => console.error('Supabase signOut error:', err));
        }
      } catch (error) {
        console.error('触发 Supabase 登出失败:', error);
      }

      // 5. 清除 Android 端的 Google 登录缓存（不等待完成，避免中断）
      try {
        const isAndroidWebView = typeof window !== 'undefined' && !!(window as any).GoogleSignIn;
        if (isAndroidWebView) {
          const { signOutGoogle } = await import('@/lib/google-signin-bridge');
          signOutGoogle().catch(err => console.error('Android signOut error:', err));
        }
      } catch (error) {
        console.error('触发 Android Google 登出失败:', error);
      }

      // 6. 国内版：调用登出 API（不等待完成，避免中断）
      if (IS_DOMESTIC_VERSION) {
        try {
          fetch("/api/domestic/auth/logout", {
            method: "POST",
            credentials: "include",
          }).catch(err => console.error('Domestic logout error:', err));
        } catch (error) {
          console.error('触发国内版登出失败:', error);
        }
      }

      // 7. 立即刷新页面
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch (error) {
      console.error("退出登录失败:", error);
      alert(`退出登录失败: ${error}`);
    }
  }, [supabase, router]);

  const updateUser = useCallback((newUser: User | DomesticUser | null) => {
    setUser(newUser);
  }, []);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    refreshSession,
    updateUser,
  }), [user, session, loading, signIn, signUp, signOut, refreshSession, updateUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
