"use server";

/**
 * 发布版本管理 Server Actions
 * 支持 Supabase (国际版) 和 CloudBase (国内版)
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { revalidatePath } from "next/cache";

export interface Release {
  id: string;
  version: string;
  version_code: number;
  title: string;
  description?: string;
  release_notes?: string;
  download_url?: string;
  download_url_backup?: string;
  file_size?: number;
  file_hash?: string;
  platform: string;
  region: "global" | "cn";
  status: "draft" | "published" | "deprecated";
  is_force_update: boolean;
  min_supported_version?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ReleaseFormData {
  version: string;
  version_code: number;
  title: string;
  description?: string;
  release_notes?: string;
  download_url?: string;
  download_url_backup?: string;
  file_size?: number;
  file_hash?: string;
  platform: string;
  region: string;
  status?: string;
  is_force_update?: boolean;
  min_supported_version?: string;
}

// CloudBase 文档转 Release 接口
function cloudBaseDocToRelease(doc: Record<string, unknown>): Release {
  return {
    id: (doc._id as string) || "",
    version: (doc.version as string) || "",
    version_code: (doc.version_code as number) || 0,
    title: (doc.title as string) || "",
    description: doc.description as string | undefined,
    release_notes: doc.release_notes as string | undefined,
    download_url: doc.download_url as string | undefined,
    download_url_backup: doc.download_url_backup as string | undefined,
    file_size: doc.file_size as number | undefined,
    file_hash: doc.file_hash as string | undefined,
    platform: (doc.platform as string) || "",
    region: (doc.region as "global" | "cn") || "cn",
    status: (doc.status as "draft" | "published" | "deprecated") || "draft",
    is_force_update: (doc.is_force_update as boolean) || false,
    min_supported_version: doc.min_supported_version as string | undefined,
    published_at: doc.published_at as string | undefined,
    created_at: (doc.created_at as string) || (doc.createdAt as string) || new Date().toISOString(),
    updated_at: (doc.updated_at as string) || (doc.updatedAt as string) || new Date().toISOString(),
  };
}

// ============================================================================
// Supabase 查询函数 (国际版)
// ============================================================================

async function getSupabaseReleases(platform?: string): Promise<Release[]> {
  if (!supabaseAdmin) return [];

  try {
    let query = supabaseAdmin
      .from("releases")
      .select("*")
      .order("version_code", { ascending: false });

    if (platform && platform !== "all") {
      query = query.eq("platform", platform);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[getSupabaseReleases] Error:", error);
      return [];
    }

    return (data || []).map((item) => ({ ...item, region: item.region || "global" }));
  } catch (err) {
    console.error("[getSupabaseReleases] Unexpected error:", err);
    return [];
  }
}

// ============================================================================
// CloudBase 查询函数 (国内版)
// ============================================================================

async function getCloudBaseReleases(platform?: string): Promise<Release[]> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    let query = db.collection("releases");

    if (platform && platform !== "all") {
      query = query.where({ platform });
    }

    const result = await query
      .orderBy("version_code", "desc")
      .limit(100)
      .get();

    return (result.data || []).map((doc: Record<string, unknown>) => cloudBaseDocToRelease(doc));
  } catch (err) {
    console.error("[getCloudBaseReleases] Error:", err);
    return [];
  }
}

async function createCloudBaseRelease(
  formData: ReleaseFormData
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const now = new Date().toISOString();
    const result = await db.collection("releases").add({
      version: formData.version,
      version_code: formData.version_code,
      title: formData.title,
      description: formData.description || null,
      release_notes: formData.release_notes || null,
      download_url: formData.download_url || null,
      download_url_backup: formData.download_url_backup || null,
      file_size: formData.file_size || null,
      file_hash: formData.file_hash || null,
      platform: formData.platform,
      region: "cn",
      status: formData.status || "draft",
      is_force_update: formData.is_force_update || false,
      min_supported_version: formData.min_supported_version || null,
      published_at: null,
      created_at: now,
      updated_at: now,
    });

    return { success: true, id: result.id };
  } catch (err) {
    console.error("[createCloudBaseRelease] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "创建失败" };
  }
}

async function updateCloudBaseRelease(
  id: string,
  formData: Partial<ReleaseFormData>
): Promise<{ success: boolean; error?: string }> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const updateData: Record<string, unknown> = {
      ...formData,
      updated_at: new Date().toISOString(),
    };

    // 如果状态变为 published，设置发布时间
    if (formData.status === "published") {
      updateData.published_at = new Date().toISOString();
    }

    await db.collection("releases").doc(id).update(updateData);

    return { success: true };
  } catch (err) {
    console.error("[updateCloudBaseRelease] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "更新失败" };
  }
}

async function deleteCloudBaseRelease(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    await db.collection("releases").doc(id).remove();

    return { success: true };
  } catch (err) {
    console.error("[deleteCloudBaseRelease] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "删除失败" };
  }
}

// ============================================================================
// 导出的 API 函数
// ============================================================================

/**
 * 获取发布版本列表
 * @param region - 区域筛选: global(国际版/Supabase), cn(国内版/CloudBase), all(全部)
 * @param platform - 平台筛选
 */
export async function getReleases(region?: string, platform?: string): Promise<Release[]> {
  try {
    if (region === "cn") {
      return await getCloudBaseReleases(platform);
    } else if (region === "global") {
      return await getSupabaseReleases(platform);
    } else {
      // region === "all" 或未指定，合并两个数据源
      const [supabaseData, cloudbaseData] = await Promise.all([
        getSupabaseReleases(platform),
        getCloudBaseReleases(platform),
      ]);
      // 合并并按版本代码排序
      return [...supabaseData, ...cloudbaseData].sort((a, b) => b.version_code - a.version_code);
    }
  } catch (err) {
    console.error("[getReleases] Unexpected error:", err);
    return [];
  }
}

/**
 * 创建发布版本
 * 根据 region 字段决定存储到哪个数据库
 */
export async function createRelease(
  formData: ReleaseFormData
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    // 国内版存储到 CloudBase
    if (formData.region === "cn") {
      const result = await createCloudBaseRelease(formData);
      if (result.success) {
        revalidatePath("/admin/releases");
      }
      return result;
    }

    // 国际版存储到 Supabase
    if (!supabaseAdmin) {
      return { success: false, error: "数据库连接失败" };
    }

    const { data, error } = await supabaseAdmin
      .from("releases")
      .insert({
        version: formData.version,
        version_code: formData.version_code,
        title: formData.title,
        description: formData.description,
        release_notes: formData.release_notes,
        download_url: formData.download_url,
        download_url_backup: formData.download_url_backup,
        file_size: formData.file_size,
        file_hash: formData.file_hash,
        platform: formData.platform,
        region: formData.region,
        status: formData.status || "draft",
        is_force_update: formData.is_force_update || false,
        min_supported_version: formData.min_supported_version,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[createRelease] Error:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/releases");
    return { success: true, id: data.id };
  } catch (err) {
    console.error("[createRelease] Unexpected error:", err);
    return { success: false, error: "创建失败" };
  }
}

/**
 * 更新发布版本
 * @param id - 版本ID
 * @param formData - 更新数据
 * @param region - 区域标识，用于确定数据库
 */
export async function updateRelease(
  id: string,
  formData: Partial<ReleaseFormData>,
  region?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 国内版更新 CloudBase
    if (region === "cn") {
      const result = await updateCloudBaseRelease(id, formData);
      if (result.success) {
        revalidatePath("/admin/releases");
      }
      return result;
    }

    // 国际版更新 Supabase
    if (!supabaseAdmin) {
      return { success: false, error: "数据库连接失败" };
    }

    const updateData: Record<string, unknown> = {
      ...formData,
      updated_at: new Date().toISOString(),
    };

    // 如果状态变为 published，设置发布时间
    if (formData.status === "published") {
      updateData.published_at = new Date().toISOString();
    }

    const { error } = await supabaseAdmin
      .from("releases")
      .update(updateData)
      .eq("id", id);

    if (error) {
      console.error("[updateRelease] Error:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/releases");
    return { success: true };
  } catch (err) {
    console.error("[updateRelease] Unexpected error:", err);
    return { success: false, error: "更新失败" };
  }
}

/**
 * 删除发布版本
 * @param id - 版本ID
 * @param region - 区域标识，用于确定数据库
 */
export async function deleteRelease(
  id: string,
  region?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 国内版删除 CloudBase
    if (region === "cn") {
      const result = await deleteCloudBaseRelease(id);
      if (result.success) {
        revalidatePath("/admin/releases");
      }
      return result;
    }

    // 国际版删除 Supabase
    if (!supabaseAdmin) {
      return { success: false, error: "数据库连接失败" };
    }

    const { error } = await supabaseAdmin
      .from("releases")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[deleteRelease] Error:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/releases");
    return { success: true };
  } catch (err) {
    console.error("[deleteRelease] Unexpected error:", err);
    return { success: false, error: "删除失败" };
  }
}

/**
 * 发布版本
 * @param id - 版本ID
 * @param region - 区域标识，用于确定数据库
 */
export async function publishRelease(
  id: string,
  region?: string
): Promise<{ success: boolean; error?: string }> {
  return updateRelease(id, { status: "published" }, region);
}
