import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isDomestic = searchParams.get("isDomestic") === "true";
    const platform = searchParams.get("platform") || "all";

    let releases = [];

    if (isDomestic) {
      // 国内版：从 CloudBase 获取
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();

      let query = db
        .collection("releases")
        .where({ status: "published", region: "cn" });

      if (platform && platform !== "all") {
        query = query.where({ platform });
      }

      const result = await query
        .orderBy("version_code", "desc")
        .limit(20)
        .get();

      releases = (result.data || []).map((doc: any) => ({
        id: doc._id,
        version: doc.version,
        version_code: doc.version_code,
        title: doc.title,
        description: doc.description,
        release_notes: doc.release_notes,
        download_url: doc.download_url,
        download_url_backup: doc.download_url_backup,
        file_size: doc.file_size,
        platform: doc.platform,
        published_at: doc.published_at,
      }));

      // 将 cloud:// URL 转换为临时 HTTPS 下载链接
      const cloudbaseReleases = releases.filter(
        (r: any) => r.download_url && r.download_url.startsWith("cloud://")
      );

      if (cloudbaseReleases.length > 0) {
        try {
          const app = connector.getApp();
          const fileIds = cloudbaseReleases.map((r: any) => r.download_url);
          const urlResult = await app.getTempFileURL({ fileList: fileIds });

          if (urlResult.fileList && Array.isArray(urlResult.fileList)) {
            const urlMap = new Map<string, string>();
            for (const fileInfo of urlResult.fileList) {
              if (fileInfo.tempFileURL && fileInfo.code === "SUCCESS") {
                urlMap.set(fileInfo.fileID, fileInfo.tempFileURL);
              }
            }

            // 更新 releases 中的 download_url
            for (const release of cloudbaseReleases) {
              const tempUrl = urlMap.get(release.download_url);
              if (tempUrl) {
                release.download_url = tempUrl;
              }
            }
          }
        } catch (urlErr) {
          console.error("[API] getTempFileURL error:", urlErr);
        }
      }
    } else {
      // 国际版：从 Supabase 获取
      if (supabaseAdmin) {
        let query = supabaseAdmin
          .from("releases")
          .select("*")
          .eq("status", "published")
          .eq("region", "global");

        if (platform && platform !== "all") {
          query = query.eq("platform", platform);
        }

        const { data, error } = await query
          .order("version_code", { ascending: false })
          .limit(20);

        if (!error && data) {
          releases = data.map((item: any) => ({
            id: item.id,
            version: item.version,
            version_code: item.version_code,
            title: item.title,
            description: item.description,
            release_notes: item.release_notes,
            download_url: item.download_url,
            download_url_backup: item.download_url_backup,
            file_size: item.file_size,
            platform: item.platform,
            published_at: item.published_at,
          }));
        }
      }
    }

    return NextResponse.json({ success: true, data: releases });
  } catch (error) {
    console.error("[API] Get active releases error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch releases" },
      { status: 500 }
    );
  }
}
