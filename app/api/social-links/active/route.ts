import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isDomestic = searchParams.get("isDomestic") === "true";

    let links: any[] = [];

    if (isDomestic) {
      // 国内版：从 CloudBase 获取
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();
      const app = connector.getApp();

      const result = await db
        .collection("social_links")
        .where({ status: "active", region: "cn" })
        .orderBy("sort_order", "asc")
        .limit(50)
        .get();

      if (result.data && Array.isArray(result.data)) {
        // 收集需要获取临时 URL 的 fileID
        const fileIdMap = new Map<string, any>();

        for (const doc of result.data) {
          if (doc.icon && doc.icon.startsWith("cloud://")) {
            fileIdMap.set(doc.icon, doc);
          } else {
            // 已经是临时 URL 或 emoji，直接使用
            links.push({
              id: doc._id,
              title: doc.name,
              description: doc.description,
              icon_url: doc.icon || "🔗",
              target_url: doc.url,
              sort_order: doc.sort_order || 0,
            });
          }
        }

        // 批量获取临时 URL
        if (fileIdMap.size > 0) {
          try {
            const fileIds = Array.from(fileIdMap.keys());
            const urlResult = await app.getTempFileURL({
              fileList: fileIds,
            });

            if (urlResult.fileList && Array.isArray(urlResult.fileList)) {
              for (const fileInfo of urlResult.fileList) {
                const doc = fileIdMap.get(fileInfo.fileID);
                if (doc && fileInfo.code === "SUCCESS" && fileInfo.tempFileURL) {
                  links.push({
                    id: doc._id,
                    title: doc.name,
                    description: doc.description,
                    icon_url: fileInfo.tempFileURL,
                    target_url: doc.url,
                    sort_order: doc.sort_order || 0,
                  });
                }
              }
            }
          } catch (urlErr) {
            console.error("CloudBase getTempFileURL error:", urlErr);
          }
        }
      }
    } else {
      // 国际版：从 Supabase 获取
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin
          .from("social_links")
          .select("*")
          .eq("status", "active")
          .eq("region", "global")
          .order("sort_order", { ascending: true })
          .limit(50);

        if (!error && data) {
          links = data.map((item: any) => ({
            id: item.id,
            title: item.name,
            description: item.description,
            icon_url: item.icon || "🔗",
            target_url: item.url,
            sort_order: item.sort_order || 0,
          }));
        }
      }
    }

    return NextResponse.json({ success: true, data: links });
  } catch (error) {
    console.error("[API] Get active social links error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch social links" },
      { status: 500 }
    );
  }
}
