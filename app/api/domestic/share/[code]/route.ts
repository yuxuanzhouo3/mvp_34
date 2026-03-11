/**
 * 国内版分享信息 API
 * 返回分享详情供前端页面展示
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { getCloudBaseStorage } from "@/lib/cloudbase/storage";

/**
 * GET /api/domestic/share/[code]
 * 获取分享信息 - 返回JSON数据供前端展示
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const secret = request.nextUrl.searchParams.get("secret");

    if (!code) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // 连接数据库
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    // 获取分享记录
    const { data: shares } = await db
      .collection("build_shares")
      .where({ share_code: code })
      .limit(1)
      .get();

    const share = shares?.[0];

    if (!share) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    // 检查分享是否过期
    if (new Date(share.expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        { error: "Share has expired", expired: true },
        { status: 410 }
      );
    }

    // 验证秘钥（如果不是公开分享）
    if (!share.is_public && share.secret !== secret) {
      return NextResponse.json(
        { error: "Invalid secret", needsSecret: true },
        { status: 403 }
      );
    }

    // 获取构建信息
    const { data: builds } = await db
      .collection("builds")
      .where({ _id: share.build_id })
      .limit(1)
      .get();

    const build = builds?.[0];

    if (!build) {
      return NextResponse.json({ error: "Build not found" }, { status: 404 });
    }

    // 检查构建是否过期
    if (new Date(build.expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        { error: "Build has expired", expired: true },
        { status: 410 }
      );
    }

    // 检查构建状态和文件
    if (build.status !== "completed" || !build.output_file_path) {
      return NextResponse.json(
        { error: "Build file not available" },
        { status: 404 }
      );
    }

    // 更新访问次数
    await db.collection("build_shares").doc(share._id).update({
      access_count: (share.access_count || 0) + 1,
    });

    // 获取临时下载URL
    const storage = getCloudBaseStorage();
    const downloadUrl = await storage.getTempDownloadUrl(build.output_file_path);

    // 获取图标临时URL
    let iconUrl: string | null = null;
    if (build.icon_path) {
      iconUrl = await storage.getTempDownloadUrl(build.icon_path);
    }

    // 返回JSON数据
    return NextResponse.json({
      success: true,
      share: {
        shareType: share.share_type,
        expiresAt: share.expires_at,
        accessCount: (share.access_count || 0) + 1,
      },
      build: {
        appName: build.app_name,
        platform: build.platform,
        versionName: build.version_name,
        fileSize: build.file_size || null,
        iconUrl,
        downloadUrl,
      },
    });
  } catch (error) {
    console.error("[domestic/share/code] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
