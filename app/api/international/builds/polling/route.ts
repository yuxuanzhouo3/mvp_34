import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 国际版构建状态轮询接口
 * 只返回 pending/processing 状态，减少轮询数据量
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 只轮询最近 1 小时仍在进行中的构建
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: processingBuilds, error } = await supabase
      .from("builds")
      .select("id,status,progress,platform,created_at")
      .eq("user_id", user.id)
      .in("status", ["pending", "processing"])
      .gte("created_at", oneHourAgo)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[International Polling] Query error:", error);
      return NextResponse.json(
        { error: "Database error", message: "Failed to fetch processing builds" },
        { status: 500 }
      );
    }

    const builds = (processingBuilds || []).map((build) => ({
      id: build.id,
      status: build.status,
      progress: build.progress,
      platform: build.platform,
    }));

    return NextResponse.json({ builds });
  } catch (error) {
    console.error("[International Polling] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
