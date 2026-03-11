/**
 * 国内版分享 API
 * 使用 CloudBase 数据库
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { getPlanShareExpireDays } from "@/utils/plan-limits";
import { nanoid } from "nanoid";

// 生成8位大写秘钥
function generateSecret() {
  return nanoid(8).toUpperCase();
}

/**
 * POST /api/domestic/share
 * 创建分享链接
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { buildId, expireDays, shareType = "link", makePublic = false, expiresInDays = 7 } = body as {
      buildId: string;
      expireDays: number;
      shareType?: "link" | "qrcode";
      makePublic?: boolean;
      expiresInDays?: number;
    };

    if (!buildId || !expireDays) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

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

    // 连接数据库
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    // 获取用户套餐信息
    const { data: users } = await db
      .collection("users")
      .doc(user.id)
      .get();

    const userDoc = users?.[0];
    const plan = userDoc?.plan || userDoc?.subscriptionTier || "free";
    const maxShareDays = getPlanShareExpireDays(plan);

    // Free 用户不支持分享
    if (maxShareDays === 0) {
      return NextResponse.json(
        { error: "Sharing not available for Free plan" },
        { status: 403 }
      );
    }

    // Team 用户才能使用二维码分享
    if (shareType === "qrcode" && plan.toLowerCase() !== "team") {
      return NextResponse.json(
        { error: "QR code sharing is only available for Team plan" },
        { status: 403 }
      );
    }

    // 获取构建信息
    const { data: builds } = await db
      .collection("builds")
      .where({ _id: buildId })
      .limit(1)
      .get();

    const build = builds?.[0];

    if (!build) {
      return NextResponse.json(
        { error: "Build not found" },
        { status: 404 }
      );
    }

    // 验证构建所有权
    if (build.user_id !== user.id) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // 验证构建状态
    if (build.status !== "completed" || !build.output_file_path) {
      return NextResponse.json(
        { error: "Build not completed or file not available" },
        { status: 400 }
      );
    }

    // 计算构建剩余有效期（天）
    const buildExpiresAt = new Date(build.expires_at);
    const now = new Date();
    const buildRemainingMs = buildExpiresAt.getTime() - now.getTime();
    const buildRemainingDays = Math.ceil(buildRemainingMs / (1000 * 60 * 60 * 24));

    if (buildRemainingDays <= 0) {
      return NextResponse.json(
        { error: "Build has expired" },
        { status: 400 }
      );
    }

    // 验证并限制 expiresInDays 范围（1-30天）
    const validExpiresInDays = Math.max(1, Math.min(30, expiresInDays));

    // 计算实际分享有效期
    const actualExpireDays = Math.min(expireDays, maxShareDays, buildRemainingDays, validExpiresInDays);

    if (actualExpireDays <= 0) {
      return NextResponse.json(
        { error: "Invalid expire days" },
        { status: 400 }
      );
    }

    // 生成分享码
    const shareCode = nanoid(12);

    // 生成秘钥（如果不是公开分享）
    const secret = makePublic ? null : generateSecret();

    // 计算分享过期时间
    const shareExpiresAt = new Date(now.getTime() + actualExpireDays * 24 * 60 * 60 * 1000);

    // 创建分享记录
    const shareData = {
      share_code: shareCode,
      build_id: buildId,
      user_id: user.id,
      share_type: shareType,
      is_public: makePublic,
      secret: secret,
      expires_in_days: validExpiresInDays,
      expires_at: shareExpiresAt.toISOString(),
      access_count: 0,
      created_at: now.toISOString(),
    };

    const result = await db.collection("build_shares").add(shareData);

    // 构建分享URL - 指向前端展示页面
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const shareUrl = `${appUrl}/share/${shareCode}`;

    return NextResponse.json({
      success: true,
      share: {
        id: result.id,
        shareCode,
        shareUrl,
        shareType,
        isPublic: makePublic,
        secret: secret || "",
        expiresAt: shareExpiresAt.toISOString(),
        actualExpireDays,
        maxShareDays,
        buildRemainingDays,
      },
    });
  } catch (error) {
    console.error("[domestic/share] POST Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/domestic/share?buildId=xxx
 * 获取构建的分享列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const buildId = searchParams.get("buildId");

    if (!buildId) {
      return NextResponse.json(
        { error: "Missing buildId" },
        { status: 400 }
      );
    }

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

    // 连接数据库
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    // 获取分享列表
    const { data: shares } = await db
      .collection("build_shares")
      .where({ build_id: buildId, user_id: user.id })
      .orderBy("created_at", "desc")
      .get();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    return NextResponse.json({
      shares: (shares || []).map((s: any) => ({
        id: s._id,
        share_code: s.share_code,
        share_type: s.share_type,
        expires_at: s.expires_at,
        access_count: s.access_count || 0,
        is_public: s.is_public || false,
        secret: s.secret || null,
        shareUrl: `${appUrl}/share/${s.share_code}`,
        expired: new Date(s.expires_at).getTime() < Date.now(),
      })),
    });
  } catch (error) {
    console.error("[domestic/share] GET Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/domestic/share?id=xxx
 * 删除分享
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shareId = searchParams.get("id");

    if (!shareId) {
      return NextResponse.json(
        { error: "Missing share id" },
        { status: 400 }
      );
    }

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

    // 连接数据库
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    // 验证分享所有权
    const { data: shares } = await db
      .collection("build_shares")
      .where({ _id: shareId, user_id: user.id })
      .limit(1)
      .get();

    if (!shares || shares.length === 0) {
      return NextResponse.json(
        { error: "Share not found" },
        { status: 404 }
      );
    }

    // 删除分享
    await db.collection("build_shares").doc(shareId).remove();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[domestic/share] DELETE Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
