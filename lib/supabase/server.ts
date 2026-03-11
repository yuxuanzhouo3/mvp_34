import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  getSupabaseUrlFromEnv,
  getSupabaseAnonKeyFromEnv,
  getSupabaseServiceRoleKeyFromEnv,
} from "./env";

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = getSupabaseUrlFromEnv();
  const supabaseKey = getSupabaseAnonKeyFromEnv();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createServerClient(supabaseUrl, supabaseKey, {
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
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}

// Service role client for admin operations (不使用cookies)
export function createServiceClient() {
  const supabaseUrl = getSupabaseUrlFromEnv();
  const serviceRoleKey = getSupabaseServiceRoleKeyFromEnv();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service role environment variables");
  }

  return createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {},
    },
  });
}

// 用于在API路由中创建带自定义cookie处理的客户端
export function createServerClientWithCookies(
  getAll: () => { name: string; value: string }[],
  setAll: (
    cookies: { name: string; value: string; options?: Record<string, unknown> }[]
  ) => void
) {
  const supabaseUrl = getSupabaseUrlFromEnv();
  const supabaseKey = getSupabaseAnonKeyFromEnv();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll,
      setAll,
    },
  });
}
