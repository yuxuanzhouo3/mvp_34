/**
 * CloudBase 认证服务（国内版）
 * 使用 CloudBase 文档库的 users 与 sessions 两张集合
 */

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { CloudBaseConnector } from "./connector";
import { seedWalletForPlan } from "@/services/wallet";

export interface CloudBaseUser {
  _id?: string;
  email: string | null;
  password: string | null;
  name: string | null;
  avatar: string | null;
  wechatOpenId?: string;
  wechatUnionId?: string | null;
  createdAt: string;
  lastLoginAt: string;
  pro: boolean;
  region: "CN";
  subscriptionTier?: string;
  plan?: string | null;
  plan_exp?: string | null;
  planExp?: string | null;
  paymentMethod: string | null;
  pendingDowngrade?: {
    targetPlan: string;
    effectiveAt?: string;
    expiresAt?: string;
  }[] | {
    targetPlan: string;
    effectiveAt?: string;
    expiresAt?: string;
  } | null;
  hide_ads?: boolean;
  source?: string;
}

export interface CloudBaseSession {
  access_token: string;
  expires_at: number;
  user: CloudBaseAuthUser;
}

export interface CloudBaseAuthUser {
  id: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
  createdAt: Date;
  metadata: {
    pro: boolean;
    region: "CN";
    plan?: string | null;
    plan_exp?: string | null;
    hide_ads?: boolean;
  };
}

export class CloudBaseAuthService {
  private db: any = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initialize();
  }

  private async initialize() {
    const connector = new CloudBaseConnector({});
    await connector.initialize();
    this.db = connector.getClient();
  }

  private async ensureReady() {
    if (this.initPromise) await this.initPromise;
    if (!this.db) throw new Error("CloudBase database not ready");
  }

  async signInWithEmail(email: string, password: string): Promise<{
    user: CloudBaseAuthUser | null;
    session?: CloudBaseSession;
    error?: Error;
  }> {
    try {
      await this.ensureReady();
      const result = await this.db.collection("users").where({ email }).get();
      let user = result?.data?.[0] as CloudBaseUser | undefined;
      if (!user || !user.password) {
        return { user: null, error: new Error("User not found") };
      }

      const ok = await bcrypt.compare(password, user.password);
      if (!ok) {
        return { user: null, error: new Error("Invalid password") };
      }

      if (user._id) {
        user = await this.applyPendingDowngradeIfNeeded(user._id, user);
      }

      const authUser = this.mapUser(user._id!, user);
      const session = await this.createSession(user._id!);

      await this.db
        .collection("users")
        .doc(user._id)
        .update({ lastLoginAt: new Date().toISOString() });

      return { user: authUser, session };
    } catch (error) {
      console.error("[cloudbase] signIn error", error);
      return { user: null, error: error as Error };
    }
  }

  async signUpWithEmail(email: string, password: string, name?: string): Promise<{
    user: CloudBaseAuthUser | null;
    session?: CloudBaseSession;
    error?: Error;
  }> {
    try {
      await this.ensureReady();
      const existing = await this.db.collection("users").where({ email }).get();
      if (existing.data.length > 0) {
        return { user: null, error: new Error("User already exists") };
      }

      const hashed = await bcrypt.hash(password, 10);
      const now = new Date().toISOString();

      const userData: CloudBaseUser = {
        email,
        password: hashed,
        name: name || null,
        avatar: null,
        createdAt: now,
        lastLoginAt: now,
        pro: false,
        region: "CN",
        subscriptionTier: "free",
        plan: "free",
        plan_exp: null,
        paymentMethod: null,
        source: "cn",
      };

      const result = await this.db.collection("users").add(userData);

      // 直接在同一个数据库连接中初始化钱包
      const defaultWallet = {
        daily_builds_limit: 3, // free plan limit
        daily_builds_used: 0,
        daily_builds_reset_at: now.split("T")[0],
        file_retention_days: 1,
        share_enabled: false,
        share_duration_days: 0,
        batch_build_enabled: false,
      };

      await this.db.collection("users").doc(result.id).update({
        wallet: defaultWallet,
        updatedAt: now,
      });

      console.log(`[cloudbase] Wallet initialized for user ${result.id}`);

      const authUser = this.mapUser(result.id, userData);
      const session = await this.createSession(result.id);

      return { user: authUser, session };
    } catch (error) {
      console.error("[cloudbase] signUp error", error);
      return { user: null, error: error as Error };
    }
  }

  async validateToken(token: string): Promise<CloudBaseAuthUser | null> {
    try {
      await this.ensureReady();

      // 检测是否是 Supabase 格式的 token
      if (token.startsWith("base64-") || token.includes("access_token") || token.includes("refresh_token")) {
        try {
          const decoded = token.startsWith("base64-")
            ? Buffer.from(token.slice(7), "base64").toString("utf-8")
            : token;
          const parsed = JSON.parse(decoded);
          if (parsed.access_token || parsed.refresh_token || parsed.user) {
            console.warn("[cloudbase] validateToken: detected Supabase session format, rejecting");
            return null;
          }
        } catch {
          // 解析失败，继续正常验证
        }
      }

      const sessions = await this.db.collection("sessions").where({ token }).limit(1).get();
      const session = sessions?.data?.[0] as { userId: string; expiresAt: number } | undefined;
      if (!session) {
        console.warn("[cloudbase] validateToken: session not found");
        return null;
      }
      if (session.expiresAt < Date.now()) {
        console.warn("[cloudbase] validateToken: session expired");
        return null;
      }

      const users = await this.db.collection("users").doc(session.userId).get();
      let user = users?.data?.[0] as CloudBaseUser | undefined;
      if (!user || !user._id) {
        console.warn("[cloudbase] validateToken: user not found for session");
        return null;
      }

      const userId = user._id;
      user = await this.applyPendingDowngradeIfNeeded(userId, user);
      return this.mapUser(userId, user);
    } catch (error) {
      console.error("[cloudbase] validate token error", error);
      return null;
    }
  }

  async signInWithWechat(params: {
    openid: string;
    unionid?: string | null;
    nickname?: string | null;
    avatar?: string | null;
  }): Promise<{
    user: CloudBaseAuthUser | null;
    session?: CloudBaseSession;
    error?: Error;
  }> {
    const { openid, unionid, nickname, avatar } = params;

    if (!openid) {
      return { user: null, error: new Error("Missing openid") };
    }

    try {
      await this.ensureReady();
      const usersColl = this.db.collection("users");

      let existing;
      let user: CloudBaseUser | undefined;

      // 1. 如果有 unionid，优先按 unionid 查找
      if (unionid) {
        existing = await usersColl.where({ wechatUnionId: unionid }).limit(1).get();
        user = existing.data[0] as CloudBaseUser | undefined;
      }

      // 2. 如果没找到，按 wechatOpenId 查找
      if (!user) {
        existing = await usersColl.where({ wechatOpenId: openid }).limit(1).get();
        user = existing.data[0] as CloudBaseUser | undefined;
      }

      // 3. 兼容早期用 email 存 openid 的情况
      if (!user) {
        const emailKey = `wechat_${openid}@local.wechat`;
        existing = await usersColl.where({ email: emailKey }).limit(1).get();
        user = existing.data[0] as CloudBaseUser | undefined;
      }

      const now = new Date().toISOString();

      if (!user) {
        // 创建新用户
        const email = `wechat_${openid}@local.wechat`;
        const userData: CloudBaseUser & { wechatOpenId: string; wechatUnionId?: string | null } = {
          email,
          password: null,
          name: nickname || "微信用户",
          avatar: avatar || null,
          createdAt: now,
          lastLoginAt: now,
          pro: false,
          region: "CN",
          subscriptionTier: "free",
          plan: "free",
          plan_exp: null,
          paymentMethod: null,
          wechatOpenId: openid,
          wechatUnionId: unionid || null,
          source: "cn",
        };

        const result = await usersColl.add(userData);
        user = { ...userData, _id: result.id };

        // 直接在同一个数据库连接中初始化钱包
        const defaultWallet = {
          daily_builds_limit: 3,
          daily_builds_used: 0,
          daily_builds_reset_at: now.split("T")[0],
          file_retention_days: 1,
          share_enabled: false,
          share_duration_days: 0,
          batch_build_enabled: false,
        };

        await this.db.collection("users").doc(result.id).update({
          wallet: defaultWallet,
          updatedAt: now,
        });

        console.log(`[cloudbase] Wallet initialized for wechat user ${result.id}`);
      } else if (user._id) {
        // 更新已有用户
        const updateData = {
          name: nickname || user.name,
          avatar: avatar || user.avatar,
          lastLoginAt: now,
          wechatOpenId: openid,
          wechatUnionId: unionid || null,
        };
        await usersColl.doc(user._id).update(updateData);
        user = { ...user, ...updateData };
      }

      if (!user || !user._id) {
        return { user: null, error: new Error("Failed to load/create user") };
      }

      const wechatUserId = user._id;
      user = await this.applyPendingDowngradeIfNeeded(wechatUserId, user);

      const authUser = this.mapUser(wechatUserId, user);
      const session = await this.createSession(wechatUserId);

      return { user: authUser, session };
    } catch (error) {
      console.error("[cloudbase] signInWithWechat error", error);
      return { user: null, error: error as Error };
    }
  }

  private generateToken(): string {
    // 使用加密安全的随机数生成器
    return crypto.randomBytes(32).toString("base64url");
  }

  private async createSession(userId: string): Promise<CloudBaseSession> {
    const token = this.generateToken();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    await this.db.collection("sessions").add({
      userId,
      token,
      createdAt: new Date().toISOString(),
      expiresAt,
    });

    const users = await this.db.collection("users").doc(userId).get();
    const user = users?.data?.[0] as CloudBaseUser | undefined;
    if (!user) {
      throw new Error("User not found when creating session");
    }
    const authUser = this.mapUser(userId, user);

    return {
      access_token: token,
      expires_at: expiresAt,
      user: authUser,
    };
  }

  private async applyPendingDowngradeIfNeeded(
    userId: string,
    userDoc: CloudBaseUser
  ): Promise<CloudBaseUser> {
    const pendingRaw = userDoc?.pendingDowngrade;
    if (!pendingRaw) return userDoc;

    const now = new Date();
    const subsColl = this.db.collection("subscriptions");

    const pendingQueue = Array.isArray(pendingRaw) ? pendingRaw : [pendingRaw];
    if (pendingQueue.length === 0 || !pendingQueue[0]?.targetPlan) return userDoc;

    const firstPending = pendingQueue[0];
    const effectiveAt = firstPending.effectiveAt
      ? new Date(firstPending.effectiveAt)
      : userDoc.plan_exp
        ? new Date(userDoc.plan_exp)
        : null;

    if (!effectiveAt || effectiveAt.getTime() > Date.now()) {
      return userDoc;
    }

    try {
      const pendingRes = await subsColl
        .where({ userId, plan: firstPending.targetPlan, status: "pending" })
        .get();

      const pendingSub =
        pendingRes?.data?.find(
          (s: any) => !s.startedAt || new Date(s.startedAt) <= now
        ) || pendingRes?.data?.[0] || null;

      const nextExpire = pendingSub?.expiresAt
        ? new Date(pendingSub.expiresAt)
        : firstPending.expiresAt
          ? new Date(firstPending.expiresAt)
          : null;

      const remainingQueue = pendingQueue.slice(1);

      const updatePayload: Record<string, any> = {
        plan: firstPending.targetPlan,
        subscriptionTier: firstPending.targetPlan,
        plan_exp: nextExpire ? nextExpire.toISOString() : null,
        pro: (firstPending.targetPlan || "").toLowerCase() !== "basic",
        pendingDowngrade: remainingQueue.length > 0 ? remainingQueue : null,
        updatedAt: now.toISOString(),
      };

      await this.db.collection("users").doc(userId).update(updatePayload);

      if (pendingSub?._id) {
        await subsColl.doc(pendingSub._id).update({
          status: "active",
          startedAt: pendingSub.startedAt || effectiveAt.toISOString(),
          updatedAt: now.toISOString(),
        });
      }

      // 重置钱包额度
      await seedWalletForPlan(userId, (firstPending.targetPlan as string).toLowerCase(), {
        forceReset: true,
      });

      console.log("[cloudbase] Applied pending downgrade:", {
        userId,
        plan: firstPending.targetPlan,
        remainingQueue: remainingQueue.length,
      });

      const refreshed = await this.db.collection("users").doc(userId).get();
      const refreshedDoc = refreshed?.data?.[0] as CloudBaseUser | undefined;
      return refreshedDoc || ({ ...userDoc, ...updatePayload } as CloudBaseUser);
    } catch (error) {
      console.error("[cloudbase] applyPendingDowngrade error", error);
      return userDoc;
    }
  }

  private mapUser(id: string, user: CloudBaseUser): CloudBaseAuthUser {
    const plan =
      (user.plan as string | undefined) ||
      (user.subscriptionTier as string | undefined) ||
      (user.pro ? "pro" : "free");
    const planLower = typeof plan === "string" ? plan.toLowerCase() : "free";
    const isProEffective = !!user.pro && planLower !== "basic";
    const planExp = (user.plan_exp as string | null | undefined) ?? user.planExp ?? null;

    return {
      id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      createdAt: new Date(user.createdAt),
      metadata: {
        pro: isProEffective,
        region: "CN",
        plan,
        plan_exp: planExp,
        hide_ads: user.hide_ads ?? false,
      },
    };
  }
}
