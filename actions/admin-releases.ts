"use server";

/**
 * 发布版本管理 Server Actions
 * 支持 Supabase (国际版) 和 CloudBase (国内版)
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/utils/session";

export interface Release {
  id: string;
  version: string;
  version_code: number;
  title: string;
  description?: string;
  release_notes?: string;
  download_url?: string;
  file_url?: string; // 别名，兼容旧代码
  download_url_backup?: string;
  file_size?: number;
  file_hash?: string;
  platform: string;
  variant?: string; // 平台变体，兼容旧代码
  region: "global" | "cn";
  status: "draft" | "published" | "deprecated";
  is_active: boolean; // 兼容旧代码
  is_force_update: boolean;
  is_mandatory?: boolean; // 别名，兼容旧代码
  min_supported_version?: string;
  published_at?: string;
  source?: string; // 数据来源标识
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
  const status = (doc.status as "draft" | "published" | "deprecated") || "draft";
  const is_force_update = (doc.is_force_update as boolean) || false;
  const region = (doc.region as "global" | "cn") || "cn";
  return {
    id: (doc._id as string) || "",
    version: (doc.version as string) || "",
    version_code: (doc.version_code as number) || 0,
    title: (doc.title as string) || "",
    description: doc.description as string | undefined,
    release_notes: doc.release_notes as string | undefined,
    download_url: doc.download_url as string | undefined,
    file_url: doc.file_url as string | undefined || doc.download_url as string | undefined,
    download_url_backup: doc.download_url_backup as string | undefined,
    file_size: doc.file_size as number | undefined,
    file_hash: doc.file_hash as string | undefined,
    platform: (doc.platform as string) || "",
    variant: doc.variant as string | undefined,
    region,
    status,
    is_active: status === "published",
    is_force_update,
    is_mandatory: is_force_update,
    min_supported_version: doc.min_supported_version as string | undefined,
    published_at: doc.published_at as string | undefined,
    source: region === "both" ? "both" : "cloudbase",
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

    return (data || []).map((item) => ({
      ...item,
      region: item.region || "global",
      source: item.region === "both" ? "both" : "supabase",
      file_url: item.file_url || item.download_url,
      is_active: item.status === "published",
    }));
  } catch (err) {
    console.error("[getSupabaseReleases] Unexpected error:", err);
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
      .from("releases")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (error) {
      console.error("Supabase upload error:", error);
      return null;
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("releases")
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
    const cloudPath = `releases/${fileName}`;

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

async function getCloudBaseReleases(platform?: string): Promise<Release[]> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();
    const app = connector.getApp();

    let query = db.collection("releases");

    if (platform && platform !== "all") {
      query = query.where({ platform });
    }

    const result = await query
      .orderBy("version_code", "desc")
      .limit(100)
      .get();

    const releases = (result.data || []).map((doc: Record<string, unknown>) => cloudBaseDocToRelease(doc));

    // 收集需要获取临时 URL 的 fileID
    const cloudbaseReleases: { release: Release; fileId: string }[] = [];
    for (const release of releases) {
      if (release.download_url && release.download_url.startsWith("cloud://")) {
        cloudbaseReleases.push({ release, fileId: release.download_url });
      }
    }

    // 批��获取临时 URL
    if (cloudbaseReleases.length > 0) {
      try {
        const fileIds = cloudbaseReleases.map((item) => item.fileId);
        const urlResult = await app.getTempFileURL({ fileList: fileIds });

        if (urlResult.fileList && Array.isArray(urlResult.fileList)) {
          const urlMap = new Map<string, string>();
          for (const fileInfo of urlResult.fileList) {
            if (fileInfo.tempFileURL && fileInfo.code === "SUCCESS") {
              urlMap.set(fileInfo.fileID, fileInfo.tempFileURL);
            }
          }

          // 更新 releases 中的 download_url
          for (const { release, fileId } of cloudbaseReleases) {
            const tempUrl = urlMap.get(fileId);
            if (tempUrl) {
              release.download_url = tempUrl;
              release.file_url = tempUrl;
            }
          }
        }
      } catch (urlErr) {
        console.error("[getCloudBaseReleases] getTempFileURL error:", urlErr);
      }
    }

    return releases;
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
    const app = connector.getApp();

    // 获取文件URL
    const result = await db.collection("releases").doc(id).get();
    let downloadUrl: string | null = null;
    if (result.data && result.data.length > 0) {
      downloadUrl = result.data[0].download_url || result.data[0].file_url;
    }

    // 删除数据库记录
    await db.collection("releases").doc(id).remove();

    // 删除存储文件
    if (downloadUrl && downloadUrl.startsWith("cloud://")) {
      try {
        await app.deleteFile({ fileList: [downloadUrl] });
      } catch (fileErr) {
        console.warn("CloudBase delete file warning:", fileErr);
      }
    }

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
  // 权限验证
  if (!(await verifyAdminSession())) {
    console.error("[getReleases] Unauthorized access attempt");
    return [];
  }

  try {
    if (region === "cn") {
      return await getCloudBaseReleases(platform);
    } else if (region === "global") {
      return await getSupabaseReleases(platform);
    } else {
      // region === "all" 或未指定，合并两个数据源并去重
      const [supabaseData, cloudbaseData] = await Promise.all([
        getSupabaseReleases(platform),
        getCloudBaseReleases(platform),
      ]);

      // 去重：优先保留Supabase中region="both"的记录
      const versionSet = new Set<string>();
      const deduped: Release[] = [];

      // 先添加Supabase数据
      for (const release of supabaseData) {
        const key = `${release.platform}-${release.version}`;
        versionSet.add(key);
        deduped.push(release);
      }

      // 再添加CloudBase数据，跳过已存在的版本
      for (const release of cloudbaseData) {
        const key = `${release.platform}-${release.version}`;
        if (!versionSet.has(key)) {
          deduped.push(release);
        }
      }

      // 按版本代码排序
      return deduped.sort((a, b) => b.version_code - a.version_code);
    }
  } catch (err) {
    console.error("[getReleases] Unexpected error:", err);
    return [];
  }
}

/**
 * 创建发布版本
 * 根据 uploadTarget 字段决定存储到哪个数据库
 */
export async function createRelease(
  formData: any
): Promise<{ success: boolean; error?: string; id?: string }> {
  // 权限验证
  if (!(await verifyAdminSession())) {
    console.error("[createRelease] Unauthorized access attempt");
    return { success: false, error: "未授权访问" };
  }

  try {
    // 处理 FormData 对象
    const isFormData = formData instanceof FormData;
    const getData = (key: string) => isFormData ? formData.get(key) : formData[key];

    const version = getData("version") as string;
    const file = getData("file") as File | null;
    const uploadTarget = getData("uploadTarget") as string || getData("region") as string;

    if (!version) {
      return { success: false, error: "版本号不能为���" };
    }

    // 如果有文件上传
    let supabaseDownloadUrl: string | null = null;
    let cloudbaseDownloadUrl: string | null = null;
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

        supabaseDownloadUrl = supabaseResult;
        cloudbaseDownloadUrl = cloudbaseResult;
      } else if (uploadTarget === "cn" || uploadTarget === "cloudbase") {
        cloudbaseDownloadUrl = await uploadToCloudBase(file, fileName);
        if (!cloudbaseDownloadUrl) {
          return { success: false, error: "上传到 CloudBase 失败" };
        }
      } else {
        supabaseDownloadUrl = await uploadToSupabase(file, fileName);
        if (!supabaseDownloadUrl) {
          return { success: false, error: "上传到 Supabase 失败" };
        }
      }
    } else {
      const downloadUrlData = getData("download_url") as string;
      supabaseDownloadUrl = downloadUrlData;
      cloudbaseDownloadUrl = downloadUrlData;
    }

    // 双端同步：写入两个数据库
    if (uploadTarget === "both") {
      if (!supabaseDownloadUrl || !cloudbaseDownloadUrl) {
        return { success: false, error: "请上传文件或提供下载URL" };
      }

      // 写入 Supabase
      if (!supabaseAdmin) {
        return { success: false, error: "数据库连接失败" };
      }

      const { data, error } = await supabaseAdmin
        .from("releases")
        .insert({
          version,
          version_code: parseInt(getData("version_code") as string) || 0,
          title: getData("title") as string,
          description: getData("description") as string,
          release_notes: getData("release_notes") as string,
          download_url: supabaseDownloadUrl,
          download_url_backup: getData("download_url_backup") as string,
          file_size: fileSize,
          file_hash: getData("file_hash") as string,
          platform: getData("platform") as string,
          region: "both",
          status: getData("status") as string || "draft",
          is_force_update: getData("is_force_update") === "true" || getData("is_force_update") === true,
          min_supported_version: getData("min_supported_version") as string,
        })
        .select("id")
        .single();

      if (error) {
        console.error("[createRelease] Supabase error:", error);
        return { success: false, error: error.message };
      }

      // 同时写入 CloudBase
      const cloudbaseResult = await createCloudBaseRelease({
        version,
        version_code: parseInt(getData("version_code") as string) || 0,
        title: getData("title") as string,
        description: getData("description") as string,
        release_notes: getData("release_notes") as string,
        download_url: cloudbaseDownloadUrl,
        download_url_backup: getData("download_url_backup") as string,
        file_size: fileSize,
        file_hash: getData("file_hash") as string,
        platform: getData("platform") as string,
        region: "cn",
        status: getData("status") as string,
        is_force_update: getData("is_force_update") === "true" || getData("is_force_update") === true,
        min_supported_version: getData("min_supported_version") as string,
      });

      if (!cloudbaseResult.success) {
        console.error("[createRelease] CloudBase write failed:", cloudbaseResult.error);
      }

      revalidatePath("/admin/releases");
      return { success: true, id: data.id };
    }

    // 国内版存储到 CloudBase
    if (uploadTarget === "cn" || uploadTarget === "cloudbase") {
      if (!cloudbaseDownloadUrl) {
        return { success: false, error: "请上传文件或提供下载URL" };
      }

      const result = await createCloudBaseRelease({
        version,
        version_code: parseInt(getData("version_code") as string) || 0,
        title: getData("title") as string,
        description: getData("description") as string,
        release_notes: getData("release_notes") as string,
        download_url: cloudbaseDownloadUrl,
        download_url_backup: getData("download_url_backup") as string,
        file_size: fileSize,
        file_hash: getData("file_hash") as string,
        platform: getData("platform") as string,
        region: "cn",
        status: getData("status") as string,
        is_force_update: getData("is_force_update") === "true" || getData("is_force_update") === true,
        min_supported_version: getData("min_supported_version") as string,
      });
      if (result.success) {
        revalidatePath("/admin/releases");
      }
      return result;
    }

    // 国际版存储到 Supabase
    if (!supabaseAdmin) {
      return { success: false, error: "数据库连接失败" };
    }

    if (!supabaseDownloadUrl) {
      return { success: false, error: "请上传文件或提供下载URL" };
    }

    const { data, error } = await supabaseAdmin
      .from("releases")
      .insert({
        version,
        version_code: parseInt(getData("version_code") as string) || 0,
        title: getData("title") as string,
        description: getData("description") as string,
        release_notes: getData("release_notes") as string,
        download_url: supabaseDownloadUrl,
        download_url_backup: getData("download_url_backup") as string,
        file_size: fileSize,
        file_hash: getData("file_hash") as string,
        platform: getData("platform") as string,
        region: "global",
        status: getData("status") as string || "draft",
        is_force_update: getData("is_force_update") === "true" || getData("is_force_update") === true,
        min_supported_version: getData("min_supported_version") as string,
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
  formData: any,
  region?: string
): Promise<{ success: boolean; error?: string }> {
  // 权限验证
  if (!(await verifyAdminSession())) {
    console.error("[updateRelease] Unauthorized access attempt");
    return { success: false, error: "未授权访问" };
  }

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
  // 权限验证
  if (!(await verifyAdminSession())) {
    console.error("[deleteRelease] Unauthorized access attempt");
    return { success: false, error: "未授权访问" };
  }

  try {
    // 先获取文件URL以便删除存储文件
    let downloadUrl: string | null = null;

    // 国内版删除 CloudBase
    if (region === "cn") {
      const result = await deleteCloudBaseRelease(id);
      if (result.success) {
        revalidatePath("/admin/releases");
      }
      return result;
    }

    // 双端同步删除
    if (region === "both") {
      if (!supabaseAdmin) {
        return { success: false, error: "数据库连接失败" };
      }

      // 获取Supabase中的记录
      const { data: releaseData } = await supabaseAdmin
        .from("releases")
        .select("version, platform, download_url, file_url")
        .eq("id", id)
        .single();

      const supabaseDownloadUrl = releaseData?.download_url || releaseData?.file_url;

      // 删除Supabase数据库记录
      const { error } = await supabaseAdmin
        .from("releases")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("[deleteRelease] Error:", error);
        return { success: false, error: error.message };
      }

      // 删除Supabase Storage文件
      if (supabaseDownloadUrl) {
        try {
          const urlParts = supabaseDownloadUrl.split("/releases/");
          if (urlParts.length > 1) {
            const fileName = urlParts[1].split("?")[0];
            await supabaseAdmin.storage.from("releases").remove([fileName]);
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

        // 查询CloudBase中是否有同版本记录
        if (releaseData?.version && releaseData?.platform) {
          const result = await db.collection("releases")
            .where({
              version: releaseData.version,
              platform: releaseData.platform
            })
            .get();

          // 删除CloudBase数据库记录和Storage文件
          if (result.data && result.data.length > 0) {
            for (const doc of result.data) {
              const cloudbaseDownloadUrl = doc.download_url || doc.file_url;

              // 删除数据库记录
              await db.collection("releases").doc(doc._id).remove();

              // 删除Storage文件（使用CloudBase的fileID）
              if (cloudbaseDownloadUrl && cloudbaseDownloadUrl.startsWith("cloud://")) {
                try {
                  await app.deleteFile({ fileList: [cloudbaseDownloadUrl] });
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

      revalidatePath("/admin/releases");
      return { success: true };
    }

    // 国际版删除 Supabase
    if (!supabaseAdmin) {
      return { success: false, error: "数据库连接失败" };
    }

    // 获取文件URL
    const { data: releaseData } = await supabaseAdmin
      .from("releases")
      .select("download_url, file_url")
      .eq("id", id)
      .single();

    if (releaseData) {
      downloadUrl = releaseData.download_url || releaseData.file_url;
    }

    // 删除数据库记录
    const { error } = await supabaseAdmin
      .from("releases")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[deleteRelease] Error:", error);
      return { success: false, error: error.message };
    }

    // 删除存储文件
    if (downloadUrl) {
      try {
        const urlParts = downloadUrl.split("/releases/");
        if (urlParts.length > 1) {
          const fileName = urlParts[1].split("?")[0];
          await supabaseAdmin.storage.from("releases").remove([fileName]);
        }
      } catch (err) {
        console.warn("Supabase delete file warning:", err);
      }
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

// ============================================================================
// 类型别名和函数别名（向后兼容）
// ============================================================================

/**
 * AppRelease 类型别名（向后兼容）
 */
export type AppRelease = Release;

/**
 * Platform 类型（向后兼容）
 */
export type Platform = string; // 改为string以兼容页面代码

/**
 * Variant 类型（向后兼容）
 */
export type Variant = string;

/**
 * 获取版本列表（向后兼容的函数别名）
 */
export async function listReleases(region?: string, platform?: string): Promise<{ success: boolean; data?: Release[]; error?: string }> {
  try {
    const data = await getReleases(region, platform);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "获取版本列表失败" };
  }
}

/**
 * 切换版本状态（向后兼容的函数别名）
 */
export async function toggleReleaseStatus(
  id: string,
  isActive: boolean,
  region?: string
): Promise<{ success: boolean; error?: string }> {
  const status = isActive ? "published" : "draft";
  return updateRelease(id, { status }, region);
}
