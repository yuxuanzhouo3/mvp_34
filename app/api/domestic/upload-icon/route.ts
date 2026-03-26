/**
 * 国内版图标上传 API
 * 用于在构建表单中立即上传图标到CloudBase
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/domestic/build-helpers";
import { isIconUploadEnabled, validateImageSize } from "@/lib/config/upload";
import { getCloudBaseStorage } from "@/lib/cloudbase/storage";
import { nanoid } from "nanoid";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser();
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: "Unauthorized", message: authResult.error }, { status: authResult.status || 401 });
    }
    const user = authResult.user;

    const formData = await request.formData();
    const icon = formData.get("icon") as File | null;
    const platform = formData.get("platform") as string;

    if (!icon || !platform) {
      return NextResponse.json({ error: "Missing required fields", message: "icon and platform are required" }, { status: 400 });
    }

    if (!isIconUploadEnabled()) {
      return NextResponse.json({ error: "Icon upload disabled" }, { status: 400 });
    }

    const sizeValidation = validateImageSize(icon.size);
    if (!sizeValidation.valid) {
      return NextResponse.json({ error: "Icon too large", message: `Icon size exceeds limit` }, { status: 400 });
    }

    // 生成唯一的图标路径
    const iconId = nanoid();
    const iconPath = `user-builds/temp-icons/${user.id}/${platform}-${iconId}.png`;

    // 上传到CloudBase
    const storage = getCloudBaseStorage();
    const iconBuffer = Buffer.from(await icon.arrayBuffer());
    await storage.uploadFile(iconPath, iconBuffer);

    return NextResponse.json({ success: true, iconPath, message: "Icon uploaded successfully" });
  } catch (error) {
    console.error("[Domestic Upload Icon API] Error:", error);
    return NextResponse.json({ error: "Internal server error", message: "An unexpected error occurred" }, { status: 500 });
  }
}
