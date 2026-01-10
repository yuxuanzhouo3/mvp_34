import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { processWechatBuild } from "@/lib/services/wechat-builder";
import { deductBuildQuota, checkBuildQuota, getSupabaseUserWallet } from "@/services/wallet-supabase";
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
    const appId = formData.get("appId") as string;
    const version = (formData.get("version") as string) || "1.0.0";

    // Validate required fields
    if (!url || !appName || !appId) {
      return NextResponse.json(
        { error: "Missing required fields", message: "url, appName, and appId are required" },
        { status: 400 }
      );
    }

    // Validate AppID format (wx + 16 hex characters)
    const appIdRegex = /^wx[a-f0-9]{16}$/i;
    if (!appIdRegex.test(appId)) {
      return NextResponse.json(
        { error: "Invalid AppID", message: "AppID should be in format: wx + 16 hex characters" },
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

    const deductResult = await deductBuildQuota(user.id, 1);
    if (!deductResult.success) {
      return NextResponse.json(
        { error: "Quota deduction failed", message: deductResult.error || "Failed to deduct build quota" },
        { status: 500 }
      );
    }

    // Get user's subscription plan to calculate expires_at
    const wallet = await getSupabaseUserWallet(user.id);
    const expireDays = getPlanBuildExpireDays(wallet?.plan || "Free");
    const expiresAt = new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000).toISOString();

    // Create build record
    const { data: build, error: insertError } = await serviceClient
      .from("builds")
      .insert({
        user_id: user.id,
        app_name: appName,
        package_name: appId, // Using package_name field for appId
        url: url,
        platform: "wechat",
        status: "pending",
        progress: 0,
        version_name: version,
        version_code: "1", // Required field, use "1" for WeChat
        expires_at: expiresAt,
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
    const buildId = build.id;

    // 使用 waitUntil 确保后台任务在函数返回后继续执行
    waitUntil(
      processWechatBuild(buildId, {
        url,
        appName,
        appId,
        version,
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
