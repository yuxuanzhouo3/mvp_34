"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseUrlFromEnv, getSupabaseAnonKeyFromEnv } from "@/lib/supabase/env";

/**
 * Google OAuth登录 - Server Action
 * 使用Server Action确保PKCE code_verifier正确存储在cookie中
 */
export async function signInWithGoogle(next: string = "/") {
  const supabaseUrl = getSupabaseUrlFromEnv();
  const supabaseAnonKey = getSupabaseAnonKeyFromEnv();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase configuration");
  }

  // 动态获取 origin，支持代理环境（如 Vercel、Nginx 反向代理等）
  const headersList = await headers();
  const host = headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") || "https";
  const origin = `${proto}://${host}`;

  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch (error) {
          // Server Component中可能失败，忽略
          console.warn("[signInWithGoogle] Failed to set cookies:", error);
        }
      },
    },
  });

  const redirectTo = `${origin}/auth/callback${next && next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;

  console.info("[signInWithGoogle] Starting OAuth flow", { origin, redirectTo });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    console.error("[signInWithGoogle] Error:", error.message);
    throw new Error(error.message);
  }

  if (data.url) {
    console.info("[signInWithGoogle] Redirecting to:", data.url);
    redirect(data.url);
  }
}
