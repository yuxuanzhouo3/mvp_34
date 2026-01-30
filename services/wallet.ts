/**
 * Wallet 钱包服务 - CloudBase 版 (构建服务)
 * 管理用户的每日构建配额
 */

import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import {
  getFreeDailyLimit,
  getProDailyLimit,
  getTeamDailyLimit,
  getPlanDailyLimit,
  getPlanBuildExpireDays,
  getPlanShareExpireDays,
  getPlanSupportBatchBuild,
} from "@/utils/plan-limits";

import {
  getBeijingYMD,
  addCalendarMonths,
  getNextBillingDateSticky,
  computePaidResetState,
} from "@/lib/billing/billing-time-helpers";

export { getBeijingYMD, addCalendarMonths, getNextBillingDateSticky, computePaidResetState };

// =============================================================================
// 日期工具函数
// =============================================================================

/**
 * 获取今天的日期字符串 (YYYY-MM-DD) - 北京时间
 */
export function getTodayString(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const beijing = new Date(utc + 8 * 3600000);
  return beijing.toISOString().split("T")[0];
}

/**
 * 获取当前年月字符串 (YYYY-MM) - 北京时间
 */
export function getCurrentYearMonth(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const beijing = new Date(utc + 8 * 3600000);
  return `${beijing.getFullYear()}-${String(beijing.getMonth() + 1).padStart(2, "0")}`;
}

// =============================================================================
// 类型定义
// =============================================================================

export interface UserWallet {
  daily_builds_limit: number;
  daily_builds_used: number;
  daily_builds_reset_at?: string;
  billing_cycle_anchor?: number;
  plan_exp?: string;
  file_retention_days: number;
  share_enabled: boolean;
  share_duration_days: number;
  batch_build_enabled: boolean;
}

// =============================================================================
// 默认钱包
// =============================================================================

export function createDefaultWallet(planLower: string = "free"): UserWallet {
  return {
    daily_builds_limit: getPlanDailyLimit(planLower),
    daily_builds_used: 0,
    daily_builds_reset_at: getTodayString(),
    billing_cycle_anchor: undefined,
    plan_exp: undefined,
    file_retention_days: getPlanBuildExpireDays(planLower),
    share_enabled: getPlanShareExpireDays(planLower) > 0,
    share_duration_days: getPlanShareExpireDays(planLower),
    batch_build_enabled: getPlanSupportBatchBuild(planLower),
  };
}

export function normalizeWallet(raw: any): UserWallet {
  const wallet = raw?.wallet || {};
  const plan = (raw?.plan || raw?.subscriptionTier || "free").toLowerCase();

  // 从数据库读取配额字段,如果不存在则使用环境变量默认值
  return {
    daily_builds_limit: wallet.daily_builds_limit ?? getPlanDailyLimit(plan),
    daily_builds_used: wallet.daily_builds_used ?? 0,
    daily_builds_reset_at: wallet.daily_builds_reset_at,
    billing_cycle_anchor: wallet.billing_cycle_anchor,
    plan_exp: wallet.plan_exp ?? raw?.plan_exp,
    file_retention_days: wallet.file_retention_days ?? getPlanBuildExpireDays(plan),
    share_enabled: wallet.share_enabled ?? (getPlanShareExpireDays(plan) > 0),
    share_duration_days: wallet.share_duration_days ?? getPlanShareExpireDays(plan),
    batch_build_enabled: wallet.batch_build_enabled ?? getPlanSupportBatchBuild(plan),
  };
}

// =============================================================================
// 钱包操作
// =============================================================================

/**
 * 为用户初始化/重置钱包配额
 */
export async function seedWalletForPlan(
  userId: string,
  planLower: string,
  options?: { forceReset?: boolean; expired?: boolean }
): Promise<UserWallet> {
  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();

  const userRes = await db.collection("users").doc(userId).get();
  const userDoc = userRes?.data?.[0] || null;
  if (!userDoc) throw new Error(`User not found: ${userId}`);

  const now = new Date();
  let effectivePlanLower = (planLower || "free").toLowerCase();

  // 检查订阅是否过期
  const planExpIso = userDoc.plan_exp;
  if (planExpIso) {
    const exp = new Date(planExpIso);
    if (!Number.isNaN(exp.getTime()) && exp < now) {
      effectivePlanLower = "free";
    }
  }
  if (options?.expired) {
    effectivePlanLower = "free";
  }

  const wallet = normalizeWallet(userDoc);
  const nowIso = now.toISOString();
  const today = getTodayString();
  const isFreePlan = effectivePlanLower === "free";
  const isPaidPlan = !isFreePlan;

  // 计算账单锚点日
  let anchorDay = wallet.billing_cycle_anchor;
  if (isPaidPlan && (options?.forceReset || !anchorDay)) {
    anchorDay = getBeijingYMD(now).day;
  }

  let needUpdate = false;
  const updatePayload: Record<string, any> = { updatedAt: nowIso };
  const nextWallet: UserWallet = {
    ...wallet,
    billing_cycle_anchor: anchorDay,
    daily_builds_limit: getPlanDailyLimit(effectivePlanLower),
    file_retention_days: getPlanBuildExpireDays(effectivePlanLower),
    share_enabled: getPlanShareExpireDays(effectivePlanLower) > 0,
    share_duration_days: getPlanShareExpireDays(effectivePlanLower),
    batch_build_enabled: getPlanSupportBatchBuild(effectivePlanLower),
  };

  // 检查是否需要重置每日配额
  const isNewDay = wallet.daily_builds_reset_at !== today;
  if (options?.forceReset || isNewDay) {
    nextWallet.daily_builds_used = 0;
    nextWallet.daily_builds_reset_at = today;
    needUpdate = true;
  }

  // 过期时清零配额
  if (options?.expired) {
    nextWallet.daily_builds_used = 0;
    nextWallet.daily_builds_reset_at = today;
    needUpdate = true;
  }

  if (!userDoc.wallet) {
    updatePayload.wallet = nextWallet;
    needUpdate = true;
  } else {
    // 同步环境变量配额到数据库
    if (wallet.daily_builds_limit !== nextWallet.daily_builds_limit) {
      updatePayload["wallet.daily_builds_limit"] = nextWallet.daily_builds_limit;
      needUpdate = true;
    }
    if (wallet.file_retention_days !== nextWallet.file_retention_days) {
      updatePayload["wallet.file_retention_days"] = nextWallet.file_retention_days;
      needUpdate = true;
    }
    if (wallet.batch_build_enabled !== nextWallet.batch_build_enabled) {
      updatePayload["wallet.batch_build_enabled"] = nextWallet.batch_build_enabled;
      needUpdate = true;
    }
    if (wallet.share_enabled !== nextWallet.share_enabled) {
      updatePayload["wallet.share_enabled"] = nextWallet.share_enabled;
      needUpdate = true;
    }
    if (wallet.share_duration_days !== nextWallet.share_duration_days) {
      updatePayload["wallet.share_duration_days"] = nextWallet.share_duration_days;
      needUpdate = true;
    }

    // 更新必要的状态字段
    if (needUpdate || isNewDay || options?.forceReset || options?.expired) {
      updatePayload["wallet.daily_builds_used"] = nextWallet.daily_builds_used;
      updatePayload["wallet.daily_builds_reset_at"] = nextWallet.daily_builds_reset_at;
      updatePayload["wallet.billing_cycle_anchor"] = nextWallet.billing_cycle_anchor;
      needUpdate = true;
    }
  }

  if (needUpdate) {
    await db.collection("users").doc(userId).update(updatePayload);
  }

  return nextWallet;
}

/**
 * 获取用户钱包
 */
export async function getUserWallet(userId: string): Promise<UserWallet | null> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();
    const userRes = await db.collection("users").doc(userId).get();
    const userDoc = userRes?.data?.[0] || null;
    if (!userDoc) return null;
    return normalizeWallet(userDoc);
  } catch (error: any) {
    if (error?.code === "DATABASE_COLLECTION_NOT_EXIST") {
      console.log("[wallet] users collection not found");
    } else {
      console.error("[wallet] Error fetching user wallet:", error);
    }
    return null;
  }
}

/**
 * 确保用户有钱包
 */
export async function ensureUserWallet(userId: string): Promise<UserWallet> {
  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();

  const userRes = await db.collection("users").doc(userId).get();
  const userDoc = userRes?.data?.[0] || null;
  if (!userDoc) throw new Error(`User not found: ${userId}`);

  if (userDoc.wallet) return normalizeWallet(userDoc);

  const plan = (userDoc.plan || userDoc.subscriptionTier || "free").toLowerCase();
  const now = new Date();
  const defaultWallet = createDefaultWallet(plan);
  defaultWallet.billing_cycle_anchor = getBeijingYMD(now).day;

  await db.collection("users").doc(userId).update({
    wallet: defaultWallet,
    updatedAt: now.toISOString(),
  });

  return defaultWallet;
}

/**
 * 检查每日构建配额
 */
export async function checkDailyBuildQuota(
  userId: string,
  count: number = 1
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();
  const today = getTodayString();

  const userRes = await db.collection("users").doc(userId).get();
  const userDoc = userRes?.data?.[0] || null;
  if (!userDoc) return { allowed: false, remaining: 0, limit: 0 };

  const wallet = normalizeWallet(userDoc);
  const limit = wallet.daily_builds_limit;
  const isNewDay = wallet.daily_builds_reset_at !== today;
  const used = isNewDay ? 0 : wallet.daily_builds_used;

  // 如果是新的一天，重置计数
  if (isNewDay) {
    await db.collection("users").doc(userId).update({
      "wallet.daily_builds_used": 0,
      "wallet.daily_builds_reset_at": today,
      updatedAt: new Date().toISOString(),
    });
  }

  return {
    allowed: used + count <= limit,
    remaining: Math.max(0, limit - used),
    limit,
  };
}

/**
 * 消耗每日构建配额（使用乐观锁防止race condition）
 */
export async function consumeDailyBuildQuota(
  userId: string,
  count: number = 1
): Promise<{ success: boolean; error?: string }> {
  // 参数验证
  if (!userId || typeof userId !== "string") {
    return { success: false, error: "Invalid userId" };
  }
  if (!Number.isFinite(count) || count <= 0 || count > 1000) {
    return { success: false, error: "Invalid count: must be between 1 and 1000" };
  }

  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();
      const _ = db.command;
      const today = getTodayString();

      const userRes = await db.collection("users").doc(userId).get();
      const userDoc = userRes?.data?.[0] || null;
      if (!userDoc) return { success: false, error: "User not found" };

      const wallet = normalizeWallet(userDoc);
      const limit = wallet.daily_builds_limit;
      const isNewDay = wallet.daily_builds_reset_at !== today;
      const used = isNewDay ? 0 : wallet.daily_builds_used;
      const nextUsed = used + count;

      if (nextUsed > limit) {
        return { success: false, error: "Insufficient daily build quota" };
      }

      const updatePayload: Record<string, any> = {
        updatedAt: new Date().toISOString(),
      };

      if (isNewDay) {
        updatePayload["wallet.daily_builds_used"] = count;
        updatePayload["wallet.daily_builds_reset_at"] = today;
      } else {
        updatePayload["wallet.daily_builds_used"] = _.inc(count);
      }

      // 使用条件更新：只在当前值未改变时更新
      // 新的一天：检查reset_at不等于today且used值匹配
      // 同一天：检查used值和reset_at都精确匹配
      const whereCondition: Record<string, any> = {
        _id: userId,
        "wallet.daily_builds_used": wallet.daily_builds_used,
        "wallet.daily_builds_reset_at": isNewDay ? _.neq(today) : today
      };

      const updateRes = await db.collection("users")
        .where(whereCondition)
        .update(updatePayload);

      // 检查是否成功更新
      if (updateRes.updated === 0) {
        // 更新失败，说明数据已被其他请求修改，重试
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
          continue;
        }
        return { success: false, error: "Concurrent update conflict, please retry" };
      }

      return { success: true };
    } catch (error) {
      console.error("[wallet][consume-daily-build-error]", error);
      if (attempt === maxRetries - 1) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to consume daily build quota",
        };
      }
    }
  }

  return { success: false, error: "Failed after retries" };
}

/**
 * 退还每日构建配额（构建失败时调用）
 */
export async function refundDailyBuildQuota(
  userId: string,
  count: number = 1
): Promise<{ success: boolean; error?: string }> {
  // 参数验证
  if (!userId || typeof userId !== "string") {
    return { success: false, error: "Invalid userId" };
  }
  if (!Number.isFinite(count) || count <= 0 || count > 1000) {
    return { success: false, error: "Invalid count: must be between 1 and 1000" };
  }

  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const userRes = await db.collection("users").doc(userId).get();
    const userDoc = userRes?.data?.[0] || null;
    if (!userDoc) return { success: false, error: "User not found" };

    const wallet = normalizeWallet(userDoc);
    const newUsed = Math.max(0, wallet.daily_builds_used - count);

    // 记录异常退款情况
    if (wallet.daily_builds_used < count) {
      console.warn(`[wallet] Refunding more quota than used: userId=${userId}, used=${wallet.daily_builds_used}, refund=${count}`);
    }

    await db.collection("users").doc(userId).update({
      "wallet.daily_builds_used": newUsed,
      updatedAt: new Date().toISOString(),
    });

    console.log("[wallet][refund-daily-build]", { userId, count, newUsed });
    return { success: true };
  } catch (error) {
    console.error("[wallet][refund-daily-build-error]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to refund daily build quota",
    };
  }
}

/**
 * 升级用户配额（升级套餐时调用）
 */
export async function upgradeUserQuota(
  userId: string,
  newPlanLower: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const now = new Date();
    const anchorDay = getBeijingYMD(now).day;

    await db.collection("users").doc(userId).update({
      "wallet.daily_builds_used": 0,
      "wallet.daily_builds_reset_at": getTodayString(),
      "wallet.billing_cycle_anchor": anchorDay,
      updatedAt: now.toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error("[wallet][upgrade-quota-error]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to upgrade user quota",
    };
  }
}

/**
 * 计算升级价格
 */
export function calculateUpgradePrice(
  currentPlanDailyPrice: number,
  targetPlanDailyPrice: number,
  remainingDays: number,
  minimumPayment: number = 0.01
): number {
  const dailyDifference = targetPlanDailyPrice - currentPlanDailyPrice;
  const upgradePrice = dailyDifference * remainingDays;
  const finalPrice = Math.max(minimumPayment, upgradePrice);
  return Math.round(finalPrice * 100) / 100;
}
