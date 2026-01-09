import { NextRequest, NextResponse } from "next/server";
import { trackAnalyticsEvent, parseUserAgent, generateSessionId, type AnalyticsEventType } from "@/services/analytics";

export const runtime = "nodejs";

const VALID_EVENT_TYPES: AnalyticsEventType[] = [
  "session_start", "session_end", "register", "page_view",
  "feature_use", "payment", "subscription", "error"
];

// 简单的内存 rate limiting（生产环境建议使用 Redis）
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1分钟
const RATE_LIMIT_MAX = 100; // 每分钟最多100次请求

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }

  record.count++;
  return record.count > RATE_LIMIT_MAX;
}

function isValidEventType(type: string): type is AnalyticsEventType {
  return VALID_EVENT_TYPES.includes(type as AnalyticsEventType);
}

// 验证 eventData 大小
function isValidEventData(data: unknown): boolean {
  if (!data) return true;
  const str = JSON.stringify(data);
  return str.length <= 10 * 1024; // 限制 10KB
}

/**
 * POST /api/analytics/track
 * 客户端埋点 API - 用于前端组件调用
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting 检查
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] ||
                     request.headers.get("x-real-ip") || "unknown";
    if (isRateLimited(clientIp)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const { userId, eventType, eventData } = body as {
      userId?: string;
      eventType?: string;
      eventData?: Record<string, unknown>;
    };

    if (!userId || !eventType) {
      return NextResponse.json(
        { error: "Missing userId or eventType" },
        { status: 400 }
      );
    }

    if (!isValidEventType(eventType)) {
      return NextResponse.json(
        { error: `Invalid eventType: ${eventType}` },
        { status: 400 }
      );
    }

    // 验证 eventData 大小
    if (!isValidEventData(eventData)) {
      return NextResponse.json(
        { error: "eventData too large (max 10KB)" },
        { status: 400 }
      );
    }

    const userAgent = request.headers.get("user-agent") || undefined;
    const deviceInfo = parseUserAgent(userAgent);

    const result = await trackAnalyticsEvent({
      userId,
      eventType,
      ...deviceInfo,
      language: request.headers.get("accept-language")?.split(",")[0] || undefined,
      referrer: request.headers.get("referer") || undefined,
      sessionId: generateSessionId(),
      eventData,
    });

    if (!result.success) {
      console.error("[api/analytics/track] Track failed:", result.error);
      return NextResponse.json(
        { error: result.error || "Track failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/analytics/track] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
