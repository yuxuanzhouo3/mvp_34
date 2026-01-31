import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { processWindowsExeBuild } from "@/lib/services/windows-exe-builder";
import { isIconUploadEnabled, validateImageSize } from "@/lib/config/upload";
import { deductBuildQuota, checkBuildQuota, getEffectiveSupabaseUserWallet, refundBuildQuota } from "@/services/wallet-supabase";
import { getPlanBuildExpireDays } from "@/utils/plan-limits";

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
    const iconFile = formData.get("icon") as File | null;

    // Validate required fields
    if (!url || !appName) {
      return NextResponse.json(
        { error: "Missing required fields", message: "url and appName are required" },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL", message: "Please provide a valid URL" },
        { status: 400 }
      );
    }

    // 预校验图标（避免先扣额度后失败）
    if (iconFile && iconFile.size > 0) {
      if (!isIconUploadEnabled()) {
        return NextResponse.json(
          { error: "Icon upload disabled", message: "Icon upload is currently disabled" },
          { status: 400 }
        );
      }

      const sizeValidation = validateImageSize(iconFile.size);
      if (!sizeValidation.valid) {
        return NextResponse.json(
          { error: "Icon too large", message: `Icon size (${sizeValidation.fileSizeMB}MB) exceeds limit (${sizeValidation.maxSizeMB}MB)` },
          { status: 400 }
        );
      }
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

    const deductResult = await deductBuildQuota(user.id, 1);
    if (!deductResult.success) {
      return NextResponse.json(
        { error: "Quota deduction failed", message: deductResult.error || "Failed to deduct build quota" },
        { status: 500 }
      );
    }

    // Upload icon if provided and enabled
    let iconPath: string | null = null;
    if (iconFile && iconFile.size > 0) {
      const iconBuffer = Buffer.from(await iconFile.arrayBuffer());

      // 获取文件扩展名，确保使用安全的文件名（避免中文等特殊字符）
      const fileExt = iconFile.name.split(".").pop()?.toLowerCase() || "png";
      const safeFileName = `icon_${Date.now()}.${fileExt}`;
      const iconFileName = `icons/${user.id}/${safeFileName}`;

      const { error: iconUploadError } = await serviceClient.storage
        .from("user-builds")
        .upload(iconFileName, iconBuffer, {
          contentType: iconFile.type,
          upsert: true,
        });

      if (iconUploadError) {
        console.warn("Failed to upload icon:", iconUploadError);
        // Continue without icon
      } else {
        iconPath = iconFileName;
        console.log("Icon uploaded successfully:", iconPath);
      }
    }

    // Get user's subscription plan to calculate expires_at
    const wallet = await getEffectiveSupabaseUserWallet(user.id);
    const expireDays = getPlanBuildExpireDays(wallet?.plan || "Free");
    const expiresAt = new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000).toISOString();

    // Create build record
    const { data: build, error: insertError } = await serviceClient
      .from("builds")
      .insert({
        user_id: user.id,
        app_name: appName,
        package_name: appName.replace(/\s+/g, "-").toLowerCase(),
        url: url,
        platform: "windows",
        status: "pending",
        progress: 0,
        version_name: "1.0.0",
        version_code: "1",
        icon_path: iconPath,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Database insert error:", insertError);
      await refundBuildQuota(user.id, 1);
      return NextResponse.json(
        { error: "Database error", message: "Failed to create build record" },
        { status: 500 }
      );
    }

    const buildId = build.id;

    // 使用 waitUntil 确保后台任务在函数返回后继续执行
    waitUntil(
      processWindowsExeBuild(buildId, {
        url,
        appName,
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
