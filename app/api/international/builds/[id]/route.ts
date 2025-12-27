import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

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

    // Generate download URL if completed
    let downloadUrl: string | null = null;
    if (build.status === "completed" && build.output_file_path) {
      const serviceClient = createServiceClient();
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
