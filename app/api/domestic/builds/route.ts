/**
 * 国内版 Builds API
 * 使用 CloudBase 数据库
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

// Check if a build is expired
function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please login to view builds" },
        { status: 401 }
      );
    }

    const authService = new CloudBaseAuthService();
    const user = await authService.validateToken(token);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // 连接 CloudBase 数据库
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    // Get query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const platform = searchParams.get("platform");
    const rawLimit = searchParams.get("limit");
    const rawOffset = searchParams.get("offset");
    const limit = rawLimit ? parseInt(rawLimit, 10) : 50;
    const offset = rawOffset ? parseInt(rawOffset, 10) : 0;

    // 验证数值有效性
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 50;
    const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;

    // Build query
    let query = db
      .collection("builds")
      .where({ user_id: user.id })
      .orderBy("created_at", "desc")
      .skip(offset)
      .limit(limit);

    // 注意：CloudBase 的 where 条件需要分开处理
    const whereConditions: Record<string, any> = { user_id: user.id };

    if (status && status !== "all") {
      whereConditions.status = status;
    }

    if (platform && platform !== "all") {
      whereConditions.platform = platform;
    }

    // 重新构建查询
    const { data: builds } = await db
      .collection("builds")
      .where(whereConditions)
      .orderBy("created_at", "desc")
      .skip(safeOffset)
      .limit(safeLimit)
      .get();

    // Process builds: mark expired ones, map _id to id, and generate icon URLs
    const { getCloudBaseStorage } = await import("@/lib/cloudbase/storage");
    const storage = getCloudBaseStorage();

    const buildsWithStatus = await Promise.all(
      (builds || []).map(async (build: any) => {
        const { _id, ...rest } = build;
        const mapped = { id: _id, ...rest };

        // Check if build is expired
        if (build.expires_at && isExpired(build.expires_at)) {
          return { ...mapped, icon_url: null };
        }

        // Generate icon URL if icon_path exists
        if (build.icon_path) {
          try {
            const iconUrl = await storage.getTempDownloadUrl(build.icon_path);
            return { ...mapped, icon_url: iconUrl };
          } catch (error) {
            return { ...mapped, icon_url: null };
          }
        }
        return { ...mapped, icon_url: null };
      })
    );

    // Get counts for stats
    const { data: allBuilds } = await db
      .collection("builds")
      .where({ user_id: user.id })
      .get();

    const counts = allBuilds || [];

    const stats = {
      total: counts.length,
      pending: counts.filter((b: any) => b.status === "pending").length,
      processing: counts.filter((b: any) => b.status === "processing").length,
      completed: counts.filter((b: any) => b.status === "completed").length,
      failed: counts.filter((b: any) => b.status === "failed").length,
    };

    // Platform stats
    const platformStats = {
      android: counts.filter((b: any) => b.platform === "android").length,
      ios: counts.filter((b: any) => b.platform === "ios").length,
      wechat: counts.filter((b: any) => b.platform === "wechat").length,
      harmonyos: counts.filter((b: any) => b.platform === "harmonyos").length,
      windows: counts.filter((b: any) => b.platform === "windows").length,
      macos: counts.filter((b: any) => b.platform === "macos").length,
      linux: counts.filter((b: any) => b.platform === "linux").length,
      chrome: counts.filter((b: any) => b.platform === "chrome").length,
    };

    return NextResponse.json({
      builds: buildsWithStatus,
      stats,
      platformStats,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
