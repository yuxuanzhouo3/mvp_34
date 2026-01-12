/**
 * 国内版 iOS 构建 API
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, checkAndDeductQuota, createBuildRecord, updateBuildStatus } from "@/lib/domestic/build-helpers";
import { processiOSBuild } from "@/lib/services/ios-builder";

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

    if (!url || !appName || !bundleId) {
      return NextResponse.json(
        { error: "Missing required fields", message: "url, appName, and bundleId are required" },
        { status: 400 }
      );
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

    // 异步处理构建
    processIosBuildAsync(buildResult.buildId, { url, appName, bundleId, versionName }).catch(console.error);

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

async function processIosBuildAsync(buildId: string, params: { url: string; appName: string; bundleId: string; versionName: string }) {
  try {
    await updateBuildStatus(buildId, "processing");
    await processiOSBuild(buildId, {
      url: params.url,
      appName: params.appName,
      bundleId: params.bundleId,
      versionString: params.versionName,
      buildNumber: "1",
      privacyPolicy: "",
      iconPath: null,
    });
  } catch (error) {
    await updateBuildStatus(buildId, "failed", { error_message: error instanceof Error ? error.message : "Unknown error" });
  }
}
