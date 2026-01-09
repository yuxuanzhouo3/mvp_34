export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { createPayPalOrder, paypalErrorResponse } from "@/lib/paypal";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAfter } from "date-fns";
import { PLAN_RANK, normalizePlanName } from "@/utils/plan-utils";
import { resolvePlan, extractPlanAmount } from "@/lib/payment/plan-resolver";
import { calculateSupabaseUpgradePrice } from "@/services/wallet-supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planName, billingPeriod, userId } = body as {
      planName?: string;
      billingPeriod?: "monthly" | "annual";
      userId?: string;
    };

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Missing userId (login required)" },
        { status: 401 }
      );
    }

    // 构建回调URL
    const envBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    const proto = request.headers.get("x-forwarded-proto") || "https";
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const headerBase = host ? `${proto}://${host}` : null;
    const origin = envBase || headerBase || request.nextUrl.origin;

    const returnUrl = `${origin}/payment/paypal/success`;
    const cancelUrl = `${origin}/payment/paypal/cancel`;

    // 解析套餐
    const resolvedPlan = resolvePlan(planName);
    const effectiveBillingPeriod = billingPeriod || "monthly";

    // 基础金额
    let amount = extractPlanAmount(resolvedPlan, effectiveBillingPeriod);
    let days = effectiveBillingPeriod === "annual" ? 365 : 30;
    let isUpgradeOrder = false;

    // 升级补差价逻辑
    if (supabaseAdmin) {
      try {
        const { data: walletRow } = await supabaseAdmin
          .from("user_wallets")
          .select("plan, plan_exp")
          .eq("user_id", userId)
          .maybeSingle();

        const currentPlanKey = normalizePlanName(walletRow?.plan || "");
        const currentPlanExp = walletRow?.plan_exp ? new Date(walletRow.plan_exp) : null;
        const now = new Date();
        const currentActive = currentPlanExp ? isAfter(currentPlanExp, now) : false;
        const purchaseRank = PLAN_RANK[normalizePlanName(resolvedPlan.name)] || 0;
        const currentRank = PLAN_RANK[currentPlanKey] || 0;
        const isUpgrade = currentActive && purchaseRank > currentRank && currentRank > 0;

        if (isUpgrade && currentPlanKey) {
          isUpgradeOrder = true;
          const remainingDays = Math.max(
            0,
            Math.ceil(((currentPlanExp?.getTime() || 0) - now.getTime()) / (1000 * 60 * 60 * 24))
          );
          const currentPlanDef = resolvePlan(currentPlanKey);
          const currentPlanMonthlyPrice = extractPlanAmount(currentPlanDef, "monthly");
          const targetPlanMonthlyPrice = extractPlanAmount(resolvedPlan, "monthly");
          const targetPrice = extractPlanAmount(resolvedPlan, effectiveBillingPeriod);
          const currentDailyPrice = currentPlanMonthlyPrice / 30;
          const targetDailyPrice = targetPlanMonthlyPrice / 30;

          // 计算当前套餐剩余价值
          const remainingValue = remainingDays * currentDailyPrice;
          const targetDays = effectiveBillingPeriod === "annual" ? 365 : 30;

          // 升级逻辑
          if (remainingValue >= targetPrice) {
            // 免费升级
            amount = 0.01;
            days = Math.floor(remainingValue / targetDailyPrice);
          } else {
            // 补差价
            amount = Math.max(0.01, targetPrice - remainingValue);
            days = targetDays;
          }

          amount = Math.round(amount * 100) / 100;

          console.log("📝 [PayPal Create] Upgrade calculation:", {
            currentPlan: currentPlanKey,
            targetPlan: resolvedPlan.name,
            remainingDays,
            remainingValue: Math.round(remainingValue * 100) / 100,
            upgradeAmount: amount,
            newPlanDays: days,
          });
        }
      } catch (error) {
        console.error("[paypal][create] upgrade price calc failed", error);
      }
    }

    // customId 格式: userId|planName|billingPeriod|amount|days|isUpgrade
    const customId = [
      userId,
      resolvedPlan.name,
      effectiveBillingPeriod,
      amount.toFixed(2),
      days,
      isUpgradeOrder ? "1" : "0"
    ].join("|");
    const description = `${resolvedPlan.name} - ${effectiveBillingPeriod === "annual" ? "Annual" : "Monthly"}`;

    const order = await createPayPalOrder({
      amount,
      currency: "USD",
      returnUrl,
      cancelUrl,
      userId,
      customId,
      description,
    });

    if (!order.approvalUrl) {
      return NextResponse.json(
        { success: false, error: "No PayPal approval URL returned" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId: order.orderId,
      approvalUrl: order.approvalUrl,
    });
  } catch (err) {
    console.error("PayPal create error:", err);
    return paypalErrorResponse(err);
  }
}
