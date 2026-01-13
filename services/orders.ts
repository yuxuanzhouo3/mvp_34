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

/**
 * 简单风控评估
 * 返回风险评分 (0-100) 和风险等级
 */
function assessRisk(params: CreateOrderParams): {
  riskScore: number;
  riskLevel: string;
  riskFactors: string[];
} {
  const factors: string[] = [];
  let score = 0;

  // 高金额订单
  if (params.amount > 500) {
    score += 20;
    factors.push("high_amount");
  } else if (params.amount > 200) {
    score += 10;
    factors.push("medium_amount");
  }

  // 缺少用户信息
  if (!params.userEmail) {
    score += 15;
    factors.push("missing_email");
  }

  // 缺少 IP 地址
  if (!params.ipAddress) {
    score += 10;
    factors.push("missing_ip");
  }

  // 确定风险等级
  let level = "low";
  if (score >= 60) {
    level = "high";
  } else if (score >= 40) {
    level = "medium";
  }

  return { riskScore: score, riskLevel: level, riskFactors: factors };
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
