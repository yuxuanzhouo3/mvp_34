/**
 * 订单服务 - 统一支持国内版 (CloudBase) 和国际版 (Supabase)
 * 用于创建、更新、查询订单
 */

import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { nanoid } from "nanoid";

// =============================================================================
// 类型定义
// =============================================================================

export interface CreateOrderParams {
  userId: string;
  userEmail?: string;
  productName: string;
  productType: "subscription" | "one_time" | "upgrade";
  plan?: string;
  period?: string;
  amount: number;
  currency?: string;
  originalAmount?: number;
  discountAmount?: number;
  paymentMethod?: string;
  source?: "global" | "cn";
  // 风控信息
  ipAddress?: string;
  userAgent?: string;
  country?: string;
  region?: string;
  city?: string;
}

export interface UpdateOrderParams {
  paymentStatus?: string;
  paidAt?: string;
  providerOrderId?: string;
  providerTransactionId?: string;
  riskScore?: number;
  riskLevel?: string;
  riskFactors?: unknown[];
  refundStatus?: string;
  refundAmount?: number;
  refundReason?: string;
  refundedAt?: string;
  notes?: string;
}

export interface Order {
  id: string;
  order_no: string;
  user_id: string;
  user_email?: string;
  product_name: string;
  product_type: string;
  plan?: string;
  period?: string;
  amount: number;
  currency: string;
  original_amount?: number;
  discount_amount?: number;
  payment_method?: string;
  payment_status: string;
  paid_at?: string;
  provider_order_id?: string;
  provider_transaction_id?: string;
  risk_score: number;
  risk_level: string;
  risk_factors?: unknown[];
  ip_address?: string;
  device_fingerprint?: string;
  user_agent?: string;
  country?: string;
  region_name?: string;
  city?: string;
  source: string;
  refund_status?: string;
  refund_amount?: number;
  refund_reason?: string;
  refunded_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderResult {
  success: boolean;
  order?: Order;
  orderId?: string;
  orderNo?: string;
  error?: string;
}

// =============================================================================
// 订单号生成
// =============================================================================

/**
 * 生成订单号
 * 格式: MC + 年月日 + 随机字符串
 * 例如: MC20250113ABC123XYZ
 */
function generateOrderNo(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const randomStr = nanoid(10).toUpperCase();
  return `MC${dateStr}${randomStr}`;
}

// =============================================================================
// 风控评估
// =============================================================================

// 用于追踪用户短时间内的订单（内存缓存，生产环境建议使用 Redis）
const recentOrdersCache = new Map<string, { count: number; lastOrderTime: number }>();
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5分钟窗口
const MAX_ORDERS_PER_WINDOW = 3; // 5分钟内最多3个订单

// 已知的高风险IP段（示例，实际应从数据库或配置加载）
const HIGH_RISK_IP_PREFIXES = [
  "10.0.0.",    // 私有网络（不应出现在生产环境）
  "192.168.",   // 私有网络
  "172.16.",    // 私有网络
];

// 已知的代理/VPN特征
const PROXY_USER_AGENT_KEYWORDS = [
  "proxy", "vpn", "tor", "anonymizer", "hide"
];

/**
 * 检查IP是否为未知或可疑
 */
function isUnknownOrSuspiciousIP(ip?: string): { suspicious: boolean; reason?: string } {
  if (!ip) {
    return { suspicious: true, reason: "missing_ip" };
  }

  // 检查是否为私有IP（不应出现在生产环境的订单中）
  for (const prefix of HIGH_RISK_IP_PREFIXES) {
    if (ip.startsWith(prefix)) {
      return { suspicious: true, reason: "private_ip" };
    }
  }

  // 检查是否为本地回环地址
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") {
    return { suspicious: true, reason: "localhost_ip" };
  }

  return { suspicious: false };
}

/**
 * 检查用户是否在短时间内创建了过多订单
 */
function checkRateLimit(userId: string): { exceeded: boolean; orderCount: number } {
  const now = Date.now();
  const userRecord = recentOrdersCache.get(userId);

  if (!userRecord) {
    // 首次订单，记录
    recentOrdersCache.set(userId, { count: 1, lastOrderTime: now });
    return { exceeded: false, orderCount: 1 };
  }

  // 检查是否在时间窗口内
  if (now - userRecord.lastOrderTime > RATE_LIMIT_WINDOW) {
    // 超出窗口，重置计数
    recentOrdersCache.set(userId, { count: 1, lastOrderTime: now });
    return { exceeded: false, orderCount: 1 };
  }

  // 在窗口内，增加计数
  const newCount = userRecord.count + 1;
  recentOrdersCache.set(userId, { count: newCount, lastOrderTime: now });

  return {
    exceeded: newCount > MAX_ORDERS_PER_WINDOW,
    orderCount: newCount,
  };
}

/**
 * 检查User-Agent是否可疑
 */
function isSuspiciousUserAgent(userAgent?: string): { suspicious: boolean; reason?: string } {
  if (!userAgent) {
    return { suspicious: true, reason: "missing_user_agent" };
  }

  const ua = userAgent.toLowerCase();

  // 检查是否包含代理/VPN关键词
  for (const keyword of PROXY_USER_AGENT_KEYWORDS) {
    if (ua.includes(keyword)) {
      return { suspicious: true, reason: "proxy_detected" };
    }
  }

  // 检查是否为空或过短的User-Agent（可能是机器人）
  if (ua.length < 20) {
    return { suspicious: true, reason: "short_user_agent" };
  }

  // 检查是否缺少常见浏览器标识
  const hasCommonBrowser = ["chrome", "firefox", "safari", "edge", "opera", "mozilla"].some(
    browser => ua.includes(browser)
  );
  if (!hasCommonBrowser) {
    return { suspicious: true, reason: "unknown_browser" };
  }

  return { suspicious: false };
}

/** 风控评估参数（简化版，用于支付回调） */
export interface RiskAssessParams {
  userId: string;
  userEmail?: string;
  amount: number;
  ipAddress?: string;
  userAgent?: string;
  country?: string;
}

/** 风控评估结果 */
export interface RiskAssessResult {
  riskScore: number;
  riskLevel: string;
  riskFactors: string[];
}

/**
 * 综合风控评估（导出版本，供支付回调使用）
 * 返回风险评分 (0-100) 和风险等级
 */
export function assessPaymentRisk(params: RiskAssessParams): RiskAssessResult {
  const factors: string[] = [];
  let score = 0;

  // 1. 金额风险评估
  if (params.amount > 1000) {
    score += 25;
    factors.push("very_high_amount");
  } else if (params.amount > 500) {
    score += 20;
    factors.push("high_amount");
  } else if (params.amount > 200) {
    score += 10;
    factors.push("medium_amount");
  }

  // 2. 用户信息完整性
  if (!params.userEmail) {
    score += 15;
    factors.push("missing_email");
  }

  // 3. IP地址风险评估
  const ipCheck = isUnknownOrSuspiciousIP(params.ipAddress);
  if (ipCheck.suspicious) {
    score += 20;
    factors.push(ipCheck.reason || "suspicious_ip");
  }

  // 4. User-Agent风险评估
  const uaCheck = isSuspiciousUserAgent(params.userAgent);
  if (uaCheck.suspicious) {
    score += 15;
    factors.push(uaCheck.reason || "suspicious_user_agent");
  }

  // 5. 频率限制检查
  const rateCheck = checkRateLimit(params.userId);
  if (rateCheck.exceeded) {
    score += 30;
    factors.push(`rate_limit_exceeded:${rateCheck.orderCount}_orders`);
  } else if (rateCheck.orderCount > 1) {
    score += 10;
    factors.push(`multiple_orders:${rateCheck.orderCount}`);
  }

  // 6. 地理位置风险
  if (!params.country) {
    score += 10;
    factors.push("missing_geo_info");
  }

  // 确定风险等级
  let level = "low";
  if (score >= 70) {
    level = "blocked";
  } else if (score >= 50) {
    level = "high";
  } else if (score >= 30) {
    level = "medium";
  }

  return { riskScore: Math.min(score, 100), riskLevel: level, riskFactors: factors };
}

/**
 * 综合风控评估（内部版本）
 * 返回风险评分 (0-100) 和风险等级
 */
function assessRisk(params: CreateOrderParams): {
  riskScore: number;
  riskLevel: string;
  riskFactors: string[];
} {
  const factors: string[] = [];
  let score = 0;

  // 1. 金额风险评估
  if (params.amount > 1000) {
    score += 25;
    factors.push("very_high_amount");
  } else if (params.amount > 500) {
    score += 20;
    factors.push("high_amount");
  } else if (params.amount > 200) {
    score += 10;
    factors.push("medium_amount");
  }

  // 2. 用户信息完整性
  if (!params.userEmail) {
    score += 15;
    factors.push("missing_email");
  }

  // 3. IP地址风险评估
  const ipCheck = isUnknownOrSuspiciousIP(params.ipAddress);
  if (ipCheck.suspicious) {
    score += 20;
    factors.push(ipCheck.reason || "suspicious_ip");
  }

  // 4. User-Agent风险评估
  const uaCheck = isSuspiciousUserAgent(params.userAgent);
  if (uaCheck.suspicious) {
    score += 15;
    factors.push(uaCheck.reason || "suspicious_user_agent");
  }

  // 5. 频率限制检查（同一用户短时间内多次下单）
  const rateCheck = checkRateLimit(params.userId);
  if (rateCheck.exceeded) {
    score += 30;
    factors.push(`rate_limit_exceeded:${rateCheck.orderCount}_orders`);
  } else if (rateCheck.orderCount > 1) {
    score += 10;
    factors.push(`multiple_orders:${rateCheck.orderCount}`);
  }

  // 6. 地理位置风险（缺少地理信息）
  if (!params.country) {
    score += 10;
    factors.push("missing_geo_info");
  }

  // 7. 首次购买高价商品（如果能获取用户历史）
  // TODO: 可以扩展为查询用户历史订单

  // 确定风险等级
  let level = "low";
  if (score >= 70) {
    level = "blocked"; // 建议拦截
  } else if (score >= 50) {
    level = "high";
  } else if (score >= 30) {
    level = "medium";
  }

  return { riskScore: Math.min(score, 100), riskLevel: level, riskFactors: factors };
}

// =============================================================================
// Supabase 实现
// =============================================================================

async function createOrderSupabase(params: CreateOrderParams): Promise<OrderResult> {
  if (!supabaseAdmin) {
    return { success: false, error: "Database not available" };
  }

  try {
    const orderNo = generateOrderNo();
    const risk = assessRisk(params);

    const { data, error } = await supabaseAdmin
      .from("orders")
      .insert({
        order_no: orderNo,
        user_id: params.userId,
        user_email: params.userEmail,
        product_name: params.productName,
        product_type: params.productType,
        plan: params.plan,
        period: params.period,
        amount: params.amount,
        currency: params.currency || "USD",
        original_amount: params.originalAmount,
        discount_amount: params.discountAmount || 0,
        payment_method: params.paymentMethod,
        payment_status: "pending",
        risk_score: risk.riskScore,
        risk_level: risk.riskLevel,
        risk_factors: risk.riskFactors,
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
        country: params.country,
        region_name: params.region,
        city: params.city,
        source: params.source || "global",
      })
      .select()
      .single();

    if (error) {
      console.error("[orders] Supabase create error:", error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      order: data,
      orderId: data.id,
      orderNo: data.order_no,
    };
  } catch (error) {
    console.error("[orders] Supabase create exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Create order failed",
    };
  }
}

async function updateOrderSupabase(
  orderId: string,
  params: UpdateOrderParams
): Promise<OrderResult> {
  if (!supabaseAdmin) {
    return { success: false, error: "Database not available" };
  }

  try {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (params.paymentStatus) updateData.payment_status = params.paymentStatus;
    if (params.paidAt) updateData.paid_at = params.paidAt;
    if (params.providerOrderId) updateData.provider_order_id = params.providerOrderId;
    if (params.providerTransactionId) updateData.provider_transaction_id = params.providerTransactionId;
    if (params.riskScore !== undefined) updateData.risk_score = params.riskScore;
    if (params.riskLevel) updateData.risk_level = params.riskLevel;
    if (params.riskFactors) updateData.risk_factors = params.riskFactors;
    if (params.refundStatus) updateData.refund_status = params.refundStatus;
    if (params.refundAmount !== undefined) updateData.refund_amount = params.refundAmount;
    if (params.refundReason) updateData.refund_reason = params.refundReason;
    if (params.refundedAt) updateData.refunded_at = params.refundedAt;
    if (params.notes !== undefined) updateData.notes = params.notes;

    const { data, error } = await supabaseAdmin
      .from("orders")
      .update(updateData)
      .eq("id", orderId)
      .select()
      .single();

    if (error) {
      console.error("[orders] Supabase update error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, order: data };
  } catch (error) {
    console.error("[orders] Supabase update exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Update order failed",
    };
  }
}

async function getOrderByNoSupabase(orderNo: string): Promise<Order | null> {
  if (!supabaseAdmin) return null;

  try {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("order_no", orderNo)
      .single();

    if (error) {
      console.error("[orders] Supabase get error:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("[orders] Supabase get exception:", error);
    return null;
  }
}

// =============================================================================
// CloudBase 实现
// =============================================================================

async function createOrderCloudBase(params: CreateOrderParams): Promise<OrderResult> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const orderNo = generateOrderNo();
    const risk = assessRisk(params);
    const now = new Date().toISOString();

    const orderData = {
      order_no: orderNo,
      user_id: params.userId,
      user_email: params.userEmail || null,
      product_name: params.productName,
      product_type: params.productType,
      plan: params.plan || null,
      period: params.period || null,
      amount: params.amount,
      currency: params.currency || "CNY",
      original_amount: params.originalAmount || null,
      discount_amount: params.discountAmount || 0,
      payment_method: params.paymentMethod || null,
      payment_status: "pending",
      risk_score: risk.riskScore,
      risk_level: risk.riskLevel,
      risk_factors: risk.riskFactors,
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
      country: params.country || null,
      region_name: params.region || null,
      city: params.city || null,
      source: params.source || "cn",
      created_at: now,
      updated_at: now,
    };

    const result = await db.collection("orders").add(orderData);

    return {
      success: true,
      orderId: result.id,
      orderNo,
    };
  } catch (error) {
    console.error("[orders] CloudBase create exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Create order failed",
    };
  }
}

async function updateOrderCloudBase(
  orderId: string,
  params: UpdateOrderParams
): Promise<OrderResult> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (params.paymentStatus) updateData.payment_status = params.paymentStatus;
    if (params.paidAt) updateData.paid_at = params.paidAt;
    if (params.providerOrderId) updateData.provider_order_id = params.providerOrderId;
    if (params.providerTransactionId) updateData.provider_transaction_id = params.providerTransactionId;
    if (params.riskScore !== undefined) updateData.risk_score = params.riskScore;
    if (params.riskLevel) updateData.risk_level = params.riskLevel;
    if (params.riskFactors) updateData.risk_factors = params.riskFactors;
    if (params.refundStatus) updateData.refund_status = params.refundStatus;
    if (params.refundAmount !== undefined) updateData.refund_amount = params.refundAmount;
    if (params.refundReason) updateData.refund_reason = params.refundReason;
    if (params.refundedAt) updateData.refunded_at = params.refundedAt;
    if (params.notes !== undefined) updateData.notes = params.notes;

    await db.collection("orders").doc(orderId).update(updateData);

    return { success: true };
  } catch (error) {
    console.error("[orders] CloudBase update exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Update order failed",
    };
  }
}

async function getOrderByNoCloudBase(orderNo: string): Promise<Order | null> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const result = await db
      .collection("orders")
      .where({ order_no: orderNo })
      .get();

    if (result.data && result.data.length > 0) {
      return result.data[0] as Order;
    }

    return null;
  } catch (error) {
    console.error("[orders] CloudBase get exception:", error);
    return null;
  }
}

// =============================================================================
// 统一导出函数
// =============================================================================

/**
 * 创建订单
 */
export async function createOrder(params: CreateOrderParams): Promise<OrderResult> {
  // 自动设置 source
  if (!params.source) {
    params.source = IS_DOMESTIC_VERSION ? "cn" : "global";
  }

  if (IS_DOMESTIC_VERSION) {
    return createOrderCloudBase(params);
  } else {
    return createOrderSupabase(params);
  }
}

/**
 * 更新订单
 */
export async function updateOrder(
  orderId: string,
  params: UpdateOrderParams
): Promise<OrderResult> {
  if (IS_DOMESTIC_VERSION) {
    return updateOrderCloudBase(orderId, params);
  } else {
    return updateOrderSupabase(orderId, params);
  }
}

/**
 * 根据订单号获取订单
 */
export async function getOrderByNo(orderNo: string): Promise<Order | null> {
  if (IS_DOMESTIC_VERSION) {
    return getOrderByNoCloudBase(orderNo);
  } else {
    return getOrderByNoSupabase(orderNo);
  }
}

/**
 * 标记订单为已支付
 */
export async function markOrderPaid(
  orderId: string,
  providerOrderId?: string,
  providerTransactionId?: string
): Promise<OrderResult> {
  return updateOrder(orderId, {
    paymentStatus: "paid",
    paidAt: new Date().toISOString(),
    providerOrderId,
    providerTransactionId,
  });
}

/**
 * 标记订单为失败
 */
export async function markOrderFailed(orderId: string): Promise<OrderResult> {
  return updateOrder(orderId, {
    paymentStatus: "failed",
  });
}

/**
 * 标记订单为已退款
 */
export async function markOrderRefunded(
  orderId: string,
  refundAmount: number,
  refundReason?: string
): Promise<OrderResult> {
  return updateOrder(orderId, {
    paymentStatus: "refunded",
    refundStatus: "full",
    refundAmount,
    refundReason,
    refundedAt: new Date().toISOString(),
  });
}
