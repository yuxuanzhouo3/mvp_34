"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: Error | null; needsEmailVerification?: boolean }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const initializedRef = useRef(false);

  // 使用useMemo缓存supabase客户端（SSR时可能为null）
  const supabase = useMemo(() => createClient(), []);

  const refreshSession = useCallback(async () => {
    // 如果supabase为null（SSR时），直接返回
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
  }, [supabase]);

  useEffect(() => {
    // 防止重复初始化
    if (initializedRef.current) return;
    initializedRef.current = true;

    // 如果supabase为null（SSR时），直接设置loading为false
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
        // 清除状态并重定向
        router.refresh();
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, refreshSession, router]);

  const signIn = useCallback(async (email: string, password: string) => {
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

      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error("Sign in failed") };
    }
  }, [supabase]);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
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

      return { error: null, needsEmailVerification: true };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error("Sign up failed") };
    }
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) {
      setUser(null);
      setSession(null);
      return;
    }

    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, [supabase]);

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
