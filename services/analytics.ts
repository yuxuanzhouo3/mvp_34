/**
 * 用户分析服务 - 统一支持国内版 (CloudBase) 和国际版 (Supabase)
 * 用于记录用户行为、登录、注册、支付等事件
 *
 * 优化：使用内存批量聚合，减少数据库写入次数
 */

import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// =============================================================================
// 类型定义
// =============================================================================

export type AnalyticsEventType =
  | "session_start"      // 会话开始（登录）
  | "session_end"        // 会话结束（登出）
  | "register"           // 用户注册
  | "page_view"          // 页面访问
  | "feature_use"        // 功能使用
  | "build_start"        // 开始构建
  | "build_complete"     // 构建完成
  | "build_download"     // 下载构建
  | "payment"            // 支付行为
  | "subscription"       // 订阅变更
  | "error";             // 错误上报

export interface AnalyticsEventParams {
  userId: string;
  eventType: AnalyticsEventType;
  source?: "global" | "cn";
  deviceType?: string;       // 'desktop', 'mobile', 'tablet'
  os?: string;               // 'Windows', 'macOS', 'iOS', 'Android', 'Linux'
  browser?: string;          // 'Chrome', 'Safari', 'Firefox', 'Edge', 'App'
  appVersion?: string;       // 客户端版本号
  screenResolution?: string; // 屏幕分辨率
  language?: string;         // 浏览器语言
  country?: string;          // 国家代码
  region?: string;           // 地区/省份
  city?: string;             // 城市
  eventData?: Record<string, unknown>;
  sessionId?: string;
  referrer?: string;
}

export interface TrackResult {
  success: boolean;
  error?: string;
}

// =============================================================================
// 批量聚合配置
// =============================================================================

const FLUSH_INTERVAL = 5000;  // 5秒刷新一次
const FLUSH_SIZE = 50;        // 达到50条立即刷新
const MAX_BUFFER_SIZE = 500;  // 缓冲区最大容量，防止内存溢出
const eventBuffer: Array<AnalyticsEventParams & { created_at: string }> = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

// 重要事件类型（立即写入，不缓冲）
const IMMEDIATE_EVENT_TYPES: AnalyticsEventType[] = ["register", "payment", "subscription"];

/**
 * 启动定时刷新
 */
function ensureFlushTimer() {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    await flushEvents();
  }, FLUSH_INTERVAL);
}

/**
 * 批量刷新事件到数据库
 */
async function flushEvents(): Promise<void> {
  if (eventBuffer.length === 0) return;

  const batch = eventBuffer.splice(0, eventBuffer.length);

  // 按 source 分组
  const globalEvents = batch.filter(e => e.source === "global");
  const cnEvents = batch.filter(e => e.source === "cn");

  // 并行写入
  const promises: Promise<void>[] = [];

  if (globalEvents.length > 0) {
    promises.push(flushSupabaseBatch(globalEvents));
  }
  if (cnEvents.length > 0) {
    promises.push(flushCloudBaseBatch(cnEvents));
  }

  await Promise.allSettled(promises);
}

/**
 * 批量写入 Supabase
 */
async function flushSupabaseBatch(events: Array<AnalyticsEventParams & { created_at: string }>): Promise<void> {
  if (!supabaseAdmin || events.length === 0) return;

  try {
    const insertData = events.map(params => ({
      user_id: params.userId,
      source: params.source || "global",
      event_type: params.eventType,
      device_type: params.deviceType || null,
      os: params.os || null,
      browser: params.browser || null,
      app_version: params.appVersion || null,
      screen_resolution: params.screenResolution || null,
      language: params.language || null,
      country: params.country || null,
      region: params.region || null,
      city: params.city || null,
      event_data: params.eventData || {},
      session_id: params.sessionId || null,
      referrer: params.referrer || null,
      created_at: params.created_at,
    }));

    const { error } = await supabaseAdmin.from("user_analytics").insert(insertData);
    if (error) {
      console.error("[analytics] Supabase batch insert error:", error);
    }
  } catch (error) {
    console.error("[analytics] Supabase batch flush error:", error);
  }
}

/**
 * 批量写入 CloudBase
 */
async function flushCloudBaseBatch(events: Array<AnalyticsEventParams & { created_at: string }>): Promise<void> {
  if (events.length === 0) return;

  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    // CloudBase 使用循环插入（不支持原生批量）
    for (const params of events) {
      await db.collection("user_analytics").add({
        user_id: params.userId,
        source: params.source || "cn",
        event_type: params.eventType,
        device_type: params.deviceType || null,
        os: params.os || null,
        browser: params.browser || null,
        app_version: params.appVersion || null,
        screen_resolution: params.screenResolution || null,
        language: params.language || null,
        country: params.country || null,
        region: params.region || null,
        city: params.city || null,
        event_data: params.eventData || {},
        session_id: params.sessionId || null,
        referrer: params.referrer || null,
        created_at: params.created_at,
      });
    }
  } catch (error) {
    console.error("[analytics] CloudBase batch flush error:", error);
  }
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 从 User-Agent 解析设备信息
 */
export function parseUserAgent(userAgent?: string): {
  deviceType: string;
  os: string;
  browser: string;
} {
  if (!userAgent) {
    return { deviceType: "unknown", os: "unknown", browser: "unknown" };
  }

  const ua = userAgent.toLowerCase();

  // 检测设备类型
  let deviceType = "desktop";
  if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    deviceType = /ipad|tablet/i.test(ua) ? "tablet" : "mobile";
  }

  // 检测操作系统
  let os = "unknown";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/linux/i.test(ua)) os = "Linux";

  // 检测浏览器
  let browser = "unknown";
  if (/edg/i.test(ua)) browser = "Edge";
  else if (/chrome/i.test(ua)) browser = "Chrome";
  else if (/safari/i.test(ua)) browser = "Safari";
  else if (/firefox/i.test(ua)) browser = "Firefox";
  else if (/opera|opr/i.test(ua)) browser = "Opera";

  return { deviceType, os, browser };
}

/**
 * 生成会话 ID
 */
export function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// =============================================================================
// 统一导出函数
// =============================================================================

/**
 * 记录用户分析事件
 * 自动根据版本选择 CloudBase 或 Supabase
 *
 * 优化策略：
 * - 重要事件（注册、支付、订阅）立即写入
 * - 普通事件（页面访问、功能使用等）批量聚合后写入
 */
export async function trackAnalyticsEvent(params: AnalyticsEventParams): Promise<TrackResult> {
  // 根据版本自动设置 source
  if (!params.source) {
    params.source = IS_DOMESTIC_VERSION ? "cn" : "global";
  }

  const eventWithTimestamp = {
    ...params,
    created_at: new Date().toISOString(),
  };

  // 重要事件立即写入
  if (IMMEDIATE_EVENT_TYPES.includes(params.eventType)) {
    if (IS_DOMESTIC_VERSION) {
      return trackCloudBaseEventDirect(eventWithTimestamp);
    } else {
      return trackSupabaseEventDirect(eventWithTimestamp);
    }
  }

  // 普通事件加入缓冲区
  // 缓冲区溢出保护：超过最大容量时丢弃最旧事件
  if (eventBuffer.length >= MAX_BUFFER_SIZE) {
    console.warn("[analytics] Buffer overflow, dropping oldest events");
    eventBuffer.splice(0, Math.floor(MAX_BUFFER_SIZE * 0.2));
  }
  eventBuffer.push(eventWithTimestamp);
  ensureFlushTimer();

  // 达到阈值立即刷新
  if (eventBuffer.length >= FLUSH_SIZE) {
    flushEvents().catch(err => console.error("[analytics] Flush error:", err));
  }

  return { success: true };
}

/**
 * 直接写入 Supabase（用于重要事件）
 */
async function trackSupabaseEventDirect(params: AnalyticsEventParams & { created_at: string }): Promise<TrackResult> {
  if (!supabaseAdmin) {
    return { success: false, error: "supabaseAdmin not available" };
  }

  try {
    const { error } = await supabaseAdmin.from("user_analytics").insert({
      user_id: params.userId,
      source: params.source || "global",
      event_type: params.eventType,
      device_type: params.deviceType || null,
      os: params.os || null,
      browser: params.browser || null,
      app_version: params.appVersion || null,
      screen_resolution: params.screenResolution || null,
      language: params.language || null,
      country: params.country || null,
      region: params.region || null,
      city: params.city || null,
      event_data: params.eventData || {},
      session_id: params.sessionId || null,
      referrer: params.referrer || null,
      created_at: params.created_at,
    });

    if (error) {
      console.error("[analytics] Supabase insert error:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    console.error("[analytics] Supabase track error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Track event failed" };
  }
}

/**
 * 直接写入 CloudBase（用于重要事件）
 */
async function trackCloudBaseEventDirect(params: AnalyticsEventParams & { created_at: string }): Promise<TrackResult> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    await db.collection("user_analytics").add({
      user_id: params.userId,
      source: params.source || "cn",
      event_type: params.eventType,
      device_type: params.deviceType || null,
      os: params.os || null,
      browser: params.browser || null,
      app_version: params.appVersion || null,
      screen_resolution: params.screenResolution || null,
      language: params.language || null,
      country: params.country || null,
      region: params.region || null,
      city: params.city || null,
      event_data: params.eventData || {},
      session_id: params.sessionId || null,
      referrer: params.referrer || null,
      created_at: params.created_at,
    });

    return { success: true };
  } catch (error) {
    console.error("[analytics] CloudBase track error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Track event failed" };
  }
}

/**
 * 记录用户登录事件
 */
export async function trackLoginEvent(
  userId: string,
  options?: {
    userAgent?: string;
    language?: string;
    referrer?: string;
    loginMethod?: string;
  }
): Promise<TrackResult> {
  const deviceInfo = parseUserAgent(options?.userAgent);

  return trackAnalyticsEvent({
    userId,
    eventType: "session_start",
    ...deviceInfo,
    language: options?.language,
    referrer: options?.referrer,
    sessionId: generateSessionId(),
    eventData: {
      loginMethod: options?.loginMethod || "email",
    },
  });
}

/**
 * 记录用户注册事件
 */
export async function trackRegisterEvent(
  userId: string,
  options?: {
    userAgent?: string;
    language?: string;
    referrer?: string;
    registerMethod?: string;
  }
): Promise<TrackResult> {
  const deviceInfo = parseUserAgent(options?.userAgent);

  return trackAnalyticsEvent({
    userId,
    eventType: "register",
    ...deviceInfo,
    language: options?.language,
    referrer: options?.referrer,
    sessionId: generateSessionId(),
    eventData: {
      registerMethod: options?.registerMethod || "email",
    },
  });
}

/**
 * 记录微信登录事件
 */
export async function trackWechatLoginEvent(
  userId: string,
  options?: {
    userAgent?: string;
    language?: string;
    isNewUser?: boolean;
  }
): Promise<TrackResult> {
  const deviceInfo = parseUserAgent(options?.userAgent);

  return trackAnalyticsEvent({
    userId,
    eventType: options?.isNewUser ? "register" : "session_start",
    ...deviceInfo,
    language: options?.language,
    sessionId: generateSessionId(),
    eventData: {
      loginMethod: "wechat",
      isNewUser: options?.isNewUser || false,
    },
  });
}

/**
 * 记录支付事件
 */
export async function trackPaymentEvent(
  userId: string,
  paymentData: {
    amount: number;
    currency: string;
    plan?: string;
    provider: string;
    orderId?: string;
  }
): Promise<TrackResult> {
  return trackAnalyticsEvent({
    userId,
    eventType: "payment",
    eventData: paymentData,
  });
}

/**
 * 记录订阅变更事件
 */
export async function trackSubscriptionEvent(
  userId: string,
  subscriptionData: {
    action: "subscribe" | "upgrade" | "downgrade" | "cancel" | "renew";
    fromPlan?: string;
    toPlan: string;
    period?: string;
  }
): Promise<TrackResult> {
  return trackAnalyticsEvent({
    userId,
    eventType: "subscription",
    eventData: subscriptionData,
  });
}

/**
 * 记录构建开始事件
 */
export async function trackBuildStartEvent(
  userId: string,
  buildData: {
    buildId: string;
    platform: string;
    appName?: string;
  }
): Promise<TrackResult> {
  return trackAnalyticsEvent({
    userId,
    eventType: "build_start",
    eventData: buildData,
  });
}

/**
 * 记录构建完成事件
 */
export async function trackBuildCompleteEvent(
  userId: string,
  buildData: {
    buildId: string;
    platform: string;
    success: boolean;
    durationMs?: number;
    errorMessage?: string;
  }
): Promise<TrackResult> {
  return trackAnalyticsEvent({
    userId,
    eventType: "build_complete",
    eventData: buildData,
  });
}

/**
 * 记录构建下载事件
 */
export async function trackBuildDownloadEvent(
  userId: string,
  downloadData: {
    buildId: string;
    platform: string;
  }
): Promise<TrackResult> {
  return trackAnalyticsEvent({
    userId,
    eventType: "build_download",
    eventData: downloadData,
  });
}
