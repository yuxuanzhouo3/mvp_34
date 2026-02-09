/**
 * 国内版批量构建 API
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { checkDailyBuildQuota, consumeDailyBuildQuota, getUserWallet, refundDailyBuildQuota } from "@/services/wallet";
import { getPlanBuildExpireDays } from "@/utils/plan-limits";
import { isIconUploadEnabled, validateImageSize } from "@/lib/config/upload";

// 导入国内版构建处理器
import {
  processAndroidBuildDomestic,
  processiOSBuildDomestic,
  processChromeExtensionBuildDomestic,
  processWindowsExeBuildDomestic,
  processMacOSAppBuildDomestic,
  processLinuxAppBuildDomestic,
  processWechatBuildDomestic,
  processHarmonyOSBuildDomestic,
} from "@/lib/services/domestic";

export const maxDuration = 120;

interface PlatformConfig {
  platform: string;
  appName: string;
  packageName?: string;
  versionName?: string;
  versionCode?: string;
  privacyPolicy?: string;
  bundleId?: string;
  versionString?: string;
  buildNumber?: string;
  appId?: string;
  version?: string;
  bundleName?: string;
  description?: string;
  iconUrl?: string; // 图标 URL（国际版使用）
  iconPath?: string; // 图标路径（国内版使用，临时上传的图标路径）
  iconBase64?: string; // 图标 base64（向后兼容）
  iconType?: string;
}

interface BatchBuildRequest {
  url: string;
  platforms: PlatformConfig[];
}

export async function POST(request: NextRequest) {
  try {
    // 1. 认证
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please login to create a build" },
        { status: 401 }
      );
    }

    const authService = new CloudBaseAuthService();
    const user = await authService.validateToken(token);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // 2. 解析请求体
    const body: BatchBuildRequest = await request.json();
    const { url, platforms } = body;

    if (!url || !platforms || platforms.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields", message: "url and platforms are required" },
        { status: 400 }
      );
    }

    // 验证 URL 格式
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL", message: "Please provide a valid URL" },
        { status: 400 }
      );
    }

    const platformCount = platforms.length;

    // 3. 检查配额
    const quotaCheck = await checkDailyBuildQuota(user.id, platformCount);
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        {
          error: "Quota exceeded",
          message: `Daily build quota exceeded. Need: ${platformCount}, Remaining: ${quotaCheck.remaining}/${quotaCheck.limit}`,
          remaining: quotaCheck.remaining,
          limit: quotaCheck.limit,
        },
        { status: 429 }
      );
    }

    // 4. 扣除配额
    const deductResult = await consumeDailyBuildQuota(user.id, platformCount);
    if (!deductResult.success) {
      return NextResponse.json(
        { error: "Quota deduction failed", message: deductResult.error || "Failed to deduct build quota" },
        { status: 500 }
      );
    }

    // 5. 计算过期时间
    const wallet = await getUserWallet(user.id);
    const expireDays = wallet?.file_retention_days || getPlanBuildExpireDays("free");
    const expiresAt = new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000).toISOString();

    // 6. 批量创建构建记录
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const buildIds: string[] = [];
    const now = Date.now();
    const totalPlatforms = platforms.length;

    for (let index = 0; index < platforms.length; index++) {
      const config = platforms[index];
      const buildData = {
        user_id: user.id,
        app_name: config.appName,
        package_name: getPackageName(config),
        version_name: config.versionName || config.versionString || config.version || "1.0.0",
        version_code: config.versionCode || config.buildNumber || "1",
        privacy_policy: config.privacyPolicy || config.description || "",
        url: url,
        platform: config.platform,
        status: "pending",
        progress: 0,
        icon_path: config.iconPath || null,
        output_file_path: null,
        download_url: null,
        error_message: null,
        expires_at: expiresAt,
        // 第一个平台时间戳最大，确保按时间降序时显示在最前面
        created_at: new Date(now + (totalPlatforms - index)).toISOString(),
        updated_at: new Date(now + (totalPlatforms - index)).toISOString(),
      };

      let result;
      try {
        result = await db.collection("builds").add(buildData);
      } catch (dbError) {
        console.error(`[Domestic Batch Build] Database insert error for ${config.platform}:`, dbError);
        // 如果是第一个平台就失败，退还所有配额
        if (buildIds.length === 0) {
          await refundDailyBuildQuota(user.id, platformCount);
          return NextResponse.json(
            { error: "Database error", message: "Failed to create build record" },
            { status: 500 }
          );
        }
        // 如果已经有成功的平台，只退还当前失败的配额，继续处理已成功的平台
        await refundDailyBuildQuota(user.id, 1);
        console.warn(`[Domestic Batch Build] Skipping ${config.platform} due to database error, continuing with ${buildIds.length} successful platforms`);
        continue;
      }
      buildIds.push(result.id);
    }

    // 如果所有平台都失败了
    if (buildIds.length === 0) {
      return NextResponse.json(
        { error: "Database error", message: "Failed to create any build records" },
        { status: 500 }
      );
    }

    // 7. 异步处理构建
    processBuildsAsync(user.id, url, platforms, buildIds).catch(console.error);

    return NextResponse.json({
      success: true,
      buildIds: buildIds,
      message: "Build tasks created successfully",
    });
  } catch (error) {
    console.error("[Domestic Batch Build API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

function getPackageName(config: PlatformConfig): string {
  switch (config.platform) {
    case "android":
      return config.packageName || `com.app.${config.appName.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    case "ios":
      return config.bundleId || `com.app.${config.appName.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    case "harmonyos":
      return config.bundleName || `com.app.${config.appName.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    case "wechat":
      return config.appId || "";
    case "chrome":
      return `chrome.extension.${config.appName.toLowerCase().replace(/\s+/g, "")}`;
    default:
      return config.appName.replace(/\s+/g, "-").toLowerCase();
  }
}

async function processBuildsAsync(
  userId: string,
  url: string,
  platforms: PlatformConfig[],
  buildIds: string[]
) {
  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();

  // 并行处理所有构建任务（大幅提升速度）
  // 使用 Promise.allSettled 确保单个构建失败不影响其他构建
  await Promise.allSettled(
    buildIds.map(async (buildId, i) => {
      const config = platforms[i];
      console.log(`[Domestic Batch Build] Processing build ${buildId}, platform: ${config.platform}, config.iconPath: ${config.iconPath}`);
      let iconPath: string | null = null;

      try {
        // 更新状态为处理中
        await db.collection("builds").doc(buildId).update({
          status: "processing",
          updated_at: new Date().toISOString(),
        });

        // 优先使用前端预上传的图标路径（国内版）
        if (config.iconPath) {
          iconPath = config.iconPath;
          console.log(`[Domestic Batch Build] Using pre-uploaded icon path for build ${buildId}: ${iconPath}`);
        }
        // 如果没有预上传路径，则上传图标（支持 URL 或 base64）
        else if (isIconUploadEnabled()) {
          console.log(`[Domestic Batch Build] No pre-uploaded icon path for build ${buildId}, trying iconUrl or iconBase64`);

          let iconBuffer: Buffer | null = null;

          // 优先使用 iconUrl（避免 Vercel 4.5MB 限制）
          if (config.iconUrl) {
            // 重试机制：最多尝试3次，超时时间递增
            const maxRetries = 3;
            const timeouts = [30000, 45000, 60000]; // 30s, 45s, 60s

            for (let attempt = 0; attempt < maxRetries; attempt++) {
              try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeouts[attempt]);

                try {
                  console.log(`[Domestic Batch] Fetching icon (attempt ${attempt + 1}/${maxRetries}, timeout: ${timeouts[attempt]}ms): ${config.iconUrl}`);
                  const iconResponse = await fetch(config.iconUrl, {
                    signal: controller.signal,
                  });

                  if (iconResponse.ok) {
                    const arrayBuffer = await iconResponse.arrayBuffer();
                    iconBuffer = Buffer.from(arrayBuffer);
                    console.log(`[Domestic Batch] Icon fetched successfully (${iconBuffer.length} bytes)`);
                    break; // 成功，退出重试循环
                  }
                } finally {
                  clearTimeout(timeoutId);
                }
              } catch (err) {
                const isLastAttempt = attempt === maxRetries - 1;
                if (isLastAttempt) {
                  console.error(`[Domestic Batch] Failed to fetch icon after ${maxRetries} attempts: ${config.iconUrl}`, err);
                } else {
                  console.warn(`[Domestic Batch] Icon fetch attempt ${attempt + 1} failed, retrying...`, err);
                  // 等待1秒后重试
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
            }
          }
          // 向后兼容：支持 base64
          else if (config.iconBase64) {
            iconBuffer = Buffer.from(config.iconBase64, "base64");
          }

          // 上传图标到 CloudBase Storage
          if (iconBuffer) {
            try {
              const sizeValidation = validateImageSize(iconBuffer.length);

              if (sizeValidation.valid) {
                const { getCloudBaseStorage } = await import("@/lib/cloudbase/storage");
                const storage = getCloudBaseStorage();
                iconPath = `user-builds/builds/${buildId}/icon.png`;
                console.log(`[Domestic Batch Build] Uploading icon for build ${buildId} to ${iconPath}`);

                await storage.uploadFile(iconPath, iconBuffer);
                console.log(`[Domestic Batch Build] Icon uploaded successfully for build ${buildId}`);

                // 更新构建记录的 icon_path
                await db.collection("builds").doc(buildId).update({
                  icon_path: iconPath,
                  updated_at: new Date().toISOString(),
                });
                console.log(`[Domestic Batch Build] Build record updated with icon_path for build ${buildId}`);
              } else {
                console.log(`[Domestic Batch Build] Icon size validation failed for build ${buildId}: ${sizeValidation.fileSizeMB}MB exceeds ${sizeValidation.maxSizeMB}MB`);
              }
            } catch (error) {
              console.error(`[Domestic Batch Build] Icon upload error for build ${buildId}:`, error);
              // 图标上传失败不影响构建继续
            }
          }
        }

        // 启动对应平台的构建（并行执行）
        await startPlatformBuild(buildId, config.platform, url, config, iconPath);
      } catch (error) {
        console.error(`[Domestic Batch] Build error for ${buildId}:`, error);
        // 构建失败时退还该平台的额度
        await refundDailyBuildQuota(userId, 1);
        await db.collection("builds").doc(buildId).update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Build failed",
          updated_at: new Date().toISOString(),
        });
      }
    })
  );
}

async function startPlatformBuild(
  buildId: string,
  platform: string,
  url: string,
  config: PlatformConfig,
  iconPath: string | null
) {
  switch (platform) {
    case "android":
    case "android-source":
      await processAndroidBuildDomestic(buildId, {
        url,
        appName: config.appName,
        packageName: config.packageName || "",
        versionName: config.versionName || "1.0.0",
        versionCode: config.versionCode || "1",
        privacyPolicy: config.privacyPolicy || "",
        iconPath,
      });
      break;

    case "android-apk":
      // Android APK 构建暂不支持批量构建
      // 用户需要单独选择 Android APK 平台进行构建
      console.warn(`[Domestic Batch] Android APK build is not supported in batch mode for build ${buildId}`);
      throw new Error("Android APK build is not supported in batch mode. Please build Android APK separately.");
      break;

    case "ios":
      await processiOSBuildDomestic(buildId, {
        url,
        appName: config.appName,
        bundleId: config.bundleId || "",
        versionString: config.versionString || "1.0.0",
        buildNumber: config.buildNumber || "1",
        privacyPolicy: config.privacyPolicy || "",
        iconPath,
      });
      break;

    case "chrome":
      await processChromeExtensionBuildDomestic(buildId, {
        url,
        appName: config.appName,
        versionName: config.versionName || "1.0.0",
        description: config.description || "",
        iconPath,
      });
      break;

    case "windows":
      await processWindowsExeBuildDomestic(buildId, {
        url,
        appName: config.appName,
        iconPath,
      });
      break;

    case "macos":
      await processMacOSAppBuildDomestic(buildId, {
        url,
        appName: config.appName,
        iconPath,
      });
      break;

    case "linux":
      await processLinuxAppBuildDomestic(buildId, {
        url,
        appName: config.appName,
        iconPath,
      });
      break;

    case "wechat":
      await processWechatBuildDomestic(buildId, {
        url,
        appName: config.appName,
        appId: config.appId || "",
        version: config.version || "1.0.0",
      });
      break;

    case "harmonyos":
      await processHarmonyOSBuildDomestic(buildId, {
        url,
        appName: config.appName,
        bundleName: config.bundleName || "",
        versionName: config.versionName || "1.0.0",
        versionCode: config.versionCode || "1",
        privacyPolicy: config.privacyPolicy || "",
        iconPath,
      });
      break;

    default:
      console.error(`[Domestic Batch] Unknown platform: ${platform}`);
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
