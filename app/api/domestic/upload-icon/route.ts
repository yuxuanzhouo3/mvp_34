/**
 * 国内版图标上传 API
 * 用于在构建表单中立即上传图标到CloudBase
 * 支持 Supabase 和 CloudBase 双认证
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/domestic/build-helpers";
import { createClient } from "@/lib/supabase/server";
import { isIconUploadEnabled, validateImageSize } from "@/lib/config/upload";
import { getCloudBaseStorage } from "@/lib/cloudbase/storage";
import { nanoid } from "nanoid";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // 认证：优先 Supabase，兜底 CloudBase
    let userId: string | null = null;

    // 尝试 Supabase 认证
    try {
      const supabase = await createClient();
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      if (supabaseUser) {
        userId = supabaseUser.id;
      }
    } catch {
      // Supabase 认证失败，继续尝试 CloudBase
    }

    // 兜底 CloudBase 认证
    if (!userId) {
      const authResult = await authenticateUser();
      if (authResult.success && authResult.user) {
        userId = authResult.user.id;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", message: "Please login" }, { status: 401 });
    }

    const user = { id: userId };

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
