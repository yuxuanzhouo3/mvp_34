/**
 * 国内版图标删除 API
 * 用于删除临时上传的图标
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/domestic/build-helpers";
import { getCloudBaseStorage } from "@/lib/cloudbase/storage";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser();
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: "Unauthorized", message: authResult.error }, { status: authResult.status || 401 });
    }

    const { iconPath } = await request.json();

    if (!iconPath) {
      return NextResponse.json({ error: "Missing required fields", message: "iconPath is required" }, { status: 400 });
    }

    // 删除CloudBase中的文件
    const storage = getCloudBaseStorage();
    await storage.deleteFile(iconPath);

    return NextResponse.json({ success: true, message: "Icon deleted successfully" });
  } catch (error) {
    console.error("[Domestic Delete Icon API] Error:", error);
    return NextResponse.json({ error: "Internal server error", message: "An unexpected error occurred" }, { status: 500 });
  }
}
