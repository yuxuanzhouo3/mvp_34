import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { geoRouter } from "@/lib/core/geo-router";
import { 
  RegionType, 
  GeoResult,
  getCurrencyByRegion,
  getPaymentMethodsByRegion,
  getAuthMethodsByRegion,
} from "@/lib/utils/ip-detection";
import { verifyAdminSessionToken } from "@/utils/session";

// ============================================================================
// Middleware 配置
// ============================================================================

const FAIL_CLOSED =
  (process.env.GEO_FAIL_CLOSED || "true").toLowerCase() === "true";

const ADMIN_SESSION_COOKIE_NAME = "admin_session";

// ============================================================================
// Middleware 主逻辑
// ============================================================================

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // 跳过静态资源
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    (pathname.includes(".") && !pathname.startsWith("/api/"))
  ) {
    return NextResponse.next();
  }

  // ============================================================================
  // Admin 路由保护
  // ============================================================================
  if (pathname.startsWith("/admin")) {
    // 非登录页需要验证 session
    if (!pathname.startsWith("/admin/login")) {
      const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;

      if (!sessionToken || !verifyAdminSessionToken(sessionToken)) {
        const loginUrl = new URL("/admin/login", request.url);
        return NextResponse.redirect(loginUrl);
      }
    }

    // Admin 路由直接返回，不经过地理位置检测，设置路径 header 供根布局使用
    const response = NextResponse.next();
    response.headers.set("x-pathname", pathname);
    return response;
  }

  // 先处理 Supabase Session 刷新和路由保护
  const supabaseResponse = await updateSession(request);

  // 如果 Supabase 中间件返回了重定向（例如未登录用户访问保护路由）
  if (supabaseResponse.status === 307 || supabaseResponse.status === 308) {
    return supabaseResponse;
  }

  try {
    const debugParam = searchParams.get("debug");
    const isDevelopment = process.env.NODE_ENV === "development";

    // 生产环境禁止调试模式
    if (debugParam && !isDevelopment) {
      console.warn(`[Middleware] Production debug mode blocked: ${debugParam}`);
      return new NextResponse(
        JSON.stringify({
          error: "Access Denied",
          message: "Debug mode is not allowed in production.",
          code: "DEBUG_MODE_BLOCKED",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    let geoResult: GeoResult;

    // 开发环境调试模式
    if (debugParam && isDevelopment) {
      console.info(`[Middleware] Debug mode enabled: ${debugParam}`);
      const debugResult = getDebugGeoResult(debugParam);

      if (debugResult) {
        geoResult = debugResult;
      } else {
        const clientIP = getClientIP(request);
        geoResult = await geoRouter.detect(clientIP || "");
      }
    } else {
      // 正常地理位置检测
      const clientIP = getClientIP(request);

      if (!clientIP) {
        // 开发环境：始终使用默认配置，方便本地调试
        if (isDevelopment) {
          console.warn("[Middleware] Development: No client IP detected, using default geo config");
          const defaultRegion = RegionType.USA;
          geoResult = {
            region: defaultRegion,
            countryCode: "US",
            currency: getCurrencyByRegion(defaultRegion),
            paymentMethods: getPaymentMethodsByRegion(defaultRegion),
            authMethods: getAuthMethodsByRegion(defaultRegion),
          };
        } 
        // 生产环境：根据 GEO_FAIL_CLOSED 配置决定
        else if (!FAIL_CLOSED) {
          // fail-closed 关闭：使用默认配置继续访问
          console.warn("[Middleware] Production: No client IP detected, using default geo config (fail-closed disabled)");
          const defaultRegion = RegionType.USA;
          geoResult = {
            region: defaultRegion,
            countryCode: "US",
            currency: getCurrencyByRegion(defaultRegion),
            paymentMethods: getPaymentMethodsByRegion(defaultRegion),
            authMethods: getAuthMethodsByRegion(defaultRegion),
          };
        } else {
          // fail-closed 开启：拒绝访问（安全策略）
          console.warn("[Middleware] Production: No client IP, access blocked (fail-closed enabled)");
          return new NextResponse(
            JSON.stringify({
              error: "Access Denied",
              message: "IP detection failed. Access blocked by policy.",
              code: "GEO_FAIL_CLOSED",
            }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      } else {
        // 正常检测到 IP，进行地理位置检测
        geoResult = await geoRouter.detect(clientIP);
      }

    }

    // 禁止欧洲IP访问
    if (
      geoResult.region === RegionType.EUROPE &&
      !(debugParam && isDevelopment)
    ) {
      console.info(`[Middleware] European IP blocked: ${geoResult.countryCode}`);
      return new NextResponse(
        JSON.stringify({
          error: "Access Denied",
          message: "This service is not available in your region due to regulatory requirements.",
          code: "REGION_BLOCKED",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 添加地理信息头（复用 supabaseResponse 以保持 cookies 设置）
    supabaseResponse.headers.set("X-User-Region", geoResult.region);
    supabaseResponse.headers.set("X-User-Country", geoResult.countryCode);
    supabaseResponse.headers.set("X-User-Currency", geoResult.currency);

    if (debugParam && isDevelopment) {
      supabaseResponse.headers.set("X-Debug-Mode", debugParam);
    }

    return supabaseResponse;
  } catch (error) {
    console.error("[Middleware] Geo routing error:", error);

    if (FAIL_CLOSED) {
      return new NextResponse(
        JSON.stringify({
          error: "Access Denied",
          message: "Geo detection failed. Access blocked by policy.",
          code: "GEO_FAIL_CLOSED",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const response = NextResponse.next();
    response.headers.set("X-Geo-Error", "true");
    return response;
  }
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 获取调试模式的地理结果
 */
function getDebugGeoResult(debugParam: string): GeoResult | null {
  switch (debugParam.toLowerCase()) {
    case "china":
    case "cn":
      return {
        region: RegionType.CHINA,
        countryCode: "CN",
        currency: "CNY",
        paymentMethods: ["wechat", "alipay"],
        authMethods: ["wechat", "email"],
      };
    case "usa":
    case "us":
      return {
        region: RegionType.USA,
        countryCode: "US",
        currency: "USD",
        paymentMethods: ["stripe", "paypal"],
        authMethods: ["google", "email"],
      };
    case "europe":
    case "eu":
      return {
        region: RegionType.EUROPE,
        countryCode: "DE",
        currency: "EUR",
        paymentMethods: [],
        authMethods: ["email"],
      };
    case "india":
    case "in":
      return {
        region: RegionType.INDIA,
        countryCode: "IN",
        currency: "INR",
        paymentMethods: ["stripe", "paypal"],
        authMethods: ["google", "email"],
      };
    case "singapore":
    case "sg":
      return {
        region: RegionType.SINGAPORE,
        countryCode: "SG",
        currency: "SGD",
        paymentMethods: ["stripe", "paypal"],
        authMethods: ["google", "email"],
      };
    default:
      return null;
  }
}

/**
 * 获取客户端真实IP地址
 */
function getClientIP(request: NextRequest): string | null {
  const isDev = process.env.NODE_ENV !== "production";

  // 开发环境调试IP
  if (isDev) {
    const debugIp =
      request.headers.get("x-debug-ip") ||
      request.nextUrl.searchParams.get("debug_ip") ||
      request.nextUrl.searchParams.get("debugip");
    if (debugIp && isValidIP(debugIp)) {
      return debugIp;
    }
  }

  // 1. Vercel 提供的真实 IP（优先，最可靠）
  const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for");
  if (vercelForwardedFor) {
    const ips = vercelForwardedFor.split(",").map((ip) => ip.trim());
    for (const ip of ips) {
      if (isValidIP(ip)) {
        return ip;
      }
    }
  }

  // 2. Cloudflare 提供的真实 IP
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp && isValidIP(cfIp)) {
    return cfIp;
  }

  // 3. X-Real-IP
  const realIP = request.headers.get("x-real-ip");
  if (realIP && isValidIP(realIP)) {
    return realIP;
  }

  // 4. X-Forwarded-For
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map((ip) => ip.trim());
    for (const ip of ips) {
      if (isValidIP(ip)) {
        return ip;
      }
    }
  }

  // 5. 其他代理头
  const possibleHeaders = [
    "x-client-ip",
    "x-forwarded",
    "forwarded-for",
    "forwarded",
    "true-client-ip",
  ];

  for (const header of possibleHeaders) {
    const ip = request.headers.get(header);
    if (ip && isValidIP(ip)) {
      return ip;
    }
  }

  // 6. Vercel 平台扩展（request.ip）
  const vercelIp = (request as unknown as { ip?: string }).ip;
  if (vercelIp && isValidIP(vercelIp)) {
    return vercelIp;
  }

  return null;
}

/**
 * 验证IP地址格式
 */
function isValidIP(ip: string): boolean {
  // IPv4
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split(".").map(Number);
    return parts.every((part) => part >= 0 && part <= 255);
  }

  // IPv6
  if (ip.includes(":")) {
    const ipv6Loose = /^[0-9a-fA-F:]+$/;
    if (!ipv6Loose.test(ip)) return false;
    const lower = ip.toLowerCase();
    // 排除本地和私有IPv6
    if (lower === "::1") return false;
    if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return false;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return false;
    if (lower.startsWith("2001:db8")) return false;
    return true;
  }

  return false;
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"],
};
