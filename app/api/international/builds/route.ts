import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// Check if a build is expired
function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

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
    const platform = searchParams.get("platform");
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

    if (platform && platform !== "all") {
      query = query.eq("platform", platform);
    }

    const { data: builds, error: queryError } = await query;

    if (queryError) {
      console.error("Query error:", queryError);
      return NextResponse.json(
        { error: "Database error", message: "Failed to fetch builds" },
        { status: 500 }
      );
    }

    const serviceClient = createServiceClient();

    // Process builds: clean up expired ones and get icon URLs
    const buildsWithIcons = await Promise.all(
      (builds || []).map(async (build) => {
        // Check if build is expired and has files to clean
        if (build.expires_at && isExpired(build.expires_at) && (build.output_file_path || build.icon_path)) {
          // Clean up expired build files in background
          const filesToDelete: string[] = [];
          if (build.output_file_path) filesToDelete.push(build.output_file_path);
          if (build.icon_path) filesToDelete.push(build.icon_path);

          if (filesToDelete.length > 0) {
            serviceClient.storage.from("user-builds").remove(filesToDelete).catch(console.error);
          }

          // Update build record to mark files as cleaned
          void serviceClient
            .from("builds")
            .update({ output_file_path: null, icon_path: null })
            .eq("id", build.id)
            .then(() => {});

          return { ...build, output_file_path: null, icon_path: null, icon_url: null };
        }

        // Get icon URL for non-expired builds with icons
        if (build.icon_path) {
          try {
            const { data } = await serviceClient.storage
              .from("user-builds")
              .createSignedUrl(build.icon_path, 3600);
            return { ...build, icon_url: data?.signedUrl || null };
          } catch {
            return { ...build, icon_url: null };
          }
        }
        return { ...build, icon_url: null };
      })
    );

    // Get counts for stats (including platform stats)
    const { data: counts } = await supabase
      .from("builds")
      .select("status, platform")
      .eq("user_id", user.id);

    const stats = {
      total: counts?.length || 0,
      pending: counts?.filter((b) => b.status === "pending").length || 0,
      processing: counts?.filter((b) => b.status === "processing").length || 0,
      completed: counts?.filter((b) => b.status === "completed").length || 0,
      failed: counts?.filter((b) => b.status === "failed").length || 0,
    };

    // Platform stats
    const platformStats = {
      android: counts?.filter((b) => b.platform === "android").length || 0,
      ios: counts?.filter((b) => b.platform === "ios").length || 0,
      wechat: counts?.filter((b) => b.platform === "wechat").length || 0,
      harmonyos: counts?.filter((b) => b.platform === "harmonyos").length || 0,
      windows: counts?.filter((b) => b.platform === "windows").length || 0,
      macos: counts?.filter((b) => b.platform === "macos").length || 0,
      linux: counts?.filter((b) => b.platform === "linux").length || 0,
      chrome: counts?.filter((b) => b.platform === "chrome").length || 0,
    };

    return NextResponse.json({
      builds: buildsWithIcons,
      stats,
      platformStats,
    });
  } catch (error) {
    console.error("Builds API error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
