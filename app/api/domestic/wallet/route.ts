/**
 * 国内版钱包 API
 * 获取用户钱包/配额信息
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { normalizeWallet, getTodayString } from "@/services/wallet";

export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const authService = new CloudBaseAuthService();
    const user = await authService.validateToken(token);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 获取用户数据
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const userRes = await db.collection("users").doc(user.id).get();
    const userDoc = userRes?.data?.[0] || null;

    if (!userDoc) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // 获取钱包数据
    const wallet = normalizeWallet(userDoc);
    const today = getTodayString();

    // 检查是否需要重置每日配额
    const isNewDay = wallet.daily_builds_reset_at !== today;
    const dailyUsed = isNewDay ? 0 : wallet.daily_builds_used;

    // 如果是新的一天，更新数据库
    if (isNewDay) {
      await db.collection("users").doc(user.id).update({
        "wallet.daily_builds_used": 0,
        "wallet.daily_builds_reset_at": today,
        updatedAt: new Date().toISOString(),
      });
    }

    // 返回钱包信息
    return NextResponse.json({
      plan: userDoc.plan || userDoc.subscriptionTier || "Free",
      plan_exp: userDoc.plan_exp || null,
      daily_builds_limit: wallet.daily_builds_limit,
      daily_builds_used: dailyUsed,
      file_retention_days: wallet.file_retention_days,
      share_enabled: wallet.share_enabled,
      share_duration_days: wallet.share_duration_days,
      batch_build_enabled: wallet.batch_build_enabled,
    });
  } catch (error) {
    console.error("[Domestic Wallet API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
