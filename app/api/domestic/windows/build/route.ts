/**
 * 国内版 Windows 构建 API
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, checkAndDeductQuota, createBuildRecord, updateBuildStatus } from "@/lib/domestic/build-helpers";
import { processWindowsExeBuild } from "@/lib/services/windows-exe-builder";
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
    const iconFile = formData.get("icon") as File | null;

    if (!url || !appName) {
      return NextResponse.json({ error: "Missing required fields", message: "url and appName are required" }, { status: 400 });
    }

    // 预校验图标（避免先扣额度后失败）
    if (iconFile && iconFile.size > 0) {
      if (!isIconUploadEnabled()) {
        return NextResponse.json({ error: "Icon upload disabled", message: "Icon upload is currently disabled" }, { status: 400 });
      }

      const sizeValidation = validateImageSize(iconFile.size);
      if (!sizeValidation.valid) {
        return NextResponse.json(
          { error: "Icon too large", message: `Icon size (${sizeValidation.fileSizeMB}MB) exceeds limit (${sizeValidation.maxSizeMB}MB)` },
          { status: 400 }
        );
      }
    }

    const quotaResult = await checkAndDeductQuota(user.id, 1);
    if (!quotaResult.success) {
      return NextResponse.json({ error: "Quota exceeded", message: quotaResult.error }, { status: 429 });
    }

    // 上传图标（如果提供）
    let iconPath: string | null = null;
    if (iconFile && iconFile.size > 0) {
      try {
        const iconBuffer = Buffer.from(await iconFile.arrayBuffer());
        const fileExt = iconFile.name.split(".").pop()?.toLowerCase() || "png";
        const safeFileName = `icon_${Date.now()}.${fileExt}`;
        iconPath = `user-builds/icons/${user.id}/${safeFileName}`;

        const storage = getCloudBaseStorage();
        await storage.uploadFile(iconPath, iconBuffer);
        console.log("[Domestic Windows Build] Icon uploaded successfully:", iconPath);
      } catch (iconError) {
        console.warn("[Domestic Windows Build] Icon upload failed:", iconError);
        // 图标上传失败不影响构建继续
      }
    }

    const buildResult = await createBuildRecord({ userId: user.id, platform: "windows", appName, url, iconPath });

    if (!buildResult.success || !buildResult.buildId) {
      return NextResponse.json({ error: "Failed to create build", message: buildResult.error }, { status: 500 });
    }

    processWindowsBuildAsync(buildResult.buildId, { url, appName, iconPath }).catch(console.error);

    return NextResponse.json({ success: true, buildId: buildResult.buildId, message: "Build started successfully", status: "pending" });
  } catch (error) {
    console.error("[Domestic Windows Build API] Error:", error);
    return NextResponse.json({ error: "Internal server error", message: "An unexpected error occurred" }, { status: 500 });
  }
}

async function processWindowsBuildAsync(buildId: string, params: { url: string; appName: string; iconPath: string | null }) {
  try {
    await updateBuildStatus(buildId, "processing");
    await processWindowsExeBuild(buildId, { url: params.url, appName: params.appName, iconPath: params.iconPath });
  } catch (error) {
    await updateBuildStatus(buildId, "failed", { error_message: error instanceof Error ? error.message : "Unknown error" });
  }
}
