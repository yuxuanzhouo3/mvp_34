export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * GET /api/international/share/d/[code]
 * 直接下载 - 重定向到签名下载URL
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (!code || !supabaseAdmin) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // 获取分享记录
    const { data: share } = await supabaseAdmin
      .from("build_shares")
      .select("*")
      .eq("share_code", code)
      .single();

    if (!share) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    // 检查分享是否过期
    if (new Date(share.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Share expired" }, { status: 410 });
    }

    // 获取构建信息
    const { data: build } = await supabaseAdmin
      .from("builds")
      .select("id, output_file_path, expires_at, status, app_name, version_name, platform")
      .eq("id", share.build_id)
      .single();

    if (!build || build.status !== "completed" || !build.output_file_path) {
      return NextResponse.json({ error: "Build not available" }, { status: 404 });
    }

    // 检查构建是否过期
    if (new Date(build.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Build expired" }, { status: 410 });
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

    if (!signedUrl?.signedUrl) {
      return NextResponse.json({ error: "Download unavailable" }, { status: 500 });
    }

    // 重定向到签名下载URL
    return NextResponse.redirect(signedUrl.signedUrl);
  } catch (error) {
    console.error("[share/d] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
