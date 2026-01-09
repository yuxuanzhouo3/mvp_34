export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseUrlFromEnv, getSupabaseAnonKeyFromEnv } from "@/lib/supabase/env";
import { checkBuildQuota } from "@/services/wallet-supabase";

/**
 * POST /api/international/quota/check
 * 检查用户是否有足够的构建额度（用于批量构建前的预检查）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { count = 1 } = body as { count?: number };

    // 验证 count 参数
    if (!Number.isInteger(count) || count < 1 || count > 10) {
      return NextResponse.json(
        { error: "Invalid count parameter", allowed: false },
        { status: 400 }
      );
    }

    // 获取用户信息
    const supabaseUrl = getSupabaseUrlFromEnv();
    const supabaseAnonKey = getSupabaseAnonKeyFromEnv();

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Service unavailable", allowed: false },
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
        { error: "Unauthorized", allowed: false },
        { status: 401 }
      );
    }

    // 检查额度
    const quotaCheck = await checkBuildQuota(user.id, count);

    return NextResponse.json({
      allowed: quotaCheck.allowed,
      remaining: quotaCheck.remaining,
      limit: quotaCheck.limit,
      requested: count,
    });
  } catch (error) {
    console.error("[quota/check] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", allowed: false },
      { status: 500 }
    );
  }
}
