/**
 * GitHub Actions 构建回调处理器
 * 接收来自 GitHub Actions workflow 的构建完成通知
 */

import { NextRequest, NextResponse } from "next/server";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { withDbRetry } from "@/lib/cloudbase/retry-wrapper";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ buildId: string }> }
) {
  try {
    const { buildId } = await params;
    const body = await request.json();

    console.log(`[GitHub Callback] Received callback for build ${buildId}:`, body);

    const { status, run_id, artifact_url } = body;

    // 连接数据库
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    // 根据 GitHub Actions 的 job.status 更新构建状态
    // job.status 可能的值: "success", "failure", "cancelled"
    let buildStatus: "completed" | "failed";
    let progress: number;

    if (status === "success") {
      buildStatus = "completed";
      progress = 100;
    } else {
      buildStatus = "failed";
      progress = 100; // 失败也算完成了流程
    }

    // 更新构建记录
    const updateData: any = {
      status: buildStatus,
      progress,
      github_run_id: run_id,
      github_artifact_url: artifact_url,
      updated_at: new Date().toISOString(),
    };

    // 如果构建失败，记录错误信息
    if (buildStatus === "failed") {
      updateData.error_message = "GitHub Actions build failed. Check the workflow logs for details.";
    }

    // 更新构建记录（使用重试机制）
    await withDbRetry(
      () => db.collection("builds").doc(buildId).update(updateData),
      'Update build status'
    );

    console.log(`[GitHub Callback] Updated build ${buildId} to status: ${buildStatus}`);

    // 如果构建成功，触发 artifact 下载（异步处理）
    if (status === "success" && run_id) {
      // 异步下载 artifact（不阻塞回调响应）
      downloadAndUpdateArtifact(buildId, run_id).catch((error) => {
        console.error(`[GitHub Callback] Failed to download artifact for build ${buildId}:`, error);
      });
    }

    // 删除Android Source中间产物（异步处理）
    cleanupIntermediateArtifacts(buildId).catch((error) => {
      console.error(`[GitHub Callback] Failed to cleanup intermediate artifacts:`, error);
    });

    return NextResponse.json({
      success: true,
      message: "Callback processed successfully",
    });
  } catch (error) {
    console.error("[GitHub Callback] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * 清理Android Source中间产物
 */
async function cleanupIntermediateArtifacts(buildId: string) {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    // 查找对应的Android Source构建记录（buildId-source）
    const sourceId = `${buildId}-source`;
    const { data: sourceBuilds } = await db
      .collection("builds")
      .where({ _id: sourceId })
      .limit(1)
      .get();

    if (!sourceBuilds || sourceBuilds.length === 0) {
      console.log(`[GitHub Callback] No intermediate artifact found for build ${buildId}`);
      return;
    }

    const sourceBuild = sourceBuilds[0];
    const { getCloudBaseStorage } = await import("@/lib/cloudbase/storage");
    const storage = getCloudBaseStorage();

    // 删除云存储文件
    const filesToDelete: string[] = [];
    if (sourceBuild.output_file_path) filesToDelete.push(sourceBuild.output_file_path);
    if (sourceBuild.icon_path) filesToDelete.push(sourceBuild.icon_path);

    if (filesToDelete.length > 0) {
      await Promise.all(
        filesToDelete.map(path => storage.deleteFile(path).catch(console.error))
      );
      console.log(`[GitHub Callback] Deleted ${filesToDelete.length} intermediate files`);
    }

    // 删除数据库记录
    await db.collection("builds").doc(sourceId).remove();
    console.log(`[GitHub Callback] Deleted intermediate build record: ${sourceId}`);
  } catch (error) {
    console.error(`[GitHub Callback] Error cleaning up intermediate artifacts:`, error);
  }
}

async function downloadAndUpdateArtifact(buildId: string, runId: string) {
  try {
    const { downloadGitHubArtifact } = await import("@/lib/services/github-builder");
    const { getCloudBaseStorage } = await import("@/lib/cloudbase/storage");

    console.log(`[GitHub Callback] Starting artifact download for build ${buildId}, run ${runId}`);

    // 获取构建记录以确定平台类型
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const buildDoc = (await withDbRetry(
      () => db.collection("builds").doc(buildId).get(),
      'Get build record'
    )) as any;
    const build = buildDoc?.data?.[0];

    if (!build) {
      throw new Error("Build record not found");
    }

    const platform = build.platform as "android-apk" | "harmonyos-hap";

    // 下载 artifact（这是一个 zip 文件，包含 APK）
    const artifactName = `app-release-${buildId}`;
    const artifactBuffer = await downloadGitHubArtifact(runId, artifactName);

    if (!artifactBuffer) {
      throw new Error("Failed to download artifact from GitHub");
    }

    console.log(`[GitHub Callback] Downloaded artifact, size: ${artifactBuffer.length} bytes`);

    // 上传到云存储（使用重试机制）
    const storage = getCloudBaseStorage();
    const fileName = `builds/${buildId}/app-release.zip`;

    const uploadResult = await withDbRetry(
      async () => {
        const result = await storage.uploadFile(fileName, artifactBuffer);
        if (!result) {
          throw new Error("Upload returned null");
        }
        return result;
      },
      'Upload artifact to CloudBase'
    );

    console.log(`[GitHub Callback] Uploaded artifact to CloudBase: ${uploadResult}`);

    // 获取下载链接
    const downloadUrl = await storage.getTempDownloadUrl(fileName);

    // 更新数据库记录（使用重试机制）
    await withDbRetry(
      () => db.collection("builds").doc(buildId).update({
        output_file_path: fileName,
        download_url: downloadUrl,
        updated_at: new Date().toISOString(),
      }),
      'Update build with download URL'
    );

    console.log(`[GitHub Callback] Successfully processed artifact for build ${buildId}`);
  } catch (error) {
    console.error(`[GitHub Callback] Error in downloadAndUpdateArtifact:`, error);

    // 更新构建记录为失败状态（使用重试机制）
    try {
      await withDbRetry(
        () => db.collection("builds").doc(buildId).update({
          status: "failed",
          error_message: `Failed to download artifact: ${error instanceof Error ? error.message : "Unknown error"}`,
          updated_at: new Date().toISOString(),
        }),
        'Update build status to failed'
      );
    } catch (updateError) {
      console.error(`[GitHub Callback] Failed to update build status:`, updateError);
    }
  }
}
