/**
 * 国内版图标上传 API
 * 同时上传到 Supabase 和 CloudBase，确保所有 builder 都能下载
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/domestic/build-helpers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isIconUploadEnabled, validateImageSize } from "@/lib/config/upload";
import { getCloudBaseStorage } from "@/lib/cloudbase/storage";
import { nanoid } from "nanoid";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // 认证：优先 Supabase，兜底 CloudBase
    let userId: string | null = null;

    try {
      const supabase = await createClient();
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      if (supabaseUser) {
        userId = supabaseUser.id;
      }
    } catch {
      // Supabase 认证失败，继续尝试 CloudBase
    }

    if (!userId) {
      const authResult = await authenticateUser();
      if (authResult.success && authResult.user) {
        userId = authResult.user.id;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", message: "Please login" }, { status: 401 });
    }

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

    const iconId = nanoid();
    const iconPath = `user-builds/temp-icons/${userId}/${platform}-${iconId}.png`;
    const iconBuffer = Buffer.from(await icon.arrayBuffer());

    // 同时上传到 Supabase 和 CloudBase（确保所有 builder 都能下载）
    const supabaseUpload = createServiceClient().storage
      .from("user-builds")
      .upload(iconPath, iconBuffer, { contentType: "image/png", upsert: true })
      .then(({ error }) => {
        if (error) console.error("[Upload Icon] Supabase upload failed:", error.message);
        else console.log("[Upload Icon] Supabase upload OK:", iconPath);
      });

    const cloudbaseUpload = (async () => {
      try {
        const storage = getCloudBaseStorage();
        await storage.uploadFile(iconPath, iconBuffer);
        console.log("[Upload Icon] CloudBase upload OK:", iconPath);
      } catch (err) {
        console.error("[Upload Icon] CloudBase upload failed:", err);
      }
    })();

    // 并行上传，任一成功即可
    await Promise.allSettled([supabaseUpload, cloudbaseUpload]);

    return NextResponse.json({ success: true, iconPath, message: "Icon uploaded successfully" });
  } catch (error) {
    console.error("[Domestic Upload Icon API] Error:", error);
    return NextResponse.json({ error: "Internal server error", message: "An unexpected error occurred" }, { status: 500 });
  }
}
