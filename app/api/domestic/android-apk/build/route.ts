/**
 * 国内版 Android APK 构建 API
 * 使用 GitHub Actions 编译 APK
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, checkAndDeductQuota, createBuildRecord } from "@/lib/domestic/build-helpers";
import { processAndroidBuildDomestic } from "@/lib/services/domestic/android-builder";
import { triggerGitHubBuild } from "@/lib/services/github-builder";
import { getCloudBaseStorage } from "@/lib/cloudbase/storage";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

export const maxDuration = 300; // APK 构建需要更长时间

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
    const packageName = formData.get("packageName") as string;
    const versionName = formData.get("versionName") as string || "1.0.0";
    const versionCode = formData.get("versionCode") as string || "1";
    const privacyPolicy = formData.get("privacyPolicy") as string || "";
    const preUploadedIconPath = formData.get("iconPath") as string | null;

    // 3. 验证必填字段
    if (!url || !appName || !packageName) {
      return NextResponse.json(
        { error: "Missing required fields", message: "url, appName, and packageName are required" },
        { status: 400 }
      );
    }

    // 4. 验证包名格式
    const packageRegex = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i;
    if (!packageRegex.test(packageName)) {
      return NextResponse.json(
        { error: "Invalid package name", message: "Package name should be in format: com.example.app" },
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
      platform: "android-apk",
      appName,
      url,
      packageName,
      versionName,
      versionCode: parseInt(versionCode),
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
    console.log(`[Domestic Android APK Build] Build record created with ID: ${buildId}`);

    // 7. 异步处理构建
    processAndroidApkBuildAsync(buildId, {
      url,
      appName,
      packageName,
      versionName,
      versionCode: parseInt(versionCode),
      privacyPolicy,
      iconPath: preUploadedIconPath,
      userId: authResult.user!.id,
    }).catch(console.error);

    return NextResponse.json({
      success: true,
      buildId,
      message: "APK build started, estimated time: 3-8 minutes",
      status: "pending",
    });
  } catch (error) {
    console.error("[Domestic Android APK Build API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

/**
 * 异步处理 Android APK 构建
 */
async function processAndroidApkBuildAsync(
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
  const storage = getCloudBaseStorage();

  // 临时构建 ID 用于生成源码（在函数顶部声明以便 catch 块访问）
  const tempSourceBuildId = `${buildId}-source`;

  try {
    // 更新状态为处理中
    await db.collection("builds").doc(buildId).update({
      status: "processing",
      progress: 10,
      updated_at: new Date().toISOString(),
    });

    // 步骤 1: 生成 Android Source（使用现有的构建服务）
    console.log(`[Android APK Build ${buildId}] Step 1: Generating Android Source...`);

    // 创建临时构建记录（processAndroidBuildDomestic 需要从数据库读取）
    await db.collection("builds").add({
      _id: tempSourceBuildId,
      user_id: params.userId,
      platform: "android-source",
      app_name: params.appName,
      package_name: params.packageName,
      url: params.url,
      status: "pending",
      progress: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 调用现有的 Android Source 构建服务
    await processAndroidBuildDomestic(tempSourceBuildId, {
      url: params.url,
      appName: params.appName,
      packageName: params.packageName,
      versionName: params.versionName,
      versionCode: String(params.versionCode),
      privacyPolicy: params.privacyPolicy,
      iconPath: params.iconPath,
    });

    // 获取生成的 Android Source 下载 URL
    const sourceBuild = await db.collection("builds").doc(tempSourceBuildId).get();
    const sourceData = sourceBuild?.data?.[0];

    if (!sourceData || !sourceData.download_url) {
      console.error(`[Android APK Build ${buildId}] Failed to get download_url`);
      throw new Error("Failed to generate Android Source");
    }

    const sourceUrl = sourceData.download_url;
    console.log(`[Android APK Build ${buildId}] Android Source generated: ${sourceUrl}`);

    // 更新进度
    await db.collection("builds").doc(buildId).update({
      progress: 30,
      updated_at: new Date().toISOString(),
    });

    // 步骤 2: 触发 GitHub Actions 构建
    console.log(`[Android APK Build ${buildId}] Step 2: Triggering GitHub Actions...`);

    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/domestic/builds/${buildId}/github-callback`;

    const githubResult = await triggerGitHubBuild({
      buildId,
      sourceUrl,
      callbackUrl,
    });

    if (!githubResult.success) {
      throw new Error(`GitHub Actions trigger failed: ${githubResult.error}`);
    }

    console.log(`[Android APK Build ${buildId}] GitHub Actions triggered successfully`);

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
    console.error(`[Android APK Build ${buildId}] Error:`, error);

    await db.collection("builds").doc(buildId).update({
      status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown error",
      updated_at: new Date().toISOString(),
    });

    // 清理临时的 source build 记录（失败情况）
    await db.collection("builds").doc(tempSourceBuildId).delete().catch(() => {});
  }
}
