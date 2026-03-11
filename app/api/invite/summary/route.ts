import { NextRequest, NextResponse } from "next/server";
import { getUserInviteSummary } from "@/lib/invite/referrals";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const userId = String(request.nextUrl.searchParams.get("userId") || "").trim();
    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    const summary = await getUserInviteSummary({
      userId,
      origin: process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin,
    });

    return NextResponse.json({ success: true, summary });
  } catch (error: any) {
    console.error("[invite] summary error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load invite summary" },
      { status: 500 },
    );
  }
}

