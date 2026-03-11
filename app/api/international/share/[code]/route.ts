export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * GET /api/international/share/[code]
 * 通过分享码访问分享内容
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const secret = request.nextUrl.searchParams.get("secret");

    if (!code) {
      return NextResponse.json(
        { error: "Missing share code" },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 503 }
      );
    }

    // 获取分享记录
    const { data: share, error: shareError } = await supabaseAdmin
      .from("build_shares")
      .select("*")
      .eq("share_code", code)
      .single();

    if (shareError || !share) {
      return NextResponse.json(
        { error: "Share not found" },
        { status: 404 }
      );
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
    const { data: build, error: buildError } = await supabaseAdmin
      .from("builds")
      .select("id, app_name, platform, version_name, status, output_file_path, icon_path, expires_at, file_size")
      .eq("id", share.build_id)
      .single();

    if (buildError || !build) {
      return NextResponse.json(
        { error: "Build not found" },
        { status: 404 }
      );
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
    await supabaseAdmin
      .from("build_shares")
      .update({ access_count: (share.access_count || 0) + 1 })
      .eq("id", share.id);

    // 生成签名下载URL（1小时有效）
    const { data: signedUrl } = await supabaseAdmin.storage
      .from("user-builds")
      .createSignedUrl(build.output_file_path, 3600);

    // 生成图标签名URL
    let iconUrl: string | null = null;
    if (build.icon_path) {
      const { data: iconSignedUrl } = await supabaseAdmin.storage
        .from("user-builds")
        .createSignedUrl(build.icon_path, 3600);
      iconUrl = iconSignedUrl?.signedUrl || null;
    }

    return NextResponse.json({
      success: true,
      share: {
        shareType: share.share_type,
        expiresAt: share.expires_at,
        accessCount: share.access_count + 1,
      },
      build: {
        appName: build.app_name,
        platform: build.platform,
        versionName: build.version_name,
        fileSize: build.file_size,
        iconUrl,
        downloadUrl: signedUrl?.signedUrl || null,
      },
    });
  } catch (error) {
    console.error("[share/code] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
