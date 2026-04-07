/**
 * 国内版 HarmonyOS HAP 构建 API
 * 使用 GitHub Actions 编译 HAP
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, checkAndDeductQuota, createBuildRecord } from "@/lib/domestic/build-helpers";
import { processHarmonyOSBuildDomestic } from "@/lib/services/domestic/harmonyos-builder";
import { triggerGitHubBuild } from "@/lib/services/github-builder";
import { getCloudBaseStorage } from "@/lib/cloudbase/storage";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

export const maxDuration = 300;

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
    const bundleName = formData.get("bundleName") as string;
    const versionName = formData.get("versionName") as string || "1.0.0";
    const versionCode = formData.get("versionCode") as string || "1";
    const privacyPolicy = formData.get("privacyPolicy") as string || "";
    const preUploadedIconPath = formData.get("iconPath") as string | null;

    // 3. 验证必填字段
    if (!url || !appName || !bundleName) {
      return NextResponse.json(
        { error: "Missing required fields", message: "url, appName, and bundleName are required" },
        { status: 400 }
      );
    }

    // 4. 检查并扣除构建配额
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

    // 5. 创建构建记录
    const buildResult = await createBuildRecord({
      userId: authResult.user!.id,
      platform: "harmonyos-hap",
      appName,
      url,
      packageName: bundleName,
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
    console.log(`[Domestic HarmonyOS HAP Build] Build record created with ID: ${buildId}`);

    // 6. 异步处理构建
    processHarmonyOSHapBuildAsync(buildId, {
      url,
      appName,
      bundleName,
      versionName,
      versionCode,
      privacyPolicy,
      iconPath: preUploadedIconPath,
      userId: authResult.user!.id,
    }).catch(console.error);

    return NextResponse.json({
      success: true,
      buildId,
      message: "HAP build started, estimated time: 3-10 minutes",
      status: "pending",
    });
  } catch (error) {
    console.error("[Domestic HarmonyOS HAP Build API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

/**
 * 异步处理 HarmonyOS HAP 构建
 */
async function processHarmonyOSHapBuildAsync(
  buildId: string,
  params: {
    url: string;
    appName: string;
    bundleName: string;
    versionName: string;
    versionCode: string;
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

    // 步骤 1: 生成 HarmonyOS Source
    console.log(`[HarmonyOS HAP Build ${buildId}] Step 1: Generating HarmonyOS Source...`);

    await db.collection("builds").add({
      _id: tempSourceBuildId,
      user_id: params.userId,
      platform: "harmonyos-source",
      app_name: params.appName,
      package_name: params.bundleName,
      url: params.url,
      status: "pending",
      progress: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await processHarmonyOSBuildDomestic(tempSourceBuildId, {
      url: params.url,
      appName: params.appName,
      bundleName: params.bundleName,
      versionName: params.versionName,
      versionCode: params.versionCode,
      privacyPolicy: params.privacyPolicy,
      iconPath: params.iconPath,
    });

    const sourceBuild = await db.collection("builds").doc(tempSourceBuildId).get();
    const sourceData = sourceBuild?.data?.[0];

    if (!sourceData || !sourceData.download_url) {
      console.error(`[HarmonyOS HAP Build ${buildId}] Failed to get download_url`);
      throw new Error("Failed to generate HarmonyOS Source");
    }

    const sourceUrl = sourceData.download_url;
    console.log(`[HarmonyOS HAP Build ${buildId}] HarmonyOS Source generated: ${sourceUrl}`);

    await db.collection("builds").doc(buildId).update({
      progress: 30,
      updated_at: new Date().toISOString(),
    });

    // 步骤 2: 触发 GitHub Actions 构建
    console.log(`[HarmonyOS HAP Build ${buildId}] Step 2: Triggering GitHub Actions...`);

    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/domestic/builds/${buildId}/github-callback`;

    const githubResult = await triggerGitHubBuild({
      buildId,
      sourceUrl,
      callbackUrl,
      platform: "harmonyos-hap",
    });

    if (!githubResult.success) {
      throw new Error(`GitHub Actions trigger failed: ${githubResult.error}`);
    }

    console.log(`[HarmonyOS HAP Build ${buildId}] GitHub Actions triggered successfully`);

    await db.collection("builds").doc(buildId).update({
      status: "processing",
      progress: 50,
      github_build_triggered: true,
      github_run_id: githubResult.runId || null,
      updated_at: new Date().toISOString(),
    });

    await db.collection("builds").doc(tempSourceBuildId).delete().catch(() => {});

  } catch (error) {
    console.error(`[HarmonyOS HAP Build ${buildId}] Error:`, error);

    await db.collection("builds").doc(buildId).update({
      status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown error",
      updated_at: new Date().toISOString(),
    });

    await db.collection("builds").doc(tempSourceBuildId).delete().catch(() => {});
  }
}
