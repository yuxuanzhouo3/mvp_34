/**
 * CloudBase 版本的邀请系统实现
 * 仅国内版使用
 */

import { randomBytes, createHash } from "crypto";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { ensureUserWallet } from "@/services/wallet";
import type { UserInviteSummary } from "./referrals";
import { buildReferralShareUrl } from "./referrals";

const INVITER_SIGNUP_BONUS_DAYS = Number(process.env.REFERRAL_INVITER_SIGNUP_BONUS_DAYS ?? 7);
const INVITED_SIGNUP_BONUS_DAYS = Number(process.env.REFERRAL_INVITED_SIGNUP_BONUS_DAYS ?? 3);

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

function toShareCode(length = 8) {
  const SHARE_CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += SHARE_CODE_ALPHABET[bytes[i] % SHARE_CODE_ALPHABET.length];
  }
  return out;
}

function hashSensitive(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

export async function ensureUserReferralLinkCloudBase(
  userId: string,
  origin?: string | null
): Promise<{ shareCode: string; shareUrl: string }> {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    throw new Error("userId is required");
  }

  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();

  // 查找现有邀请链接
  const existingResult = await db
    .collection("referral_links")
    .where({ creator_user_id: normalizedUserId, tool_slug: "main" })
    .limit(1)
    .get();

  const existing = existingResult.data?.[0];
  if (existing?.share_code) {
    const shareCode = normalizeShareCode(existing.share_code);
    const shareUrl = buildReferralShareUrl(shareCode, origin, existing.source_default || null);
    return { shareCode, shareUrl };
  }

  // 创建新邀请链接
  const shareCode = toShareCode();
  const sourceDefault = "copy";
  const now = new Date().toISOString();

  const linkData = {
    creator_user_id: normalizedUserId,
    tool_slug: "main",
    share_code: shareCode,
    source_default: sourceDefault,
    is_active: true,
    click_count: 0,
    created_at: now,
    expires_at: null,
  };

  const result = await db.collection("referral_links").add(linkData);
  if (!result.id) {
    throw new Error("Failed to create referral link");
  }

  const shareUrl = buildReferralShareUrl(shareCode, origin, sourceDefault);

  return { shareCode, shareUrl };
}

export async function getUserInviteSummaryCloudBase(input: {
  userId: string;
  origin?: string | null;
}): Promise<UserInviteSummary> {
  const { shareCode, shareUrl } = await ensureUserReferralLinkCloudBase(input.userId, input.origin);

  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();

  // 统计点击量
  const clicksResult = await db
    .collection("referral_clicks")
    .where({ share_code: shareCode })
    .count();

  // 统计邀请人数
  const invitedResult = await db
    .collection("referral_relations")
    .where({ inviter_user_id: input.userId })
    .count();

  // 统计奖励天数
  const rewardsResult = await db
    .collection("referral_rewards")
    .where({ user_id: input.userId, status: "granted" })
    .get();

  const clickCount = safeNumber(clicksResult.total);
  const invitedCount = safeNumber(invitedResult.total);
  const rewardDays = (rewardsResult.data || []).reduce(
    (sum: number, row: any) => sum + safeNumber(row?.amount),
    0
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

export async function recordReferralClickCloudBase(input: {
  shareCode: string;
  source?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  landingPath?: string | null;
}) {
  const code = normalizeShareCode(input.shareCode);
  if (!code) return;

  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();

  const ipHash = input.ip ? hashSensitive(input.ip) : null;
  const uaHash = input.userAgent ? hashSensitive(input.userAgent) : null;

  const payload = {
    share_code: code,
    source: normalizeSource(input.source || null) || null,
    ip_hash: ipHash,
    user_agent_hash: uaHash,
    landing_path: String(input.landingPath || "").slice(0, 255) || null,
    created_at: new Date().toISOString(),
    registered_user_id: null,
  };

  await db.collection("referral_clicks").add(payload);

  // 更新点击计数
  const linkResult = await db
    .collection("referral_links")
    .where({ share_code: code })
    .limit(1)
    .get();

  const linkRow = linkResult.data?.[0];
  if (linkRow?._id) {
    const currentCount = safeNumber(linkRow.click_count);
    await db.collection("referral_links").doc(linkRow._id).update({
      click_count: currentCount + 1,
    });
  }
}

export async function bindReferralFromRequestCloudBase(input: {
  shareCode: string;
  invitedUserId: string;
}): Promise<{ bound: boolean; relationId?: string }> {
  const invitedUserId = String(input.invitedUserId || "").trim();
  const shareCode = normalizeShareCode(input.shareCode);

  if (!invitedUserId || !shareCode) {
    return { bound: false };
  }

  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();

  // 查找邀请链接
  const linkResult = await db
    .collection("referral_links")
    .where({ share_code: shareCode })
    .limit(1)
    .get();

  const linkRow = linkResult.data?.[0];
  const creatorUserId = String(linkRow?.creator_user_id || "").trim();
  const isActive = linkRow?.is_active !== false;

  if (!creatorUserId || !isActive || creatorUserId === invitedUserId) {
    return { bound: false };
  }

  // 检查是否已有邀请关系
  const existingRelationResult = await db
    .collection("referral_relations")
    .where({ invited_user_id: invitedUserId })
    .limit(1)
    .get();

  if (existingRelationResult.data?.[0]?._id) {
    return { bound: false, relationId: String(existingRelationResult.data[0]._id) };
  }

  // 创建邀请关系
  const createdAt = new Date().toISOString();
  const relationData = {
    inviter_user_id: creatorUserId,
    invited_user_id: invitedUserId,
    share_code: shareCode,
    tool_slug: linkRow?.tool_slug || "main",
    status: "bound",
    created_at: createdAt,
    activated_at: createdAt,
  };

  const relationResult = await db.collection("referral_relations").add(relationData);
  const relationId = String(relationResult.id);

  // 记录奖励
  const inviterReferenceId = `ref_signup_inviter_${relationId}`;
  const invitedReferenceId = `ref_signup_invited_${relationId}`;

  await Promise.all([
    db.collection("referral_rewards").add({
      relation_id: relationId,
      user_id: creatorUserId,
      reward_type: "signup_inviter",
      amount: INVITER_SIGNUP_BONUS_DAYS,
      status: "granted",
      reference_id: inviterReferenceId,
      created_at: createdAt,
      granted_at: createdAt,
    }),
    db.collection("referral_rewards").add({
      relation_id: relationId,
      user_id: invitedUserId,
      reward_type: "signup_invited",
      amount: INVITED_SIGNUP_BONUS_DAYS,
      status: "granted",
      reference_id: invitedReferenceId,
      created_at: createdAt,
      granted_at: createdAt,
    }),
  ]);

  // 延长邀请人的会员时长
  try {
    const inviterUserResult = await db.collection("users").doc(creatorUserId).get();
    const inviterUser = inviterUserResult.data?.[0];
    if (inviterUser) {
      const now = new Date();
      const currentPlan = (inviterUser.plan || "free").toLowerCase();
      const currentExp = inviterUser.plan_exp ? new Date(inviterUser.plan_exp) : null;

      let newExp: Date;
      if (currentExp && currentExp > now) {
        newExp = new Date(currentExp.getTime() + INVITER_SIGNUP_BONUS_DAYS * 24 * 60 * 60 * 1000);
      } else {
        newExp = new Date(now.getTime() + INVITER_SIGNUP_BONUS_DAYS * 24 * 60 * 60 * 1000);
      }

      const newPlan = currentPlan === "free" ? "Pro" : inviterUser.plan;

      await db.collection("users").doc(creatorUserId).update({
        plan: newPlan,
        plan_exp: newExp.toISOString(),
        updatedAt: createdAt,
      });
    }
  } catch (error) {
    console.error("[referrals-cloudbase] Error updating inviter wallet:", error);
  }

  // 延长被邀请人的会员时长
  try {
    const invitedUserResult = await db.collection("users").doc(invitedUserId).get();
    const invitedUser = invitedUserResult.data?.[0];
    if (invitedUser) {
      const now = new Date();
      const currentPlan = (invitedUser.plan || "free").toLowerCase();
      const currentExp = invitedUser.plan_exp ? new Date(invitedUser.plan_exp) : null;

      let newExp: Date;
      if (currentExp && currentExp > now) {
        newExp = new Date(currentExp.getTime() + INVITED_SIGNUP_BONUS_DAYS * 24 * 60 * 60 * 1000);
      } else {
        newExp = new Date(now.getTime() + INVITED_SIGNUP_BONUS_DAYS * 24 * 60 * 60 * 1000);
      }

      const newPlan = currentPlan === "free" ? "Pro" : invitedUser.plan;

      await db.collection("users").doc(invitedUserId).update({
        plan: newPlan,
        plan_exp: newExp.toISOString(),
        updatedAt: createdAt,
      });
    }
  } catch (error) {
    console.error("[referrals-cloudbase] Error updating invited wallet:", error);
  }

  return { bound: true, relationId };
}
