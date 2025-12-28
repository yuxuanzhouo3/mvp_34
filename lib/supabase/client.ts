import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseUrlFromEnv, getSupabaseAnonKeyFromEnv } from "./env";

// 单例缓存，避免多次实例化
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  // 在服务端构建时跳过创建（避免预渲染错误）
  if (typeof window === "undefined") {
    // 返回一个占位符，实际方法会在客户端调用时执行
    return null as unknown as ReturnType<typeof createBrowserClient>;
  }

  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = getSupabaseUrlFromEnv();
  const supabaseKey = getSupabaseAnonKeyFromEnv();

  if (!supabaseUrl || !supabaseKey) {
    console.warn("Missing Supabase environment variables");
    return null as unknown as ReturnType<typeof createBrowserClient>;
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
