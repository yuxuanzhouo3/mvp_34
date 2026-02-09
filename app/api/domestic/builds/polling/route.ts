/**
 * 构建状态轮询接口（优化版 + 自动同步）
 * 只返回 pending/processing 状态的构建，减少数据传输
 * 自动检测并同步卡住的 APK 构建
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { withDbRetry } from "@/lib/cloudbase/retry-wrapper";
import { getGitHubBuildStatus, downloadGitHubArtifact } from "@/lib/services/github-builder";
import { getCloudBaseStorage } from "@/lib/cloudbase/storage";
import AdmZip from "adm-zip";

// 全局同步锁：防止同一个build被并发同步
const syncingBuilds = new Set<string>();

// 已完成构建缓存：防止数据库延迟导致重复同步
const completedBuilds = new Map<string, number>(); // buildId -> timestamp
const COMPLETED_CACHE_TTL = 5 * 60 * 1000; // 5分钟后清理缓存

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authService = new CloudBaseAuthService();
    const user = await authService.validateToken(token);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    // 只查询 pending 和 processing 状态的构建
    const { data: processingBuilds } = await withDbRetry(
      () => db
        .collection("builds")
        .where({
          user_id: user.id,
          status: db.command.in(["pending", "processing"]),
        })
        .orderBy("created_at", "desc")
        .limit(20)
        .get(),
      'Get processing builds'
    );

    // 自动同步卡住的 APK 构建（异步处理，不阻塞响应）
    if (processingBuilds && processingBuilds.length > 0) {
      autoSyncStuckApkBuilds(processingBuilds).catch((error) => {
        console.error("[Polling] Auto-sync error:", error);
      });
    }

    // 返回简化的数据（只包含必要字段）
    const builds = (processingBuilds || []).map((build: any) => ({
      id: build._id,
      status: build.status,
      progress: build.progress,
      platform: build.platform,
      github_run_id: build.github_run_id,
    }));

    return NextResponse.json({ builds });
  } catch (error) {
    console.error("[Polling] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * 自动同步卡住的 APK 构建
 * 检测停留在 50% 超过 5 分钟的 APK 构建，自动同步 GitHub 状态
 */
async function autoSyncStuckApkBuilds(builds: any[]) {
  const now = Date.now();
  const STUCK_THRESHOLD = 2 * 60 * 1000; // 2分钟

  // 清理过期的已完成构建缓存
  for (const [buildId, timestamp] of completedBuilds.entries()) {
    if (now - timestamp > COMPLETED_CACHE_TTL) {
      completedBuilds.delete(buildId);
    }
  }

  for (const build of builds) {
    // 只处理 android-apk 平台，且进度为 50%
    if (build.platform !== "android-apk" || build.progress !== 50) {
      continue;
    }

    // 检查是否有 github_run_id
    if (!build.github_run_id) {
      continue;
    }

    // 检查是否在已完成缓存中（防止数据库延迟导致重复同步）
    if (completedBuilds.has(build._id)) {
      continue;
    }

    // 检查是否正在同步中，避免并发同步
    if (syncingBuilds.has(build._id)) {
      continue;
    }

    // 检查更新时间
    const updatedAt = new Date(build.updated_at).getTime();
    const stuckDuration = now - updatedAt;

    if (stuckDuration < STUCK_THRESHOLD) {
      continue;
    }

    // 检查是否已经上传过APK，避免重复下载（静默跳过）
    if (build.output_file_path && build.output_file_path.endsWith('.apk')) {
      continue;
    }

    // 标记为正在同步
    syncingBuilds.add(build._id);
    console.log(`[AutoSync] 🚀 Syncing build ${build._id} (stuck ${Math.round(stuckDuration / 1000)}s)`);

    // 标志变量：控制是否清理同步锁
    let shouldCleanupLock = false;

    try {
      // 查询 GitHub Actions 状态
      const status = await getGitHubBuildStatus(build.github_run_id);

      if (status.error) {
        console.error(`[AutoSync] ❌ GitHub status error: ${status.error}`);
        continue;
      }

      // 如果构建完成且成功，下载并上传 artifact
      if (status.status === "completed" && status.conclusion === "success") {
        console.log(`[AutoSync] ✅ Build completed, downloading artifact...`);

        const artifactName = `app-release-${build._id}`;
        const artifactBuffer = await downloadGitHubArtifact(build.github_run_id, artifactName);

        if (!artifactBuffer) {
          console.error(`[AutoSync] ❌ Download failed`);
          continue;
        }

        console.log(`[AutoSync] 📤 Uploading to CloudBase (${(artifactBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

        // 解压zip并提取APK
        console.log(`[AutoSync] 📦 Extracting APK from zip...`);
        const zip = new AdmZip(artifactBuffer);
        const zipEntries = zip.getEntries();

        // 查找APK文件: android/app/build/outputs/apk/normal/release/*.apk
        const apkEntry = zipEntries.find(entry =>
          entry.entryName.includes('android/app/build/outputs/apk/normal/release/') &&
          entry.entryName.endsWith('.apk')
        );

        if (!apkEntry) {
          console.error(`[AutoSync] ❌ APK file not found in zip`);
          continue;
        }

        console.log(`[AutoSync] ✅ Found APK: ${apkEntry.entryName}`);
        const apkBuffer = apkEntry.getData();
        console.log(`[AutoSync] 📤 Uploading APK to CloudBase (${(apkBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

        // 上传APK到云存储
        const storage = getCloudBaseStorage();
        const fileName = `builds/${build._id}/app-release.apk`;

        await withDbRetry(
          async () => {
            const result = await storage.uploadFile(fileName, apkBuffer);
            if (!result) throw new Error("Upload returned null");
            return result;
          },
          'Upload artifact to CloudBase'
        );

        // 获取下载链接
        const downloadUrl = await storage.getTempDownloadUrl(fileName);

        // 更新构建记录
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();

        await withDbRetry(
          () => db.collection("builds").doc(build._id).update({
            status: "completed",
            progress: 100,
            output_file_path: fileName,
            download_url: downloadUrl,
            updated_at: new Date().toISOString(),
          }),
          'Update build status'
        );

        // 清理中间产物
        const sourceId = `${build._id}-source`;
        await db.collection("builds").doc(sourceId).remove().catch(() => {});

        console.log(`[AutoSync] 🎉 Build ${build._id} synced successfully`);
        completedBuilds.set(build._id, Date.now()); // 添加到已完成缓存
        shouldCleanupLock = true;
      } else if (status.status === "completed" && status.conclusion === "failure") {
        // 构建失败
        console.log(`[AutoSync] ❌ Build failed`);
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();

        await withDbRetry(
          () => db.collection("builds").doc(build._id).update({
            status: "failed",
            progress: 100,
            error_message: "GitHub Actions build failed",
            updated_at: new Date().toISOString(),
          }),
          'Update build status to failed'
        );
        completedBuilds.set(build._id, Date.now()); // 添加到已完成缓存
        shouldCleanupLock = true;
      }
    } catch (error) {
      console.error(`[AutoSync] ❌ Error:`, error instanceof Error ? error.message : String(error));
      // 不清理锁，让构建保持锁定状态，避免重复同步
      // 只有在真正完成（成功/失败）时才清理锁
    } finally {
      // 只在真正完成同步时清理锁（避免continue时清理）
      if (shouldCleanupLock) {
        syncingBuilds.delete(build._id);
      }
    }
  }
}
