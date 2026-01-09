export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { deductBuildQuota, checkBuildQuota } from "@/services/wallet-supabase";

/**
 * 扣减构建额度 API
 * POST /api/payment/deduct-quota
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, count = 1 } = body as { userId?: string; count?: number };

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Missing userId" },
        { status: 400 }
      );
    }

    const result = await deductBuildQuota(userId, count);

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
 * GET /api/payment/deduct-quota?userId=xxx&count=1
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const count = parseInt(searchParams.get("count") || "1", 10);

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Missing userId" },
        { status: 400 }
      );
    }

    const result = await checkBuildQuota(userId, count);

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
