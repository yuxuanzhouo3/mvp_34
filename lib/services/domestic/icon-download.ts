/**
 * 国内版图标下载工具
 * CloudBase 优先，Supabase 兜底
 */

import { getCloudBaseStorage } from "@/lib/cloudbase/storage";
import { createServiceClient } from "@/lib/supabase/server";

export async function downloadIconBuffer(iconPath: string): Promise<Buffer> {
  // Try CloudBase first
  try {
    const storage = getCloudBaseStorage();
    const buffer = await storage.downloadFile(iconPath);
    if (buffer && buffer.length > 0) {
      console.log(`[Icon Download] CloudBase OK: ${iconPath} (${buffer.length} bytes)`);
      return buffer;
    }
  } catch (err) {
    console.warn(`[Icon Download] CloudBase failed: ${err instanceof Error ? err.message : err}`);
  }

  // Fallback to Supabase
  console.log(`[Icon Download] Trying Supabase fallback: ${iconPath}`);
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage.from("user-builds").download(iconPath);
  if (error || !data) {
    throw new Error(`Icon download failed from both storages: ${error?.message || "no data"}`);
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  if (buffer.length === 0) {
    throw new Error("Downloaded icon buffer is empty from Supabase");
  }
  console.log(`[Icon Download] Supabase OK: ${iconPath} (${buffer.length} bytes)`);
  return buffer;
}
