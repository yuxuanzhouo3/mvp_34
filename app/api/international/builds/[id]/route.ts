import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// Check if a build is expired
function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

// Clean up expired build files (delete files but keep record)
async function cleanupExpiredBuild(
  serviceClient: ReturnType<typeof createServiceClient>,
  build: { id: string; output_file_path: string | null; icon_path: string | null }
): Promise<void> {
  const filesToDelete: string[] = [];

  if (build.output_file_path) {
    filesToDelete.push(build.output_file_path);
  }
  if (build.icon_path) {
    filesToDelete.push(build.icon_path);
  }

  if (filesToDelete.length > 0) {
    await serviceClient.storage.from("user-builds").remove(filesToDelete);
  }

  // Update build record to mark files as cleaned
  await serviceClient
    .from("builds")
    .update({ output_file_path: null, icon_path: null })
    .eq("id", build.id);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please login to view build" },
        { status: 401 }
      );
    }

    // Get build
    const { data: build, error: queryError } = await supabase
      .from("builds")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (queryError || !build) {
      return NextResponse.json(
        { error: "Not found", message: "Build not found" },
        { status: 404 }
      );
    }

    const serviceClient = createServiceClient();

    // Check if build is expired
    if (build.expires_at && isExpired(build.expires_at)) {
      // Clean up files if they still exist
      if (build.output_file_path || build.icon_path) {
        await cleanupExpiredBuild(serviceClient, build);
      }

      return NextResponse.json({
        build: {
          ...build,
          output_file_path: null,
          icon_path: null,
          downloadUrl: null,
          expired: true,
        },
      });
    }

    // Generate download URL if completed and not expired
    let downloadUrl: string | null = null;
    if (build.status === "completed" && build.output_file_path) {
      const { data: signedUrl } = await serviceClient.storage
        .from("user-builds")
        .createSignedUrl(build.output_file_path, 3600); // 1 hour expiry

      downloadUrl = signedUrl?.signedUrl || null;
    }

    return NextResponse.json({
      build: {
        ...build,
        downloadUrl,
      },
    });
  } catch (error) {
    console.error("Build API error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please login to delete build" },
        { status: 401 }
      );
    }

    // Get build first
    const { data: build, error: queryError } = await supabase
      .from("builds")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (queryError || !build) {
      return NextResponse.json(
        { error: "Not found", message: "Build not found" },
        { status: 404 }
      );
    }

    const serviceClient = createServiceClient();

    // Delete files from storage
    if (build.output_file_path) {
      await serviceClient.storage
        .from("user-builds")
        .remove([build.output_file_path]);
    }

    if (build.icon_path) {
      await serviceClient.storage
        .from("user-builds")
        .remove([build.icon_path]);
    }

    // Delete build record
    const { error: deleteError } = await serviceClient
      .from("builds")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      return NextResponse.json(
        { error: "Database error", message: "Failed to delete build" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Build deleted successfully",
    });
  } catch (error) {
    console.error("Build delete API error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
