import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { processAndroidBuild } from "@/lib/services/android-builder";
import { isIconUploadEnabled, validateImageSize } from "@/lib/config/upload";
import { deductBuildQuota, checkBuildQuota } from "@/services/wallet-supabase";

// 增加函数执行时间限制（Vercel Pro: 最大 300 秒）
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please login to create a build" },
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

    // Get service client for database operations
    const serviceClient = createServiceClient();

    // Check and deduct build quota
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

    // Deduct quota before starting build
    const deductResult = await deductBuildQuota(user.id, 1);
    if (!deductResult.success) {
      return NextResponse.json(
        {
          error: "Quota deduction failed",
          message: deductResult.error || "Failed to deduct build quota",
        },
        { status: 500 }
      );
    }

    // Upload icon if provided and enabled
    let iconPath: string | null = null;
    if (icon && icon.size > 0) {
      // Check if icon upload is enabled
      if (!isIconUploadEnabled()) {
        return NextResponse.json(
          { error: "Icon upload disabled", message: "Icon upload is currently disabled" },
          { status: 400 }
        );
      }

      // Validate icon size
      const sizeValidation = validateImageSize(icon.size);
      if (!sizeValidation.valid) {
        return NextResponse.json(
          { error: "Icon too large", message: `Icon size (${sizeValidation.fileSizeMB}MB) exceeds limit (${sizeValidation.maxSizeMB}MB)` },
          { status: 400 }
        );
      }

      const iconBuffer = Buffer.from(await icon.arrayBuffer());

      // 获取文件扩展名，确保使用安全的文件名（避免中文等特殊字符）
      const fileExt = icon.name.split(".").pop()?.toLowerCase() || "png";
      const safeFileName = `icon_${Date.now()}.${fileExt}`;
      const iconFileName = `icons/${user.id}/${safeFileName}`;

      const { error: uploadError } = await serviceClient.storage
        .from("user-builds")
        .upload(iconFileName, iconBuffer, {
          contentType: icon.type,
          upsert: true,
        });

      if (uploadError) {
        console.error("Icon upload error:", uploadError);
      } else {
        iconPath = iconFileName;
        console.log("Icon uploaded successfully:", iconPath);
      }
    }

    // Create build record
    const { data: build, error: insertError } = await serviceClient
      .from("builds")
      .insert({
        user_id: user.id,
        app_name: appName,
        package_name: packageName,
        version_name: versionName,
        version_code: versionCode,
        privacy_policy: privacyPolicy,
        url: url,
        platform: "android",
        status: "pending",
        progress: 0,
        icon_path: iconPath,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Database insert error:", insertError);
      return NextResponse.json(
        { error: "Database error", message: "Failed to create build record" },
        { status: 500 }
      );
    }

    // 立即返回 buildId，让前端跳转到构建列表页
    // 然后在后台异步执行构建过程
    const buildId = build.id;

    // 使用 waitUntil 确保后台任务在函数返回后继续执行
    // 这是 Vercel 提供的 API，用于处理 serverless 函数的后台任务
    waitUntil(
      processAndroidBuild(buildId, {
        url,
        appName,
        packageName,
        versionName,
        versionCode,
        privacyPolicy,
        iconPath,
      }).catch((err) => {
        console.error(`[API] Build process error for ${buildId}:`, err);
      })
    );

    // 立即返回，让前端可以开始轮询进度
    return NextResponse.json({
      success: true,
      buildId: buildId,
      message: "Build task created successfully",
    });
  } catch (error) {
    console.error("Build API error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
