/**
 * 国内版 iOS IPA 构建 API
 * 使用 GitHub Actions 编译 IPA
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, checkAndDeductQuota, createBuildRecord } from "@/lib/domestic/build-helpers";
import { processiOSBuildDomestic } from "@/lib/services/domestic/ios-builder";
import { triggerGitHubBuild } from "@/lib/services/github-builder";
import { getCloudBaseStorage } from "@/lib/cloudbase/storage";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

export const maxDuration = 300; // IPA 构建需要更长时间

export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const authResult = await authenticateUser();
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // 2. 解析表单数据
    const formData = await request.formData();
    const url = formData.get("url") as string;
    const appName = formData.get("appName") as string;
    const bundleId = formData.get("bundleId") as string;
    const versionString = formData.get("versionString") as string || "1.0.0";
    const buildNumber = formData.get("buildNumber") as string || "1";
    const privacyPolicy = formData.get("privacyPolicy") as string || "";
    const preUploadedIconPath = formData.get("iconPath") as string | null;

    // 3. 验证必填字段
    if (!url || !appName || !bundleId) {
      return NextResponse.json(
        { error: "Missing required fields", message: "url, appName, and bundleId are required" },
        { status: 400 }
      );
    }

    // 4. 验证 Bundle ID 格式
    const bundleRegex = /^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$/i;
    if (!bundleRegex.test(bundleId)) {
      return NextResponse.json(
        { error: "Invalid bundle ID", message: "Bundle ID should be in format: com.example.app" },
        { status: 400 }
      );
    }

    // 5. 检查并扣除构建配额
    const quotaResult = await checkAndDeductQuota(authResult.user!.id);
    if (!quotaResult.success) {
      return NextResponse.json(
        {
          error: "Quota exceeded",
          message: quotaResult.error,
          remaining: quotaResult.remaining,
          limit: quotaResult.limit,
        },
        { status: 429 }
      );
    }

    // 6. 创建构建记录
    const buildResult = await createBuildRecord({
      userId: authResult.user!.id,
      platform: "ios-ipa",
      appName,
      url,
      packageName: bundleId,
      versionName: versionString,
      versionCode: parseInt(buildNumber),
      privacyPolicy,
      iconPath: preUploadedIconPath,
    });

    if (!buildResult.success) {
      return NextResponse.json(
        { error: buildResult.error },
        { status: 500 }
      );
    }

    const buildId = buildResult.buildId!;
    console.log(`[Domestic iOS IPA Build] Build record created with ID: ${buildId}`);

    // 7. 异步处理构建
    processIOSIpaBuildAsync(buildId, {
      url,
      appName,
      bundleId,
      versionString,
      buildNumber,
      privacyPolicy,
      iconPath: preUploadedIconPath,
      userId: authResult.user!.id,
    }).catch(console.error);

    return NextResponse.json({
      success: true,
      buildId,
      message: "IPA build started, estimated time: 5-15 minutes",
      status: "pending",
    });
  } catch (error) {
    console.error("[Domestic iOS IPA Build API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

/**
 * 异步处理 iOS IPA 构建
 */
async function processIOSIpaBuildAsync(
  buildId: string,
  params: {
    url: string;
    appName: string;
    bundleId: string;
    versionString: string;
    buildNumber: string;
    privacyPolicy: string;
    iconPath: string | null;
    userId: string;
  }
) {
  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();
  const storage = getCloudBaseStorage();

  const tempSourceBuildId = `${buildId}-source`;

  try {
    // 更新状态为处理中
    await db.collection("builds").doc(buildId).update({
      status: "processing",
      progress: 10,
      updated_at: new Date().toISOString(),
    });

    // 步骤 1: 生成 iOS Source（使用现有的构建服务）
    console.log(`[iOS IPA Build ${buildId}] Step 1: Generating iOS Source...`);

    // 创建临时构建记录
    await db.collection("builds").add({
      _id: tempSourceBuildId,
      user_id: params.userId,
      platform: "ios",
      app_name: params.appName,
      package_name: params.bundleId,
      url: params.url,
      status: "pending",
      progress: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 调用现有的 iOS Source 构建服务
    await processiOSBuildDomestic(tempSourceBuildId, {
      url: params.url,
      appName: params.appName,
      bundleId: params.bundleId,
      versionString: params.versionString,
      buildNumber: params.buildNumber,
      privacyPolicy: params.privacyPolicy,
      iconPath: params.iconPath,
    });

    // 获取生成的 iOS Source 下载 URL
    const sourceBuild = await db.collection("builds").doc(tempSourceBuildId).get();
    const sourceData = sourceBuild?.data?.[0];

    if (!sourceData || !sourceData.download_url) {
      console.error(`[iOS IPA Build ${buildId}] Failed to get download_url`);
      throw new Error("Failed to generate iOS Source");
    }

    const sourceUrl = sourceData.download_url;
    console.log(`[iOS IPA Build ${buildId}] iOS Source generated: ${sourceUrl}`);

    // 更新进度
    await db.collection("builds").doc(buildId).update({
      progress: 30,
      updated_at: new Date().toISOString(),
    });

    // 步骤 2: 触发 GitHub Actions 构建
    console.log(`[iOS IPA Build ${buildId}] Step 2: Triggering GitHub Actions...`);

    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/domestic/builds/${buildId}/github-callback`;

    const githubResult = await triggerGitHubBuild({
      buildId,
      sourceUrl,
      callbackUrl,
      platform: "ios-ipa",
    });

    if (!githubResult.success) {
      throw new Error(`GitHub Actions trigger failed: ${githubResult.error}`);
    }

    console.log(`[iOS IPA Build ${buildId}] GitHub Actions triggered successfully`);

    // 更新状态：等待 GitHub Actions 完成
    await db.collection("builds").doc(buildId).update({
      status: "processing",
      progress: 50,
      github_build_triggered: true,
      github_run_id: githubResult.runId || null,
      updated_at: new Date().toISOString(),
    });

    // 清理临时的 source build 记录
    await db.collection("builds").doc(tempSourceBuildId).delete().catch(() => {});

  } catch (error) {
    console.error(`[iOS IPA Build ${buildId}] Error:`, error);

    await db.collection("builds").doc(buildId).update({
      status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown error",
      updated_at: new Date().toISOString(),
    });

    // 清理临时的 source build 记录（失败情况）
    await db.collection("builds").doc(tempSourceBuildId).delete().catch(() => {});
  }
}
