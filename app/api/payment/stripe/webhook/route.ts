import { headers } from "next/headers";
import Stripe from "stripe";
import { isAfter } from "date-fns";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  addCalendarMonths,
  getTodayString,
  updateSupabaseSubscription,
  upgradeSupabaseQuota,
  renewSupabaseQuota,
  seedSupabaseWalletForPlan,
} from "@/services/wallet-supabase";
import {
  checkPaymentExists,
  insertPaymentRecord,
  validatePaymentAmountCents,
} from "@/lib/payment/payment-record-helper";
import { PLAN_RANK, normalizePlanName } from "@/utils/plan-utils";
import { getPlanDailyLimit, getPlanBuildExpireDays, getPlanSupportBatchBuild } from "@/utils/plan-limits";
import { trackPaymentAndSubscription } from "@/lib/payment/analytics-helper";
import { createOrder, markOrderPaid } from "@/services/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

export async function POST(req: Request) {
  // 检查配置
  if (!stripeKey || !webhookSecret) {
    console.warn("[stripe webhook] missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET, skipping");
    return new Response("stripe disabled", { status: 200 });
  }

  const stripe = new Stripe(stripeKey);

  const body = await req.text();
  const signature = (await headers()).get("stripe-signature") as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`❌ Stripe Webhook Error: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // 只处理 checkout.session.completed 事件
  if (event.type !== "checkout.session.completed") {
    return new Response(null, { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") {
    return new Response(null, { status: 200 });
  }

  if (!supabaseAdmin) {
    console.warn("[stripe webhook] supabaseAdmin not available, skipping");
    return new Response(null, { status: 200 });
  }

  const metadata = session.metadata || {};
  const userId = metadata.userId;

  if (!userId) {
    console.error("❌ Webhook Error: No userId in checkout.session.completed");
    return new Response(null, { status: 200 });
  }

  const amount = (session.amount_total || 0) / 100;
  const currency = session.currency?.toUpperCase() || "USD";
  const actualCents = session.amount_total || 0;

  // 金额一致性校验
  const expectedCentsStr = metadata.expectedAmountCents;
  let expectedCents = 0;
  if (expectedCentsStr != null) {
    expectedCents = parseInt(String(expectedCentsStr), 10);
  }
  if (expectedCents > 0 && !validatePaymentAmountCents(expectedCents, actualCents)) {
    console.error("[stripe webhook][amount-mismatch]", { sessionId: session.id, userId, expectedCents, actualCents });
    return new Response(null, { status: 200 });
  }

  // 幂等性检查
  const existingPayment = await checkPaymentExists("stripe", session.id);
  if (existingPayment) {
    console.log(`[Stripe][SUBSCRIPTION] already processed, skipping: ${session.id}`);
    return new Response(null, { status: 200 });
  }

  // 订阅处理
  const plan = normalizePlanName(metadata.planName || "Pro");
  const periodStr = String(metadata.billingCycle || "monthly").toLowerCase();
  const period: "monthly" | "annual" = periodStr === "annual" || periodStr === "yearly" ? "annual" : "monthly";
  const metaDays = parseInt(metadata.days || "0", 10);
  const isUpgradeOrder = metadata.isUpgrade === "true";

  try {
    const now = new Date();
    const nowIso = now.toISOString();
    const today = getTodayString();

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
      console.log(`[Stripe][SUBSCRIPTION] upgrade with days: ${metaDays}, expires: ${purchaseExpiresAt.toISOString()}`);
    } else {
      const baseDate = isSameActive && currentPlanExp ? currentPlanExp : now;
      const anchorDay = walletRow?.billing_cycle_anchor || now.getUTCDate();
      purchaseExpiresAt = addCalendarMonths(baseDate, monthsToAdd, anchorDay);
    }

    // 插入支付记录
    await insertPaymentRecord({
      userId,
      provider: "stripe",
      providerOrderId: session.id,
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
      await markOrderPaid(orderResult.orderId, session.id, paymentIntentId);
      console.log(`[Stripe][WEBHOOK] Order created: ${orderResult.orderNo}`);
    } else {
      console.error("[Stripe][WEBHOOK] Order creation failed:", orderResult.error);
      // 订单创建失败不应阻止订阅处理，但需要记录错误
    }

    // 降级处理：延迟生效
    if (isDowngrade) {
      const scheduledStart = currentPlanExp && currentPlanActive ? currentPlanExp : now;
      const anchorDay = walletRow?.billing_cycle_anchor || now.getUTCDate();
      const scheduledExpire = addCalendarMonths(scheduledStart, monthsToAdd, anchorDay);
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
          provider_order_id: session.id,
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

      console.log(`[Stripe][SUBSCRIPTION] downgrade scheduled for user ${userId}`);
      return new Response(null, { status: 200 });
    }

    // 新购/续费/升级处理
    await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: userId,
        plan,
        period,
        status: "active",
        provider: "stripe",
        provider_order_id: session.id,
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

    console.log(`[Stripe][SUBSCRIPTION] processed for user ${userId}, plan: ${plan}, expires: ${purchaseExpiresAt.toISOString()}`);

    // 支付和订阅埋点
    const subscriptionAction = isUpgrade ? "upgrade" : (isSameActive ? "renew" : "subscribe");
    trackPaymentAndSubscription(
      { userId, amount, currency, plan, provider: "stripe", orderId: session.id },
      { action: subscriptionAction, fromPlan: currentPlanKey || "Free", toPlan: plan, period }
    );
  } catch (err) {
    console.error("[Stripe][SUBSCRIPTION] error", err);
    return new Response("DB Error", { status: 500 });
  }

  return new Response(null, { status: 200 });
}
