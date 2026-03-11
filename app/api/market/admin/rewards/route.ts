import { NextRequest, NextResponse } from "next/server"
import { verifyMarketAdminToken } from "@/lib/market/admin-auth"
import { getMarketAdminRewards } from "@/lib/market/referrals"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const auth = verifyMarketAdminToken(request)
  if (!auth.ok) return auth.response

  try {
    const page = Number(request.nextUrl.searchParams.get("page") || 1)
    const limit = Number(request.nextUrl.searchParams.get("limit") || 20)
    const result = await getMarketAdminRewards({ page, limit })
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load rewards" },
      { status: 500 },
    )
  }
}

