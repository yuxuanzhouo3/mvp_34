import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please login to view builds" },
        { status: 401 }
      );
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query
    let query = supabase
      .from("builds")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data: builds, error: queryError } = await query;

    if (queryError) {
      console.error("Query error:", queryError);
      return NextResponse.json(
        { error: "Database error", message: "Failed to fetch builds" },
        { status: 500 }
      );
    }

    // Get counts for stats
    const { data: counts } = await supabase
      .from("builds")
      .select("status")
      .eq("user_id", user.id);

    const stats = {
      total: counts?.length || 0,
      pending: counts?.filter((b) => b.status === "pending").length || 0,
      processing: counts?.filter((b) => b.status === "processing").length || 0,
      completed: counts?.filter((b) => b.status === "completed").length || 0,
      failed: counts?.filter((b) => b.status === "failed").length || 0,
    };

    return NextResponse.json({
      builds: builds || [],
      stats,
    });
  } catch (error) {
    console.error("Builds API error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
