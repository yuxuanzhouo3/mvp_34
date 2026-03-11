/**
 * 客户端图标上传工具
 * 国际版：直接上传到 Supabase Storage，避免在 API 请求体中传输大量 base64 数据
 * 国内版：返回文件对象，由后端API处理上传到CloudBase
 * 解决 Vercel 4.5MB 请求体限制问题
 */

import { createClient } from "@/lib/supabase/client";

export interface IconUploadResult {
  success: boolean;
  url?: string;
  error?: string;
  file?: File; // 国内版返回文件对象
}

/**
 * 检查是否为国内版
 */
function isDomesticVersion(): boolean {
  return process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE === "zh";
}

/**
 * 上传图标到存储
 * 国际版：上传到 Supabase Storage
 * 国内版：返回文件对象，由后端API处理
 * @param file 图标文件
 * @param userId 用户 ID
 * @param platform 平台名称（用于生成唯一文件名）
 * @returns 上传结果，包含公开访问 URL 或文件对象
 */
export async function uploadIconToStorage(
  file: File,
  userId: string,
  platform: string
): Promise<IconUploadResult> {
  try {
    // 国内版：直接返回文件对象，由后端API处理上传
    if (isDomesticVersion()) {
      return {
        success: true,
        file: file,
      };
    }

    // 国际版：上传到 Supabase Storage
    const supabase = createClient();
    if (!supabase) {
      return { success: false, error: "Supabase client not initialized" };
    }

    // 生成唯一文件名：userId/timestamp-platform.ext
    const timestamp = Date.now();
    const ext = file.name.split(".").pop() || "png";
    const fileName = `${userId}/${timestamp}-${platform}.${ext}`;

    // 上传到 user-icons bucket
    const { data, error } = await supabase.storage
      .from("user-icons")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Icon upload error:", error);
      return { success: false, error: error.message };
    }

    // 获取公开访问 URL
    const { data: urlData } = supabase.storage
      .from("user-icons")
      .getPublicUrl(data.path);

    return {
      success: true,
      url: urlData.publicUrl,
    };
  } catch (error) {
    console.error("Icon upload exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 批量上传图标
 * @param icons 图标文件数组，每个包含 file 和 platform
 * @param userId 用户 ID
 * @returns 上传结果数组
 */
export async function uploadIconsBatch(
  icons: Array<{ file: File; platform: string }>,
  userId: string
): Promise<Array<IconUploadResult & { platform: string }>> {
  const results = await Promise.all(
    icons.map(async ({ file, platform }) => {
      const result = await uploadIconToStorage(file, userId, platform);
      return { ...result, platform };
    })
  );

  return results;
}
