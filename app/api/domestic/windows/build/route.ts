/**
 * 国内版 Windows 构建 API
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, checkAndDeductQuota, createBuildRecord, updateBuildStatus } from "@/lib/domestic/build-helpers";
import { processWindowsExeBuild } from "@/lib/services/windows-exe-builder";

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

    if (!url || !appName) {
      return NextResponse.json({ error: "Missing required fields", message: "url and appName are required" }, { status: 400 });
    }

    const quotaResult = await checkAndDeductQuota(user.id, 1);
    if (!quotaResult.success) {
      return NextResponse.json({ error: "Quota exceeded", message: quotaResult.error }, { status: 429 });
    }

    const buildResult = await createBuildRecord({ userId: user.id, platform: "windows", appName, url });

    if (!buildResult.success || !buildResult.buildId) {
      return NextResponse.json({ error: "Failed to create build", message: buildResult.error }, { status: 500 });
    }

    processWindowsBuildAsync(buildResult.buildId, { url, appName }).catch(console.error);

    return NextResponse.json({ success: true, buildId: buildResult.buildId, message: "Build started successfully", status: "pending" });
  } catch (error) {
    console.error("[Domestic Windows Build API] Error:", error);
    return NextResponse.json({ error: "Internal server error", message: "An unexpected error occurred" }, { status: 500 });
  }
}

async function processWindowsBuildAsync(buildId: string, params: { url: string; appName: string }) {
  try {
    await updateBuildStatus(buildId, "processing");
    await processWindowsExeBuild(buildId, { url: params.url, appName: params.appName, iconPath: null });
  } catch (error) {
    await updateBuildStatus(buildId, "failed", { error_message: error instanceof Error ? error.message : "Unknown error" });
  }
}
