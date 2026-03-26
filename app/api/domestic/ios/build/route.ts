/**
 * 国内版 iOS 构建 API
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, checkAndDeductQuota, createBuildRecord, updateBuildStatus } from "@/lib/domestic/build-helpers";
import { processiOSBuildDomestic } from "@/lib/services/domestic/ios-builder";
import { isIconUploadEnabled, validateImageSize } from "@/lib/config/upload";
import { getCloudBaseStorage } from "@/lib/cloudbase/storage";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    // 验证用户
    const authResult = await authenticateUser();
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: "Unauthorized", message: authResult.error },
        { status: authResult.status || 401 }
      );
    }
    const user = authResult.user;

    // 解析表单数据
    const formData = await request.formData();
    const url = formData.get("url") as string;
    const appName = formData.get("appName") as string;
    const bundleId = formData.get("bundleId") as string;
    const versionName = formData.get("versionName") as string || "1.0.0";
    const icon = formData.get("icon") as File | null;

    if (!url || !appName || !bundleId) {
      return NextResponse.json(
        { error: "Missing required fields", message: "url, appName, and bundleId are required" },
        { status: 400 }
      );
    }

    // 预校验图标
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

    // 检查并扣除配额
    const quotaResult = await checkAndDeductQuota(user.id, 1);
    if (!quotaResult.success) {
      return NextResponse.json(
        { error: "Quota exceeded", message: quotaResult.error, remaining: quotaResult.remaining, limit: quotaResult.limit },
        { status: 429 }
      );
    }

    // 创建构建记录
    const buildResult = await createBuildRecord({
      userId: user.id,
      platform: "ios",
      appName,
      url,
      packageName: bundleId,
      versionName,
    });

    if (!buildResult.success || !buildResult.buildId) {
      return NextResponse.json(
        { error: "Failed to create build", message: buildResult.error },
        { status: 500 }
      );
    }

    const buildId = buildResult.buildId;

    // 上传图标到CloudBase存储
    let iconPath: string | null = null;
    if (icon && icon.size > 0) {
      try {
        const storage = getCloudBaseStorage();
        const iconBuffer = Buffer.from(await icon.arrayBuffer());
        iconPath = `user-builds/builds/${buildId}/icon.png`;
        await storage.uploadFile(iconPath, iconBuffer);
        await updateBuildStatus(buildId, "pending", { icon_path: iconPath });
      } catch (error) {
        console.error("[Domestic iOS Build] Icon upload error:", error);
      }
    }

    // 异步处理构建
    processIosBuildAsync(buildId, { url, appName, bundleId, versionName, iconPath }).catch(console.error);

    return NextResponse.json({
      success: true,
      buildId: buildResult.buildId,
      message: "Build started successfully",
      status: "pending",
    });
  } catch (error) {
    console.error("[Domestic iOS Build API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

async function processIosBuildAsync(buildId: string, params: { url: string; appName: string; bundleId: string; versionName: string; iconPath: string | null }) {
  try {
    await updateBuildStatus(buildId, "processing");
    await processiOSBuildDomestic(buildId, {
      url: params.url,
      appName: params.appName,
      bundleId: params.bundleId,
      versionString: params.versionName,
      buildNumber: "1",
      privacyPolicy: "",
      iconPath: params.iconPath,
    });
  } catch (error) {
    await updateBuildStatus(buildId, "failed", { error_message: error instanceof Error ? error.message : "Unknown error" });
  }
}
