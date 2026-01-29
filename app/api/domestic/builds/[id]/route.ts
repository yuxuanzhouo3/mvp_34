/**
 * 国内版 Build 详情 API
 * 使用 CloudBase 数据库
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { getCloudBaseStorage } from "@/lib/cloudbase/storage";

// Check if a build is expired
function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 验证用户身份
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please login to view build" },
        { status: 401 }
      );
    }

    const authService = new CloudBaseAuthService();
    const user = await authService.validateToken(token);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // 连接 CloudBase 数据库
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    // 获取构建记录
    const { data: builds } = await db
      .collection("builds")
      .where({ _id: id, user_id: user.id })
      .limit(1)
      .get();

    const build = builds?.[0];

    if (!build) {
      return NextResponse.json(
        { error: "Not found", message: "Build not found" },
        { status: 404 }
      );
    }

    // 检查是否过期
    if (build.expires_at && isExpired(build.expires_at)) {
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

    // 实时生成新的临时下载链接（CloudBase 临时链接有效期约2小时）
    let downloadUrl: string | null = null;
    if (build.output_file_path && build.status === "completed") {
      try {
        const storage = getCloudBaseStorage();
        downloadUrl = await storage.getTempDownloadUrl(build.output_file_path);
      } catch (error) {
        console.error("[Domestic Build API] Failed to generate download URL:", error);
      }
    }

    // 返回构建详情
    return NextResponse.json({
      build: {
        ...build,
        downloadUrl,
      },
    });
  } catch (error) {
    console.error("[Domestic Build API] GET Error:", error);
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

    // 验证用户身份
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please login to delete build" },
        { status: 401 }
      );
    }

    const authService = new CloudBaseAuthService();
    const user = await authService.validateToken(token);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // 连接 CloudBase 数据库
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    // 先获取构建记录，确认属于当前用户
    const { data: builds } = await db
      .collection("builds")
      .where({ _id: id, user_id: user.id })
      .limit(1)
      .get();

    const build = builds?.[0];

    if (!build) {
      return NextResponse.json(
        { error: "Not found", message: "Build not found" },
        { status: 404 }
      );
    }

    // 删除云存储中的文件
    const storage = getCloudBaseStorage();

    if (build.output_file_path) {
      try {
        await storage.deleteFile(build.output_file_path);
      } catch (err) {
        console.error(`[Domestic Build API] Failed to delete output file:`, err);
      }
    }

    if (build.icon_path) {
      try {
        await storage.deleteFile(build.icon_path);
      } catch (err) {
        console.error(`[Domestic Build API] Failed to delete icon file:`, err);
      }
    }

    // 删除构建记录
    await db.collection("builds").doc(id).remove();

    return NextResponse.json({
      success: true,
      message: "Build deleted successfully",
    });
  } catch (error) {
    console.error("[Domestic Build API] DELETE Error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
