import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { processiOSBuild } from "@/lib/services/ios-builder";

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
    const bundleId = formData.get("bundleId") as string;
    const versionString = formData.get("versionString") as string || "1.0.0";
    const buildNumber = formData.get("buildNumber") as string || "1";
    const privacyPolicy = formData.get("privacyPolicy") as string || "";
    const icon = formData.get("icon") as File | null;

    // Validate required fields
    if (!url || !appName || !bundleId) {
      return NextResponse.json(
        { error: "Missing required fields", message: "url, appName, and bundleId are required" },
        { status: 400 }
      );
    }

    // Validate bundle ID format
    const bundleIdRegex = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i;
    if (!bundleIdRegex.test(bundleId)) {
      return NextResponse.json(
        { error: "Invalid bundle ID", message: "Bundle ID should be in format: com.example.app" },
        { status: 400 }
      );
    }

    // Get service client for database operations
    const serviceClient = createServiceClient();

    // Upload icon if provided
    let iconPath: string | null = null;
    if (icon && icon.size > 0) {
      const iconBuffer = Buffer.from(await icon.arrayBuffer());

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
        package_name: bundleId,  // 使用 package_name 字段存储 bundleId
        version_name: versionString,  // 版本号，如 "1.0.0"
        version_code: buildNumber,    // 构建号，如 "1"
        privacy_policy: privacyPolicy,
        url: url,
        platform: "ios",
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

    // 使用 waitUntil 确保后台任务在函数返回后继续执行
    waitUntil(
      processiOSBuild(buildId, {
        url,
        appName,
        bundleId,
        versionString,
        buildNumber,
        privacyPolicy,
        iconPath,
      }).catch((err) => {
        console.error(`[API] iOS build process error for ${buildId}:`, err);
      })
    );

    // 立即返回，让前端可以开始轮询进度
    return NextResponse.json({
      success: true,
      buildId: buildId,
      message: "iOS build task created successfully",
    });
  } catch (error) {
    console.error("iOS Build API error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
