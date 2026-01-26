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
  iconBase64?: string;
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
    const now = new Date().toISOString();

    for (const config of platforms) {
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
        icon_path: null,
        output_file_path: null,
        download_url: null,
        error_message: null,
        expires_at: expiresAt,
        created_at: now,
        updated_at: now,
      };

      const result = await db.collection("builds").add(buildData);
      buildIds.push(result.id);
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

  for (let i = 0; i < buildIds.length; i++) {
    const buildId = buildIds[i];
    const config = platforms[i];
    let iconPath: string | null = null;

    try {
      // 更新状态为处理中
      await db.collection("builds").doc(buildId).update({
        status: "processing",
        updated_at: new Date().toISOString(),
      });

      // 上传图标（如果有）
      if (config.iconBase64 && isIconUploadEnabled()) {
        try {
          const iconBuffer = Buffer.from(config.iconBase64, "base64");
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

      // 启动对应平台的构建
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
  }
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
      console.warn(`[Domestic Batch] Unknown platform: ${platform}`);
  }
}
