/**
 * 手动同步 GitHub Actions 构建状态
 * 用于本地开发环境无法接收 callback 的情况
 */

import { NextRequest, NextResponse } from "next/server";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { withDbRetry } from "@/lib/cloudbase/retry-wrapper";
import { getGitHubBuildStatus, downloadGitHubArtifact } from "@/lib/services/github-builder";
import { getCloudBaseStorage } from "@/lib/cloudbase/storage";
import AdmZip from "adm-zip";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ buildId: string }> }
) {
  try {
    const { buildId } = await params;

    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    // 获取构建记录
    const buildDoc = await db.collection("builds").doc(buildId).get();
    const build = buildDoc?.data?.[0];

    if (!build) {
      return NextResponse.json({ error: "Build not found" }, { status: 404 });
    }

    const runId = build.github_run_id;
    if (!runId) {
      // 如果没有 github_run_id，尝试通过查询最近的 workflow runs 来找到对应的构建
      console.log(`[Sync GitHub Status] No github_run_id found, searching for matching workflow run...`);

      try {
        const token = process.env.GITHUB_TOKEN;
        const owner = process.env.GITHUB_OWNER;
        const repo = process.env.GITHUB_REPO;

        if (!token || !owner || !repo) {
          return NextResponse.json({ error: "GitHub configuration missing" }, { status: 500 });
        }

        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/actions/workflows/build-android-apk.yml/runs?per_page=10`,
          {
            headers: {
              "Authorization": `Bearer ${token}`,
              "Accept": "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          // 查找最近完成的成功构建
          const matchingRun = data.workflow_runs?.find((run: any) =>
            run.status === "completed" && run.conclusion === "success"
          );

          if (matchingRun) {
            console.log(`[Sync GitHub Status] Found matching run: ${matchingRun.id}`);
            // 更新数据库中的 github_run_id
            await withDbRetry(
              () => db.collection("builds").doc(buildId).update({
                github_run_id: String(matchingRun.id),
                updated_at: new Date().toISOString(),
              }),
              'Update github_run_id'
            );
            // 使用找到的 run ID 继续处理
            return await syncBuildWithRunId(buildId, String(matchingRun.id), db);
          }
        }
      } catch (error) {
        console.error(`[Sync GitHub Status] Error searching for workflow run:`, error);
      }

      return NextResponse.json({ error: "No GitHub run ID found and unable to locate matching workflow run" }, { status: 400 });
    }

    console.log(`[Sync GitHub Status] Checking status for build ${buildId}, run ${runId}`);

    return await syncBuildWithRunId(buildId, runId, db);
  } catch (error) {
    console.error("[Sync GitHub Status] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * 同步构建状态的核心逻辑
 */
async function syncBuildWithRunId(
  buildId: string,
  runId: string,
  db: any
): Promise<NextResponse> {
  try {
    console.log(`[Sync GitHub Status] Syncing build ${buildId} with run ${runId}`);

    // 获取 GitHub Actions 状态
    const status = await getGitHubBuildStatus(runId);

    if (status.error) {
      return NextResponse.json({ error: status.error }, { status: 500 });
    }

    // 如果构建完成且成功，下载并上传 artifact
    if (status.status === "completed" && status.conclusion === "success") {
      // 先获取构建记录，检查是否已经上传过APK
      const buildDoc = await withDbRetry(
        () => db.collection("builds").doc(buildId).get(),
        'Get build record'
      );
      const build = buildDoc?.data?.[0];

      // 检查是否已经上传过APK，避免重复下载
      if (build?.output_file_path && build.output_file_path.endsWith('.apk')) {
        console.log(`[Sync GitHub Status] ⏭️ APK already uploaded, skipping download`);
        return NextResponse.json({
          success: true,
          status: "completed",
          message: "APK already uploaded",
        });
      }

      console.log(`[Sync GitHub Status] Build completed successfully, downloading artifact...`);

      const artifactName = `app-release-${buildId}`;
      const artifactBuffer = await downloadGitHubArtifact(runId, artifactName);

      if (!artifactBuffer) {
        return NextResponse.json({ error: "Failed to download artifact" }, { status: 500 });
      }

      console.log(`[Sync GitHub Status] Downloaded artifact, size: ${artifactBuffer.length} bytes`);

      // 解压zip并提取APK
      console.log(`[Sync GitHub Status] Extracting APK from zip...`);
      const zip = new AdmZip(artifactBuffer);
      const zipEntries = zip.getEntries();

      // 查找APK文件: android/app/build/outputs/apk/normal/release/*.apk
      const apkEntry = zipEntries.find(entry =>
        entry.entryName.includes('android/app/build/outputs/apk/normal/release/') &&
        entry.entryName.endsWith('.apk')
      );

      if (!apkEntry) {
        return NextResponse.json({ error: "APK file not found in zip" }, { status: 500 });
      }

      console.log(`[Sync GitHub Status] Found APK: ${apkEntry.entryName}`);
      const apkBuffer = apkEntry.getData();
      console.log(`[Sync GitHub Status] Uploading APK to CloudBase (${(apkBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

      // 上传APK到云存储
      const storage = getCloudBaseStorage();
      const fileName = `builds/${buildId}/app-release.apk`;

      await withDbRetry(
        async () => {
          const result = await storage.uploadFile(fileName, apkBuffer);
          if (!result) throw new Error("Upload returned null");
          return result;
        },
        'Upload artifact to CloudBase'
      );

      console.log(`[Sync GitHub Status] Uploaded to CloudBase: ${fileName}`);

      // 获取下载链接
      const downloadUrl = await storage.getTempDownloadUrl(fileName);

      // 更新构建记录
      await withDbRetry(
        () => db.collection("builds").doc(buildId).update({
          status: "completed",
          progress: 100,
          output_file_path: fileName,
          download_url: downloadUrl,
          updated_at: new Date().toISOString(),
        }),
        'Update build status'
      );

      // 清理中间产物
      const sourceId = `${buildId}-source`;
      await db.collection("builds").doc(sourceId).remove().catch(() => {});

      console.log(`[Sync GitHub Status] Build ${buildId} synced successfully`);

      return NextResponse.json({
        success: true,
        status: "completed",
        downloadUrl,
      });
    } else if (status.status === "completed" && status.conclusion === "failure") {
      // 构建失败
      await withDbRetry(
        () => db.collection("builds").doc(buildId).update({
          status: "failed",
          progress: 100,
          error_message: "GitHub Actions build failed",
          updated_at: new Date().toISOString(),
        }),
        'Update build status to failed'
      );

      return NextResponse.json({
        success: true,
        status: "failed",
      });
    } else {
      // 仍在进行中
      return NextResponse.json({
        success: true,
        status: status.status,
        message: "Build still in progress",
      });
    }
  } catch (error) {
    console.error("[Sync GitHub Status] Error in syncBuildWithRunId:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
