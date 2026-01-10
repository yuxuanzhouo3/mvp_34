import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isIconUploadEnabled, validateImageSize } from "@/lib/config/upload";
import { deductBuildQuota, checkBuildQuota, getSupabaseUserWallet, refundBuildQuota } from "@/services/wallet-supabase";
import { getPlanBuildExpireDays } from "@/utils/plan-limits";

// 导入各平台的构建处理器
import { processAndroidBuild } from "@/lib/services/android-builder";
import { processIOSBuild } from "@/lib/services/ios-builder";
import { processChromeExtensionBuild } from "@/lib/services/chrome-extension-builder";
import { processWindowsExeBuild } from "@/lib/services/windows-exe-builder";
import { processMacOSAppBuild } from "@/lib/services/macos-app-builder";
import { processLinuxAppBuild } from "@/lib/services/linux-app-builder";
import { processWechatBuild } from "@/lib/services/wechat-builder";
import { processHarmonyOSBuild } from "@/lib/services/harmonyos-builder";

export const maxDuration = 120;

// 平台配置类型
interface PlatformConfig {
  platform: string;
  appName: string;
  // Android
  packageName?: string;
  versionName?: string;
  versionCode?: string;
  privacyPolicy?: string;
  // iOS
  bundleId?: string;
  versionString?: string;
  buildNumber?: string;
  // WeChat
  appId?: string;
  version?: string;
  // HarmonyOS
  bundleName?: string;
  // Chrome
  description?: string;
  // 图标（base64 或路径）
  iconBase64?: string;
  iconType?: string;
}

interface BatchBuildRequest {
  url: string;
  platforms: PlatformConfig[];
}

export async function POST(request: NextRequest) {
  try {
    // 1. 认证（只做一次）
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please login to create a build" },
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
    const serviceClient = createServiceClient();

    // 3. 并行执行：额度检查 + 获取用户钱包信息（优化响应速度）
    const [quotaCheck, wallet] = await Promise.all([
      checkBuildQuota(user.id, platformCount),
      getSupabaseUserWallet(user.id),
    ]);

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

    // 4. 扣除额度
    const deductResult = await deductBuildQuota(user.id, platformCount);
    if (!deductResult.success) {
      return NextResponse.json(
        { error: "Quota deduction failed", message: deductResult.error || "Failed to deduct build quota" },
        { status: 500 }
      );
    }

    // 5. 计算过期时间（使用已获取的钱包信息）
    const expireDays = getPlanBuildExpireDays(wallet?.plan || "Free");
    const expiresAt = new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000).toISOString();

    // 6. 批量创建构建记录
    const buildRecords = platforms.map((config) => ({
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
      icon_path: null, // 图标稍后异步上传
      expires_at: expiresAt,
    }));

    const { data: builds, error: insertError } = await serviceClient
      .from("builds")
      .insert(buildRecords)
      .select();

    if (insertError || !builds) {
      console.error("Batch insert error:", insertError);
      // 回滚已扣除的额度
      await refundBuildQuota(user.id, platformCount);
      return NextResponse.json(
        { error: "Database error", message: "Failed to create build records" },
        { status: 500 }
      );
    }

    // 7. 立即返回 buildIds，让前端跳转
    const buildIds = builds.map((b) => b.id);

    // 8. 后台异步处理：上传图标 + 启动构建
    waitUntil(
      processBuildsInBackground(serviceClient, user.id, url, platforms, builds)
    );

    return NextResponse.json({
      success: true,
      buildIds: buildIds,
      message: "Build tasks created successfully",
    });
  } catch (error) {
    console.error("Batch build API error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// 根据平台获取包名
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
    case "windows":
    case "macos":
    case "linux":
      return config.appName.replace(/\s+/g, "-").toLowerCase();
    default:
      return config.appName.toLowerCase().replace(/\s+/g, "-");
  }
}

// 后台处理构建任务
async function processBuildsInBackground(
  serviceClient: ReturnType<typeof createServiceClient>,
  userId: string,
  url: string,
  platforms: PlatformConfig[],
  builds: Array<{ id: string; platform: string }>
) {
  // 并行处理所有平台的图标上传和构建启动
  const tasks = builds.map(async (build, index) => {
    const config = platforms[index];
    let iconPath: string | null = null;

    try {
      // 上传图标（如果有）
      if (config.iconBase64 && isIconUploadEnabled()) {
        const iconBuffer = Buffer.from(config.iconBase64, "base64");
        const sizeValidation = validateImageSize(iconBuffer.length);

        if (sizeValidation.valid) {
          const fileExt = config.iconType?.split("/")[1] || "png";
          const safeFileName = `icon_${Date.now()}_${index}.${fileExt}`;
          const iconFileName = `icons/${userId}/${safeFileName}`;

          const { error: uploadError } = await serviceClient.storage
            .from("user-builds")
            .upload(iconFileName, iconBuffer, {
              contentType: config.iconType || "image/png",
              upsert: true,
            });

          if (!uploadError) {
            iconPath = iconFileName;
            // 更新数据库中的图标路径
            await serviceClient
              .from("builds")
              .update({ icon_path: iconPath })
              .eq("id", build.id);
          }
        }
      }

      // 启动对应平台的构建
      await startPlatformBuild(build.id, build.platform, url, config, iconPath);
    } catch (err) {
      console.error(`[Batch] Build process error for ${build.id}:`, err);
      // 构建失败时回滚该平台的额度
      await refundBuildQuota(userId, 1);
      // 更新构建状态为失败
      await serviceClient
        .from("builds")
        .update({ status: "failed", error_message: err instanceof Error ? err.message : "Build failed" })
        .eq("id", build.id);
    }
  });

  await Promise.allSettled(tasks);
}

// 启动对应平台的构建
async function startPlatformBuild(
  buildId: string,
  platform: string,
  url: string,
  config: PlatformConfig,
  iconPath: string | null
) {
  switch (platform) {
    case "android":
      await processAndroidBuild(buildId, {
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
      await processIOSBuild(buildId, {
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
      await processChromeExtensionBuild(buildId, {
        url,
        appName: config.appName,
        versionName: config.versionName || "1.0.0",
        description: config.description || "",
        iconPath,
      });
      break;

    case "windows":
      await processWindowsExeBuild(buildId, {
        url,
        appName: config.appName,
        iconPath,
      });
      break;

    case "macos":
      await processMacOSAppBuild(buildId, {
        url,
        appName: config.appName,
        iconPath,
      });
      break;

    case "linux":
      await processLinuxAppBuild(buildId, {
        url,
        appName: config.appName,
        iconPath,
      });
      break;

    case "wechat":
      await processWechatBuild(buildId, {
        url,
        appName: config.appName,
        appId: config.appId || "",
        version: config.version || "1.0.0",
      });
      break;

    case "harmonyos":
      await processHarmonyOSBuild(buildId, {
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
      console.warn(`[Batch] Unknown platform: ${platform}`);
  }
}
