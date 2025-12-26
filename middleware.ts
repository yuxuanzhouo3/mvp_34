import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// 区域类型定义
// ============================================================================

enum RegionType {
  CHINA = "china",
  USA = "usa",
  EUROPE = "europe",
  INDIA = "india",
  SINGAPORE = "singapore",
  OTHER = "other",
}

interface GeoResult {
  region: RegionType;
  countryCode: string;
  currency: string;
}

// ============================================================================
// IP 检测工具
// ============================================================================

// 欧洲国家代码列表（EU + EEA + UK + CH）
const EUROPEAN_COUNTRIES = [
  // EU 成员国 (27个)
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  // EEA 非 EU 成员
  "IS", "LI", "NO",
  // 英国
  "GB",
  // 欧盟未知时返回 EU 代码的兼容
  "EU",
  // 瑞士
  "CH",
];

// 主流市场国家
const TARGET_MARKETS = {
  CHINA: "CN",
  USA: "US",
  INDIA: "IN",
  SINGAPORE: "SG",
};

function getRegionFromCountryCode(countryCode: string): RegionType {
  const code = (countryCode || "").toUpperCase();
  if (code === TARGET_MARKETS.CHINA) return RegionType.CHINA;
  if (code === TARGET_MARKETS.USA) return RegionType.USA;
  if (code === TARGET_MARKETS.INDIA) return RegionType.INDIA;
  if (code === TARGET_MARKETS.SINGAPORE) return RegionType.SINGAPORE;
  if (EUROPEAN_COUNTRIES.includes(code)) return RegionType.EUROPE;
  return RegionType.OTHER;
}

function getCurrencyByRegion(region: RegionType): string {
  switch (region) {
    case RegionType.CHINA: return "CNY";
    case RegionType.USA: return "USD";
    case RegionType.INDIA: return "INR";
    case RegionType.SINGAPORE: return "SGD";
    case RegionType.EUROPE: return "EUR";
    default: return "USD";
  }
}

// ============================================================================
// GeoRouter - IP 地理位置检测
// ============================================================================

class GeoRouter {
  private cache = new Map<string, { result: GeoResult; timestamp: number }>();
  private pendingRequests = new Map<string, Promise<GeoResult>>();
  private readonly CACHE_TTL = 1000 * 60 * 60; // 1小时缓存
  private readonly REQUEST_TIMEOUT = 5000; // 5秒超时
  private readonly MAX_RETRIES = 2;
  private readonly FAIL_CLOSED =
    (process.env.GEO_FAIL_CLOSED || "false").toLowerCase() === "true";

  async detect(ip: string): Promise<GeoResult> {
    // 检查缓存
    const cached = this.cache.get(ip);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result;
    }

    // 检查是否有正在进行的请求
    const pending = this.pendingRequests.get(ip);
    if (pending) {
      return pending;
    }

    // 创建新的请求
    const requestPromise = this.performDetection(ip);
    this.pendingRequests.set(ip, requestPromise);

    try {
      const result = await requestPromise;
      this.cache.set(ip, { result, timestamp: Date.now() });
      return result;
    } catch (error) {
      console.error("Geo detection failed:", error);

      if (this.FAIL_CLOSED) {
        throw new Error("Geo detection failed (fail-closed)");
      }

      const defaultResult = this.getDefaultGeoResult();
      this.cache.set(ip, { result: defaultResult, timestamp: Date.now() });
      return defaultResult;
    } finally {
      this.pendingRequests.delete(ip);
    }
  }

  private async performDetection(ip: string): Promise<GeoResult> {
    const services = [
      () => this.detectWithPrimaryService(ip),
      () => this.detectWithFallbackService(ip),
      () => this.detectWithThirdFallback(ip),
    ];

    for (const service of services) {
      try {
        return await this.withRetry(service, this.MAX_RETRIES);
      } catch (error) {
        console.warn("Service failed, trying next:", error);
      }
    }

    return this.detectLocally(ip);
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number
  ): Promise<T> {
    let lastError: Error = new Error("Unknown error");

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError;
  }

  private async fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private buildIpapiUrl(ip?: string): string {
    const base = process.env.IP_API_URL || "https://ipapi.co";
    const trimmed = base.replace(/\/json\/?$/, "").replace(/\/$/, "");
    if (ip) {
      return `${trimmed}/${ip}/json/`;
    }
    return `${trimmed}/json/`;
  }

  private async detectWithPrimaryService(ip: string): Promise<GeoResult> {
    if (!ip || ip === "" || ip === "::1" || ip === "127.0.0.1") {
      return this.detectLocally(ip);
    }

    const url = this.buildIpapiUrl(ip);
    const response = await this.fetchWithTimeout(url, this.REQUEST_TIMEOUT);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`IP detection failed: ${data.reason || data.error}`);
    }

    if (!data.country_code) {
      throw new Error("Invalid response: missing country_code");
    }

    return this.buildGeoResult(data.country_code);
  }

  private async detectWithFallbackService(ip: string): Promise<GeoResult> {
    if (!ip || ip === "" || ip === "::1" || ip === "127.0.0.1") {
      return this.detectLocally(ip);
    }

    const response = await this.fetchWithTimeout(
      `http://ip-api.com/json/${ip}`,
      this.REQUEST_TIMEOUT
    );

    if (!response.ok) {
      throw new Error(`Fallback service HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.status === "fail") {
      throw new Error(`Fallback IP detection failed: ${data.message}`);
    }

    if (!data.countryCode) {
      throw new Error("Invalid fallback response: missing countryCode");
    }

    return this.buildGeoResult(data.countryCode);
  }

  private async detectWithThirdFallback(ip: string): Promise<GeoResult> {
    if (!ip || ip === "" || ip === "::1" || ip === "127.0.0.1") {
      return this.detectLocally(ip);
    }

    const response = await this.fetchWithTimeout(
      `https://ipinfo.io/${ip}/json`,
      this.REQUEST_TIMEOUT
    );

    if (!response.ok) {
      throw new Error(`Third fallback service HTTP ${response.status}`);
    }

    const data = await response.json();
    const countryCode = data.country;

    if (!countryCode) {
      throw new Error("Invalid third fallback response: missing country");
    }

    return this.buildGeoResult(countryCode);
  }

  private detectLocally(ip: string): GeoResult {
    if (this.isPrivateIP(ip)) {
      return this.buildGeoResult("CN");
    }
    return this.buildGeoResult("US");
  }

  private buildGeoResult(countryCode: string): GeoResult {
    const region = getRegionFromCountryCode(countryCode);
    return {
      region,
      countryCode: countryCode.toUpperCase(),
      currency: getCurrencyByRegion(region),
    };
  }

  private isPrivateIP(ip: string): boolean {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4) return false;

    return (
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168)
    );
  }

  private getDefaultGeoResult(): GeoResult {
    return {
      region: RegionType.USA,
      countryCode: "US",
      currency: "USD",
    };
  }
}

const geoRouter = new GeoRouter();

// ============================================================================
// Middleware 主逻辑
// ============================================================================

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  const FAIL_CLOSED =
    (process.env.GEO_FAIL_CLOSED || "false").toLowerCase() === "true";

  // 跳过静态资源
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    (pathname.includes(".") && !pathname.startsWith("/api/"))
  ) {
    return NextResponse.next();
  }

  try {
    const debugParam = searchParams.get("debug");
    const isDevelopment = process.env.NODE_ENV === "development";

    // 生产环境禁止调试模式
    if (debugParam && !isDevelopment) {
      console.warn(`🚨 生产环境检测到调试模式参数，已禁止访问: ${debugParam}`);
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
      console.log(`🔧 调试模式启用: ${debugParam}`);

      switch (debugParam.toLowerCase()) {
        case "china":
          geoResult = { region: RegionType.CHINA, countryCode: "CN", currency: "CNY" };
          break;
        case "usa":
        case "us":
          geoResult = { region: RegionType.USA, countryCode: "US", currency: "USD" };
          break;
        case "europe":
        case "eu":
          geoResult = { region: RegionType.EUROPE, countryCode: "DE", currency: "EUR" };
          break;
        default:
          const clientIP = getClientIP(request);
          geoResult = await geoRouter.detect(clientIP || "");
      }
    } else {
      // 正常地理位置检测
      const clientIP = getClientIP(request);

      if (!clientIP) {
        console.warn("无法获取客户端IP，标记为未知风险");
        if (FAIL_CLOSED) {
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
        const res = NextResponse.next();
        res.headers.set("X-Geo-Error", "true");
        return res;
      }

      geoResult = await geoRouter.detect(clientIP);
    }

    // 禁止欧洲IP访问
    if (
      geoResult.region === RegionType.EUROPE &&
      !(debugParam && isDevelopment)
    ) {
      console.log(`禁止欧洲IP访问: ${geoResult.countryCode}`);
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

    // 添加地理信息头
    const response = NextResponse.next();
    response.headers.set("X-User-Region", geoResult.region);
    response.headers.set("X-User-Country", geoResult.countryCode);
    response.headers.set("X-User-Currency", geoResult.currency);

    if (debugParam && isDevelopment) {
      response.headers.set("X-Debug-Mode", debugParam);
    }

    return response;
  } catch (error) {
    console.error("地理分流中间件错误:", error);

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
 * 获取客户端真实IP地址
 */
function getClientIP(request: NextRequest): string | null {
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    const debugIp =
      request.headers.get("x-debug-ip") ||
      request.nextUrl.searchParams.get("debug_ip") ||
      request.nextUrl.searchParams.get("debugip");
    if (debugIp && isValidIP(debugIp)) {
      return debugIp;
    }
  }

  // 1. X-Real-IP
  const realIP = request.headers.get("x-real-ip");
  if (realIP && isValidIP(realIP)) {
    return realIP;
  }

  // 2. X-Forwarded-For
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map((ip) => ip.trim());
    for (const ip of ips) {
      if (isValidIP(ip)) {
        return ip;
      }
    }
  }

  // 3. 其他头
  const possibleHeaders = [
    "x-client-ip",
    "x-forwarded",
    "forwarded-for",
    "forwarded",
    "cf-connecting-ip",
    "true-client-ip",
  ];

  for (const header of possibleHeaders) {
    const ip = request.headers.get(header);
    if (ip && isValidIP(ip)) {
      return ip;
    }
  }

  // 4. Vercel 平台扩展
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
