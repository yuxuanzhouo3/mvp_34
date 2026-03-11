export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseUrlFromEnv, getSupabaseAnonKeyFromEnv } from "@/lib/supabase/env";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getEffectiveSupabaseUserWallet } from "@/services/wallet-supabase";
import { getPlanShareExpireDays } from "@/utils/plan-limits";
import { nanoid } from "nanoid";

// 生成8位大写秘钥
function generateSecret() {
  return nanoid(8).toUpperCase();
}

/**
 * POST /api/international/share
 * 创建分享链接
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { buildId, expireDays, shareType = "link", makePublic = false, expiresInDays = 7 } = body as {
      buildId: string;
      expireDays: number;
      shareType?: "link" | "qrcode";
      makePublic?: boolean;
      expiresInDays?: number;
    };

    if (!buildId || !expireDays) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // 获取用户信息
    const supabaseUrl = getSupabaseUrlFromEnv();
    const supabaseAnonKey = getSupabaseAnonKeyFromEnv();

    if (!supabaseUrl || !supabaseAnonKey || !supabaseAdmin) {
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 503 }
      );
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    });

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 获取用户套餐信息
    const wallet = await getEffectiveSupabaseUserWallet(user.id);
    if (!wallet) {
      return NextResponse.json(
        { error: "Failed to load wallet" },
        { status: 503 }
      );
    }
    const plan = wallet.plan || "Free";
    const maxShareDays = getPlanShareExpireDays(plan);

    // Free 用户不支持分享
    if (maxShareDays === 0) {
      return NextResponse.json(
        { error: "Sharing not available for Free plan" },
        { status: 403 }
      );
    }

    // Team 用户才能使用二维码分享
    if (shareType === "qrcode" && plan.toLowerCase() !== "team") {
      return NextResponse.json(
        { error: "QR code sharing is only available for Team plan" },
        { status: 403 }
      );
    }

    // 获取构建信息
    const { data: build } = await supabaseAdmin
      .from("builds")
      .select("id, user_id, expires_at, status, output_file_path")
      .eq("id", buildId)
      .single();

    if (!build) {
      return NextResponse.json(
        { error: "Build not found" },
        { status: 404 }
      );
    }

    // 验证构建所有权
    if (build.user_id !== user.id) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // 验证构建状态
    if (build.status !== "completed" || !build.output_file_path) {
      return NextResponse.json(
        { error: "Build not completed or file not available" },
        { status: 400 }
      );
    }

    // 计算构建剩余有效期（天）
    const buildExpiresAt = new Date(build.expires_at);
    const now = new Date();
    const buildRemainingMs = buildExpiresAt.getTime() - now.getTime();
    const buildRemainingDays = Math.ceil(buildRemainingMs / (1000 * 60 * 60 * 24));

    if (buildRemainingDays <= 0) {
      return NextResponse.json(
        { error: "Build has expired" },
        { status: 400 }
      );
    }

    // 验证并限制 expiresInDays 范围（1-30天）
    const validExpiresInDays = Math.max(1, Math.min(30, expiresInDays));

    // 计算实际分享有效期：取用户设置、套餐限制、构建剩余有效期的最小值
    const actualExpireDays = Math.min(expireDays, maxShareDays, buildRemainingDays, validExpiresInDays);

    if (actualExpireDays <= 0) {
      return NextResponse.json(
        { error: "Invalid expire days" },
        { status: 400 }
      );
    }

    // 生成分享码
    const shareCode = nanoid(12);

    // 生成秘钥（如果不是公开分享）
    const secret = makePublic ? null : generateSecret();

    // 计算分享过期时间
    const shareExpiresAt = new Date(now.getTime() + actualExpireDays * 24 * 60 * 60 * 1000);

    // 创建分享记录
    const { data: share, error: insertError } = await supabaseAdmin
      .from("build_shares")
      .insert({
        share_code: shareCode,
        build_id: buildId,
        user_id: user.id,
        share_type: shareType,
        is_public: makePublic,
        secret: secret,
        expires_in_days: validExpiresInDays,
        expires_at: shareExpiresAt.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("[share] Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to create share" },
        { status: 500 }
      );
    }

    // 构建分享URL - 指向前端展示页面
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const shareUrl = `${appUrl}/share/${shareCode}`;

    return NextResponse.json({
      success: true,
      share: {
        id: share.id,
        shareCode,
        shareUrl,
        shareType,
        isPublic: makePublic,
        secret: secret || "",
        expiresAt: shareExpiresAt.toISOString(),
        actualExpireDays,
        maxShareDays,
        buildRemainingDays,
      },
    });
  } catch (error) {
    console.error("[share] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/international/share?buildId=xxx
 * 获取构建的分享列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const buildId = searchParams.get("buildId");

    if (!buildId) {
      return NextResponse.json(
        { error: "Missing buildId" },
        { status: 400 }
      );
    }

    // 获取用户信息
    const supabaseUrl = getSupabaseUrlFromEnv();
    const supabaseAnonKey = getSupabaseAnonKeyFromEnv();

    if (!supabaseUrl || !supabaseAnonKey || !supabaseAdmin) {
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 503 }
      );
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    });

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 获取分享列表
    const { data: shares } = await supabaseAdmin
      .from("build_shares")
      .select("*")
      .eq("build_id", buildId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    return NextResponse.json({
      shares: (shares || []).map((s) => ({
        ...s,
        shareUrl: `${appUrl}/share/${s.share_code}`,
        expired: new Date(s.expires_at).getTime() < Date.now(),
      })),
    });
  } catch (error) {
    console.error("[share] GET Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/international/share?id=xxx
 * 删除分享
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shareId = searchParams.get("id");

    if (!shareId) {
      return NextResponse.json(
        { error: "Missing share id" },
        { status: 400 }
      );
    }

    // 获取用户信息
    const supabaseUrl = getSupabaseUrlFromEnv();
    const supabaseAnonKey = getSupabaseAnonKeyFromEnv();

    if (!supabaseUrl || !supabaseAnonKey || !supabaseAdmin) {
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 503 }
      );
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    });

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 删除分享（只能删除自己的）
    const { error } = await supabaseAdmin
      .from("build_shares")
      .delete()
      .eq("id", shareId)
      .eq("user_id", user.id);

    if (error) {
      console.error("[share] Delete error:", error);
      return NextResponse.json(
        { error: "Failed to delete share" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[share] DELETE Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
