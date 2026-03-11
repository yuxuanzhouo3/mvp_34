import { randomBytes, createHash } from "crypto";
import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ensureSupabaseUserWallet } from "@/services/wallet-supabase";
import { IS_DOMESTIC_VERSION } from "@/config";
import {
  ensureUserReferralLinkCloudBase,
  getUserInviteSummaryCloudBase,
  recordReferralClickCloudBase,
  bindReferralFromRequestCloudBase,
} from "./referrals-cloudbase";

const REFERRAL_ATTRIBUTION_COOKIE = "mk_ref";
const REFERRAL_ATTRIBUTION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

const SHARE_CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
const SHARE_CODE_LENGTH = 8;

// 邀请奖励：会员时长（天数）
// 邀请人：默认 7 天会员时长
// 被邀请人：默认 3 天会员时长
const INVITER_SIGNUP_BONUS_DAYS = Number(process.env.REFERRAL_INVITER_SIGNUP_BONUS_DAYS ?? 7);
const INVITED_SIGNUP_BONUS_DAYS = Number(process.env.REFERRAL_INVITED_SIGNUP_BONUS_DAYS ?? 3);

type ReferralAttribution = {
  shareCode: string;
  source?: string | null;
  ts: number;
};

export type UserInviteSummary = {
  referralCode: string;
  shareUrl: string;
  clickCount: number;
  invitedCount: number;
  conversionRate: number;
  rewardDays: number; // 累计奖励的会员时长（天数）
  inviterSignupBonusDays: number; // 邀请人奖励天数
  invitedSignupBonusDays: number; // 被邀请人奖励天数
};

function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    if (IS_DOMESTIC_VERSION) {
      throw new Error(
        "邀请功能需要配置 Supabase。请确保已设置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 环境变量，并在 Supabase 中创建邀请相关的表（参考 supabase/migrations/20260306001_referrals_invite_points.sql）"
      );
    }
    throw new Error("Supabase admin client is not configured");
  }
  return supabaseAdmin;
}

function normalizeShareCode(raw: string | null | undefined) {
  return String(raw ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 64);
}

function normalizeSource(raw: string | null | undefined) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32);
}

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toShareCode(length = SHARE_CODE_LENGTH) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += SHARE_CODE_ALPHABET[bytes[i] % SHARE_CODE_ALPHABET.length];
  }
  return out;
}

function withSiteOrigin(origin?: string | null) {
  const base = String(origin || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").trim();
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

export function buildReferralShareUrl(shareCode: string, origin?: string | null, source?: string | null) {
  const base = withSiteOrigin(origin);
  const code = normalizeShareCode(shareCode);
  if (!code) return `${base}/`;
  const url = new URL(`/r/${encodeURIComponent(code)}`, base);
  if (source) {
    url.searchParams.set("source", normalizeSource(source));
  }
  // 默认跳到首页，登录后可以再跳转
  url.searchParams.set("to", "/");
  return url.toString();
}

export async function ensureUserReferralLink(userId: string, origin?: string | null): Promise<{
  shareCode: string;
  shareUrl: string;
}> {
  // 国内版使用 CloudBase
  if (IS_DOMESTIC_VERSION) {
    return ensureUserReferralLinkCloudBase(userId, origin);
  }

  // 国际版使用 Supabase
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    throw new Error("userId is required");
  }

  const supabase = requireSupabaseAdmin();

  const { data: existing, error: existingError } = await supabase
    .from("referral_links")
    .select("share_code, source_default")
    .eq("creator_user_id", normalizedUserId)
    .eq("tool_slug", "main")
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.share_code) {
    const shareCode = normalizeShareCode((existing as any).share_code);
    return {
      shareCode,
      shareUrl: buildReferralShareUrl(shareCode, origin, (existing as any).source_default ?? null),
    };
  }

  const shareCode = toShareCode();
  const sourceDefault = "copy";

  const { data: created, error: insertError } = await supabase
    .from("referral_links")
    .insert({
      creator_user_id: normalizedUserId,
      tool_slug: "main",
      share_code: shareCode,
      source_default: sourceDefault,
      is_active: true,
      click_count: 0,
    })
    .select("share_code, source_default")
    .maybeSingle();

  if (insertError || !created?.share_code) {
    throw new Error(insertError?.message || "Failed to create referral link");
  }

  const finalCode = normalizeShareCode((created as any).share_code);
  return {
    shareCode: finalCode,
    shareUrl: buildReferralShareUrl(finalCode, origin, (created as any).source_default ?? null),
  };
}

export async function getUserInviteSummary(input: { userId: string; origin?: string | null }): Promise<UserInviteSummary> {
  // 国内版使用 CloudBase
  if (IS_DOMESTIC_VERSION) {
    return getUserInviteSummaryCloudBase(input);
  }

  // 国际版使用 Supabase
  const { shareCode, shareUrl } = await ensureUserReferralLink(input.userId, input.origin);
  const supabase = requireSupabaseAdmin();

  const [clicksResult, invitedResult, rewardsResult] = await Promise.all([
    supabase
      .from("referral_clicks")
      .select("id", { count: "exact", head: true })
      .eq("share_code", shareCode),
    supabase
      .from("referral_relations")
      .select("id", { count: "exact", head: true })
      .eq("inviter_user_id", input.userId),
    // 统计该用户作为邀请人获得的奖励天数（amount 字段存储的是天数）
    supabase
      .from("referral_rewards")
      .select("amount")
      .eq("user_id", input.userId)
      .eq("status", "granted"),
  ]);

  const clickCount = safeNumber(clicksResult.count);
  const invitedCount = safeNumber(invitedResult.count);
  // 累计奖励天数（所有奖励记录里的 amount 总和）
  const rewardDays = (rewardsResult.data || []).reduce(
    (sum: number, row: any) => sum + safeNumber(row?.amount),
    0,
  );

  return {
    referralCode: shareCode,
    shareUrl,
    clickCount,
    invitedCount,
    conversionRate: clickCount > 0 ? Number(((invitedCount / clickCount) * 100).toFixed(2)) : 0,
    rewardDays,
    inviterSignupBonusDays: INVITER_SIGNUP_BONUS_DAYS,
    invitedSignupBonusDays: INVITED_SIGNUP_BONUS_DAYS,
  };
}

export async function recordReferralClick(input: {
  shareCode: string;
  source?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  landingPath?: string | null;
}) {
  // 国内版使用 CloudBase
  if (IS_DOMESTIC_VERSION) {
    return recordReferralClickCloudBase(input);
  }

  // 国际版使用 Supabase
  const code = normalizeShareCode(input.shareCode);
  if (!code) return;

  const supabase = requireSupabaseAdmin();

  const ipHash = input.ip ? hashSensitive(input.ip) : null;
  const uaHash = input.userAgent ? hashSensitive(input.userAgent) : null;

  const payload = {
    share_code: code,
    source: normalizeSource(input.source || null) || null,
    ip_hash: ipHash,
    user_agent_hash: uaHash,
    landing_path: String(input.landingPath || "").slice(0, 255) || null,
  };

  await supabase.from("referral_clicks").insert(payload).throwOnError();

  const { data: linkRow } = await supabase
    .from("referral_links")
    .select("id,click_count")
    .eq("share_code", code)
    .maybeSingle();

  if (linkRow?.id) {
    const next = safeNumber((linkRow as any).click_count) + 1;
    await supabase
      .from("referral_links")
      .update({ click_count: next })
      .eq("id", (linkRow as any).id)
      .throwOnError();
  }
}

function hashSensitive(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

export function encodeReferralAttributionCookie(value: ReferralAttribution) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeReferralAttributionCookie(value?: string | null): ReferralAttribution | null {
  if (!value) return null;
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const shareCode = normalizeShareCode(decoded?.shareCode);
    if (!shareCode) return null;
    const ts = Number(decoded?.ts || 0);
    const now = Date.now();
    if (!Number.isFinite(ts) || ts <= 0 || now - ts > REFERRAL_ATTRIBUTION_MAX_AGE_SECONDS * 1000) {
      return null;
    }
    return {
      shareCode,
      source: normalizeSource(decoded?.source) || null,
      ts,
    };
  } catch {
    return null;
  }
}

export function extractReferralAttribution(request: NextRequest): ReferralAttribution | null {
  const queryRef = normalizeShareCode(request.nextUrl.searchParams.get("ref"));
  if (queryRef) {
    return {
      shareCode: queryRef,
      source: normalizeSource(request.nextUrl.searchParams.get("source")) || null,
      ts: Date.now(),
    };
  }

  return decodeReferralAttributionCookie(request.cookies.get(REFERRAL_ATTRIBUTION_COOKIE)?.value || null);
}

export async function bindReferralFromRequest(input: {
  request: NextRequest;
  invitedUserId?: string | null;
}): Promise<{ bound: boolean; relationId?: string }> {
  const invitedUserId = String(input.invitedUserId || "").trim();
  if (!invitedUserId) {
    return { bound: false };
  }

  const attribution = extractReferralAttribution(input.request);
  if (!attribution?.shareCode) {
    return { bound: false };
  }

  // 国内版使用 CloudBase
  if (IS_DOMESTIC_VERSION) {
    return bindReferralFromRequestCloudBase({
      shareCode: attribution.shareCode,
      invitedUserId,
    });
  }

  // 国际版使用 Supabase
  const supabase = requireSupabaseAdmin();

  const { data: linkRow } = await supabase
    .from("referral_links")
    .select("creator_user_id,is_active,share_code,tool_slug,source_default")
    .eq("share_code", attribution.shareCode)
    .maybeSingle();

  const creatorUserId = String((linkRow as any)?.creator_user_id || "").trim();
  const isActive = (linkRow as any)?.is_active !== false;

  if (!creatorUserId || !isActive || creatorUserId === invitedUserId) {
    return { bound: false };
  }

  const { data: existingRelation, error: existingError } = await supabase
    .from("referral_relations")
    .select("id")
    .eq("invited_user_id", invitedUserId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }
  if (existingRelation?.id) {
    return { bound: false, relationId: String(existingRelation.id) };
  }

  const createdAt = new Date().toISOString();

  const { data: createdRelation, error: createError } = await supabase
    .from("referral_relations")
    .insert({
      inviter_user_id: creatorUserId,
      invited_user_id: invitedUserId,
      share_code: attribution.shareCode,
      tool_slug: (linkRow as any)?.tool_slug || "main",
      status: "bound",
      created_at: createdAt,
    })
    .select("id")
    .maybeSingle();

  if (createError || !createdRelation?.id) {
    throw new Error(createError?.message || "Failed to create referral relation");
  }

  const relationId = String(createdRelation.id);

  // 记录奖励记录（用于统计）
  const inviterReferenceId = `ref_signup_inviter_${relationId}`;
  const invitedReferenceId = `ref_signup_invited_${relationId}`;

  await supabase
    .from("referral_rewards")
    .insert([
      {
        relation_id: relationId,
        user_id: creatorUserId,
        reward_type: "signup_inviter",
        amount: INVITER_SIGNUP_BONUS_DAYS, // 存储天数
        status: "granted",
        reference_id: inviterReferenceId,
        created_at: createdAt,
        granted_at: createdAt,
      },
      {
        relation_id: relationId,
        user_id: invitedUserId,
        reward_type: "signup_invited",
        amount: INVITED_SIGNUP_BONUS_DAYS, // 存储天数
        status: "granted",
        reference_id: invitedReferenceId,
        created_at: createdAt,
        granted_at: createdAt,
      },
    ])
    .throwOnError();

  // 延长邀请人的会员时长
  const inviterWallet = await ensureSupabaseUserWallet(creatorUserId);
  if (inviterWallet) {
    const now = new Date();
    // 如果当前是 Free 计划且没有到期时间，先升级到 Pro 并设置到期时间
    const currentPlan = (inviterWallet.plan || "Free").toLowerCase();
    const currentExp = inviterWallet.plan_exp ? new Date(inviterWallet.plan_exp) : null;
    
    let newExp: Date;
    if (currentExp && currentExp > now) {
      // 如果已有会员时长，在现有基础上延长
      newExp = new Date(currentExp.getTime() + INVITER_SIGNUP_BONUS_DAYS * 24 * 60 * 60 * 1000);
    } else {
      // 如果没有会员时长或已过期，从现在开始计算
      newExp = new Date(now.getTime() + INVITER_SIGNUP_BONUS_DAYS * 24 * 60 * 60 * 1000);
    }

    // 如果当前是 Free，升级到 Pro
    const newPlan = currentPlan === "free" ? "Pro" : inviterWallet.plan;

    await supabase
      .from("user_wallets")
      .update({
        plan: newPlan,
        plan_exp: newExp.toISOString(),
        updated_at: createdAt,
      })
      .eq("user_id", creatorUserId)
      .throwOnError();
  }

  // 延长被邀请人的会员时长
  const invitedWallet = await ensureSupabaseUserWallet(invitedUserId);
  if (invitedWallet) {
    const now = new Date();
    const currentPlan = (invitedWallet.plan || "Free").toLowerCase();
    const currentExp = invitedWallet.plan_exp ? new Date(invitedWallet.plan_exp) : null;
    
    let newExp: Date;
    if (currentExp && currentExp > now) {
      // 如果已有会员时长，在现有基础上延长
      newExp = new Date(currentExp.getTime() + INVITED_SIGNUP_BONUS_DAYS * 24 * 60 * 60 * 1000);
    } else {
      // 如果没有会员时长或已过期，从现在开始计算
      newExp = new Date(now.getTime() + INVITED_SIGNUP_BONUS_DAYS * 24 * 60 * 60 * 1000);
    }

    // 如果当前是 Free，升级到 Pro
    const newPlan = currentPlan === "free" ? "Pro" : invitedWallet.plan;

    await supabase
      .from("user_wallets")
      .update({
        plan: newPlan,
        plan_exp: newExp.toISOString(),
        updated_at: createdAt,
      })
      .eq("user_id", invitedUserId)
      .throwOnError();
  }

  return { bound: true, relationId };
}

export { REFERRAL_ATTRIBUTION_COOKIE, REFERRAL_ATTRIBUTION_MAX_AGE_SECONDS };

