/**
 * Wallet Supabase 服务 - 国际版
 * 管理订阅配额、构建额度，支持账单日粘性与原子扣费
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getPlanDailyLimit,
  getPlanBuildExpireDays,
  getPlanSupportBatchBuild,
} from "@/utils/plan-limits";

// =============================================================================
// 类型定义
// =============================================================================

export interface SupabaseUserWallet {
  user_id: string;
  plan: string;
  plan_exp: string | null;
  daily_builds_limit: number;
  daily_builds_used: number;
  daily_builds_reset_at: string | null;
  file_retention_days: number;
  batch_build_enabled: boolean;
  pending_downgrade: string | null;
  updated_at: string;
}

// =============================================================================
// 时间工具
// =============================================================================

/** 获取 UTC 时间的年月日（国际版使用 UTC 时区） */
export function getUTCYMD(date: Date): { year: number; month: number; day: number } {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

/** 获取今天的日期字符串 (YYYY-MM-DD)，使用 UTC 时区 */
export function getTodayString(): string {
  const { year, month, day } = getUTCYMD(new Date());
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 添加日历月份（支持月末粘性） */
export function addCalendarMonths(baseDate: Date, months: number, anchorDay?: number): Date {
  const result = new Date(baseDate);
  const targetMonth = result.getMonth() + months;
  result.setMonth(targetMonth);

  if (anchorDay) {
    const maxDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(anchorDay, maxDay));
  }

  return result;
}

// =============================================================================
// 默认钱包
// =============================================================================

export function createDefaultSupabaseWallet(userId: string): Partial<SupabaseUserWallet> {
  const today = getTodayString();
  return {
    user_id: userId,
    plan: "Free",
    plan_exp: null,
    daily_builds_limit: getPlanDailyLimit("Free"),
    daily_builds_used: 0,
    daily_builds_reset_at: today,
    file_retention_days: getPlanBuildExpireDays("Free"),
    batch_build_enabled: getPlanSupportBatchBuild("Free"),
    pending_downgrade: null,
    updated_at: new Date().toISOString(),
  };
}

// =============================================================================
// 钱包操作
// =============================================================================

export async function getSupabaseUserWallet(userId: string): Promise<SupabaseUserWallet | null> {
  if (!supabaseAdmin) {
    console.warn("[wallet-supabase] supabaseAdmin not available");
    return null;
  }
  try {
    const { data, error } = await supabaseAdmin
      .from("user_wallets")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (error) {
      if (error.code === "PGRST116") return null;
      console.error("[wallet-supabase] Error fetching wallet:", error);
      return null;
    }
    return data as SupabaseUserWallet;
  } catch (error) {
    console.error("[wallet-supabase] Error fetching wallet:", error);
    return null;
  }
}

export async function ensureSupabaseUserWallet(userId: string): Promise<SupabaseUserWallet | null> {
  if (!supabaseAdmin) {
    console.warn("[wallet-supabase] supabaseAdmin not available");
    return null;
  }

  let wallet = await getSupabaseUserWallet(userId);
  if (!wallet) {
    const defaultWallet = createDefaultSupabaseWallet(userId);
    const { data, error } = await supabaseAdmin
      .from("user_wallets")
      .insert(defaultWallet)
      .select()
      .single();
    if (error) {
      console.error("[wallet-supabase] Error creating wallet:", error);
      return null;
    }
    wallet = data as SupabaseUserWallet;
  }

  return wallet;
}

/** 标准化套餐名称 */
function normalizeSupabasePlanLabel(planLower: string): string {
  const lower = (planLower || "").toLowerCase();
  if (lower === "pro" || lower === "专业版") return "Pro";
  if (lower === "team" || lower === "团队版") return "Team";
  return "Free";
}

/** 处理待生效的降级 */
async function applySupabasePendingDowngradeIfNeeded(params: {
  userId: string;
  wallet: SupabaseUserWallet;
  now: Date;
}): Promise<SupabaseUserWallet | null> {
  const { userId, wallet, now } = params;
  if (!supabaseAdmin) return null;

  const raw = wallet.pending_downgrade;
  if (!raw) return null;

  let pendingData: any = null;
  try {
    pendingData = JSON.parse(raw);
  } catch {
    return null;
  }

  const pendingQueue = Array.isArray(pendingData) ? pendingData : [pendingData];
  if (pendingQueue.length === 0) return null;

  const firstPending = pendingQueue[0];
  const targetPlanRaw = firstPending?.targetPlan || firstPending?.plan || null;
  if (!targetPlanRaw) return null;

  const targetPlanLower = String(targetPlanRaw).toLowerCase();
  const targetPlan = normalizeSupabasePlanLabel(targetPlanLower);

  const effectiveAt = firstPending?.effectiveAt
    ? new Date(firstPending.effectiveAt)
    : wallet.plan_exp
      ? new Date(wallet.plan_exp)
      : null;
  if (!effectiveAt || Number.isNaN(effectiveAt.getTime()) || effectiveAt > now) {
    return null;
  }

  // 从队列中移除第一个已生效的降级
  const remainingQueue = pendingQueue.slice(1);
  const newPendingDowngrade = remainingQueue.length > 0 ? JSON.stringify(remainingQueue) : null;

  // 计算新的到期时间
  const monthsToAdd = firstPending?.period === "annual" ? 12 : 1;
  const nextExpireIso = firstPending?.expiresAt || addCalendarMonths(effectiveAt, monthsToAdd).toISOString();
  const nowIso = now.toISOString();

  // 更新钱包
  const { error: walletUpdateError } = await supabaseAdmin
    .from("user_wallets")
    .update({
      plan: targetPlan,
      plan_exp: nextExpireIso,
      daily_builds_limit: getPlanDailyLimit(targetPlan),
      daily_builds_used: 0,
      file_retention_days: getPlanBuildExpireDays(targetPlan),
      batch_build_enabled: getPlanSupportBatchBuild(targetPlan),
      pending_downgrade: newPendingDowngrade,
      updated_at: nowIso,
    })
    .eq("user_id", userId);

  if (walletUpdateError) {
    console.error("[wallet-supabase] apply pending downgrade error:", walletUpdateError);
  }

  // 同步 auth.users 元数据
  try {
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        plan: targetPlan,
        plan_exp: nextExpireIso,
      },
    });
  } catch (e) {
    console.warn("[wallet-supabase] auth metadata sync failed:", e);
  }

  console.log("[wallet-supabase] Applied pending downgrade:", {
    userId,
    plan: targetPlan,
    remainingQueue: remainingQueue.length,
  });

  return await getSupabaseUserWallet(userId);
}

/**
 * 确保钱包存在，并按套餐初始化/懒刷新每日配额
 */
export async function seedSupabaseWalletForPlan(
  userId: string,
  planLowerInput: string,
  options?: { forceReset?: boolean; expired?: boolean }
): Promise<SupabaseUserWallet | null> {
  if (!supabaseAdmin) {
    console.warn("[wallet-supabase] supabaseAdmin not available");
    return null;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const today = getTodayString();

  // 获取钱包与活跃订阅
  const [walletRes, subRes] = await Promise.all([
    getSupabaseUserWallet(userId),
    supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let wallet = walletRes;
  const activeSub = subRes.error ? null : subRes.data;

  // 处理到期的降级请求
  if (wallet?.pending_downgrade) {
    const appliedWallet = await applySupabasePendingDowngradeIfNeeded({
      userId,
      wallet,
      now,
    });
    if (appliedWallet) return appliedWallet;
    wallet = await getSupabaseUserWallet(userId);
  }

  // 判定真实 Plan
  let effectivePlan = (planLowerInput || "free").toLowerCase();
  let effectivePlanExp: string | null = null;
  if (activeSub) {
    const subExpiresAt = activeSub.expires_at ? new Date(activeSub.expires_at) : null;
    if (!subExpiresAt || subExpiresAt > now) {
      effectivePlan = (activeSub.plan || "free").toLowerCase();
      effectivePlanExp = activeSub.expires_at || null;
    }
  }
  if (options?.expired) {
    effectivePlan = "free";
  }

  const planLabel = normalizeSupabasePlanLabel(effectivePlan);

  // 新钱包初始化
  if (!wallet) {
    const newWallet: Partial<SupabaseUserWallet> = {
      user_id: userId,
      plan: planLabel,
      plan_exp: effectivePlanExp,
      daily_builds_limit: getPlanDailyLimit(planLabel),
      daily_builds_used: 0,
      daily_builds_reset_at: today,
      file_retention_days: getPlanBuildExpireDays(planLabel),
      batch_build_enabled: getPlanSupportBatchBuild(planLabel),
      pending_downgrade: null,
      updated_at: nowIso,
    };

    const { data, error } = await supabaseAdmin
      .from("user_wallets")
      .insert(newWallet)
      .select()
      .single();

    if (error) {
      console.error("[wallet-supabase] Error creating wallet:", error);
      return null;
    }

    return data as SupabaseUserWallet;
  }

  // 懒刷新/状态同步
  let needUpdate = false;
  const updatePayload: Partial<SupabaseUserWallet> = { updated_at: nowIso };

  // 校正 plan
  const walletPlanLower = (wallet.plan || "free").toLowerCase();
  if (walletPlanLower !== effectivePlan) {
    updatePayload.plan = planLabel;
    updatePayload.plan_exp = effectivePlanExp;
    updatePayload.daily_builds_limit = getPlanDailyLimit(planLabel);
    updatePayload.daily_builds_used = 0;
    updatePayload.file_retention_days = getPlanBuildExpireDays(planLabel);
    updatePayload.batch_build_enabled = getPlanSupportBatchBuild(planLabel);
    updatePayload.daily_builds_reset_at = today;
    needUpdate = true;
  }

  // 每日重置检查
  if (!needUpdate && wallet.daily_builds_reset_at !== today) {
    updatePayload.daily_builds_used = 0;
    updatePayload.daily_builds_reset_at = today;
    needUpdate = true;
  }

  if (options?.forceReset) {
    updatePayload.daily_builds_used = 0;
    updatePayload.daily_builds_reset_at = today;
    needUpdate = true;
  }

  if (needUpdate) {
    const { data, error } = await supabaseAdmin
      .from("user_wallets")
      .update(updatePayload)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("[wallet-supabase] Error updating wallet:", error);
      return wallet;
    }

    return data as SupabaseUserWallet;
  }

  return wallet;
}

/**
 * 更新订阅信息
 */
export async function updateSupabaseSubscription(
  userId: string,
  plan: string,
  planExpIso: string,
  pendingDowngrade: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!supabaseAdmin) return { success: false, error: "supabaseAdmin not available" };
  try {
    await ensureSupabaseUserWallet(userId);
    const planLabel = normalizeSupabasePlanLabel(plan);
    const { error } = await supabaseAdmin
      .from("user_wallets")
      .update({
        plan: planLabel,
        plan_exp: planExpIso,
        daily_builds_limit: getPlanDailyLimit(planLabel),
        file_retention_days: getPlanBuildExpireDays(planLabel),
        batch_build_enabled: getPlanSupportBatchBuild(planLabel),
        pending_downgrade: pendingDowngrade,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update subscription",
    };
  }
}

/**
 * 升级时重置每日配额
 */
export async function upgradeSupabaseQuota(
  userId: string,
  plan: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabaseAdmin) return { success: false, error: "supabaseAdmin not available" };
  try {
    await ensureSupabaseUserWallet(userId);
    const planLabel = normalizeSupabasePlanLabel(plan);
    const today = getTodayString();

    const { error } = await supabaseAdmin
      .from("user_wallets")
      .update({
        plan: planLabel,
        daily_builds_limit: getPlanDailyLimit(planLabel),
        daily_builds_used: 0,
        daily_builds_reset_at: today,
        file_retention_days: getPlanBuildExpireDays(planLabel),
        batch_build_enabled: getPlanSupportBatchBuild(planLabel),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to upgrade quota",
    };
  }
}

/**
 * 续费时延长订阅（不重置已用额度）
 */
export async function renewSupabaseQuota(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabaseAdmin) return { success: false, error: "supabaseAdmin not available" };

  try {
    const wallet = await getSupabaseUserWallet(userId);
    if (!wallet) await ensureSupabaseUserWallet(userId);

    // 续费不重置已用额度，只更新时间戳
    const { error } = await supabaseAdmin
      .from("user_wallets")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to renew quota",
    };
  }
}

/**
 * 扣减构建额度（使用原子操作防止竞态条件）
 */
export async function deductBuildQuota(
  userId: string,
  count: number = 1
): Promise<{ success: boolean; remaining?: number; error?: string }> {
  if (!supabaseAdmin) return { success: false, error: "supabaseAdmin not available" };

  try {
    // 确保用户钱包存在
    const wallet = await getSupabaseUserWallet(userId);
    if (!wallet) {
      const created = await ensureSupabaseUserWallet(userId);
      if (!created) return { success: false, error: "Failed to create wallet" };
    }

    const today = getTodayString();

    // 使用 RPC 函数进行原子扣减
    const { data, error } = await supabaseAdmin.rpc("deduct_build_quota", {
      p_user_id: userId,
      p_count: count,
      p_today: today,
    });

    if (error) {
      console.error("[wallet-supabase] RPC deduct_build_quota error:", error);
      return { success: false, error: error.message };
    }

    const result = data?.[0];
    if (!result) {
      return { success: false, error: "No result from deduct_build_quota" };
    }

    console.log("[wallet-supabase][deduct-build]", {
      userId,
      count,
      success: result.success,
      remaining: result.remaining,
      error: result.error_message,
    });

    if (!result.success) {
      return {
        success: false,
        remaining: result.remaining,
        error: result.error_message || "Insufficient daily build quota",
      };
    }

    return { success: true, remaining: result.remaining };
  } catch (err) {
    console.error("[wallet-supabase][deduct-build-error]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to deduct quota",
    };
  }
}

/**
 * 退还构建额度（用于数据库插入失败等回滚场景）
 */
export async function refundBuildQuota(
  userId: string,
  count: number = 1
): Promise<{ success: boolean; error?: string }> {
  if (!supabaseAdmin) return { success: false, error: "supabaseAdmin not available" };

  try {
    const wallet = await getSupabaseUserWallet(userId);
    if (!wallet) return { success: false, error: "Wallet not found" };

    const newUsed = Math.max(0, (wallet.daily_builds_used || 0) - count);

    const { error } = await supabaseAdmin
      .from("user_wallets")
      .update({
        daily_builds_used: newUsed,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      console.error("[wallet-supabase] refund error:", error);
      return { success: false, error: error.message };
    }

    console.log("[wallet-supabase][refund-build]", { userId, count, newUsed });
    return { success: true };
  } catch (err) {
    console.error("[wallet-supabase][refund-error]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to refund quota",
    };
  }
}

/**
 * 检查构建额度
 */
export async function checkBuildQuota(
  userId: string,
  count: number = 1
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  if (!supabaseAdmin) return { allowed: false, remaining: 0, limit: 0 };

  const today = getTodayString();
  let wallet = await getSupabaseUserWallet(userId);

  if (!wallet) {
    wallet = await ensureSupabaseUserWallet(userId);
    if (!wallet) return { allowed: false, remaining: 0, limit: 0 };
  }

  const limit = wallet.daily_builds_limit || getPlanDailyLimit(wallet.plan);
  const isNewDay = wallet.daily_builds_reset_at !== today;
  const used = isNewDay ? 0 : (wallet.daily_builds_used || 0);
  const remaining = Math.max(0, limit - used);

  return {
    allowed: remaining >= count,
    remaining,
    limit,
  };
}

/**
 * 计算升级补差价
 */
export function calculateSupabaseUpgradePrice(
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
