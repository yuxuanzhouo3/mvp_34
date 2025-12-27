import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseUrlFromEnv, getSupabaseAnonKeyFromEnv } from "./env";

// 单例缓存，避免多次实例化
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = getSupabaseUrlFromEnv();
  const supabaseKey = getSupabaseAnonKeyFromEnv();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables");
  }

  supabaseInstance = createBrowserClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true, // 启用PKCE OAuth流程
    },
  });

  return supabaseInstance;
}

// 重置单例（用于测试或重新初始化）
export function resetClient() {
  supabaseInstance = null;
}
