/**
 * GitHub Actions 构建回调处理器
 * 接收来自 GitHub Actions workflow 的构建完成通知
 * 快速返回响应（避免 curl --max-time 超时），让 polling auto-sync 完成 artifact 下载
 */

import { NextRequest, NextResponse } from "next/server";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { withDbRetry } from "@/lib/cloudbase/retry-wrapper";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ buildId: string }> }
) {
  try {
    const { buildId } = await params;
    const body = await request.json();

    console.log(`[GitHub Callback] Received callback for build ${buildId}:`, body);

    const { status, run_id, artifact_url } = body;

    // 根据状态确定更新数据
    const buildStatus = status === "success" ? "processing" : "failed";
    const progress = status === "success" ? 98 : 100;

    const updateData: any = {
      status: buildStatus,
      progress,
      github_run_id: run_id,
      github_artifact_url: artifact_url,
      updated_at: new Date().toISOString(),
    };

    if (buildStatus === "failed") {
      updateData.error_message = "GitHub Actions build failed. Check the workflow logs for details.";
    }

    // 并行更新 CloudBase 和 Supabase，然后立即返回响应
    // 成功时保持 processing/98，让 polling 的同步 auto-sync 完成 artifact 下载
    await Promise.allSettled([
      (async () => {
        try {
          const connector = new CloudBaseConnector();
          await connector.initialize();
          const db = connector.getClient();
          await withDbRetry(
            () => db.collection("builds").doc(buildId).update(updateData),
            'Update build status in CloudBase'
          );
          console.log(`[GitHub Callback] Updated CloudBase: ${buildStatus}/${progress}`);
        } catch (e) {
          console.error(`[GitHub Callback] CloudBase update failed:`, e);
        }
      })(),
      (async () => {
        try {
          const supabase = createServiceClient();
          await supabase.from("builds").update(updateData).eq("id", buildId);
          console.log(`[GitHub Callback] Updated Supabase: ${buildStatus}/${progress}`);
        } catch (e) {
          console.error(`[GitHub Callback] Supabase update failed:`, e);
        }
      })(),
    ]);

    // 立即返回响应（不做 artifact 下载，避免 curl --max-time 30 超时）
    // artifact 下载由 polling route 的同步 autoSyncStuckBuilds 完成
    return NextResponse.json({
      success: true,
      message: `Build ${buildId} updated to ${buildStatus}`,
    });
  } catch (error) {
    console.error("[GitHub Callback] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
