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
import { githubRateLimiter } from "@/lib/services/github-rate-limiter";
import { monitoring } from "@/lib/services/monitoring";
import AdmZip from "adm-zip";

// 全局同步锁：防止同一个build被并发同步
const syncingBuilds = new Set<string>();

// 已完成构建缓存：防止数据库延迟导致重复同步
const completedBuilds = new Map<string, number>(); // buildId -> timestamp
const COMPLETED_CACHE_TTL = 5 * 60 * 1000; // 5分钟后清理缓存

/**
 * 尝试获取数据库分布式锁
 * @param db 数据库连接
 * @param buildId 构建ID
 * @returns 是否成功获取锁
 */
async function tryAcquireDistributedLock(db: any, buildId: string): Promise<boolean> {
  try {
    // 先读取当前构建记录，检查锁状态
    const buildDoc = (await db.collection("builds").doc(buildId).get()) as any;
    const build = buildDoc?.data?.[0];

    if (!build) {
      return false;
    }

    // 检查是否已被锁定
    if (build.sync_lock?.locked) {
      const lockedAt = new Date(build.sync_lock.locked_at).getTime();
      const lockTimeout = 10 * 60 * 1000; // 10分钟

      // 如果锁未过期，无法获取锁
      if (Date.now() - lockedAt < lockTimeout) {
        return false;
      }
    }

    // 锁未被占用或已过期，尝试获取锁
    const now = new Date().toISOString();
    await db.collection("builds").doc(buildId).update({
      sync_lock: {
        locked: true,
        locked_at: now,
        instance_id: process.pid.toString(),
      }
    });

    return true;
  } catch (error) {
    console.error(`[Lock] Failed to acquire lock for ${buildId}:`, error);
    return false;
  }
}

/**
 * 检查构建是否已被锁定
 * @param build 构建对象
 * @returns 是否已锁定
 */
function isDistributedLocked(build: any): boolean {
  if (!build.sync_lock?.locked) {
    return false;
  }

  // 检查锁是否过期（超过10分钟）
  const lockedAt = new Date(build.sync_lock.locked_at).getTime();
  const lockTimeout = 10 * 60 * 1000;

  if (Date.now() - lockedAt > lockTimeout) {
    // 锁已过期
    return false;
  }

  return true;
}

/**
 * 释放数据库分布式锁
 * @param db 数据库连接
 * @param buildId 构建ID
 */
async function releaseDistributedLock(db: any, buildId: string): Promise<void> {
  try {
    await db.collection("builds").doc(buildId).update({
      sync_lock: {
        locked: false,
        locked_at: null,
        instance_id: null,
      }
    });
  } catch (error) {
    console.error(`[Lock] Failed to release lock for ${buildId}:`, error);
  }
}

export async function GET(request: NextRequest) {
  try {
    // 记录轮询请求
    monitoring.recordApiCall('polling', true);

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

    // 只查询 pending 和 processing 状态的构建（最近 1 小时内）
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: processingBuilds } = (await withDbRetry(
      () => db
        .collection("builds")
        .where({
          user_id: user.id,
          status: db.command.in(["pending", "processing"]),
          created_at: db.command.gte(oneHourAgo), // 只查询最近 1 小时内的构建
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
  console.log(`[AutoSync] 🚀 === FUNCTION CALLED === Total builds received: ${builds.length}`);

  const now = Date.now();
  const STUCK_THRESHOLD = 2 * 60 * 1000; // 2分钟

  // 清理过期的已完成构建缓存
  for (const [buildId, timestamp] of completedBuilds.entries()) {
    if (now - timestamp > COMPLETED_CACHE_TTL) {
      completedBuilds.delete(buildId);
    }
  }

  // 检查 GitHub API 速率限制
  if (githubRateLimiter.shouldThrottle()) {
    console.warn('[AutoSync] ⚠️ GitHub API usage high, reducing sync frequency');
    return; // 跳过本次同步，降低请求频率
  }

  console.log(`[AutoSync] 📋 Starting to check each build...`);

  for (const build of builds) {
    console.log(`[AutoSync] 🔍 === Checking build ${build._id} ===`);
    console.log(`[AutoSync]    Platform: ${build.platform}`);
    console.log(`[AutoSync]    Status: ${build.status}`);
    console.log(`[AutoSync]    GitHub Run ID: ${build.github_run_id}`);
    console.log(`[AutoSync]    Output File: ${build.output_file_path}`);
    console.log(`[AutoSync]    Updated At: ${build.updated_at}`);

    // 只处理 android-apk 平台
    if (build.platform !== "android-apk") {
      console.log(`[AutoSync] ⏭️ Skip: not supported platform (is ${build.platform})`);
      continue;
    }

    // 检查是否有 github_run_id
    if (!build.github_run_id) {
      console.log(`[AutoSync] ⏭️ Skip: no github_run_id`);
      continue;
    }

    // 检查是否在已完成缓存中（防止数据库延迟导致重复同步）
    if (completedBuilds.has(build._id)) {
      console.log(`[AutoSync] ⏭️ Skip: in completed cache`);
      continue;
    }

    // 检查数据库分布式锁（防止多实例重复同步）
    if (isDistributedLocked(build)) {
      console.log(`[AutoSync] ⏭️ Skip: distributed lock active`);
      continue;
    }

    // 检查是否正在同步中，避免并发同步（内存锁）
    if (syncingBuilds.has(build._id)) {
      console.log(`[AutoSync] ⏭️ Skip: already syncing (memory lock)`);
      continue;
    }

    // 检查更新时间（只对非 android-apk 平台检查卡住时间）
    // android-apk 平台直接检查 GitHub 状态，不需要等待卡住
    if (build.platform !== "android-apk") {
      const updatedAt = new Date(build.updated_at).getTime();
      const stuckDuration = now - updatedAt;

      if (stuckDuration < STUCK_THRESHOLD) {
        console.log(`[AutoSync] ⏭️ Skip: not stuck yet (${Math.round(stuckDuration / 1000)}s < ${STUCK_THRESHOLD / 1000}s)`);
        continue;
      }
    }

    // 检查是否已经上传过APK，避免重复下载
    const isAlreadyUploaded = build.output_file_path &&
      typeof build.output_file_path === 'string' &&
      build.output_file_path.trim() !== '' &&
      build.output_file_path.endsWith('.apk');

    if (isAlreadyUploaded) {
      console.log(`[AutoSync] ⏭️ Skip: File already uploaded (${build.output_file_path})`);
      continue;
    }

    console.log(`[AutoSync] ✅ All checks passed! Starting sync for build ${build._id}`);

    // 标记为正在同步（内存锁）
    syncingBuilds.add(build._id);

    // 获取数据库分布式锁
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const lockAcquired = await tryAcquireDistributedLock(db, build._id);
    if (!lockAcquired) {
      console.log(`[AutoSync] ⏭️ Failed to acquire lock, skipping`);
      syncingBuilds.delete(build._id);
      continue;
    }

    console.log(`[AutoSync] 🚀 Syncing build ${build._id}`);

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

        const artifactName = `app-debug-${build._id}`;
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

        // 查找APK文件: android/app/build/outputs/apk/normal/debug/*.apk 或 release/*.apk
        const fileEntry = zipEntries.find(entry =>
          (entry.entryName.includes('android/app/build/outputs/apk/normal/debug/') ||
           entry.entryName.includes('android/app/build/outputs/apk/normal/release/')) &&
          entry.entryName.endsWith('.apk')
        );

        if (!fileEntry) {
          console.error(`[AutoSync] ❌ APK file not found in zip`);
          continue;
        }

        console.log(`[AutoSync] ✅ Found APK: ${fileEntry.entryName}`);
        const fileBuffer = fileEntry.getData();
        console.log(`[AutoSync] 📤 Uploading APK to CloudBase (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

        // 上传文件到云存储
        const storage = getCloudBaseStorage();
        const fileName = `builds/${build._id}/app-debug.apk`;

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
        await releaseDistributedLock(db, build._id); // 释放数据库锁
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
        await releaseDistributedLock(db, build._id); // 释放数据库锁
        shouldCleanupLock = true;
      }
    } catch (error) {
      console.error(`[AutoSync] ❌ Error:`, error instanceof Error ? error.message : String(error));
      // 发生错误时释放数据库锁，避免永久锁定
      await releaseDistributedLock(db, build._id);
    } finally {
      // 如果同步未完成（continue跳出），释放数据库锁
      if (!shouldCleanupLock) {
        await releaseDistributedLock(db, build._id);
      }

      // 无论同步是否完成，都清理内存锁，避免永久锁定
      syncingBuilds.delete(build._id);
    }
  }
}
