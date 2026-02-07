import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUrlFromEnv, getSupabaseAnonKeyFromEnv } from "@/lib/supabase/env";
import { trackLoginEvent, trackRegisterEvent } from "@/services/analytics";
import { IS_DOMESTIC_VERSION } from "@/config";

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
 * 尝试解析微信OAuth的state参数
 * 微信OAuth的state是base64url编码的JSON，格式: {"next": "/path"}
 */
function tryParseWechatState(state: string | null): { isWechat: boolean; next: string } {
  if (!state) return { isWechat: false, next: "/" };

  try {
    const decoded = Buffer.from(state, "base64url").toString("utf-8");
    const parsed = JSON.parse(decoded);
    // 微信state包含next字段
    if (typeof parsed === "object" && parsed !== null && "next" in parsed) {
      return { isWechat: true, next: sanitizeNextPath(parsed.next) };
    }
  } catch {
    // 解析失败，不是微信OAuth
  }

  return { isWechat: false, next: "/" };
}

/**
 * 服务端 OAuth 回调处理路由
 *
 * 支持两种OAuth回调：
 * 1. 微信OAuth (国内版) - 通过state参数识别，调用/api/domestic/auth/wechat处理
 * 2. Supabase OAuth (Google等) - 使用PKCE code exchange
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const next = sanitizeNextPath(searchParams.get("next"));
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const origin = getRequestOrigin(request);

  console.info("[auth/callback] Received callback", {
    hasCode: !!code,
    hasState: !!state,
    hasError: !!errorParam,
    isDomestic: IS_DOMESTIC_VERSION,
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

  // 检查是否是微信OAuth回调
  const wechatState = tryParseWechatState(state);

  if (wechatState.isWechat && code && IS_DOMESTIC_VERSION) {
    console.info("[auth/callback] Detected WeChat OAuth callback, processing...");

    try {
      // 调用微信登录API处理code
      const wechatApiUrl = new URL("/api/domestic/auth/wechat", origin);
      const wechatResponse = await fetch(wechatApiUrl.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code, state }),
      });

      const wechatResult = await wechatResponse.json();

      if (!wechatResponse.ok || !wechatResult.success) {
        console.error("[auth/callback] WeChat login failed:", wechatResult.error);
        const errUrl = new URL("/auth/login", origin);
        errUrl.searchParams.set("error", "wechat_login_failed");
        errUrl.searchParams.set("error_description", wechatResult.error || "微信登录失败");
        return NextResponse.redirect(errUrl);
      }

      console.info("[auth/callback] WeChat login successful, redirecting to:", wechatState.next);

      // 创建响应并设置cookie
      const successUrl = new URL(wechatState.next, origin);
      const response = NextResponse.redirect(successUrl);

      // 从API返回的token设置cookie
      if (wechatResult.token) {
        response.cookies.set("auth-token", wechatResult.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7,
          path: "/",
        });
      }

      return response;
    } catch (error) {
      console.error("[auth/callback] WeChat processing error:", error);
      const errUrl = new URL("/auth/login", origin);
      errUrl.searchParams.set("error", "wechat_processing_error");
      errUrl.searchParams.set("error_description", "微信登录处理失败");
      return NextResponse.redirect(errUrl);
    }
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

  // Supabase OAuth 处理 (Google等)
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

  // OAuth 登录/注册埋点
  const user = data?.session?.user;
  if (user) {
    const provider = user.app_metadata?.provider || "oauth";
    const createdAt = new Date(user.created_at);
    const now = new Date();
    const isNewUser = (now.getTime() - createdAt.getTime()) < 5 * 60 * 1000;

    const trackOptions = {
      userAgent: request.headers.get("user-agent") || undefined,
      language: request.headers.get("accept-language")?.split(",")[0] || undefined,
      referrer: request.headers.get("referer") || undefined,
    };

    if (isNewUser) {
      trackRegisterEvent(user.id, { ...trackOptions, registerMethod: provider }).catch(() => {});
    } else {
      trackLoginEvent(user.id, { ...trackOptions, loginMethod: provider }).catch(() => {});
    }
  }

  // 创建成功响应并设置 cookies
  const successUrl = new URL(next, origin);
  const response = NextResponse.redirect(successUrl);

  // 设置 Supabase 返回的 cookies
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options as Record<string, unknown>);
  }

  return response;
}
