/**
 * Wallet Supabase 服务 - 国际版
 * 管理订阅配额、构建额度，支持账单日粘性与原子扣费
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getPlanDailyLimit,
  getPlanBuildExpireDays,
  getPlanShareExpireDays,
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
  share_enabled: boolean;
  share_duration_days: number;
  pending_downgrade: string | null;
  billing_cycle_anchor?: number | null;
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
  const currentYear = result.getFullYear();
  const currentMonth = result.getMonth();
  const currentDay = result.getDate();

  // 计算目标年月
  const targetMonth = currentMonth + months;
  const targetYear = currentYear + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  // 确定目标日期
  const targetDay = anchorDay || currentDay;
  const maxDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const finalDay = Math.min(targetDay, maxDay);

  // 设置新日期（先重置日期，避免 31 号切月溢出到下月）
  result.setDate(1);
  result.setFullYear(targetYear);
  result.setMonth(normalizedMonth);
  result.setDate(finalDay);

  return result;
}

// =============================================================================
// 默认钱包
// =============================================================================

export function createDefaultSupabaseWallet(userId: string): Partial<SupabaseUserWallet> {
  const today = getTodayString();
  const shareDuration = getPlanShareExpireDays("Free");
  return {
    user_id: userId,
    plan: "Free",
    plan_exp: null,
    daily_builds_limit: getPlanDailyLimit("Free"),
    daily_builds_used: 0,
    daily_builds_reset_at: today,
    file_retention_days: getPlanBuildExpireDays("Free"),
    batch_build_enabled: getPlanSupportBatchBuild("Free"),
    share_enabled: shareDuration > 0,
    share_duration_days: shareDuration,
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
  if (typeof raw === "string") {
    try {
      pendingData = JSON.parse(raw);
    } catch {
      return null;
    }
  } else {
    pendingData = raw;
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
  const anchorDay = wallet.billing_cycle_anchor || effectiveAt.getUTCDate();
  const nextExpireIso = firstPending?.expiresAt || addCalendarMonths(effectiveAt, monthsToAdd, anchorDay).toISOString();
  const nowIso = now.toISOString();
  const shareDuration = getPlanShareExpireDays(targetPlan);

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
      share_enabled: shareDuration > 0,
      share_duration_days: shareDuration,
      pending_downgrade: newPendingDowngrade,
      updated_at: nowIso,
    })
    .eq("user_id", userId);

  if (walletUpdateError) {
    console.error("[wallet-supabase] apply pending downgrade error:", walletUpdateError);
  }

  const { error: subUpdateError } = await supabaseAdmin
    .from("subscriptions")
    .update({
      plan: targetPlan,
      period: firstPending?.period || "monthly",
      status: "active",
      started_at: effectiveAt.toISOString(),
      expires_at: nextExpireIso,
      updated_at: nowIso,
    })
    .eq("user_id", userId);

  if (subUpdateError) {
    console.error("[wallet-supabase] apply pending downgrade subscription update error:", subUpdateError);
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
 * 订阅到期处理：到期后自动降级为 Free
 */
async function expireSupabaseWalletIfNeeded(params: {
  userId: string;
  wallet: SupabaseUserWallet;
  now: Date;
}): Promise<SupabaseUserWallet | null> {
  const { userId, wallet, now } = params;
  if (!supabaseAdmin) return null;

  const planLower = (wallet.plan || "").toLowerCase();
  if (planLower === "free") return wallet;

  const planExp = wallet.plan_exp ? new Date(wallet.plan_exp) : null;
  if (!planExp || Number.isNaN(planExp.getTime()) || planExp > now) {
    return wallet;
  }

  const nowIso = now.toISOString();
  const today = getTodayString();
  const shareDuration = getPlanShareExpireDays("Free");

  const { data, error } = await supabaseAdmin
    .from("user_wallets")
    .update({
      plan: "Free",
      plan_exp: null,
      daily_builds_limit: getPlanDailyLimit("Free"),
      daily_builds_used: 0,
      daily_builds_reset_at: today,
      file_retention_days: getPlanBuildExpireDays("Free"),
      batch_build_enabled: getPlanSupportBatchBuild("Free"),
      share_enabled: shareDuration > 0,
      share_duration_days: shareDuration,
      pending_downgrade: null,
      updated_at: nowIso,
    })
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    console.error("[wallet-supabase] expire wallet error:", error);
    return null;
  }

  // 标记订阅记录为过期
  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "expired", updated_at: nowIso })
    .eq("user_id", userId)
    .eq("status", "active")
    .lte("expires_at", nowIso);

  // 同步 auth.users 元数据
  try {
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { plan: "Free", plan_exp: null },
    });
  } catch (e) {
    console.warn("[wallet-supabase] auth metadata sync failed:", e);
  }

  return data as SupabaseUserWallet;
}

/**
 * 获取有效钱包（处理待降级与到期逻辑）
 */
export async function getEffectiveSupabaseUserWallet(
  userId: string
): Promise<SupabaseUserWallet | null> {
  if (!supabaseAdmin) return null;

  let wallet = await getSupabaseUserWallet(userId);
  if (!wallet) {
    wallet = await ensureSupabaseUserWallet(userId);
  }
  if (!wallet) return null;

  const now = new Date();

  // 处理待生效降级
  if (wallet.pending_downgrade) {
    const applied = await applySupabasePendingDowngradeIfNeeded({ userId, wallet, now });
    if (applied) {
      wallet = applied;
    }
  }

  // 处理到期自动降级
  const expiredWallet = await expireSupabaseWalletIfNeeded({ userId, wallet, now });
  if (!expiredWallet) return null;
  wallet = expiredWallet;

  return wallet;
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
    const shareDuration = getPlanShareExpireDays(planLabel);
    const newWallet: Partial<SupabaseUserWallet> = {
      user_id: userId,
      plan: planLabel,
      plan_exp: effectivePlanExp,
      daily_builds_limit: getPlanDailyLimit(planLabel),
      daily_builds_used: 0,
      daily_builds_reset_at: today,
      file_retention_days: getPlanBuildExpireDays(planLabel),
      batch_build_enabled: getPlanSupportBatchBuild(planLabel),
      share_enabled: shareDuration > 0,
      share_duration_days: shareDuration,
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
    updatePayload.daily_builds_used = 0;
    updatePayload.daily_builds_reset_at = today;
    needUpdate = true;
  }

  // 同步环境变量配额到数据库
  const envDailyLimit = getPlanDailyLimit(planLabel);
  const envRetentionDays = getPlanBuildExpireDays(planLabel);
  const envBatchEnabled = getPlanSupportBatchBuild(planLabel);
  const envShareDuration = getPlanShareExpireDays(planLabel);
  const envShareEnabled = envShareDuration > 0;

  if (wallet.daily_builds_limit !== envDailyLimit) {
    updatePayload.daily_builds_limit = envDailyLimit;
    needUpdate = true;
  }
  if (wallet.file_retention_days !== envRetentionDays) {
    updatePayload.file_retention_days = envRetentionDays;
    needUpdate = true;
  }
  if (wallet.batch_build_enabled !== envBatchEnabled) {
    updatePayload.batch_build_enabled = envBatchEnabled;
    needUpdate = true;
  }
  if (wallet.share_enabled !== envShareEnabled) {
    updatePayload.share_enabled = envShareEnabled;
    needUpdate = true;
  }
  if (wallet.share_duration_days !== envShareDuration) {
    updatePayload.share_duration_days = envShareDuration;
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
    const shareDuration = getPlanShareExpireDays(planLabel);
    const { error } = await supabaseAdmin
      .from("user_wallets")
      .update({
        plan: planLabel,
        plan_exp: planExpIso,
        daily_builds_limit: getPlanDailyLimit(planLabel),
        file_retention_days: getPlanBuildExpireDays(planLabel),
        batch_build_enabled: getPlanSupportBatchBuild(planLabel),
        share_enabled: shareDuration > 0,
        share_duration_days: shareDuration,
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
    const shareDuration = getPlanShareExpireDays(planLabel);

    const { error } = await supabaseAdmin
      .from("user_wallets")
      .update({
        plan: planLabel,
        daily_builds_limit: getPlanDailyLimit(planLabel),
        daily_builds_used: 0,
        daily_builds_reset_at: today,
        file_retention_days: getPlanBuildExpireDays(planLabel),
        batch_build_enabled: getPlanSupportBatchBuild(planLabel),
        share_enabled: shareDuration > 0,
        share_duration_days: shareDuration,
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

  // 参数验证
  if (!userId || typeof userId !== "string") {
    return { success: false, error: "Invalid userId" };
  }
  if (!Number.isFinite(count) || count <= 0 || count > 1000) {
    return { success: false, error: "Invalid count: must be between 1 and 1000" };
  }

  try {
    // 获取有效钱包（处理到期/降级）
    const wallet = await getEffectiveSupabaseUserWallet(userId);
    if (!wallet) {
      return { success: false, error: "Failed to load wallet" };
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

  // 参数验证
  if (!userId || typeof userId !== "string") {
    return { success: false, error: "Invalid userId" };
  }
  if (!Number.isFinite(count) || count <= 0 || count > 1000) {
    return { success: false, error: "Invalid count: must be between 1 and 1000" };
  }

  try {
    const wallet = await getSupabaseUserWallet(userId);
    if (!wallet) return { success: false, error: "Wallet not found" };

    const newUsed = Math.max(0, (wallet.daily_builds_used || 0) - count);

    // 记录异常退款情况
    if ((wallet.daily_builds_used || 0) < count) {
      console.warn(`[wallet-supabase] Refunding more quota than used: userId=${userId}, used=${wallet.daily_builds_used}, refund=${count}`);
    }

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
  const wallet = await getEffectiveSupabaseUserWallet(userId);
  if (!wallet) return { allowed: false, remaining: 0, limit: 0 };

  // 始终从环境变量读取配额限制，确保环境变量更新后立即生效
  const limit = getPlanDailyLimit(wallet.plan);
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
