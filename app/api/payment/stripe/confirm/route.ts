export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { retrieveStripeSession, stripeErrorResponse } from "@/lib/stripe";
import { isAfter } from "date-fns";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  addCalendarMonths,
  getTodayString,
  seedSupabaseWalletForPlan,
} from "@/services/wallet-supabase";
import { PLAN_RANK, normalizePlanName } from "@/utils/plan-utils";
import { getPlanDailyLimit, getPlanBuildExpireDays, getPlanSupportBatchBuild } from "@/utils/plan-limits";
import { checkPaymentExists, insertPaymentRecord } from "@/lib/payment/payment-record-helper";
import { trackPaymentAndSubscription } from "@/lib/payment/analytics-helper";
import { createOrder, markOrderPaid } from "@/services/orders";

/**
 * POST /api/payment/stripe/confirm
 * 确认 Stripe 支付状态并更新订阅（用于本地开发环境，Webhook 无法访问 localhost）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body as { sessionId?: string };

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Missing sessionId" },
        { status: 400 }
      );
    }

    // 获取 Session 详情
    const session = await retrieveStripeSession(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        {
          success: false,
          error: "Payment not completed",
          status: session.payment_status,
        },
        { status: 400 }
      );
    }

    // 解析 metadata
    const metadata = session.metadata || {};
    const userId = metadata.userId;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Missing userId in session metadata" },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: "Database not available" },
        { status: 500 }
      );
    }

    const plan = normalizePlanName(metadata.planName || "Pro");
    const periodStr = (metadata.billingCycle || "monthly").toLowerCase();
    const period: "monthly" | "annual" = periodStr === "annual" || periodStr === "yearly" ? "annual" : "monthly";
    const metaDays = parseInt(metadata.days || "0", 10);
    const isUpgradeOrder = metadata.isUpgrade === "true";

    const now = new Date();
    const nowIso = now.toISOString();
    const today = getTodayString();

    // 幂等性检查
    const existingPayment = await checkPaymentExists("stripe", sessionId);

    if (existingPayment) {
      // 已处理过，返回当前订阅状态
      const { data: currentWallet } = await supabaseAdmin
        .from("user_wallets")
        .select("plan, plan_exp")
        .eq("user_id", userId)
        .maybeSingle();

      return NextResponse.json({
        success: true,
        status: "already_processed",
        plan: currentWallet?.plan || plan,
        period,
        expiresAt: currentWallet?.plan_exp,
      });
    }

    // 获取用户当前钱包信息
    const { data: walletRow } = await supabaseAdmin
      .from("user_wallets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const currentPlanKey = normalizePlanName(walletRow?.plan || "");
    const currentPlanExp = walletRow?.plan_exp ? new Date(walletRow.plan_exp) : null;
    const currentPlanActive = currentPlanExp ? isAfter(currentPlanExp, now) : false;

    const purchasePlanKey = normalizePlanName(plan);
    const purchaseRank = PLAN_RANK[purchasePlanKey] || 0;
    const currentRank = PLAN_RANK[currentPlanKey] || 0;
    const isUpgrade = purchaseRank > currentRank && currentPlanActive && currentRank > 0;
    const isDowngrade = purchaseRank < currentRank && currentPlanActive;
    const isSameActive = purchaseRank === currentRank && currentPlanActive;
    const isNewOrExpired = !currentPlanActive || !currentPlanKey;

    const monthsToAdd = period === "annual" ? 12 : 1;

    // 计算到期日期
    let purchaseExpiresAt: Date;
    if (isUpgradeOrder && metaDays > 0) {
      purchaseExpiresAt = new Date(now.getTime() + metaDays * 24 * 60 * 60 * 1000);
    } else {
      const baseDate = isSameActive && currentPlanExp ? currentPlanExp : now;
      purchaseExpiresAt = addCalendarMonths(baseDate, monthsToAdd);
    }

    const amount = (session.amount_total || 0) / 100;
    const currency = session.currency?.toUpperCase() || "USD";

    // 插入支付记录
    await insertPaymentRecord({
      userId,
      provider: "stripe",
      providerOrderId: sessionId,
      amount,
      currency,
      type: "SUBSCRIPTION",
      plan,
      period,
    });

    // 获取用户邮箱
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const userEmail = userData?.user?.email || "";

    // 确定订单类型
    const productType = isUpgradeOrder ? "upgrade" : (isSameActive ? "renewal" : "subscription");

    // 创建订单记录（使用统一的订单服务）
    const orderResult = await createOrder({
      userId,
      userEmail,
      productName: `${plan} Plan (${period})`,
      productType: productType as "subscription" | "one_time" | "upgrade",
      plan,
      period,
      amount,
      currency,
      originalAmount: amount,
      discountAmount: 0,
      paymentMethod: "stripe",
      source: "global",
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      country: metadata.country,
    });

    if (orderResult.success && orderResult.orderId) {
      // 标记订单为已支付
      const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent?.id || undefined);
      await markOrderPaid(orderResult.orderId, sessionId, paymentIntentId);
      console.log(`[Stripe][CONFIRM] Order created: ${orderResult.orderNo}`);
    } else {
      console.error("[Stripe][CONFIRM] Order creation failed:", orderResult.error);
    }

    // 降级处理：延迟生效
    if (isDowngrade) {
      const scheduledStart = currentPlanExp && currentPlanActive ? currentPlanExp : now;
      const scheduledExpire = addCalendarMonths(scheduledStart, monthsToAdd);
      const pendingDowngrade = JSON.stringify({
        targetPlan: plan,
        effectiveAt: scheduledStart.toISOString(),
        expiresAt: scheduledExpire.toISOString(),
        period,
      });

      await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: userId,
          plan,
          period,
          status: "pending",
          provider: "stripe",
          provider_order_id: sessionId,
          started_at: scheduledStart.toISOString(),
          expires_at: scheduledExpire.toISOString(),
          type: "SUBSCRIPTION",
        },
        { onConflict: "user_id" }
      );

      await supabaseAdmin
        .from("user_wallets")
        .update({
          pending_downgrade: pendingDowngrade,
          updated_at: nowIso,
        })
        .eq("user_id", userId);

      console.log(`[Stripe Confirm] Downgrade scheduled for user ${userId}, target: ${plan}`);

      return NextResponse.json({
        success: true,
        status: "COMPLETED",
        plan: currentPlanKey,
        period,
        expiresAt: currentPlanExp?.toISOString(),
        pendingDowngrade: plan,
        amount,
        currency,
      });
    }

    // 新购/续费/升级：更新订阅记录
    await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: userId,
        plan,
        period,
        status: "active",
        provider: "stripe",
        provider_order_id: sessionId,
        started_at: nowIso,
        expires_at: purchaseExpiresAt.toISOString(),
        type: "SUBSCRIPTION",
      },
      { onConflict: "user_id" }
    );

    // 更新用户元数据
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        plan,
        plan_exp: purchaseExpiresAt.toISOString(),
      },
    });

    // 更新钱包
    await supabaseAdmin
      .from("user_wallets")
      .update({
        plan,
        plan_exp: purchaseExpiresAt.toISOString(),
        daily_builds_limit: getPlanDailyLimit(plan),
        daily_builds_used: isUpgrade || isNewOrExpired ? 0 : walletRow?.daily_builds_used || 0,
        daily_builds_reset_at: isUpgrade || isNewOrExpired ? today : walletRow?.daily_builds_reset_at || today,
        file_retention_days: getPlanBuildExpireDays(plan),
        batch_build_enabled: getPlanSupportBatchBuild(plan),
        pending_downgrade: null,
        updated_at: nowIso,
      })
      .eq("user_id", userId);

    // 确保钱包结构存在
    await seedSupabaseWalletForPlan(userId, plan.toLowerCase(), {
      forceReset: isUpgrade || isNewOrExpired,
    });

    console.log(`[Stripe Confirm] Subscription updated for user ${userId}, plan: ${plan}, expires: ${purchaseExpiresAt.toISOString()}`);

    // 支付和订阅埋点
    const subscriptionAction = isUpgrade ? "upgrade" : (isSameActive ? "renew" : "subscribe");
    trackPaymentAndSubscription(
      { userId, amount, currency, plan, provider: "stripe", orderId: sessionId },
      { action: subscriptionAction, fromPlan: currentPlanKey || "Free", toPlan: plan, period }
    );

    return NextResponse.json({
      success: true,
      status: "COMPLETED",
      plan,
      period,
      expiresAt: purchaseExpiresAt.toISOString(),
      amount,
      currency,
    });
  } catch (err) {
    console.error("Stripe confirm error:", err);
    return stripeErrorResponse(err);
  }
}
