export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { isAfter } from "date-fns";
import { capturePayPalOrder, paypalErrorResponse } from "@/lib/paypal";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  addCalendarMonths,
  getTodayString,
  updateSupabaseSubscription,
  upgradeSupabaseQuota,
  renewSupabaseQuota,
  seedSupabaseWalletForPlan,
} from "@/services/wallet-supabase";
import { PLAN_RANK, normalizePlanName } from "@/utils/plan-utils";
import {
  queryPaymentRecord,
  claimPaymentRecord,
  validatePaymentAmountCents,
} from "@/lib/payment/payment-record-helper";
import { getPlanDailyLimit, getPlanBuildExpireDays, getPlanSupportBatchBuild } from "@/utils/plan-limits";
import { trackPaymentAndSubscription } from "@/lib/payment/analytics-helper";
import { createOrder, markOrderPaid } from "@/services/orders";

/**
 * 解析 customId
 * 格式: userId|planName|billingPeriod|amount|days|isUpgrade
 */
interface ParsedCustomId {
  userId: string;
  plan: string;
  period: "monthly" | "annual";
  expectedAmount?: number;
  days?: number;
  isUpgradeOrder?: boolean;
}

function parseCustomId(customId?: string | null, description?: string | null): ParsedCustomId {
  const result: ParsedCustomId = {
    userId: "",
    plan: "Pro",
    period: "monthly",
  };

  if (!customId) {
    if (description) {
      const parts = description.split(" - ");
      if (parts[0]) result.plan = parts[0];
      if (parts[1]) {
        const p = parts[1].toLowerCase();
        result.period = p === "annual" || p === "yearly" ? "annual" : "monthly";
      }
    }
    return result;
  }

  const parts = customId.split("|");
  result.userId = parts[0] || "";
  result.plan = parts[1] || "Pro";

  const p = (parts[2] || "").toLowerCase();
  result.period = p === "annual" || p === "yearly" ? "annual" : "monthly";

  if (parts[3]) {
    const expected = parseFloat(parts[3]);
    if (!Number.isNaN(expected)) result.expectedAmount = expected;
  }

  if (parts[4]) {
    const days = parseInt(parts[4], 10);
    if (!Number.isNaN(days) && days > 0) result.days = days;
  }

  if (parts[5]) {
    result.isUpgradeOrder = parts[5] === "1";
  }

  return result;
}

export async function POST(request: NextRequest) {
  let claimed = false;
  let subscriptionApplied = false;
  let finalized = false;
  let providerOrderId = "";
  try {
    const body = await request.json();
    const { orderId } = body as { orderId?: string };

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Missing orderId" },
        { status: 400 }
      );
    }
    providerOrderId = orderId;

    // 获取风控信息（从请求头中）
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "";
    const userAgent = request.headers.get("user-agent") || "";
    const country = request.headers.get("x-vercel-ip-country")
      || request.headers.get("cf-ipcountry")
      || "";

    let paymentRecord = supabaseAdmin ? await queryPaymentRecord("paypal", providerOrderId) : null;
    const paymentStatus = (paymentRecord?.status || "").toString().toUpperCase();
    if (supabaseAdmin && (paymentStatus === "COMPLETED" || paymentStatus === "SUCCESS" || paymentStatus === "PAID")) {
      const { data: currentWallet } = await supabaseAdmin
        .from("user_wallets")
        .select("plan, plan_exp")
        .eq("provider_order_id", orderId)
        .maybeSingle();

      const { data: subscription } = await supabaseAdmin
        .from("subscriptions")
        .select("user_id, plan, period, expires_at")
        .eq("provider_order_id", orderId)
        .maybeSingle();

      return NextResponse.json({
        success: true,
        status: "already_processed",
        plan: subscription?.plan || currentWallet?.plan || "Pro",
        period: subscription?.period || "monthly",
        expiresAt: subscription?.expires_at || currentWallet?.plan_exp,
      });
    }
    if (supabaseAdmin && paymentStatus === "PROCESSING") {
      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("id, status, plan, period, expires_at")
        .eq("provider_order_id", orderId)
        .maybeSingle();
      if (sub) {
        await supabaseAdmin
          .from("payments")
          .update({ status: "COMPLETED", updated_at: new Date().toISOString() })
          .eq("provider", "paypal")
          .eq("provider_order_id", orderId);
        return NextResponse.json({
          success: true,
          status: "COMPLETED",
          plan: sub?.plan || "Pro",
          period: sub?.period || "monthly",
          expiresAt: sub?.expires_at,
        });
      }
      return NextResponse.json({
        success: true,
        status: "processing",
      });
    }

    let result;
    try {
      result = await capturePayPalOrder(orderId);
    } catch (captureError: any) {
      // 处理 ORDER_ALREADY_CAPTURED 错误
      if (captureError?.message?.includes("ORDER_ALREADY_CAPTURED") ||
          captureError?.details?.[0]?.issue === "ORDER_ALREADY_CAPTURED") {
        // 订单已被捕获，检查数据库中是否有记录
        if (supabaseAdmin) {
          const { data: subscription } = await supabaseAdmin
            .from("subscriptions")
            .select("user_id, plan, period, expires_at")
            .eq("provider_order_id", orderId)
            .maybeSingle();

          if (subscription) {
            return NextResponse.json({
              success: true,
              status: "already_captured",
              plan: subscription.plan,
              period: subscription.period,
              expiresAt: subscription.expires_at,
            });
          }
        }
        // 如果数据库中没有记录但订单已被捕获，返回成功（可能是外部捕获）
        return NextResponse.json({
          success: true,
          status: "already_captured",
          message: "Order was already captured",
        });
      }
      // 其他错误继续抛出
      throw captureError;
    }

    const unit = result.purchase_units?.[0];
    const capture = unit?.payments?.captures?.[0];
    const status = capture?.status || result.status;

    const amountValue = parseFloat(
      capture?.amount?.value || unit?.amount?.value || "0"
    );
    const currency = capture?.amount?.currency_code || unit?.amount?.currency_code || "USD";

    const customId = unit?.custom_id || capture?.custom_id || null;
    const description = unit?.description || null;

    // 解析 customId
    const parsed = parseCustomId(customId, description);
    const plan = normalizePlanName(parsed.plan);
    const period = parsed.period;
    const userId = parsed.userId;

    if (!userId) {
      console.error("[paypal][capture] No userId found");
      return NextResponse.json(
        { success: false, error: "No userId found" },
        { status: 400 }
      );
    }

    // 金额一致性校验
    if (parsed.expectedAmount != null) {
      const expectedCents = Math.round(parsed.expectedAmount * 100);
      const actualCents = Math.round(amountValue * 100);
      if (!validatePaymentAmountCents(expectedCents, actualCents)) {
        console.error("[paypal][amount-mismatch]", { orderId, expectedAmount: parsed.expectedAmount, actualAmount: amountValue });
        return NextResponse.json({ success: false, error: "Amount mismatch" }, { status: 400 });
      }
    }

    if (!supabaseAdmin) {
      console.warn("[paypal][capture] supabaseAdmin not available");
      return NextResponse.json({ success: true, status, raw: result });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const today = getTodayString();

    if (paymentRecord) {
      const claim = await claimPaymentRecord({
        provider: "paypal",
        providerOrderId,
        record: paymentRecord,
      });
      if (!claim.claimed) {
        const { data: subscription } = await supabaseAdmin
          .from("subscriptions")
          .select("user_id, plan, period, expires_at")
          .eq("provider_order_id", orderId)
          .maybeSingle();

        console.log(`[PayPal][SUBSCRIPTION] already processed, skipping: ${providerOrderId}`);
        return NextResponse.json({
          success: true,
          status: "already_processed",
          plan: subscription?.plan || plan,
          period: subscription?.period || period,
          expiresAt: subscription?.expires_at,
        });
      }
      claimed = true;
    }

    // 获取用户当前钱包
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
    const upgradeDays = parsed.days ?? 0;
    const canApplyUpgradeDays = !!(parsed.isUpgradeOrder && isUpgrade && upgradeDays > 0);
    if (canApplyUpgradeDays) {
      purchaseExpiresAt = new Date(now.getTime() + upgradeDays * 24 * 60 * 60 * 1000);
      console.log(`[PayPal Capture] upgrade with days: ${upgradeDays}, expires: ${purchaseExpiresAt.toISOString()}`);
    } else {
      const baseDate = isSameActive && currentPlanExp ? currentPlanExp : now;
      const anchorDay = walletRow?.billing_cycle_anchor || now.getUTCDate();
      purchaseExpiresAt = addCalendarMonths(baseDate, monthsToAdd, anchorDay);
    }

    // 获取用户邮箱
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const userEmail = userData?.user?.email || "";

    // 确定订单类型
    const productType = parsed.isUpgradeOrder ? "upgrade" : "subscription";

    // 创建订单记录（使用统一的订单服务）
    const orderResult = await createOrder({
      userId,
      userEmail,
      productName: `${plan} Plan (${period})`,
      productType: productType as "subscription" | "one_time" | "upgrade",
      plan,
      period,
      amount: amountValue,
      currency,
      originalAmount: amountValue,
      discountAmount: 0,
      paymentMethod: "paypal",
      source: "global",
      ipAddress,
      userAgent,
      country,
    });

    if (orderResult.success && orderResult.orderId) {
      // 标记订单为已支付
      await markOrderPaid(orderResult.orderId, orderId, capture?.id || undefined);
      console.log(`[PayPal][CAPTURE] Order created: ${orderResult.orderNo}`);
    } else {
      console.error("[PayPal][CAPTURE] Order creation failed:", orderResult.error);
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
          provider: "paypal",
          provider_order_id: orderId,
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

      console.log(`[PayPal][SUBSCRIPTION] downgrade scheduled for user ${userId}`);

      return NextResponse.json({
        success: true,
        status,
        plan: currentPlanKey,
        period,
        expiresAt: currentPlanExp?.toISOString(),
        pendingDowngrade: plan,
        raw: result,
      });
    }

    // 新购/续费/升级处理
    await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: userId,
        plan,
        period,
        status: "active",
        provider: "paypal",
        provider_order_id: orderId,
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
    subscriptionApplied = true;

    console.log(`[PayPal][SUBSCRIPTION] processed for user ${userId}, plan: ${plan}, expires: ${purchaseExpiresAt.toISOString()}`);

    if (paymentRecord) {
      await supabaseAdmin
        .from("payments")
        .update({
          status: "COMPLETED",
          provider_transaction_id: capture?.id || null,
          updated_at: nowIso,
        })
        .eq("provider", "paypal")
        .eq("provider_order_id", providerOrderId);
    } else {
      await supabaseAdmin.from("payments").upsert({
        user_id: userId,
        provider: "paypal",
        provider_order_id: providerOrderId,
        amount: amountValue,
        currency,
        status: "COMPLETED",
        type: "SUBSCRIPTION",
        plan,
        period,
        provider_transaction_id: capture?.id || null,
        source: "global",
        updated_at: nowIso,
      }, { onConflict: "provider,provider_order_id" });
    }
    finalized = true;

    // 支付和订阅埋点
    const subscriptionAction = isUpgrade ? "upgrade" : (isSameActive ? "renew" : "subscribe");
    trackPaymentAndSubscription(
      { userId, amount: amountValue, currency, plan, provider: "paypal", orderId },
      { action: subscriptionAction, fromPlan: currentPlanKey || "Free", toPlan: plan, period }
    );

    return NextResponse.json({
      success: true,
      status,
      plan,
      period,
      expiresAt: purchaseExpiresAt.toISOString(),
      raw: result,
    });
  } catch (err) {
    if (claimed && !finalized && supabaseAdmin) {
      const fallbackStatus = subscriptionApplied ? "COMPLETED" : "PENDING";
      await supabaseAdmin
        .from("payments")
        .update({ status: fallbackStatus, updated_at: new Date().toISOString() })
        .eq("provider", "paypal")
        .eq("provider_order_id", providerOrderId);
    }
    console.error("PayPal capture error:", err);
    return paypalErrorResponse(err);
  }
}
