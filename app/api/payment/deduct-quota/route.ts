export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseUrlFromEnv, getSupabaseAnonKeyFromEnv } from "@/lib/supabase/env";
import { deductBuildQuota, checkBuildQuota } from "@/services/wallet-supabase";

/**
 * 扣减构建额度 API
 * POST /api/payment/deduct-quota
 *
 * 安全修复：添加身份验证，从认证token获取userId
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { count = 1 } = body as { count?: number };

    // 验证用户身份
    const supabaseUrl = getSupabaseUrlFromEnv();
    const supabaseAnonKey = getSupabaseAnonKeyFromEnv();

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { success: false, error: "Service unavailable" },
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
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 使用验证后的用户ID
    const result = await deductBuildQuota(user.id, count);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, remaining: result.remaining },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      remaining: result.remaining,
    });
  } catch (err) {
    console.error("[deduct-quota] error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to deduct quota" },
      { status: 500 }
    );
  }
}

/**
 * 检查构建额度 API
 * GET /api/payment/deduct-quota?count=1
 *
 * 安全修复：添加身份验证，从认证token获取userId
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const count = parseInt(searchParams.get("count") || "1", 10);

    // 验证用户身份
    const supabaseUrl = getSupabaseUrlFromEnv();
    const supabaseAnonKey = getSupabaseAnonKeyFromEnv();

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { success: false, error: "Service unavailable" },
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
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 使用验证后的用户ID
    const result = await checkBuildQuota(user.id, count);

    return NextResponse.json({
      success: true,
      allowed: result.allowed,
      remaining: result.remaining,
      limit: result.limit,
    });
  } catch (err) {
    console.error("[check-quota] error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to check quota" },
      { status: 500 }
    );
  }
}
