import { NextRequest, NextResponse } from "next/server";
import { bindReferralFromRequest } from "@/lib/invite/referrals";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const invitedUserId = String(body?.invitedUserId || "").trim();
    if (!invitedUserId) {
      return NextResponse.json({ success: false, error: "invitedUserId is required" }, { status: 400 });
    }

    const result = await bindReferralFromRequest({ request, invitedUserId });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("[invite] bind error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to bind referral" },
      { status: 500 },
    );
  }
}

