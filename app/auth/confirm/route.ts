import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUrlFromEnv, getSupabaseAnonKeyFromEnv } from "@/lib/supabase/env";
import type { EmailOtpType } from "@supabase/supabase-js";

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

/**
 * 邮箱验证确认路由
 * 处理Supabase发送的邮箱验证链接
 *
 * URL格式: /auth/confirm?token_hash=xxx&type=signup&next=/
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code"); // PKCE code (备选)
  const next = sanitizeNextPath(searchParams.get("next"));

  const origin = request.nextUrl.origin;

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

  // 方式1: token_hash + type (邮箱验证标准方式)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (error) {
      console.error("OTP verification error:", error);
      const errorUrl = new URL("/auth/login", origin);
      errorUrl.searchParams.set("error", "verification_failed");
      errorUrl.searchParams.set("error_description", error.message);
      return NextResponse.redirect(errorUrl);
    }

    // 验证成功，重定向到目标页面
    const successUrl = new URL(next, origin);
    const response = NextResponse.redirect(successUrl);

    // 设置cookies
    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(name, value, options as Record<string, unknown>);
    }

    return response;
  }

  // 方式2: PKCE code (备选)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Code exchange error:", error);
      const errorUrl = new URL("/auth/login", origin);
      errorUrl.searchParams.set("error", "code_exchange_failed");
      errorUrl.searchParams.set("error_description", error.message);
      return NextResponse.redirect(errorUrl);
    }

    const successUrl = new URL(next, origin);
    const response = NextResponse.redirect(successUrl);

    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(name, value, options as Record<string, unknown>);
    }

    return response;
  }

  // 没有有效的验证参数
  console.error("No valid verification parameters");
  return NextResponse.redirect(new URL("/auth/login?error=invalid_link", origin));
}
