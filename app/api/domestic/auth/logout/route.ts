import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { IS_DOMESTIC_VERSION } from "@/config";

export const runtime = "nodejs";

/**
 * POST /api/domestic/auth/logout
 * 登出（国内版）
 */
export async function POST() {
  try {
    // 版本隔离：国际版不允许访问此接口
    if (!IS_DOMESTIC_VERSION) {
      return new NextResponse(null, { status: 404 });
    }

    const cookieStore = await cookies();

    // 清除 auth-token cookie
    const res = NextResponse.json({ success: true });
    res.cookies.set("auth-token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return res;
  } catch (error) {
    console.error("[domestic/auth/logout] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
