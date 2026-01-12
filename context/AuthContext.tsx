"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { IS_DOMESTIC_VERSION } from "@/config";

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
      const res = await fetch("/api/domestic/auth/me", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        return data.user as DomesticUser;
      }
      return null;
    } catch (error) {
      console.error("[AuthContext] Failed to fetch domestic user:", error);
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
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        router.refresh();
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
    if (IS_DOMESTIC_VERSION) {
      // 国内版：调用登出 API
      try {
        await fetch("/api/domestic/auth/logout", {
          method: "POST",
          credentials: "include",
        });
      } catch (error) {
        console.error("[AuthContext] Domestic logout error:", error);
      }
      setUser(null);
      setSession(null);
      router.refresh();
      return;
    }

    // 国际版：使用 Supabase
    if (!supabase) {
      setUser(null);
      setSession(null);
      return;
    }

    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, [supabase, router]);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    refreshSession,
  }), [user, session, loading, signIn, signUp, signOut, refreshSession]);

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
