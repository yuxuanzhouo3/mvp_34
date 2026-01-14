/**
 * 支付记录辅助函数
 * 支持国际版（Supabase）和国内版（CloudBase）
 */

import { IS_DOMESTIC_VERSION } from "@/config";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

/** 支付记录类型 */
export interface PaymentRecord {
  _id?: string;
  id?: string;
  userId?: string;
  user_id?: string;
  status?: string;
  amount?: number;
  type?: string;
  plan?: string;
  period?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

/**
 * 检查支付记录是否已存在（幂等性检查）
 */
export async function checkPaymentExists(
  provider: string,
  providerOrderId: string
): Promise<boolean> {
  if (IS_DOMESTIC_VERSION) {
    try {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();
      const result = await db
        .collection("payments")
        .where({ provider, providerOrderId })
        .limit(1)
        .get();
      return (result.data?.length || 0) > 0;
    } catch (error) {
      console.error("[payment-record] CloudBase check error:", error);
      return false;
    }
  }

  if (!supabaseAdmin) return false;

  try {
    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("provider", provider)
      .eq("provider_order_id", providerOrderId)
      .maybeSingle();

    if (error) {
      console.error("[payment-record] check error:", error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error("[payment-record] check exception:", err);
    return false;
  }
}

/**
 * 插入支付记录
 */
export async function insertPaymentRecord(params: {
  userId: string;
  provider: string;
  providerOrderId: string;
  amount: number;
  currency: string;
  status?: string;
  type: "SUBSCRIPTION";
  plan?: string;
  period?: string;
  metadata?: Record<string, any>;
}): Promise<{ success: boolean; error?: string }> {
  const nowIso = new Date().toISOString();

  if (IS_DOMESTIC_VERSION) {
    try {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();
      await db.collection("payments").add({
        userId: params.userId,
        provider: params.provider,
        providerOrderId: params.providerOrderId,
        amount: params.amount,
        currency: params.currency,
        status: params.status || "COMPLETED",
        type: params.type,
        plan: params.plan || null,
        period: params.period || null,
        metadata: params.metadata || {},
        createdAt: nowIso,
        updatedAt: nowIso,
        source: "cn",
      });
      return { success: true };
    } catch (err) {
      console.error("[payment-record] CloudBase insert error:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to insert payment record",
      };
    }
  }

  if (!supabaseAdmin) return { success: false, error: "supabaseAdmin not available" };

  try {
    const { error } = await supabaseAdmin.from("payments").insert({
      user_id: params.userId,
      provider: params.provider,
      provider_order_id: params.providerOrderId,
      amount: params.amount,
      currency: params.currency,
      status: params.status || "COMPLETED",
      type: params.type,
      plan: params.plan,
      period: params.period,
      source: "global",
    });

    if (error) {
      console.error("[payment-record] insert error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("[payment-record] insert exception:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to insert payment record",
    };
  }
}

/**
 * 查询支付记录
 */
export async function queryPaymentRecord(
  provider: string,
  providerOrderId: string
): Promise<PaymentRecord | null> {
  if (IS_DOMESTIC_VERSION) {
    try {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();
      const result = await db
        .collection("payments")
        .where({ provider, providerOrderId })
        .get();
      return result.data?.[0] || null;
    } catch (error) {
      console.error("[payment-record] CloudBase query error:", error);
      return null;
    }
  }

  if (!supabaseAdmin) return null;

  try {
    const { data } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("provider_order_id", providerOrderId)
      .maybeSingle();
    return data || null;
  } catch (error) {
    console.error("[payment-record] Supabase query error:", error);
    return null;
  }
}

/**
 * 更新支付记录
 */
export async function updatePaymentRecord(
  provider: string,
  providerOrderId: string,
  updateData: Record<string, any>,
  docId?: string
): Promise<boolean> {
  if (IS_DOMESTIC_VERSION) {
    try {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();
      if (docId) {
        await db.collection("payments").doc(docId).update(updateData);
      } else {
        await db
          .collection("payments")
          .where({ provider, providerOrderId })
          .update(updateData);
      }
      return true;
    } catch (error) {
      console.error("[payment-record] CloudBase update error:", error);
      return false;
    }
  }

  if (!supabaseAdmin) return false;

  try {
    await supabaseAdmin
      .from("payments")
      .update(updateData)
      .eq("provider_order_id", providerOrderId);
    return true;
  } catch (error) {
    console.error("[payment-record] Supabase update error:", error);
    return false;
  }
}

/**
 * 检查支付是否已完成
 */
export function isPaymentCompleted(paymentRecord: PaymentRecord | null): boolean {
  if (!paymentRecord) return false;
  const status = (paymentRecord.status || "").toString().toUpperCase();
  return status === "COMPLETED";
}

/**
 * 从支付记录中提取用户 ID
 */
export function extractUserId(paymentRecord: PaymentRecord | null, fallbackUserId?: string): string {
  return (paymentRecord?.userId || paymentRecord?.user_id || fallbackUserId || "") as string;
}

/**
 * 验证支付金额（允许 0.01 元或 1% 的误差，取较大值）
 */
export function validatePaymentAmount(
  expectedAmount: number,
  paidAmount: number,
  tolerancePercent: number = 1
): boolean {
  if (expectedAmount <= 0) return true;
  // 允许 0.01 元或 1% 的误差，取较大值
  const absoluteTolerance = 0.01;
  const percentTolerance = expectedAmount * (tolerancePercent / 100);
  const tolerance = Math.max(absoluteTolerance, percentTolerance);
  return Math.abs(expectedAmount - paidAmount) <= tolerance;
}

/**
 * 验证支付金额（允许1%误差）
 */
export function validatePaymentAmountCents(
  expectedCents: number,
  actualCents: number,
  tolerancePercent: number = 1
): boolean {
  if (expectedCents === 0) return true;
  const tolerance = expectedCents * (tolerancePercent / 100);
  return Math.abs(actualCents - expectedCents) <= tolerance;
}
