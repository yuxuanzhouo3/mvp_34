"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseUrlFromEnv, getSupabaseAnonKeyFromEnv, getSiteUrl } from "@/lib/supabase/env";

/**
 * Google OAuth登录 - Server Action
 * 使用Server Action确保PKCE code_verifier正确存储在cookie中
 */
export async function signInWithGoogle(next: string = "/") {
  const supabaseUrl = getSupabaseUrlFromEnv();
  const supabaseAnonKey = getSupabaseAnonKeyFromEnv();
  const siteUrl = getSiteUrl();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

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
        } catch {
          // Server Component中可能失败
        }
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    console.error("Google OAuth error:", error);
    throw new Error(error.message);
  }

  if (data.url) {
    redirect(data.url);
  }
}
