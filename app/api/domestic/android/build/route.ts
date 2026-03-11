/**
 * 国内版 Android 构建 API
 * 使用 CloudBase 数据库和存储
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { processAndroidBuildDomestic } from "@/lib/services/domestic/android-builder";
import { isIconUploadEnabled, validateImageSize } from "@/lib/config/upload";
import { checkDailyBuildQuota, consumeDailyBuildQuota, getUserWallet, refundDailyBuildQuota } from "@/services/wallet";
import { getPlanBuildExpireDays } from "@/utils/plan-limits";

// 增加函数执行时间限制
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
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

    // Parse form data
    const formData = await request.formData();
    const url = formData.get("url") as string;
    const appName = formData.get("appName") as string;
    const packageName = formData.get("packageName") as string;
    const versionName = formData.get("versionName") as string || "1.0.0";
    const versionCode = formData.get("versionCode") as string || "1";
    const privacyPolicy = formData.get("privacyPolicy") as string || "";
    const icon = formData.get("icon") as File | null;
    const preUploadedIconPath = formData.get("iconPath") as string | null; // 前端预上传的图标路径

    // Validate required fields
    if (!url || !appName || !packageName) {
      return NextResponse.json(
        { error: "Missing required fields", message: "url, appName, and packageName are required" },
        { status: 400 }
      );
    }

    // Validate package name format
    const packageRegex = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i;
    if (!packageRegex.test(packageName)) {
      return NextResponse.json(
        { error: "Invalid package name", message: "Package name should be in format: com.example.app" },
        { status: 400 }
      );
    }

    // 预校验图标（避免先扣额度后失败）
    if (icon && icon.size > 0) {
      if (!isIconUploadEnabled()) {
        return NextResponse.json(
          { error: "Icon upload disabled", message: "Icon upload is currently disabled" },
          { status: 400 }
        );
      }

      const sizeValidation = validateImageSize(icon.size);
      if (!sizeValidation.valid) {
        return NextResponse.json(
          { error: "Icon too large", message: `Icon size (${sizeValidation.fileSizeMB}MB) exceeds limit (${sizeValidation.maxSizeMB}MB)` },
          { status: 400 }
        );
      }
    }

    // 检查构建配额
    const quotaCheck = await checkDailyBuildQuota(user.id, 1);
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        {
          error: "Quota exceeded",
          message: `Daily build quota exceeded. Remaining: ${quotaCheck.remaining}/${quotaCheck.limit}`,
          remaining: quotaCheck.remaining,
          limit: quotaCheck.limit,
        },
        { status: 429 }
      );
    }

    // 扣除配额
    const deductResult = await consumeDailyBuildQuota(user.id, 1);
    if (!deductResult.success) {
      return NextResponse.json(
        {
          error: "Quota deduction failed",
          message: deductResult.error || "Failed to deduct build quota",
        },
        { status: 500 }
      );
    }

    // 连接 CloudBase 数据库
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    // 获取用户套餐信息计算过期时间
    const wallet = await getUserWallet(user.id);
    const plan = user.metadata?.plan || "free";
    const expireDays = wallet?.file_retention_days || getPlanBuildExpireDays(plan);
    const expiresAt = new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000).toISOString();

    // 使用前端预上传的图标路径（如果有）
    const iconPath = preUploadedIconPath || null;
    console.log(`[Domestic Android Build] Icon path from frontend: ${iconPath || "none"}`);

    // 创建构建记录
    const buildData = {
      user_id: user.id,
      platform: "android",
      status: "pending",
      app_name: appName,
      package_name: packageName,
      version_name: versionName,
      version_code: parseInt(versionCode),
      url,
      privacy_policy: privacyPolicy,
      icon_path: iconPath,
      output_file_path: null,
      download_url: null,
      error_message: null,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let result;
    try {
      result = await db.collection("builds").add(buildData);
    } catch (dbError) {
      console.error("[Domestic Android Build] Database insert error:", dbError);
      // 退还已扣除的quota
      await refundDailyBuildQuota(user.id, 1);
      return NextResponse.json(
        { error: "Database error", message: "Failed to create build record" },
        { status: 500 }
      );
    }
    const buildId = result.id;
    console.log(`[Domestic Android Build] Build record created with ID: ${buildId}, icon_path: ${iconPath || "none"}`);

    // 异步处理构建（不阻塞响应）
    // 注意：实际生产环境应使用消息队列或云函数
    processAndroidBuildAsync(buildId, {
      url,
      appName,
      packageName,
      versionName,
      versionCode: parseInt(versionCode),
      privacyPolicy,
      iconPath,
      userId: user.id,
    }).catch(console.error);

    return NextResponse.json({
      success: true,
      buildId,
      message: "Build started successfully",
      status: "pending",
    });
  } catch (error) {
    console.error("[Domestic Android Build API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

/**
 * 异步处理 Android 构建
 */
async function processAndroidBuildAsync(
  buildId: string,
  params: {
    url: string;
    appName: string;
    packageName: string;
    versionName: string;
    versionCode: number;
    privacyPolicy: string;
    iconPath: string | null;
    userId: string;
  }
) {
  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();

  try {
    // 更新状态为处理中
    await db.collection("builds").doc(buildId).update({
      status: "processing",
      updated_at: new Date().toISOString(),
    });

    // 调用国内版构建服务（传入 buildId 和 config）
    await processAndroidBuildDomestic(buildId, {
      url: params.url,
      appName: params.appName,
      packageName: params.packageName,
      versionName: params.versionName,
      versionCode: String(params.versionCode),
      privacyPolicy: params.privacyPolicy,
      iconPath: params.iconPath,
    });

    // 构建服务会自动更新状态
  } catch (error) {
    console.error("[Domestic Android Build] Async processing error:", error);

    // 更新为失败状态
    await db.collection("builds").doc(buildId).update({
      status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown error",
      updated_at: new Date().toISOString(),
    });
  }
}
