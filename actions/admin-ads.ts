"use server";

/**
 * 广告管理 Server Actions
 * 支持 Supabase (国际版) 和 CloudBase (国内版)
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/utils/session";

export interface Ad {
  id: string;
  title: string;
  description?: string;
  media_type: "image" | "video";
  media_url: string;
  thumbnail_url?: string;
  link_url?: string;
  target_url?: string; // 别名，兼容旧代码
  link_type: "external" | "internal" | "download";
  position: "left" | "right" | "top" | "bottom";
  platform: string;
  region: "global" | "cn" | "all";
  status: "active" | "inactive" | "scheduled";
  is_active: boolean; // 兼容旧代码
  priority: number;
  start_at?: string;
  end_at?: string;
  impressions: number;
  clicks: number;
  source?: string; // 数据来源标识
  file_size?: number; // 文件大小
  created_at: string;
  updated_at: string;
}

export interface AdFormData {
  title: string;
  description?: string;
  media_type: "image" | "video";
  media_url: string;
  thumbnail_url?: string;
  link_url?: string;
  link_type?: string;
  position: string;
  platform?: string;
  region: string;
  status?: string;
  priority?: number;
  start_at?: string;
  end_at?: string;
}

// CloudBase 文档转 Ad 接口
function cloudBaseDocToAd(doc: Record<string, unknown>): Ad {
  const status = (doc.status as "active" | "inactive" | "scheduled") || "inactive";
  return {
    id: (doc._id as string) || "",
    title: (doc.title as string) || "",
    description: doc.description as string | undefined,
    media_type: (doc.media_type as "image" | "video") || "image",
    media_url: (doc.media_url as string) || "",
    thumbnail_url: doc.thumbnail_url as string | undefined,
    link_url: doc.link_url as string | undefined,
    target_url: doc.target_url as string | undefined || doc.link_url as string | undefined,
    link_type: (doc.link_type as "external" | "internal" | "download") || "external",
    position: (doc.position as "left" | "right" | "top" | "bottom") || "bottom",
    platform: (doc.platform as string) || "all",
    region: (doc.region as "global" | "cn" | "all") || "cn",
    status,
    is_active: status === "active",
    priority: (doc.priority as number) || 0,
    start_at: doc.start_at as string | undefined,
    end_at: doc.end_at as string | undefined,
    impressions: (doc.impressions as number) || 0,
    clicks: (doc.clicks as number) || 0,
    source: doc.source as string | undefined || "cn",
    file_size: doc.file_size as number | undefined,
    created_at: (doc.created_at as string) || (doc.createdAt as string) || new Date().toISOString(),
    updated_at: (doc.updated_at as string) || (doc.updatedAt as string) || new Date().toISOString(),
  };
}

// ============================================================================
// Supabase 查询函数 (国际版)
// ============================================================================

async function getSupabaseAds(status?: string): Promise<Ad[]> {
  if (!supabaseAdmin) return [];

  try {
    let query = supabaseAdmin
      .from("ads")
      .select("*")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[getSupabaseAds] Error:", error);
      return [];
    }

    return (data || []).map((item) => ({
      ...item,
      region: item.region || "global",
      target_url: item.target_url || item.link_url,
      is_active: item.status === "active",
    }));
  } catch (err) {
    console.error("[getSupabaseAds] Unexpected error:", err);
    return [];
  }
}

// ============================================================================
// CloudBase 查询函数 (国内版)
// ============================================================================

async function getCloudBaseAds(status?: string): Promise<Ad[]> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    let query = db.collection("ads");

    if (status && status !== "all") {
      query = query.where({ status });
    }

    const result = await query
      .orderBy("priority", "desc")
      .orderBy("created_at", "desc")
      .limit(100)
      .get();

    return (result.data || []).map((doc: Record<string, unknown>) => cloudBaseDocToAd(doc));
  } catch (err) {
    console.error("[getCloudBaseAds] Error:", err);
    return [];
  }
}

async function createCloudBaseAd(
  formData: AdFormData
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const now = new Date().toISOString();
    const result = await db.collection("ads").add({
      title: formData.title,
      description: formData.description || null,
      media_type: formData.media_type,
      media_url: formData.media_url,
      thumbnail_url: formData.thumbnail_url || null,
      link_url: formData.link_url || null,
      link_type: formData.link_type || "external",
      position: formData.position,
      platform: formData.platform || "all",
      region: "cn",
      status: formData.status || "inactive",
      priority: formData.priority || 0,
      start_at: formData.start_at || null,
      end_at: formData.end_at || null,
      impressions: 0,
      clicks: 0,
      created_at: now,
      updated_at: now,
    });

    return { success: true, id: result.id };
  } catch (err) {
    console.error("[createCloudBaseAd] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "创建失败" };
  }
}

async function updateCloudBaseAd(
  id: string,
  formData: Partial<AdFormData>
): Promise<{ success: boolean; error?: string }> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    await db.collection("ads").doc(id).update({
      ...formData,
      updated_at: new Date().toISOString(),
    });

    return { success: true };
  } catch (err) {
    console.error("[updateCloudBaseAd] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "更新失败" };
  }
}

async function deleteCloudBaseAd(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    await db.collection("ads").doc(id).remove();

    return { success: true };
  } catch (err) {
    console.error("[deleteCloudBaseAd] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "删除失败" };
  }
}

// ============================================================================
// 导出的 API 函数
// ============================================================================

/**
 * 获取广告列表
 * @param region - 区域筛选: global(国际版/Supabase), cn(国内版/CloudBase), all(全部)
 * @param status - 状态筛选
 */
export async function getAds(region?: string, status?: string): Promise<Ad[]> {
  // 权限验证
  if (!(await verifyAdminSession())) {
    console.error("[getAds] Unauthorized access attempt");
    return [];
  }

  try {
    if (region === "cn") {
      return await getCloudBaseAds(status);
    } else if (region === "global") {
      return await getSupabaseAds(status);
    } else {
      // region === "all" 或未指定，合并两个数据源
      const [supabaseData, cloudbaseData] = await Promise.all([
        getSupabaseAds(status),
        getCloudBaseAds(status),
      ]);
      // 合并并按优先级排序
      return [...supabaseData, ...cloudbaseData].sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
  } catch (err) {
    console.error("[getAds] Unexpected error:", err);
    return [];
  }
}

/**
 * 获取单个广告
 */
export async function getAd(id: string, region?: string): Promise<Ad | null> {
  // 权限验证
  if (!(await verifyAdminSession())) {
    console.error("[getAd] Unauthorized access attempt");
    return null;
  }

  try {
    // 如果指定了区域，直接查询对应数据库
    if (region === "cn") {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();
      const result = await db.collection("ads").doc(id).get();
      if (result.data && result.data.length > 0) {
        return cloudBaseDocToAd(result.data[0]);
      }
      return null;
    }

    // 默认查询 Supabase
    if (!supabaseAdmin) return null;

    const { data, error } = await supabaseAdmin
      .from("ads")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("[getAd] Error:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[getAd] Unexpected error:", err);
    return null;
  }
}

/**
 * 创建广告
 * 根据 region 字段决定存储到哪个数据库
 */
export async function createAd(
  formData: any
): Promise<{ success: boolean; error?: string; id?: string }> {
  // 权限验证
  if (!(await verifyAdminSession())) {
    console.error("[createAd] Unauthorized access attempt");
    return { success: false, error: "未授权访问" };
  }

  try {
    // 国内版存储到 CloudBase
    if (formData.region === "cn") {
      const result = await createCloudBaseAd(formData);
      if (result.success) {
        revalidatePath("/admin/ads");
      }
      return result;
    }

    // 国际版存储到 Supabase
    if (!supabaseAdmin) {
      return { success: false, error: "数据库连接失败" };
    }

    const { data, error } = await supabaseAdmin
      .from("ads")
      .insert({
        title: formData.title,
        description: formData.description,
        media_type: formData.media_type,
        media_url: formData.media_url,
        thumbnail_url: formData.thumbnail_url,
        link_url: formData.link_url,
        link_type: formData.link_type || "external",
        position: formData.position,
        platform: formData.platform || "all",
        region: formData.region,
        status: formData.status || "inactive",
        priority: formData.priority || 0,
        start_at: formData.start_at || null,
        end_at: formData.end_at || null,
        impressions: 0,
        clicks: 0,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[createAd] Error:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/ads");
    return { success: true, id: data.id };
  } catch (err) {
    console.error("[createAd] Unexpected error:", err);
    return { success: false, error: "创建失败" };
  }
}

/**
 * 更新广告
 * @param id - 广告ID
 * @param formData - 更新数据
 * @param region - 区域标识，用于确定数据库
 */
export async function updateAd(
  id: string,
  formData: any,
  region?: string
): Promise<{ success: boolean; error?: string }> {
  // 权限验证
  if (!(await verifyAdminSession())) {
    console.error("[updateAd] Unauthorized access attempt");
    return { success: false, error: "未授权访问" };
  }

  try {
    // 国内版更新 CloudBase
    if (region === "cn") {
      const result = await updateCloudBaseAd(id, formData);
      if (result.success) {
        revalidatePath("/admin/ads");
      }
      return result;
    }

    // 国际版更新 Supabase
    if (!supabaseAdmin) {
      return { success: false, error: "数据库连接失败" };
    }

    const { error } = await supabaseAdmin
      .from("ads")
      .update({
        ...formData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("[updateAd] Error:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/ads");
    return { success: true };
  } catch (err) {
    console.error("[updateAd] Unexpected error:", err);
    return { success: false, error: "更新失败" };
  }
}

/**
 * 删除广告
 * @param id - 广告ID
 * @param region - 区域标识，用于确定数据库
 */
export async function deleteAd(
  id: string,
  region?: string
): Promise<{ success: boolean; error?: string }> {
  // 权限验证
  if (!(await verifyAdminSession())) {
    console.error("[deleteAd] Unauthorized access attempt");
    return { success: false, error: "未授权访问" };
  }

  try {
    // 国内版删除 CloudBase
    if (region === "cn") {
      const result = await deleteCloudBaseAd(id);
      if (result.success) {
        revalidatePath("/admin/ads");
      }
      return result;
    }

    // 国际版删除 Supabase
    if (!supabaseAdmin) {
      return { success: false, error: "数据库连接失败" };
    }

    const { error } = await supabaseAdmin.from("ads").delete().eq("id", id);

    if (error) {
      console.error("[deleteAd] Error:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/ads");
    return { success: true };
  } catch (err) {
    console.error("[deleteAd] Unexpected error:", err);
    return { success: false, error: "删除失败" };
  }
}

/**
 * 切换广告状态
 */
export async function toggleAdStatus(
  id: string,
  status: "active" | "inactive" | boolean,
  region?: string
): Promise<{ success: boolean; error?: string }> {
  // 兼容boolean类型参数
  const statusStr = typeof status === "boolean" ? (status ? "active" : "inactive") : status;
  return updateAd(id, { status: statusStr }, region);
}

// ============================================================================
// 类型别名和函数别名（向后兼容）
// ============================================================================

/**
 * Advertisement 类型别名（向后兼容）
 */
export type Advertisement = Ad;

/**
 * 获取广告列表（向后兼容的函数别名）
 */
export async function listAdvertisements(region?: string, status?: string): Promise<{ success: boolean; data?: Ad[]; error?: string }> {
  try {
    const data = await getAds(region, status);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "获取广告列表失败" };
  }
}

/**
 * 创建广告（向后兼容的函数别名）
 */
export const createAdvertisement = createAd;

/**
 * 更新广告（向后兼容的函数别名）
 */
export const updateAdvertisement = updateAd;

/**
 * 删除广告（向后兼容的函数别名）
 */
export const deleteAdvertisement = deleteAd;

/**
 * 切换广告状态（向后兼容的函数别名）
 */
export const toggleAdvertisementStatus = toggleAdStatus;
