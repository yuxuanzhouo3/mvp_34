"use server";

/**
 * 社交链接管理 Server Actions
 * 支持 Supabase (国际版) 和 CloudBase (国内版)
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/utils/session";

export interface SocialLink {
  id: string;
  name: string;
  title?: string; // 别名，兼容旧代码
  description?: string;
  url: string;
  icon?: string;
  icon_url?: string; // 别名，兼容旧代码
  icon_type: string;
  platform_type: string;
  region: "global" | "cn";
  status: "active" | "inactive";
  is_active: boolean; // 兼容旧代码
  sort_order: number;
  source?: string; // 数据来源标识
  file_size?: number; // 文件大小
  target_url?: string; // 目标URL
  created_at: string;
  updated_at: string;
}

export interface SocialLinkFormData {
  name: string;
  description?: string;
  url: string;
  icon?: string;
  icon_type?: string;
  platform_type: string;
  region: string;
  status?: string;
  sort_order?: number;
}

// CloudBase 文档转 SocialLink 接口
function cloudBaseDocToSocialLink(doc: Record<string, unknown>): SocialLink {
  const status = (doc.status as "active" | "inactive") || "active";
  return {
    id: (doc._id as string) || "",
    name: (doc.name as string) || "",
    title: doc.title as string | undefined || doc.name as string | undefined,
    description: doc.description as string | undefined,
    url: (doc.url as string) || "",
    icon: doc.icon as string | undefined,
    icon_url: doc.icon_url as string | undefined || doc.icon as string | undefined,
    icon_type: (doc.icon_type as string) || "url",
    platform_type: (doc.platform_type as string) || "website",
    region: (doc.region as "global" | "cn") || "cn",
    status,
    is_active: status === "active",
    sort_order: (doc.sort_order as number) || 0,
    source: doc.source as string | undefined || "cn",
    file_size: doc.file_size as number | undefined,
    target_url: doc.target_url as string | undefined || doc.url as string | undefined,
    created_at: (doc.created_at as string) || (doc.createdAt as string) || new Date().toISOString(),
    updated_at: (doc.updated_at as string) || (doc.updatedAt as string) || new Date().toISOString(),
  };
}

// ============================================================================
// Supabase 查询函数 (国际版)
// ============================================================================

async function getSupabaseSocialLinks(): Promise<SocialLink[]> {
  if (!supabaseAdmin) return [];

  try {
    const { data, error } = await supabaseAdmin
      .from("social_links")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[getSupabaseSocialLinks] Error:", error);
      return [];
    }

    return (data || []).map((item) => ({
      ...item,
      region: item.region || "global",
      title: item.title || item.name,
      icon_url: item.icon_url || item.icon,
      is_active: item.status === "active",
      target_url: item.target_url || item.url,
    }));
  } catch (err) {
    console.error("[getSupabaseSocialLinks] Unexpected error:", err);
    return [];
  }
}

// ============================================================================
// CloudBase 查询函数 (国内版)
// ============================================================================

async function getCloudBaseSocialLinks(): Promise<SocialLink[]> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const result = await db
      .collection("social_links")
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "desc")
      .limit(100)
      .get();

    return (result.data || []).map((doc: Record<string, unknown>) => cloudBaseDocToSocialLink(doc));
  } catch (err) {
    console.error("[getCloudBaseSocialLinks] Error:", err);
    return [];
  }
}

async function createCloudBaseSocialLink(
  formData: SocialLinkFormData
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const now = new Date().toISOString();
    const result = await db.collection("social_links").add({
      name: formData.name,
      description: formData.description || null,
      url: formData.url,
      icon: formData.icon || null,
      icon_type: formData.icon_type || "url",
      platform_type: formData.platform_type,
      region: "cn",
      status: formData.status || "active",
      sort_order: formData.sort_order || 0,
      created_at: now,
      updated_at: now,
    });

    return { success: true, id: result.id };
  } catch (err) {
    console.error("[createCloudBaseSocialLink] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "创建失败" };
  }
}

async function updateCloudBaseSocialLink(
  id: string,
  formData: Partial<SocialLinkFormData>
): Promise<{ success: boolean; error?: string }> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    await db.collection("social_links").doc(id).update({
      ...formData,
      updated_at: new Date().toISOString(),
    });

    return { success: true };
  } catch (err) {
    console.error("[updateCloudBaseSocialLink] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "更新失败" };
  }
}

async function deleteCloudBaseSocialLink(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    await db.collection("social_links").doc(id).remove();

    return { success: true };
  } catch (err) {
    console.error("[deleteCloudBaseSocialLink] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "删除失败" };
  }
}

// ============================================================================
// 导出的 API 函数
// ============================================================================

/**
 * 获取社交链接列表
 * @param region - 区域筛选: global(国际版/Supabase), cn(国内版/CloudBase), all(全部)
 */
export async function getSocialLinks(region?: string): Promise<SocialLink[]> {
  // 权限验证
  if (!(await verifyAdminSession())) {
    console.error("[getSocialLinks] Unauthorized access attempt");
    return [];
  }

  try {
    if (region === "cn") {
      return await getCloudBaseSocialLinks();
    } else if (region === "global") {
      return await getSupabaseSocialLinks();
    } else {
      // region === "all" 或未指定，合并两个数据源
      const [supabaseData, cloudbaseData] = await Promise.all([
        getSupabaseSocialLinks(),
        getCloudBaseSocialLinks(),
      ]);
      // 合并并按排序顺序排列
      return [...supabaseData, ...cloudbaseData].sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
  } catch (err) {
    console.error("[getSocialLinks] Unexpected error:", err);
    return [];
  }
}

/**
 * 创建社交链接
 * 根据 region 字段决定存储到哪个数据库
 */
export async function createSocialLink(
  formData: any
): Promise<{ success: boolean; error?: string; id?: string }> {
  // 权限验证
  if (!(await verifyAdminSession())) {
    console.error("[createSocialLink] Unauthorized access attempt");
    return { success: false, error: "未授权访问" };
  }

  try {
    // 国内版存储到 CloudBase
    if (formData.region === "cn") {
      const result = await createCloudBaseSocialLink(formData);
      if (result.success) {
        revalidatePath("/admin/social-links");
      }
      return result;
    }

    // 国际版存储到 Supabase
    if (!supabaseAdmin) {
      return { success: false, error: "数据库连接失败" };
    }

    const { data, error } = await supabaseAdmin
      .from("social_links")
      .insert({
        name: formData.name,
        description: formData.description,
        url: formData.url,
        icon: formData.icon,
        icon_type: formData.icon_type || "url",
        platform_type: formData.platform_type,
        region: formData.region,
        status: formData.status || "active",
        sort_order: formData.sort_order || 0,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[createSocialLink] Error:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/social-links");
    return { success: true, id: data.id };
  } catch (err) {
    console.error("[createSocialLink] Unexpected error:", err);
    return { success: false, error: "创建失败" };
  }
}

/**
 * 更新社交链接
 * @param id - 链接ID
 * @param formData - 更新数据
 * @param region - 区域标识，用于确定数据库
 */
export async function updateSocialLink(
  id: string,
  formData: any,
  region?: string
): Promise<{ success: boolean; error?: string }> {
  // 权限验证
  if (!(await verifyAdminSession())) {
    console.error("[updateSocialLink] Unauthorized access attempt");
    return { success: false, error: "未授权访问" };
  }

  try {
    // 国内版更新 CloudBase
    if (region === "cn") {
      const result = await updateCloudBaseSocialLink(id, formData);
      if (result.success) {
        revalidatePath("/admin/social-links");
      }
      return result;
    }

    // 国际版更新 Supabase
    if (!supabaseAdmin) {
      return { success: false, error: "数据库连接失败" };
    }

    const { error } = await supabaseAdmin
      .from("social_links")
      .update({
        ...formData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("[updateSocialLink] Error:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/social-links");
    return { success: true };
  } catch (err) {
    console.error("[updateSocialLink] Unexpected error:", err);
    return { success: false, error: "更新失败" };
  }
}

/**
 * 删除社交链接
 * @param id - 链接ID
 * @param region - 区域标识，用于确定数据库
 */
export async function deleteSocialLink(
  id: string,
  region?: string
): Promise<{ success: boolean; error?: string }> {
  // 权限验证
  if (!(await verifyAdminSession())) {
    console.error("[deleteSocialLink] Unauthorized access attempt");
    return { success: false, error: "未授权访问" };
  }

  try {
    // 国内版删除 CloudBase
    if (region === "cn") {
      const result = await deleteCloudBaseSocialLink(id);
      if (result.success) {
        revalidatePath("/admin/social-links");
      }
      return result;
    }

    // 国际版删除 Supabase
    if (!supabaseAdmin) {
      return { success: false, error: "数据库连接失败" };
    }

    const { error } = await supabaseAdmin
      .from("social_links")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[deleteSocialLink] Error:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/social-links");
    return { success: true };
  } catch (err) {
    console.error("[deleteSocialLink] Unexpected error:", err);
    return { success: false, error: "删除失败" };
  }
}

// ============================================================================
// 函数别名（向后兼容）
// ============================================================================

/**
 * 获取社交链接列表（向后兼容的函数别名）
 */
export async function listSocialLinks(region?: string): Promise<{ success: boolean; data?: SocialLink[]; error?: string }> {
  try {
    const data = await getSocialLinks(region);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "获取社交链接列表失败" };
  }
}

/**
 * 切换社交链接状态（向后兼容的函数别名）
 */
export async function toggleSocialLinkStatus(
  id: string,
  isActive: boolean,
  region?: string
): Promise<{ success: boolean; error?: string }> {
  const status = isActive ? "active" : "inactive";
  return updateSocialLink(id, { status }, region);
}

/**
 * 更新社交链接排序（向后兼容的函数别名）
 */
export async function updateSocialLinksOrder(
  links: Array<{ id: string; sort_order: number }>,
  region?: string
): Promise<{ success: boolean; error?: string }> {
  // 权限验证
  if (!(await verifyAdminSession())) {
    return { success: false, error: "未授权访问" };
  }

  try {
    // 批量更新排序
    for (const link of links) {
      await updateSocialLink(link.id, { sort_order: link.sort_order }, region);
    }

    revalidatePath("/admin/social-links");
    return { success: true };
  } catch (err) {
    console.error("[updateSocialLinksOrder] Error:", err);
    return { success: false, error: "更新排序失败" };
  }
}
