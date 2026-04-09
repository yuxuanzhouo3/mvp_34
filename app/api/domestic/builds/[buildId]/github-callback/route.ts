/**
 * GitHub Actions 构建回调处理器
 * 接收来自 GitHub Actions workflow 的构建完成通知
 * 同步下载 artifact 并上传到存储，确保在函数超时前完成
 */

import { NextRequest, NextResponse } from "next/server";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { withDbRetry } from "@/lib/cloudbase/retry-wrapper";
import { createServiceClient } from "@/lib/supabase/server";
import { downloadGitHubArtifact, setRunIdRepo } from "@/lib/services/github-builder";
import { getCloudBaseStorage } from "@/lib/cloudbase/storage";
import AdmZip from "adm-zip";

export const maxDuration = 120;

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

    // 如果构建失败，直接更新状态并返回
    if (status !== "success") {
      const failData = {
        status: "failed",
        progress: 100,
        github_run_id: run_id,
        error_message: "GitHub Actions build failed. Check the workflow logs for details.",
        updated_at: new Date().toISOString(),
      };

      // 并行更新 CloudBase 和 Supabase
      await Promise.allSettled([
        withDbRetry(
          () => db.collection("builds").doc(buildId).update(failData),
          'Update build status in CloudBase'
        ).catch(e => console.error(`[GitHub Callback] CloudBase update failed:`, e)),
        (async () => {
          const supabase = createServiceClient();
          await supabase.from("builds").update(failData).eq("id", buildId);
        })().catch(e => console.error(`[GitHub Callback] Supabase update failed:`, e)),
      ]);

      return NextResponse.json({ success: true, message: "Build failed, status updated" });
    }

    // === 构建成功：同步下载 artifact 并上传 ===
    console.log(`[GitHub Callback] Build succeeded, starting synchronous artifact download...`);

    // 先更新进度到 98%，让用户知道正在处理
    const progressData: any = {
      status: "processing",
      progress: 98,
      github_run_id: run_id,
      github_artifact_url: artifact_url,
      updated_at: new Date().toISOString(),
    };

    await Promise.allSettled([
      withDbRetry(
        () => db.collection("builds").doc(buildId).update(progressData),
        'Update build progress in CloudBase'
      ).catch(e => console.error(`[GitHub Callback] CloudBase progress update failed:`, e)),
      (async () => {
        const supabase = createServiceClient();
        await supabase.from("builds").update(progressData).eq("id", buildId);
      })().catch(e => console.error(`[GitHub Callback] Supabase progress update failed:`, e)),
    ]);

    // 获取构建记录以确定平台
    const buildRecord = await db.collection("builds").doc(buildId).get();
    const buildData = buildRecord?.data?.[0];
    const platform = buildData?.platform || "android-apk";

    console.log(`[GitHub Callback] Platform: ${platform}`);

    // 根据平台配置 artifact
    const platformConfig: Record<string, { prefix: string; ext: string; findEntry: (e: { entryName: string }) => boolean }> = {
      "android-apk": {
        prefix: "app-debug",
        ext: ".apk",
        findEntry: (e) =>
          (e.entryName.includes('android/app/build/outputs/apk/normal/debug/') ||
           e.entryName.includes('android/app/build/outputs/apk/normal/release/')) &&
          e.entryName.endsWith('.apk'),
      },
      "ios-ipa": {
        prefix: "ipa-release",
        ext: ".ipa",
        findEntry: (e) => e.entryName.endsWith('.ipa'),
      },
      "harmonyos-hap": {
        prefix: "hap-release",
        ext: ".hap",
        findEntry: (e) => e.entryName.endsWith('.hap'),
      },
    };

    const config = platformConfig[platform] || platformConfig["android-apk"];
    const artifactName = `${config.prefix}-${buildId}`;

    // 设置 runId 对应的 repo
    if (platform === "ios-ipa" || platform === "harmonyos-hap" || platform === "android-apk") {
      setRunIdRepo(run_id, platform as "android-apk" | "ios-ipa" | "harmonyos-hap");
    }

    // 同步下载 artifact（这是阻塞的，在返回响应前完成）
    const artifactBuffer = await downloadGitHubArtifact(run_id, artifactName, platform as any);

    if (!artifactBuffer) {
      console.error(`[GitHub Callback] ❌ Failed to download artifact`);
      // 下载失败，保持 processing/98 状态，让 auto-sync 重试
      return NextResponse.json({ success: true, message: "Callback received, artifact download failed, auto-sync will retry" });
    }

    console.log(`[GitHub Callback] ✅ Downloaded artifact: ${(artifactBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // 解压 zip 并提取构建产物
    const zip = new AdmZip(artifactBuffer);
    const zipEntries = zip.getEntries();
    const fileEntry = zipEntries.find(entry => config.findEntry(entry));

    if (!fileEntry) {
      console.error(`[GitHub Callback] ❌ ${config.ext} file not found in artifact zip`);
      return NextResponse.json({ success: true, message: "Artifact downloaded but build file not found in zip" });
    }

    const fileBuffer = fileEntry.getData();
    const fileName = `builds/${buildId}/${config.prefix}${config.ext}`;

    console.log(`[GitHub Callback] ✅ Extracted ${fileEntry.entryName} (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

    // 上传到 CloudBase 存储
    const storage = getCloudBaseStorage();
    await withDbRetry(
      async () => {
        const result = await storage.uploadFile(fileName, fileBuffer);
        if (!result) throw new Error("Upload returned null");
        return result;
      },
      'Upload artifact to CloudBase'
    );

    // 获取下载链接
    const downloadUrl = await storage.getTempDownloadUrl(fileName);

    console.log(`[GitHub Callback] ✅ Uploaded to CloudBase: ${fileName}`);

    // 更新 CloudBase 为完成状态
    const completedData = {
      status: "completed",
      progress: 100,
      output_file_path: fileName,
      download_url: downloadUrl,
      updated_at: new Date().toISOString(),
    };

    await withDbRetry(
      () => db.collection("builds").doc(buildId).update(completedData),
      'Update build to completed in CloudBase'
    ).catch(e => console.error(`[GitHub Callback] CloudBase completed update failed:`, e));

    // 同步到 Supabase（上传文件 + 更新记录）
    try {
      const supabase = createServiceClient();
      if (platform === "ios-ipa" || platform === "harmonyos-hap") {
        await supabase.storage.from("user-builds").upload(fileName, fileBuffer, {
          contentType: "application/octet-stream",
          upsert: true,
        });
      }
      await supabase.from("builds").update({
        status: "completed",
        progress: 100,
        output_file_path: fileName,
        file_size: fileBuffer.length,
        updated_at: new Date().toISOString(),
      }).eq("id", buildId);
      console.log(`[GitHub Callback] ✅ Synced to Supabase`);
    } catch (sbError) {
      console.error(`[GitHub Callback] Supabase sync failed (non-critical):`, sbError);
    }

    // 清理中间产物
    try {
      const sourceId = `${buildId}-source`;
      await db.collection("builds").doc(sourceId).remove().catch(() => {});
    } catch (e) {
      // ignore
    }

    console.log(`[GitHub Callback] 🎉 Build ${buildId} completed successfully`);

    return NextResponse.json({
      success: true,
      message: "Build completed and artifact uploaded",
    });
  } catch (error) {
    console.error("[GitHub Callback] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
