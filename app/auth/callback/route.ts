import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUrlFromEnv, getSupabaseAnonKeyFromEnv } from "@/lib/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 获取请求的 origin，支持代理环境
 */
function getRequestOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const proto = forwardedProto || request.nextUrl.protocol.replace(":", "") || "https";
  const host = forwardedHost || request.headers.get("host");
  if (host) return `${proto}://${host}`;
  return request.nextUrl.origin;
}

/**
 * 清理next路径，防止开放重定向攻击
 */
function sanitizeNextPath(next: string | null): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//")) return "/";
  return next;
}

/**
 * 服务端 OAuth 回调处理路由
 * 使用 PKCE code exchange 处理 Google OAuth
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next"));
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const origin = getRequestOrigin(request);

  console.info("[auth/callback] Received callback", {
    hasCode: !!code,
    hasError: !!errorParam,
    next,
  });

  // 处理 OAuth 错误
  if (errorParam) {
    console.error("[auth/callback] OAuth error:", errorParam, errorDescription);
    const errUrl = new URL("/auth/login", origin);
    errUrl.searchParams.set("error", errorParam);
    if (errorDescription) {
      errUrl.searchParams.set("error_description", errorDescription);
    }
    return NextResponse.redirect(errUrl);
  }

  // 如果没有 code，重定向到客户端页面处理其他情况（如 hash 中的 tokens）
  if (!code) {
    console.info("[auth/callback] No code found, redirecting to client-side handler");
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

  // Supabase OAuth 处理
  const supabaseUrl = getSupabaseUrlFromEnv();
  const supabaseAnonKey = getSupabaseAnonKeyFromEnv();

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[auth/callback] Missing Supabase configuration");
    const errUrl = new URL("/auth/login", origin);
    errUrl.searchParams.set("error", "configuration_error");
    errUrl.searchParams.set("error_description", "Missing Supabase configuration");
    return NextResponse.redirect(errUrl);
  }

  // 收集需要设置的 cookies
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

  console.info("[auth/callback] Exchanging code for session");

  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[auth/callback] exchangeCodeForSession error:", exchangeError.message);
    const errUrl = new URL("/auth/login", origin);
    errUrl.searchParams.set("error", "exchange_failed");
    errUrl.searchParams.set("error_description", exchangeError.message);
    return NextResponse.redirect(errUrl);
  }

  console.info("[auth/callback] Session established for:", data?.session?.user?.email);

  // 创建成功响应并设置 cookies
  const successUrl = new URL(next, origin);
  const response = NextResponse.redirect(successUrl);

  // 设置 Supabase 返回的 cookies
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options as Record<string, unknown>);
  }

  return response;
}
