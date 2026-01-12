/**
 * 国内版 Quota Check API
 * 检查用户是否有足够的构建额度
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { checkDailyBuildQuota } from "@/services/wallet";

export const runtime = "nodejs";

/**
 * POST /api/domestic/quota/check
 * 检查用户是否有足够的构建额度（用于批量构建前的预检查）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { count = 1 } = body as { count?: number };

    // 验证 count 参数
    if (!Number.isInteger(count) || count < 1 || count > 10) {
      return NextResponse.json(
        { error: "Invalid count parameter", allowed: false },
        { status: 400 }
      );
    }

    // 验证用户身份
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized", allowed: false },
        { status: 401 }
      );
    }

    const authService = new CloudBaseAuthService();
    const user = await authService.validateToken(token);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", allowed: false },
        { status: 401 }
      );
    }

    // 检查额度
    const quotaCheck = await checkDailyBuildQuota(user.id, count);

    return NextResponse.json({
      allowed: quotaCheck.allowed,
      remaining: quotaCheck.remaining,
      limit: quotaCheck.limit,
      requested: count,
    });
  } catch (error) {
    console.error("[Domestic quota/check] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", allowed: false },
      { status: 500 }
    );
  }
}
