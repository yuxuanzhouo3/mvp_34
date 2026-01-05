import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { processChromeExtensionBuild } from "@/lib/services/chrome-extension-builder";

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
    const versionName = formData.get("versionName") as string || "1.0.0";
    const description = formData.get("description") as string || "";
    const icon = formData.get("icon") as File | null;

    // Validate required fields
    if (!url || !appName) {
      return NextResponse.json(
        { error: "Missing required fields", message: "url and appName are required" },
        { status: 400 }
      );
    }

    // Get service client for database operations
    const serviceClient = createServiceClient();

    // Upload icon if provided
    let iconPath: string | null = null;
    if (icon && icon.size > 0) {
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
        package_name: `chrome.extension.${appName.toLowerCase().replace(/\s+/g, '')}`,
        version_name: versionName,
        version_code: "1",
        privacy_policy: description,
        url: url,
        platform: "chrome",
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

    const buildId = build.id;

    // 同步执行构建过程（Chrome 扩展构建较快，不需要后台执行）
    try {
      await processChromeExtensionBuild(buildId, {
        url,
        appName,
        versionName,
        description,
        iconPath,
      });
    } catch (err) {
      console.error(`[API] Build process error for ${buildId}:`, err);
      // 构建失败时，processChromeExtensionBuild 内部已经更新了状态
    }

    return NextResponse.json({
      success: true,
      buildId: buildId,
      message: "Build task completed",
    });
  } catch (error) {
    console.error("Build API error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
