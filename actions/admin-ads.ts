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
  const region = (doc.region as "global" | "cn" | "all") || "cn";
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
    region,
    status,
    is_active: status === "active",
    priority: (doc.priority as number) || 0,
    start_at: doc.start_at as string | undefined,
    end_at: doc.end_at as string | undefined,
    impressions: (doc.impressions as number) || 0,
    clicks: (doc.clicks as number) || 0,
    source: "cloudbase",
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
      source: item.region === "both" ? "both" : "supabase",
      target_url: item.target_url || item.link_url,
      is_active: item.status === "active",
    }));
  } catch (err) {
    console.error("[getSupabaseAds] Unexpected error:", err);
    return [];
  }
}

// ============================================================================
// 文件上传函数
// ============================================================================

/**
 * 上传文件到 Supabase Storage
 */
async function uploadToSupabase(
  file: File,
  fileName: string
): Promise<string | null> {
  if (!supabaseAdmin) return null;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = `${fileName}`;

    const { error } = await supabaseAdmin.storage
      .from("ads")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (error) {
      console.error("Supabase upload error:", error);
      return null;
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("ads")
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (err) {
    console.error("Supabase upload exception:", err);
    return null;
  }
}

/**
 * 上传文件到 CloudBase Storage
 */
async function uploadToCloudBase(
  file: File,
  fileName: string
): Promise<string | null> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const app = connector.getApp();
    const buffer = Buffer.from(await file.arrayBuffer());
    const cloudPath = `ads/${fileName}`;

    const uploadResult = await app.uploadFile({
      cloudPath,
      fileContent: buffer,
    });

    if (!uploadResult.fileID) {
      console.error("CloudBase upload failed: no fileID returned");
      return null;
    }

    return uploadResult.fileID;
  } catch (err) {
    console.error("CloudBase upload exception:", err);
    return null;
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
    const app = connector.getApp();

    let query = db.collection("ads");

    if (status && status !== "all") {
      query = query.where({ status });
    }

    const result = await query
      .orderBy("priority", "desc")
      .orderBy("created_at", "desc")
      .limit(100)
      .get();

    const ads = (result.data || []).map((doc: Record<string, unknown>) => cloudBaseDocToAd(doc));

    // 收集需要获取临时 URL 的 fileID
    const cloudbaseAds: { ad: Ad; fileId: string }[] = [];
    for (const ad of ads) {
      if (ad.media_url && ad.media_url.startsWith("cloud://")) {
        cloudbaseAds.push({ ad, fileId: ad.media_url });
      }
    }

    // 批量获取临时 URL
    if (cloudbaseAds.length > 0) {
      try {
        const fileIds = cloudbaseAds.map((item) => item.fileId);
        const urlResult = await app.getTempFileURL({ fileList: fileIds });

        if (urlResult.fileList && Array.isArray(urlResult.fileList)) {
          const urlMap = new Map<string, string>();
          for (const fileInfo of urlResult.fileList) {
            if (fileInfo.tempFileURL && fileInfo.code === "SUCCESS") {
              urlMap.set(fileInfo.fileID, fileInfo.tempFileURL);
            }
          }

          // 更新 ads 中的 media_url
          for (const { ad, fileId } of cloudbaseAds) {
            const tempUrl = urlMap.get(fileId);
            if (tempUrl) {
              ad.media_url = tempUrl;
            }
          }
        }
      } catch (urlErr) {
        console.error("[getCloudBaseAds] getTempFileURL error:", urlErr);
      }
    }

    return ads;
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
    const app = connector.getApp();

    // 获取文件URL
    const result = await db.collection("ads").doc(id).get();
    let mediaUrl: string | null = null;
    if (result.data && result.data.length > 0) {
      mediaUrl = result.data[0].media_url;
    }

    // 删除数据库记录
    await db.collection("ads").doc(id).remove();

    // 删除存储文件
    if (mediaUrl && mediaUrl.startsWith("cloud://")) {
      try {
        await app.deleteFile({ fileList: [mediaUrl] });
      } catch (fileErr) {
        console.warn("CloudBase delete file warning:", fileErr);
      }
    }

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
      // region === "all" 或未指定，合并两个数据源并去重
      const [supabaseData, cloudbaseData] = await Promise.all([
        getSupabaseAds(status),
        getCloudBaseAds(status),
      ]);

      // 去重：优先保留Supabase中region="both"的记录
      const titleSet = new Set<string>();
      const deduped: Ad[] = [];

      // 先添加Supabase数据
      for (const ad of supabaseData) {
        titleSet.add(ad.title);
        deduped.push(ad);
      }

      // 再添加CloudBase数据，跳过已存在的title
      for (const ad of cloudbaseData) {
        if (!titleSet.has(ad.title)) {
          deduped.push(ad);
        }
      }

      // 按优先级排序
      return deduped.sort((a, b) => {
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
    // 处理 FormData 对象
    const isFormData = formData instanceof FormData;
    const getData = (key: string) => isFormData ? formData.get(key) : formData[key];

    const title = getData("title") as string;
    const file = getData("file") as File | null;
    const uploadTarget = getData("uploadTarget") as string;

    if (!title) {
      return { success: false, error: "标题��能为空" };
    }

    // 如果有文件上传
    let supabaseMediaUrl: string | null = null;
    let cloudbaseMediaUrl: string | null = null;
    let fileSize: number | undefined;

    if (file && file.size > 0) {
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      fileSize = file.size;

      // 根据上传目标选择存储
      if (uploadTarget === "both") {
        // 双端同步：同时上传到两个存储
        const [supabaseResult, cloudbaseResult] = await Promise.all([
          uploadToSupabase(file, fileName),
          uploadToCloudBase(file, fileName),
        ]);

        if (!supabaseResult || !cloudbaseResult) {
          const errors = [];
          if (!supabaseResult) errors.push("Supabase");
          if (!cloudbaseResult) errors.push("CloudBase");
          return { success: false, error: `上传到 ${errors.join(" 和 ")} 失败` };
        }

        supabaseMediaUrl = supabaseResult;
        cloudbaseMediaUrl = cloudbaseResult;
      } else if (uploadTarget === "cn" || uploadTarget === "cloudbase") {
        cloudbaseMediaUrl = await uploadToCloudBase(file, fileName);
        if (!cloudbaseMediaUrl) {
          return { success: false, error: "上传到 CloudBase 失败" };
        }
      } else {
        supabaseMediaUrl = await uploadToSupabase(file, fileName);
        if (!supabaseMediaUrl) {
          return { success: false, error: "上传到 Supabase 失败" };
        }
      }
    } else {
      const mediaUrlData = getData("media_url") as string;
      supabaseMediaUrl = mediaUrlData;
      cloudbaseMediaUrl = mediaUrlData;
    }

    // 双端同步：写入两个数据库
    if (uploadTarget === "both") {
      if (!supabaseMediaUrl || !cloudbaseMediaUrl) {
        return { success: false, error: "请上传媒体文件或提供媒体URL" };
      }

      // 写入 Supabase
      if (!supabaseAdmin) {
        return { success: false, error: "数据库连接失败" };
      }

      const isActive = getData("isActive") === "true";
      const status = isActive ? "active" : "inactive";

      const { data, error } = await supabaseAdmin
        .from("ads")
        .insert({
          title,
          description: getData("description") as string,
          media_type: (getData("media_type") as "image" | "video") || "image",
          media_url: supabaseMediaUrl,
          thumbnail_url: getData("thumbnail_url") as string,
          link_url: getData("link_url") as string,
          link_type: getData("link_type") as string || "external",
          position: getData("position") as string,
          platform: getData("platform") as string || "all",
          region: "both",
          status,
          priority: parseInt(getData("priority") as string) || 0,
          start_at: getData("start_at") as string || null,
          end_at: getData("end_at") as string || null,
          impressions: 0,
          clicks: 0,
        })
        .select("id")
        .single();

      if (error) {
        console.error("[createAd] Supabase error:", error);
        return { success: false, error: error.message };
      }

      // 同时写入 CloudBase
      const cloudbaseResult = await createCloudBaseAd({
        title,
        description: getData("description") as string,
        media_type: (getData("media_type") as "image" | "video") || "image",
        media_url: cloudbaseMediaUrl,
        thumbnail_url: getData("thumbnail_url") as string,
        link_url: getData("link_url") as string,
        link_type: getData("link_type") as string,
        position: getData("position") as string,
        platform: getData("platform") as string,
        region: "cn",
        status,
        priority: parseInt(getData("priority") as string) || 0,
        start_at: getData("start_at") as string,
        end_at: getData("end_at") as string,
      });

      if (!cloudbaseResult.success) {
        console.error("[createAd] CloudBase write failed:", cloudbaseResult.error);
      }

      revalidatePath("/admin/ads");
      return { success: true, id: data.id };
    }

    // 国内版存储到 CloudBase
    if (uploadTarget === "cn" || uploadTarget === "cloudbase") {
      if (!cloudbaseMediaUrl) {
        return { success: false, error: "请上传媒体文件或提供媒体URL" };
      }

      const isActive = getData("isActive") === "true";
      const status = isActive ? "active" : "inactive";
      const result = await createCloudBaseAd({
        title,
        description: getData("description") as string,
        media_type: (getData("media_type") as "image" | "video") || "image",
        media_url: cloudbaseMediaUrl,
        thumbnail_url: getData("thumbnail_url") as string,
        link_url: getData("link_url") as string,
        link_type: getData("link_type") as string,
        position: getData("position") as string,
        platform: getData("platform") as string,
        region: "cn",
        status,
        priority: parseInt(getData("priority") as string) || 0,
        start_at: getData("start_at") as string,
        end_at: getData("end_at") as string,
      });
      if (result.success) {
        revalidatePath("/admin/ads");
      }
      return result;
    }

    // 国际版存储到 Supabase
    if (!supabaseAdmin) {
      return { success: false, error: "数据库连接失败" };
    }

    if (!supabaseMediaUrl) {
      return { success: false, error: "请上传媒体文件或提供媒体URL" };
    }

    const isActive = getData("isActive") === "true";
    const status = isActive ? "active" : "inactive";

    const { data, error } = await supabaseAdmin
      .from("ads")
      .insert({
        title,
        description: getData("description") as string,
        media_type: (getData("media_type") as "image" | "video") || "image",
        media_url: supabaseMediaUrl,
        thumbnail_url: getData("thumbnail_url") as string,
        link_url: getData("link_url") as string,
        link_type: getData("link_type") as string || "external",
        position: getData("position") as string,
        platform: getData("platform") as string || "all",
        region: "global",
        status,
        priority: parseInt(getData("priority") as string) || 0,
        start_at: getData("start_at") as string || null,
        end_at: getData("end_at") as string || null,
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
 * @param source - 数据源标识（supabase/cloudbase/both），用于确定数据库
 */
export async function updateAd(
  id: string,
  formData: any,
  source?: string
): Promise<{ success: boolean; error?: string }> {
  // 权限验证
  if (!(await verifyAdminSession())) {
    console.error("[updateAd] Unauthorized access attempt");
    return { success: false, error: "未授权访问" };
  }

  try {
    // 将source转换为region以保持内部逻辑一致
    let region = source;
    if (source === "supabase") region = "global";
    if (source === "cloudbase") region = "cn";

    // 国内版更新 CloudBase
    if (region === "cn" || region === "cloudbase") {
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
 * @param source - 数据源标识（supabase/cloudbase/both），用于确定数据库
 */
export async function deleteAd(
  id: string,
  source?: string
): Promise<{ success: boolean; error?: string }> {
  // 权限验证
  if (!(await verifyAdminSession())) {
    console.error("[deleteAd] Unauthorized access attempt");
    return { success: false, error: "未授权访问" };
  }

  try {
    // 将source转换为region以保持内部逻辑一致
    let region = source;
    if (source === "supabase") region = "global";
    if (source === "cloudbase") region = "cn";

    // 先获取广告信息以便删除存储文件
    let mediaUrl: string | null = null;

    // 国内版删除 CloudBase
    if (region === "cn" || region === "cloudbase") {
      // 获取文件URL
      try {
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        const app = connector.getApp();

        const result = await db.collection("ads").doc(id).get();
        if (result.data && result.data.length > 0) {
          mediaUrl = result.data[0].media_url;
        }

        // 删除数据库记录
        await db.collection("ads").doc(id).remove();

        // 删除存储文件
        if (mediaUrl && mediaUrl.startsWith("cloud://")) {
          try {
            await app.deleteFile({ fileList: [mediaUrl] });
          } catch (fileErr) {
            console.warn("CloudBase delete file warning:", fileErr);
          }
        }
      } catch (err) {
        console.error("[deleteAd] CloudBase error:", err);
        return { success: false, error: err instanceof Error ? err.message : "删除失败" };
      }

      revalidatePath("/admin/ads");
      return { success: true };
    }

    // 双端同步删除
    if (region === "both") {
      if (!supabaseAdmin) {
        return { success: false, error: "数据库连接失败" };
      }

      // 获取Supabase中的记录
      const { data: adData } = await supabaseAdmin
        .from("ads")
        .select("title, media_url")
        .eq("id", id)
        .single();

      const supabaseMediaUrl = adData?.media_url;

      // 删除Supabase数据库记录
      const { error } = await supabaseAdmin.from("ads").delete().eq("id", id);

      if (error) {
        console.error("[deleteAd] Error:", error);
        return { success: false, error: error.message };
      }

      // 删除Supabase Storage文件
      if (supabaseMediaUrl) {
        try {
          const urlParts = supabaseMediaUrl.split("/ads/");
          if (urlParts.length > 1) {
            const fileName = urlParts[1].split("?")[0];
            await supabaseAdmin.storage.from("ads").remove([fileName]);
          }
        } catch (err) {
          console.warn("Supabase delete file warning:", err);
        }
      }

      // 删除CloudBase数据库记录和Storage文件
      try {
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        const app = connector.getApp();

        // 查询CloudBase中是否有同名记录
        if (adData?.title) {
          const result = await db.collection("ads")
            .where({ title: adData.title })
            .get();

          // 删除CloudBase数据库记录和Storage文件
          if (result.data && result.data.length > 0) {
            for (const doc of result.data) {
              const cloudbaseMediaUrl = doc.media_url;

              // 删除数据库记录
              await db.collection("ads").doc(doc._id).remove();
              console.log("CloudBase database record deleted:", doc._id);

              // 删除Storage文件（使用CloudBase的fileID）
              if (cloudbaseMediaUrl && cloudbaseMediaUrl.startsWith("cloud://")) {
                try {
                  await app.deleteFile({ fileList: [cloudbaseMediaUrl] });
                  console.log("CloudBase storage file deleted:", cloudbaseMediaUrl);
                } catch (fileErr) {
                  console.warn("CloudBase delete file warning:", fileErr);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn("CloudBase delete warning:", err);
      }

      revalidatePath("/admin/ads");
      return { success: true };
    }

    // 国际版删除 Supabase
    if (!supabaseAdmin) {
      return { success: false, error: "数据库连接失败" };
    }

    // 获取文件URL
    const { data: adData } = await supabaseAdmin
      .from("ads")
      .select("media_url")
      .eq("id", id)
      .single();

    if (adData) {
      mediaUrl = adData.media_url;
    }

    // 删除数据库记录
    const { error } = await supabaseAdmin.from("ads").delete().eq("id", id);

    if (error) {
      console.error("[deleteAd] Error:", error);
      return { success: false, error: error.message };
    }

    // 删除存储文件
    if (mediaUrl) {
      try {
        const urlParts = mediaUrl.split("/ads/");
        if (urlParts.length > 1) {
          const fileName = urlParts[1].split("?")[0];
          await supabaseAdmin.storage.from("ads").remove([fileName]);
        }
      } catch (err) {
        console.warn("Supabase delete file warning:", err);
      }
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
  source?: string
): Promise<{ success: boolean; error?: string }> {
  // 兼容boolean类型参数
  const statusStr = typeof status === "boolean" ? (status ? "active" : "inactive") : status;
  return updateAd(id, { status: statusStr }, source);
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
