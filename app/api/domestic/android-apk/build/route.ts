/**
 * 国内版 Android APK 构建 API（兼容国际版 Supabase 认证）
 * 使用 GitHub Actions 编译 APK
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { deductBuildQuota, checkBuildQuota, getEffectiveSupabaseUserWallet, refundBuildQuota } from "@/services/wallet-supabase";
import { getPlanBuildExpireDays } from "@/utils/plan-limits";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { processAndroidBuild } from "@/lib/services/android-builder";
import { triggerGitHubBuild } from "@/lib/services/github-builder";
import { waitUntil } from "@vercel/functions";

export const maxDuration = 300; // APK 构建需要更长时间

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
    const packageName = formData.get("packageName") as string;
    const versionName = formData.get("versionName") as string || "1.0.0";
    const versionCode = formData.get("versionCode") as string || "1";
    const privacyPolicy = formData.get("privacyPolicy") as string || "";
    const preUploadedIconPath = formData.get("iconPath") as string | null;
    const iconUrl = formData.get("iconUrl") as string | null;
    const iconFile = formData.get("iconFile") as File | null;

    // 调试信息：记录所有图标来源（将保存到构建记录中）
    const iconDebugInfo = {
      hasIconFile: !!iconFile,
      iconFileSize: iconFile?.size || 0,
      iconFileName: iconFile?.name || null,
      iconFileType: iconFile?.type || null,
      hasIconPath: !!preUploadedIconPath,
      iconPath: preUploadedIconPath,
      hasIconUrl: !!iconUrl,
      iconUrl: iconUrl?.substring(0, 100) || null,
    };
    console.log(`[Android APK Build] Icon debug info:`, JSON.stringify(iconDebugInfo));

    // 将图标文件转为 Buffer（直接从 FormData 获取，绕过所有存储上传链路）
    let iconBuffer: Buffer | null = null;
    if (iconFile && iconFile.size > 500) {
      iconBuffer = Buffer.from(await iconFile.arrayBuffer());
      console.log(`[Android APK Build] ✅ Icon file received directly, size: ${iconBuffer.length} bytes`);
    } else if (iconFile) {
      console.warn(`[Android APK Build] ⚠️ Icon file too small (${iconFile.size} bytes), ignoring - likely corrupt`);
    }

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

    // 5. 检查配额
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

    // 6. 扣除配额
    const deductResult = await deductBuildQuota(user.id, 1);
    if (!deductResult.success) {
      return NextResponse.json(
        { error: "Quota deduction failed", message: deductResult.error || "Failed to deduct build quota" },
        { status: 500 }
      );
    }

    // 7. 计算过期时间
    const wallet = await getEffectiveSupabaseUserWallet(user.id);
    const expireDays = getPlanBuildExpireDays(wallet?.plan || "Free");
    const expiresAt = new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000).toISOString();

    // 8. 创建构建记录（Supabase）
    const serviceClient = createServiceClient();
    const { data: build, error: insertError } = await serviceClient
      .from("builds")
      .insert({
        user_id: user.id,
        platform: "android-apk",
        status: "pending",
        progress: 0,
        app_name: appName,
        package_name: packageName,
        version_name: versionName,
        version_code: versionCode,
        url: url,
        privacy_policy: privacyPolicy,
        icon_path: preUploadedIconPath || JSON.stringify(iconDebugInfo),
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (insertError || !build) {
      console.error("[Android APK Build] Database insert error:", insertError);
      await refundBuildQuota(user.id, 1);
      return NextResponse.json(
        { error: "Database error", message: "Failed to create build record" },
        { status: 500 }
      );
    }

    const buildId = build.id;
    console.log(`[Android APK Build] Build record created: ${buildId}`);

    // 同步创建 CloudBase 记录（国内版 UI 从 CloudBase 读取）
    try {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();
      await db.collection("builds").add({
        _id: buildId,
        user_id: user.id,
        platform: "android-apk",
        status: "pending",
        progress: 0,
        app_name: appName,
        package_name: packageName,
        version_name: versionName,
        version_code: versionCode,
        url: url,
        privacy_policy: privacyPolicy,
        icon_path: preUploadedIconPath,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      console.log(`[Android APK Build] CloudBase record synced: ${buildId}`);
    } catch (cbError) {
      console.error(`[Android APK Build] CloudBase sync failed:`, cbError);
    }

    // 9. 异步处理构建
    waitUntil(processAndroidApkBuildAsync(serviceClient, buildId, {
      url, appName, packageName, versionName, versionCode, privacyPolicy,
      iconPath: preUploadedIconPath, iconUrl, iconBuffer, userId: user.id,
    }));

    return NextResponse.json({
      success: true,
      buildId,
      message: "APK build started, estimated time: 3-8 minutes",
      status: "pending",
    });
  } catch (error) {
    console.error("[Android APK Build API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

/**
 * 异步处理 Android APK 构建
 * 流程与 HarmonyOS HAP 一致：Supabase 源码生成 → GitHub Actions 编译
 */
async function processAndroidApkBuildAsync(
  serviceClient: ReturnType<typeof createServiceClient>,
  buildId: string,
  params: {
    url: string;
    appName: string;
    packageName: string;
    versionName: string;
    versionCode: string;
    privacyPolicy: string;
    iconPath: string | null;
    iconUrl: string | null;
    iconBuffer: Buffer | null;
    userId: string;
  }
) {
  try {
    // 步骤 1: 生成 Android Source（使用 Supabase 存储，与鸿蒙一致）
    console.log(`[Android APK Build ${buildId}] Step 1: Generating Android Source...`);
    await processAndroidBuild(buildId, {
      url: params.url,
      appName: params.appName,
      packageName: params.packageName,
      versionName: params.versionName,
      versionCode: params.versionCode,
      privacyPolicy: params.privacyPolicy,
      iconPath: params.iconPath,
      iconUrl: params.iconUrl,
      iconBuffer: params.iconBuffer,
    }, { skipFinalStatus: true });

    // 获取生成的源文件路径（从 Supabase 读取）
    const { data: sourceBuild } = await serviceClient
      .from("builds").select("output_file_path, status").eq("id", buildId).single();

    if (!sourceBuild?.output_file_path || sourceBuild.status === "failed") {
      throw new Error("Failed to generate Android Source - build failed or no output file");
    }

    // 从 Supabase Storage 生成临时下载链接（1小时有效）
    const { data: signedData } = await serviceClient.storage
      .from("user-builds")
      .createSignedUrl(sourceBuild.output_file_path, 3600);

    if (!signedData?.signedUrl) {
      throw new Error("Failed to generate download URL for Android Source");
    }

    const sourceUrl = signedData.signedUrl;
    console.log(`[Android APK Build ${buildId}] Android Source generated: ${sourceUrl.substring(0, 80)}...`);

    await serviceClient.from("builds").update({
      progress: 50, updated_at: new Date().toISOString(),
    }).eq("id", buildId);

    // 步骤 2: 触发 GitHub Actions 构建
    console.log(`[Android APK Build ${buildId}] Step 2: Triggering GitHub Actions...`);
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/domestic/builds/${buildId}/github-callback`;

    const githubResult = await triggerGitHubBuild({
      buildId, sourceUrl, callbackUrl, platform: "android-apk",
    });

    if (!githubResult.success) {
      throw new Error(`GitHub Actions trigger failed: ${githubResult.error}`);
    }

    console.log(`[Android APK Build ${buildId}] GitHub Actions triggered, runId: ${githubResult.runId}`);
    await serviceClient.from("builds").update({
      status: "processing", progress: 97,
      github_run_id: githubResult.runId || null,
      updated_at: new Date().toISOString(),
    }).eq("id", buildId);

    // 同步 github_run_id 到 CloudBase（用于 auto-sync 轮询检测）
    try {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();
      await db.collection("builds").doc(buildId).update({
        github_run_id: githubResult.runId || null,
        progress: 97,
        status: "processing",
        updated_at: new Date().toISOString(),
      });
    } catch (cbError) {
      console.error(`[Android APK Build ${buildId}] CloudBase sync github_run_id failed:`, cbError);
    }

  } catch (error) {
    console.error(`[Android APK Build ${buildId}] Error:`, error);
    await serviceClient.from("builds").update({
      status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown error",
      updated_at: new Date().toISOString(),
    }).eq("id", buildId);

    // 同步失败状态到 CloudBase
    try {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();
      await db.collection("builds").doc(buildId).update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
        updated_at: new Date().toISOString(),
      });
    } catch {
      // ignore CloudBase sync errors
    }

    // 退还配额
    await refundBuildQuota(params.userId, 1);
  }
}
