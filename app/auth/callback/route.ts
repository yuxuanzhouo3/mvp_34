import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUrlFromEnv, getSupabaseAnonKeyFromEnv } from "@/lib/supabase/env";

/**
 * 清理next路径，防止开放重定向攻击
 */
function sanitizeNextPath(next: string | null): string {
  if (!next) return "/";
  // 只允许相对路径
  if (next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next"));
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // 获取origin（用于重定向）
  const origin = request.nextUrl.origin;

  // 处理OAuth错误
  if (error) {
    console.error("OAuth error:", error, errorDescription);
    const errorUrl = new URL("/auth/login", origin);
    errorUrl.searchParams.set("error", error);
    if (errorDescription) {
      errorUrl.searchParams.set("error_description", errorDescription);
    }
    return NextResponse.redirect(errorUrl);
  }

  // 如果没有code，可能是hash模式的token（重定向到客户端处理）
  if (!code) {
    const clientUrl = new URL("/auth/callback/client", origin);
    clientUrl.searchParams.set("next", next);
    // 复制其他参数
    for (const [key, value] of searchParams.entries()) {
      if (key !== "code" && key !== "next") {
        clientUrl.searchParams.set(key, value);
      }
    }
    return NextResponse.redirect(clientUrl);
  }

  // 使用PKCE交换code获取session
  const supabaseUrl = getSupabaseUrlFromEnv();
  const supabaseAnonKey = getSupabaseAnonKeyFromEnv();

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables");
    return NextResponse.redirect(new URL("/auth/login?error=config_error", origin));
  }

  // 收集需要设置的cookies
  const pendingCookies: { name: string; value: string; options: Record<string, unknown> }[] = [];

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach((cookie) => {
          pendingCookies.push(cookie);
        });
      },
    },
  });

  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("Code exchange error:", exchangeError);
    return NextResponse.redirect(new URL("/auth/login?error=code_exchange_error", origin));
  }

  // 创建成功响应并设置cookies
  const successUrl = new URL(next, origin);
  const response = NextResponse.redirect(successUrl);

  // 设置Supabase返回的cookies
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options as Record<string, unknown>);
  }

  return response;
}
