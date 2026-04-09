/**
 * iOS IPA 构建 API（兼容国际版 Supabase 认证）
 * 使用 GitHub Actions 编译 IPA
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { deductBuildQuota, checkBuildQuota, getEffectiveSupabaseUserWallet, refundBuildQuota } from "@/services/wallet-supabase";
import { getPlanBuildExpireDays } from "@/utils/plan-limits";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { processiOSBuild } from "@/lib/services/ios-builder";
import { triggerGitHubBuild } from "@/lib/services/github-builder";
import { waitUntil } from "@vercel/functions";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份（Supabase 认证）
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please login to create a build" },
        { status: 401 }
      );
    }

    // 2. 解析表单数据
    const formData = await request.formData();
    const url = formData.get("url") as string;
    const appName = formData.get("appName") as string;
    const bundleId = formData.get("bundleId") as string || `com.${(appName || "app").toLowerCase().replace(/[^a-z0-9]/g, "")}.ios`;
    const versionString = formData.get("versionString") as string || "1.0.0";
    const buildNumber = formData.get("buildNumber") as string || "1";
    const privacyPolicy = formData.get("privacyPolicy") as string || "";
    const preUploadedIconPath = formData.get("iconPath") as string | null;

    // 3. 验证必填字段
    if (!url || !appName) {
      return NextResponse.json(
        { error: "Missing required fields", message: "url and appName are required" },
        { status: 400 }
      );
    }

    // 4. 检查配额
    const quotaCheck = await checkBuildQuota(user.id, 1);
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

    // 5. 扣除配额
    const deductResult = await deductBuildQuota(user.id, 1);
    if (!deductResult.success) {
      return NextResponse.json(
        { error: "Quota deduction failed", message: deductResult.error || "Failed to deduct build quota" },
        { status: 500 }
      );
    }

    // 6. 计算过期时间
    const wallet = await getEffectiveSupabaseUserWallet(user.id);
    const expireDays = getPlanBuildExpireDays(wallet?.plan || "Free");
    const expiresAt = new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000).toISOString();

    // 7. 创建构建记录
    const serviceClient = createServiceClient();
    const { data: build, error: insertError } = await serviceClient
      .from("builds")
      .insert({
        user_id: user.id,
        platform: "ios-ipa",
        status: "pending",
        progress: 0,
        app_name: appName,
        package_name: bundleId,
        version_name: versionString,
        version_code: buildNumber,
        url: url,
        privacy_policy: privacyPolicy,
        icon_path: preUploadedIconPath,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (insertError || !build) {
      console.error("[iOS IPA Build] Database insert error:", insertError);
      await refundBuildQuota(user.id, 1);
      return NextResponse.json(
        { error: "Database error", message: "Failed to create build record" },
        { status: 500 }
      );
    }

    const buildId = build.id;
    console.log(`[iOS IPA Build] Build record created: ${buildId}`);

    // 同步创建 CloudBase 记录（国内版 UI 从 CloudBase 读取）
    try {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();
      await db.collection("builds").add({
        _id: buildId,
        user_id: user.id,
        platform: "ios-ipa",
        status: "pending",
        progress: 0,
        app_name: appName,
        package_name: bundleId,
        version_name: versionString,
        version_code: buildNumber,
        url: url,
        privacy_policy: privacyPolicy,
        icon_path: preUploadedIconPath,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      console.log(`[iOS IPA Build] CloudBase record synced: ${buildId}`);
    } catch (cbError) {
      console.error(`[iOS IPA Build] CloudBase sync failed:`, cbError);
    }

    // 8. 异步处理构建（立即返回给用户）
    waitUntil(processIOSIpaBuildAsync(serviceClient, buildId, {
      url, appName, bundleId, versionString, buildNumber, privacyPolicy,
      iconPath: preUploadedIconPath, userId: user.id,
    }));

    // 触发额度刷新
    return NextResponse.json({
      success: true,
      buildIds: [buildId],
      message: "iOS IPA build started",
    });
  } catch (error) {
    console.error("[iOS IPA Build API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

/**
 * 同步更新 CloudBase 构建进度（非阻塞）
 */
async function syncCloudBaseProgress(buildId: string, data: Record<string, any>) {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();
    await db.collection("builds").doc(buildId).update({
      ...data,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    // 非关键路径，不阻塞主流程
  }
}

/**
 * 异步处理 iOS IPA 构建
 */
async function processIOSIpaBuildAsync(
  serviceClient: ReturnType<typeof createServiceClient>,
  buildId: string,
  params: {
    url: string; appName: string; bundleId: string;
    versionString: string; buildNumber: string; privacyPolicy: string;
    iconPath: string | null; userId: string;
  }
) {
  try {
    // 更新状态为处理中
    await serviceClient.from("builds").update({
      status: "processing", progress: 10, updated_at: new Date().toISOString(),
    }).eq("id", buildId);
    syncCloudBaseProgress(buildId, { status: "processing", progress: 10 });

    // 步骤 1: 生成 iOS Source
    console.log(`[iOS IPA Build ${buildId}] Step 1: Generating iOS Source...`);
    await processiOSBuild(buildId, {
      url: params.url,
      appName: params.appName,
      bundleId: params.bundleId,
      versionString: params.versionString,
      buildNumber: params.buildNumber,
      privacyPolicy: params.privacyPolicy,
      iconPath: params.iconPath,
    }, { skipFinalStatus: true });

    // 获取生成的源文件路径（ios-builder 存的是 output_file_path，不是 download_url）
    const { data: sourceBuild } = await serviceClient
      .from("builds").select("output_file_path, status").eq("id", buildId).single();

    if (!sourceBuild?.output_file_path || sourceBuild.status === "failed") {
      throw new Error("Failed to generate iOS Source - build failed or no output file");
    }

    // 从 Storage 生成临时下载链接（1小时有效）
    const { data: signedData } = await serviceClient.storage
      .from("user-builds")
      .createSignedUrl(sourceBuild.output_file_path, 3600);

    if (!signedData?.signedUrl) {
      throw new Error("Failed to generate download URL for iOS Source");
    }

    const sourceUrl = signedData.signedUrl;
    console.log(`[iOS IPA Build ${buildId}] Source generated: ${sourceUrl.substring(0, 80)}...`);

    await serviceClient.from("builds").update({
      progress: 96, updated_at: new Date().toISOString(),
    }).eq("id", buildId);
    syncCloudBaseProgress(buildId, { progress: 96 });

    // 步骤 2: 触发 GitHub Actions 构建
    console.log(`[iOS IPA Build ${buildId}] Step 2: Triggering GitHub Actions...`);
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/domestic/builds/${buildId}/github-callback`;

    const githubResult = await triggerGitHubBuild({
      buildId, sourceUrl, callbackUrl, platform: "ios-ipa",
    });

    if (!githubResult.success) {
      throw new Error(`GitHub Actions trigger failed: ${githubResult.error}`);
    }

    console.log(`[iOS IPA Build ${buildId}] GitHub Actions triggered, runId: ${githubResult.runId}`);
    await serviceClient.from("builds").update({
      status: "processing", progress: 97,
      github_run_id: githubResult.runId || null,
      updated_at: new Date().toISOString(),
    }).eq("id", buildId);
    syncCloudBaseProgress(buildId, { status: "processing", progress: 97, github_run_id: githubResult.runId || null });

  } catch (error) {
    console.error(`[iOS IPA Build ${buildId}] Error:`, error);
    await serviceClient.from("builds").update({
      status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown error",
      updated_at: new Date().toISOString(),
    }).eq("id", buildId);
    syncCloudBaseProgress(buildId, {
      status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown error",
    });

    await refundBuildQuota(params.userId, 1);
  }
}
