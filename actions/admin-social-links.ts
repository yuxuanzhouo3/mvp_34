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
  const region = (doc.region as "global" | "cn") || "cn";
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
    region,
    source: "cloudbase",
    status,
    is_active: status === "active",
    sort_order: (doc.sort_order as number) || 0,
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
      source: item.region === "both" ? "both" : "supabase",
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
// 文件上传函数
// ============================================================================

/**
 * 上传图标到 Supabase Storage
 */
async function uploadIconToSupabase(
  file: File,
  fileName: string
): Promise<string | null> {
  if (!supabaseAdmin) return null;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = `${fileName}`;

    const { error } = await supabaseAdmin.storage
      .from("social-icons")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (error) {
      console.error("Supabase upload icon error:", error);
      return null;
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("social-icons")
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (err) {
    console.error("Supabase upload icon exception:", err);
    return null;
  }
}

/**
 * 上传图标到 CloudBase Storage
 */
async function uploadIconToCloudBase(
  file: File,
  fileName: string
): Promise<string | null> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const app = connector.getApp();
    const buffer = Buffer.from(await file.arrayBuffer());
    const cloudPath = `social-icons/${fileName}`;

    const uploadResult = await app.uploadFile({
      cloudPath,
      fileContent: buffer,
    });

    if (!uploadResult.fileID) {
      console.error("CloudBase upload icon failed: no fileID returned");
      return null;
    }

    return uploadResult.fileID;
  } catch (err) {
    console.error("CloudBase upload icon exception:", err);
    return null;
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
    const app = connector.getApp();

    const result = await db
      .collection("social_links")
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "desc")
      .limit(100)
      .get();

    const links = (result.data || []).map((doc: Record<string, unknown>) => cloudBaseDocToSocialLink(doc));

    // 收集需要获取临时 URL 的 fileID
    const cloudbaseLinks: { link: SocialLink; fileId: string }[] = [];
    for (const link of links) {
      if (link.icon_url && link.icon_url.startsWith("cloud://")) {
        cloudbaseLinks.push({ link, fileId: link.icon_url });
      }
    }

    // 批量获取临时 URL
    if (cloudbaseLinks.length > 0) {
      try {
        const fileIds = cloudbaseLinks.map((item) => item.fileId);
        const urlResult = await app.getTempFileURL({ fileList: fileIds });

        if (urlResult.fileList && Array.isArray(urlResult.fileList)) {
          const urlMap = new Map<string, string>();
          for (const fileInfo of urlResult.fileList) {
            if (fileInfo.tempFileURL && fileInfo.code === "SUCCESS") {
              urlMap.set(fileInfo.fileID, fileInfo.tempFileURL);
            }
          }

          // 更新 links 中的 icon_url
          for (const { link, fileId } of cloudbaseLinks) {
            const tempUrl = urlMap.get(fileId);
            if (tempUrl) {
              link.icon_url = tempUrl;
              link.icon = tempUrl;
            }
          }
        }
      } catch (urlErr) {
        console.error("[getCloudBaseSocialLinks] getTempFileURL error:", urlErr);
      }
    }

    return links;
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
    const dataToInsert = {
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
    };

    const result = await db.collection("social_links").add(dataToInsert);

    return { success: true, id: result.id };
  } catch (err) {
    console.error("[createCloudBaseSocialLink] Error:", err);
    console.error("[createCloudBaseSocialLink] Error stack:", err instanceof Error ? err.stack : "No stack trace");
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
      // region === "all" 或未指定，合并两个数据源并去重
      const [supabaseData, cloudbaseData] = await Promise.all([
        getSupabaseSocialLinks(),
        getCloudBaseSocialLinks(),
      ]);

      // 去重：优先保留Supabase中region="both"的记录
      const nameSet = new Set<string>();
      const deduped: SocialLink[] = [];

      // 先添加Supabase数据
      for (const link of supabaseData) {
        nameSet.add(link.name);
        deduped.push(link);
      }

      // 再添加CloudBase数据，跳过已存在的name
      for (const link of cloudbaseData) {
        if (!nameSet.has(link.name)) {
          deduped.push(link);
        }
      }

      // 按排序顺序排列
      return deduped.sort((a, b) => {
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
    // 处理 FormData 对象
    const isFormData = formData instanceof FormData;
    const getData = (key: string) => isFormData ? formData.get(key) : formData[key];

    // 字段映射：前端使用 title，数据库使用 name
    const name = getData("title") || getData("name");
    if (!name) {
      return { success: false, error: "标题不能为空" };
    }

    const description = getData("description");
    const targetUrl = getData("targetUrl");
    const uploadTarget = getData("uploadTarget");
    const sortOrder = parseInt(getData("sortOrder") as string) || 0;
    const isActive = getData("isActive") === "true";
    const file = getData("file") as File | null;

    // 如果有文件上传
    let supabaseIconUrl: string | null = null;
    let cloudbaseIconUrl: string | null = null;
    let fileSize: number | undefined;

    if (file && file.size > 0) {
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      fileSize = file.size;

      // 根据上传目标选择存储
      if (uploadTarget === "both") {
        // 双端同步:同时上传到两个存储
        const [supabaseResult, cloudbaseResult] = await Promise.all([
          uploadIconToSupabase(file, fileName),
          uploadIconToCloudBase(file, fileName),
        ]);

        if (!supabaseResult || !cloudbaseResult) {
          const errors = [];
          if (!supabaseResult) errors.push("Supabase");
          if (!cloudbaseResult) errors.push("CloudBase");
          return { success: false, error: `上传到 ${errors.join(" 和 ")} 失败` };
        }

        supabaseIconUrl = supabaseResult;
        cloudbaseIconUrl = cloudbaseResult;
      } else if (uploadTarget === "cn" || uploadTarget === "cloudbase") {
        cloudbaseIconUrl = await uploadIconToCloudBase(file, fileName);
        if (!cloudbaseIconUrl) {
          return { success: false, error: "上传到 CloudBase 失败" };
        }
      } else {
        supabaseIconUrl = await uploadIconToSupabase(file, fileName);
        if (!supabaseIconUrl) {
          return { success: false, error: "上传到 Supabase 失败" };
        }
      }
    } else {
      const iconData = getData("icon") as string;
      supabaseIconUrl = iconData;
      cloudbaseIconUrl = iconData;
    }

    // 双端同步:文件上传到两个存储,数据写入两个数据库
    if (uploadTarget === "both") {
      if (!supabaseIconUrl || !cloudbaseIconUrl) {
        return { success: false, error: "请上传图标文件或提供图标URL" };
      }

      // 写入 Supabase
      if (!supabaseAdmin) {
        return { success: false, error: "数据库连接失败" };
      }

      const { data, error } = await supabaseAdmin
        .from("social_links")
        .insert({
          name: name as string,
          description: description as string,
          url: targetUrl as string,
          icon: supabaseIconUrl,
          icon_type: "upload",
          platform_type: "website",
          region: "both", // 标记为双端同步
          status: isActive ? "active" : "inactive",
          sort_order: sortOrder,
        })
        .select("id")
        .single();

      if (error) {
        console.error("[createSocialLink] Supabase error:", error);
        return { success: false, error: error.message };
      }

      // 同时写入 CloudBase
      const cloudbaseResult = await createCloudBaseSocialLink({
        name: name as string,
        description: description as string,
        url: targetUrl as string,
        icon: cloudbaseIconUrl,
        icon_type: "upload",
        platform_type: "website",
        region: "cn",
        sort_order: sortOrder,
        status: isActive ? "active" : "inactive",
      });

      if (!cloudbaseResult.success) {
        console.error("[createSocialLink] CloudBase write failed:", cloudbaseResult.error);
      }

      revalidatePath("/admin/social-links");
      return { success: true, id: data.id };
    }

    // 国内版存储到 CloudBase
    console.log("[createSocialLink] Checking CloudBase branch, uploadTarget:", uploadTarget);
    if (uploadTarget === "cn" || uploadTarget === "cloudbase") {
      console.log("[createSocialLink] Entered CloudBase branch, cloudbaseIconUrl:", cloudbaseIconUrl);
      if (!cloudbaseIconUrl) {
        console.error("[createSocialLink] CloudBase icon URL is empty!");
        return { success: false, error: "请上传图标文件或提供图标URL" };
      }

      console.log("[createSocialLink] About to call createCloudBaseSocialLink");
      const result = await createCloudBaseSocialLink({
        name: name as string,
        description: description as string,
        url: targetUrl as string,
        icon: cloudbaseIconUrl,
        icon_type: "upload",
        platform_type: "website",
        region: "cn",
        sort_order: sortOrder,
        status: isActive ? "active" : "inactive",
      });
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
        name: name as string,
        description: description as string,
        url: targetUrl as string,
        icon: supabaseIconUrl,
        icon_type: "upload",
        platform_type: "website",
        region: "global",
        status: isActive ? "active" : "inactive",
        sort_order: sortOrder,
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
    // 双端同步删除
    if (region === "both") {
      if (!supabaseAdmin) {
        return { success: false, error: "数据库连接失败" };
      }

      // 获取Supabase中的记录
      const { data: linkData } = await supabaseAdmin
        .from("social_links")
        .select("name, icon, icon_url")
        .eq("id", id)
        .single();

      const supabaseIconUrl = linkData?.icon || linkData?.icon_url;
      const linkName = linkData?.name;

      // 删除Supabase数据库记录
      const { error } = await supabaseAdmin
        .from("social_links")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("[deleteSocialLink] Error:", error);
        return { success: false, error: error.message };
      }

      // 删除Supabase Storage文件
      if (supabaseIconUrl) {
        try {
          const urlParts = supabaseIconUrl.split("/social-icons/");
          if (urlParts.length > 1) {
            const fileName = urlParts[1].split("?")[0];
            await supabaseAdmin.storage.from("social-icons").remove([fileName]);
          }
        } catch (err) {
          console.error("[deleteSocialLink] Supabase delete file error:", err);
        }
      }

      // 删除CloudBase数据库记录和Storage文件
      try {
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        const app = connector.getApp();

        // 尝试通过name查询，如果没有name则尝试通过id查询
        let cloudbaseRecords = [];

        if (linkName) {
          const result = await db.collection("social_links")
            .where({ name: linkName })
            .get();
          cloudbaseRecords = result.data || [];
        } else {
          // 如果Supabase中没有记录，尝试直接用id删除CloudBase记录
          try {
            const result = await db.collection("social_links").doc(id).get();
            if (result.data && result.data.length > 0) {
              cloudbaseRecords = result.data;
            }
          } catch (err) {
            // CloudBase记录不存在
          }
        }

        // 删除CloudBase数据库记录和Storage文件
        if (cloudbaseRecords.length > 0) {
          for (const doc of cloudbaseRecords) {
            const cloudbaseIconUrl = doc.icon || doc.icon_url;
            const docId = doc._id || id;

            // 删除数据库记录
            await db.collection("social_links").doc(docId).remove();

            // 删除Storage文件（使用CloudBase的fileID）
            if (cloudbaseIconUrl && cloudbaseIconUrl.startsWith("cloud://")) {
              try {
                await app.deleteFile({ fileList: [cloudbaseIconUrl] });
              } catch (fileErr) {
                console.error("[deleteSocialLink] CloudBase delete file error:", fileErr);
              }
            }
          }
        }
      } catch (err) {
        console.error("[deleteSocialLink] CloudBase delete error:", err);
      }

      revalidatePath("/admin/social-links");
      return { success: true };
    }

    // 国内版删除 CloudBase
    if (region === "cn") {
      try {
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        const app = connector.getApp();

        const result = await db.collection("social_links").doc(id).get();
        let iconUrl: string | null = null;
        if (result.data && result.data.length > 0) {
          iconUrl = result.data[0].icon || result.data[0].icon_url;
        }

        // 删除数据库记录
        await db.collection("social_links").doc(id).remove();

        // 删除存储文件
        if (iconUrl && iconUrl.startsWith("cloud://")) {
          try {
            await app.deleteFile({ fileList: [iconUrl] });
          } catch (fileErr) {
            console.warn("CloudBase delete file warning:", fileErr);
          }
        }
      } catch (err) {
        console.error("[deleteSocialLink] CloudBase error:", err);
        return { success: false, error: err instanceof Error ? err.message : "删除失败" };
      }

      revalidatePath("/admin/social-links");
      return { success: true };
    }

    // 国际版删除 Supabase
    if (!supabaseAdmin) {
      return { success: false, error: "数据库连接失败" };
    }

    // 获取文件URL
    const { data: linkData } = await supabaseAdmin
      .from("social_links")
      .select("icon")
      .eq("id", id)
      .single();

    const iconUrl = linkData?.icon;

    // 删除数据库记录
    const { error } = await supabaseAdmin
      .from("social_links")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[deleteSocialLink] Error:", error);
      return { success: false, error: error.message };
    }

    // 删除存储文件
    if (iconUrl) {
      try {
        const urlParts = iconUrl.split("/social-icons/");
        if (urlParts.length > 1) {
          const fileName = urlParts[1].split("?")[0];
          await supabaseAdmin.storage.from("social-icons").remove([fileName]);
        }
      } catch (err) {
        console.error("[deleteSocialLink] Delete file error:", err);
      }
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
