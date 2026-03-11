/**
 * 国内版 macOS 构建 API
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, checkAndDeductQuota, createBuildRecord, updateBuildStatus } from "@/lib/domestic/build-helpers";
import { processMacOSAppBuildDomestic } from "@/lib/services/domestic/macos-app-builder";
import { isIconUploadEnabled, validateImageSize } from "@/lib/config/upload";
import { getCloudBaseStorage } from "@/lib/cloudbase/storage";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser();
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: "Unauthorized", message: authResult.error }, { status: authResult.status || 401 });
    }
    const user = authResult.user;

    const formData = await request.formData();
    const url = formData.get("url") as string;
    const appName = formData.get("appName") as string;
    const icon = formData.get("icon") as File | null;

    if (!url || !appName) {
      return NextResponse.json({ error: "Missing required fields", message: "url and appName are required" }, { status: 400 });
    }

    if (icon && icon.size > 0) {
      if (!isIconUploadEnabled()) {
        return NextResponse.json({ error: "Icon upload disabled" }, { status: 400 });
      }
      const sizeValidation = validateImageSize(icon.size);
      if (!sizeValidation.valid) {
        return NextResponse.json({ error: "Icon too large", message: `Icon size exceeds limit` }, { status: 400 });
      }
    }

    const quotaResult = await checkAndDeductQuota(user.id, 1);
    if (!quotaResult.success) {
      return NextResponse.json({ error: "Quota exceeded", message: quotaResult.error }, { status: 429 });
    }

    const buildResult = await createBuildRecord({ userId: user.id, platform: "macos", appName, url });

    if (!buildResult.success || !buildResult.buildId) {
      return NextResponse.json({ error: "Failed to create build", message: buildResult.error }, { status: 500 });
    }

    const buildId = buildResult.buildId;
    let iconPath: string | null = null;
    if (icon && icon.size > 0) {
      try {
        const storage = getCloudBaseStorage();
        const iconBuffer = Buffer.from(await icon.arrayBuffer());
        iconPath = `user-builds/builds/${buildId}/icon.png`;
        await storage.uploadFile(iconPath, iconBuffer);
        await updateBuildStatus(buildId, "pending", { icon_path: iconPath });
      } catch (error) {
        console.error("[Domestic macOS Build] Icon upload error:", error);
      }
    }

    processMacosBuildAsync(buildId, { url, appName, iconPath }).catch(console.error);

    return NextResponse.json({ success: true, buildId: buildResult.buildId, message: "Build started successfully", status: "pending" });
  } catch (error) {
    console.error("[Domestic macOS Build API] Error:", error);
    return NextResponse.json({ error: "Internal server error", message: "An unexpected error occurred" }, { status: 500 });
  }
}

async function processMacosBuildAsync(buildId: string, params: { url: string; appName: string; iconPath: string | null }) {
  try {
    await updateBuildStatus(buildId, "processing");
    await processMacOSAppBuildDomestic(buildId, { url: params.url, appName: params.appName, iconPath: params.iconPath });
  } catch (error) {
    await updateBuildStatus(buildId, "failed", { error_message: error instanceof Error ? error.message : "Unknown error" });
  }
}
