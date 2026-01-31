/**
 * 国内版订阅支付处理逻辑
 * 微信/支付宝 Webhook 共用
 */

import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { PLAN_RANK, normalizePlanName } from "@/utils/plan-utils";
import { getPlanLimits } from "@/lib/payment/plan-resolver";

export type PaymentProvider = "wechat" | "alipay";

export interface ApplySubscriptionParams {
  userId: string;
  providerOrderId: string;
  provider: PaymentProvider;
  period: "monthly" | "annual";
  days: number;
  planName: string;
}

/**
 * 添加自然月（处理月末粘性）
 */
function addCalendarMonths(baseDate: Date, months: number, anchorDay: number): Date {
  const result = new Date(baseDate);
  const currentYear = result.getFullYear();
  const currentMonth = result.getMonth();
  const currentDay = result.getDate();

  // 计算目标年月
  const targetMonth = currentMonth + months;
  const targetYear = currentYear + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  // 月末粘性处理：确定目标日期
  const targetDay = anchorDay || currentDay;
  const daysInMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const finalDay = Math.min(targetDay, daysInMonth);

  // 设置新日期（先重置日期，避免 31 号切月导致溢出到下月）
  result.setDate(1);
  result.setFullYear(targetYear);
  result.setMonth(normalizedMonth);
  result.setDate(finalDay);

  return result;
}

/**
 * 添加天数
 */
function addDays(baseDate: Date, days: number): Date {
  return new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * 获取北京时间的年月日
 */
function getBeijingYMD(date: Date): { year: number; month: number; day: number } {
  const beijingOffset = 8 * 60 * 60 * 1000;
  const beijingTime = new Date(date.getTime() + beijingOffset);
  return {
    year: beijingTime.getUTCFullYear(),
    month: beijingTime.getUTCMonth() + 1,
    day: beijingTime.getUTCDate(),
  };
}

/**
 * 国内版：应用订阅购买结果
 * 同级顺延 / 升级立即生效并重置周期 / 降级延期生效
 */
export async function applySubscriptionPayment(params: ApplySubscriptionParams): Promise<void> {
  const { userId, providerOrderId, provider, period, planName } = params;
  const logPrefix = provider === "wechat" ? "[WeChat Webhook]" : "[Alipay Webhook]";

  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();

  const now = new Date();
  const nowIso = now.toISOString();
  const plan = normalizePlanName(planName) || "Pro";
  const planLower = plan.toLowerCase();

  // 获取用户信息
  const userRes = await db.collection("users").doc(userId).get();
  const userDoc = userRes?.data?.[0] || null;
  if (!userDoc) {
    console.error(`${logPrefix} user not found:`, userId);
    return;
  }

  const currentPlanKey = normalizePlanName(userDoc?.plan || userDoc?.subscriptionTier || "");
  const currentPlanExp = userDoc?.plan_exp ? new Date(userDoc.plan_exp) : null;
  const currentPlanActive = currentPlanExp ? currentPlanExp > now : false;

  const purchasePlanKey = normalizePlanName(plan);
  const purchaseRank = PLAN_RANK[purchasePlanKey] || 0;
  const currentRank = PLAN_RANK[currentPlanKey] || 0;
  const isUpgrade = purchaseRank > currentRank && currentPlanActive;
  const isDowngrade = purchaseRank < currentRank && currentPlanActive;
  const isSameActive = purchaseRank === currentRank && currentPlanActive;
  const isNewOrExpired = !currentPlanActive || !currentPlanKey;

  // 获取套餐配置
  const planLimits = getPlanLimits(planLower);
  const anchorDayNow = getBeijingYMD(now).day;
  const existingAnchorDay =
    userDoc?.wallet?.billing_cycle_anchor ||
    (currentPlanExp ? getBeijingYMD(currentPlanExp).day : null) ||
    anchorDayNow;

  const monthsToAdd = period === "annual" ? 12 : 1;
  const anchorDay = isUpgrade || isNewOrExpired ? anchorDayNow : existingAnchorDay;
  const baseDate = isSameActive && currentPlanExp ? currentPlanExp : now;
  const upgradeTotalDays = Math.max(0, Math.floor(params.days || 0));
  const purchaseExpiresAt = isUpgrade && upgradeTotalDays > 0
    ? addDays(now, upgradeTotalDays)
    : addCalendarMonths(baseDate, monthsToAdd, anchorDay);

  const subsColl = db.collection("subscriptions");

  // 降级：延期生效
  if (isDowngrade) {
    const tempStart = currentPlanExp && currentPlanActive ? currentPlanExp : now;
    await subsColl.add({
      userId,
      plan,
      period,
      status: "pending",
      provider,
      providerOrderId,
      startedAt: tempStart.toISOString(),
      expiresAt: addCalendarMonths(tempStart, monthsToAdd, existingAnchorDay).toISOString(),
      updatedAt: nowIso,
      createdAt: nowIso,
      type: "SUBSCRIPTION",
    });

    // 更新用户的 pendingDowngrade
    const pendingDowngradeRaw = userDoc.pendingDowngrade;
    const pendingDowngrade = Array.isArray(pendingDowngradeRaw)
      ? pendingDowngradeRaw
      : pendingDowngradeRaw
        ? [pendingDowngradeRaw]
        : [];
    pendingDowngrade.push({
      targetPlan: plan,
      effectiveAt: tempStart.toISOString(),
      expiresAt: addCalendarMonths(tempStart, monthsToAdd, existingAnchorDay).toISOString(),
    });

    await db.collection("users").doc(userId).update({
      pendingDowngrade,
      updatedAt: nowIso,
    });

    console.log(`${logPrefix} Downgrade scheduled:`, {
      userId,
      newPlan: plan,
      effectiveAt: tempStart.toISOString(),
    });

    return;
  }

  // 新购/续费/升级：立即生效
  const subPayload = {
    userId,
    plan,
    period,
    status: "active",
    provider,
    providerOrderId,
    startedAt: nowIso,
    expiresAt: purchaseExpiresAt.toISOString(),
    updatedAt: nowIso,
    type: "SUBSCRIPTION",
  };

  // 查找现有订阅
  const existing = await subsColl
    .where({ userId, status: "active" })
    .limit(1)
    .get();

  if (existing?.data?.[0]?._id) {
    await subsColl.doc(existing.data[0]._id).update(subPayload);
  } else {
    await subsColl.add({ ...subPayload, createdAt: nowIso });
  }

  // 升级时清理低等级的待生效降级订阅
  if (isUpgrade) {
    const pendingRes = await subsColl.where({ userId, status: "pending" }).get();
    const pendingSubs = pendingRes?.data || [];

    for (const pendingSub of pendingSubs) {
      const pendingRank = PLAN_RANK[normalizePlanName(pendingSub.plan)] || 0;
      if (pendingRank <= purchaseRank) {
        try {
          await subsColl.doc(pendingSub._id).remove();
        } catch (e) {
          console.warn(`${logPrefix} Failed to remove pending subscription:`, pendingSub._id, e);
        }
      }
    }

    console.log(`${logPrefix} Cleaned pending subscriptions for upgrade`);
  }

  // 更新用户信息
  const walletUpdate = {
    daily_builds_limit: planLimits.dailyLimit,
    daily_builds_used: isUpgrade || isNewOrExpired ? 0 : (userDoc?.wallet?.daily_builds_used || 0),
    daily_builds_reset_at: getBeijingYMD(now).year + "-" +
      String(getBeijingYMD(now).month).padStart(2, "0") + "-" +
      String(getBeijingYMD(now).day).padStart(2, "0"),
    file_retention_days: planLimits.buildExpireDays,
    share_enabled: planLimits.shareExpireDays > 0,
    share_duration_days: planLimits.shareExpireDays,
    batch_build_enabled: planLimits.batchBuildEnabled,
    billing_cycle_anchor: anchorDay,
  };

  await db.collection("users").doc(userId).update({
    pro: planLower !== "free" && planLower !== "basic",
    plan,
    plan_exp: purchaseExpiresAt.toISOString(),
    subscriptionTier: plan,
    pendingDowngrade: null,
    wallet: walletUpdate,
    updatedAt: nowIso,
  });

  console.log(`${logPrefix} Subscription applied:`, {
    userId,
    plan,
    expiresAt: purchaseExpiresAt.toISOString(),
    isUpgrade,
    isSameActive,
  });
}
