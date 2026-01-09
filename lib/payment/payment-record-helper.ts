/**
 * 支付记录辅助函数
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * 检查支付记录是否已存在（幂等性检查）
 */
export async function checkPaymentExists(
  provider: string,
  providerOrderId: string
): Promise<boolean> {
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
