export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseUrlFromEnv, getSupabaseAnonKeyFromEnv } from "@/lib/supabase/env";
import { createStripeCheckoutSession, stripeErrorResponse } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAfter } from "date-fns";
import { PLAN_RANK, normalizePlanName } from "@/utils/plan-utils";
import { resolvePlan, extractPlanAmount } from "@/lib/payment/plan-resolver";
import { calculateSupabaseUpgradePrice } from "@/services/wallet-supabase";
import { insertPaymentRecord } from "@/lib/payment/payment-record-helper";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planName, billingPeriod } = body as {
      planName?: string;
      billingPeriod?: "monthly" | "annual";
    };

    // 验证用户身份
    const supabaseUrl = getSupabaseUrlFromEnv();
    const supabaseAnonKey = getSupabaseAnonKeyFromEnv();

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { success: false, error: "Service unavailable" },
        { status: 503 }
      );
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    });

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 使用验证后的用户ID
    const userId = user.id;

    // 获取风控信息
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "";
    const userAgent = request.headers.get("user-agent") || "";
    // 地理位置：优先 Vercel，其次 Cloudflare
    const country = request.headers.get("x-vercel-ip-country")
      || request.headers.get("cf-ipcountry")
      || "";

    // 构建回调URL
    const envBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    const proto = request.headers.get("x-forwarded-proto") || "https";
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const headerBase = host ? `${proto}://${host}` : null;
    const origin = envBase || headerBase || request.nextUrl.origin;

    const successUrl = `${origin}/payment/stripe/success`;
    const cancelUrl = `${origin}/payment/stripe/cancel`;

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
          const upgradeDays = Math.max(0, Math.floor(remainingValue / targetDailyPrice));
          const totalDays = targetDays + upgradeDays;

          // 升级逻辑
          if (remainingValue >= targetPrice) {
            // 免费升级：剩余价值折算成目标套餐天数
            amount = 0.01;
          } else {
            // 补差价
            amount = Math.max(0.01, targetPrice - remainingValue);
          }
          days = totalDays;

          amount = Math.round(amount * 100) / 100;

          console.log("📝 [Stripe Create] Upgrade calculation:", {
            currentPlan: currentPlanKey,
            targetPlan: resolvedPlan.name,
            remainingDays,
            remainingValue: Math.round(remainingValue * 100) / 100,
            upgradeAmount: amount,
            upgradeDays,
            purchaseDays: targetDays,
            totalDays: days,
          });
        }
      } catch (error) {
        console.error("[stripe][create] upgrade price calc failed", error);
      }
    }

    const customId = [userId, resolvedPlan.name, effectiveBillingPeriod].join("|");
    const description = `${resolvedPlan.name} - ${effectiveBillingPeriod === "annual" ? "Annual" : "Monthly"}`;

    // 创建 Stripe Checkout Session
    const { sessionId, url } = await createStripeCheckoutSession({
      amount,
      currency: "USD",
      successUrl,
      cancelUrl,
      userId,
      customId,
      description,
      billingCycle: effectiveBillingPeriod,
      planName: resolvedPlan.name,
      metadata: {
        days: String(days),
        upgradeDays: String(isUpgradeOrder ? Math.max(0, days - (effectiveBillingPeriod === "annual" ? 365 : 30)) : 0),
        purchaseDays: String(effectiveBillingPeriod === "annual" ? 365 : 30),
        isUpgrade: isUpgradeOrder ? "true" : "false",
        originalAmount: String(extractPlanAmount(resolvedPlan, effectiveBillingPeriod)),
        ipAddress,
        userAgent: userAgent.slice(0, 500), // Stripe metadata 限制
        country,
      },
    });

    if (!url) {
      return NextResponse.json(
        { success: false, error: "Failed to create Stripe checkout session" },
        { status: 500 }
      );
    }

    if (supabaseAdmin) {
      await insertPaymentRecord({
        userId,
        provider: "stripe",
        providerOrderId: sessionId,
        amount,
        currency: "USD",
        status: "PENDING",
        type: "SUBSCRIPTION",
        plan: resolvedPlan.name,
        period: effectiveBillingPeriod,
        metadata: {
          days: String(days),
          upgradeDays: String(isUpgradeOrder ? Math.max(0, days - (effectiveBillingPeriod === "annual" ? 365 : 30)) : 0),
          purchaseDays: String(effectiveBillingPeriod === "annual" ? 365 : 30),
          isUpgrade: isUpgradeOrder ? "true" : "false",
          originalAmount: String(extractPlanAmount(resolvedPlan, effectiveBillingPeriod)),
          ipAddress,
          userAgent: userAgent.slice(0, 500),
          country,
        },
      });
    }

    return NextResponse.json({
      success: true,
      sessionId,
      url,
    });
  } catch (err) {
    console.error("Stripe create error:", err);
    return stripeErrorResponse(err);
  }
}
