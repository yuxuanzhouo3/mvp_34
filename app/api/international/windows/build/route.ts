import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { processWindowsExeBuild } from "@/lib/services/windows-exe-builder";
import { isIconUploadEnabled, validateImageSize } from "@/lib/config/upload";

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

    // Get service client for database operations
    const serviceClient = createServiceClient();

    // Upload icon if provided and enabled
    let iconPath: string | null = null;
    if (iconFile && iconFile.size > 0) {
      // Check if icon upload is enabled
      if (!isIconUploadEnabled()) {
        return NextResponse.json(
          { error: "Icon upload disabled", message: "Icon upload is currently disabled" },
          { status: 400 }
        );
      }

      // Validate icon size
      const sizeValidation = validateImageSize(iconFile.size);
      if (!sizeValidation.valid) {
        return NextResponse.json(
          { error: "Icon too large", message: `Icon size (${sizeValidation.fileSizeMB}MB) exceeds limit (${sizeValidation.maxSizeMB}MB)` },
          { status: 400 }
        );
      }

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
