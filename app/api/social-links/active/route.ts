import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isDomestic = searchParams.get("isDomestic") === "true";

    let links = [];

    if (isDomestic) {
      // 国内版：从 CloudBase 获取
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();

      const result = await db
        .collection("social_links")
        .where({ status: "active", region: "cn" })
        .orderBy("sort_order", "asc")
        .limit(50)
        .get();

      links = (result.data || []).map((doc: any) => ({
        id: doc._id,
        title: doc.name,
        description: doc.description,
        icon_url: doc.icon || "🔗",
        target_url: doc.url,
        sort_order: doc.sort_order || 0,
      }));
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
