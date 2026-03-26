/**
 * 国内版分享下载 API
 * 使用 CloudBase 数据库和存储
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { getCloudBaseStorage } from "@/lib/cloudbase/storage";

/**
 * GET /api/domestic/share/d/[code]
 * 直接下载 - 重定向到签名下载URL
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

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
      return NextResponse.json({ error: "Share expired" }, { status: 410 });
    }

    // 获取构建信息
    const { data: builds } = await db
      .collection("builds")
      .where({ _id: share.build_id })
      .limit(1)
      .get();

    const build = builds?.[0];

    if (!build || build.status !== "completed" || !build.output_file_path) {
      return NextResponse.json({ error: "Build not available" }, { status: 404 });
    }

    // 检查构建是否过期
    if (new Date(build.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Build expired" }, { status: 410 });
    }

    // 更新访问次数
    await db.collection("build_shares").doc(share._id).update({
      access_count: (share.access_count || 0) + 1,
    });

    // 获取临时下载URL
    const storage = getCloudBaseStorage();
    const downloadUrl = await storage.getTempDownloadUrl(build.output_file_path);

    // 重定向到下载URL
    return NextResponse.redirect(downloadUrl);
  } catch (error) {
    console.error("[domestic/share/d] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
