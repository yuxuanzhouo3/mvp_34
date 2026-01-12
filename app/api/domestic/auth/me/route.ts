import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";

export const runtime = "nodejs";

/**
 * GET /api/domestic/auth/me
 * 获取当前登录用户信息（国内版）
 */
export async function GET(req: Request) {
  try {
    // 版本隔离：国际版不允许访问此接口
    if (!IS_DOMESTIC_VERSION) {
      return new NextResponse(null, { status: 404 });
    }

    const cookieStore = await cookies();
    const cookieToken = cookieStore.get("auth-token")?.value;
    const headerToken =
      req.headers.get("x-auth-token") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      null;
    const token = cookieToken || headerToken || null;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const service = new CloudBaseAuthService();
    const user = await service.validateToken(token);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = NextResponse.json({ user });
    // 如果请求通过 header token 而无 cookie，则回写 cookie
    if (!cookieToken && token) {
      res.cookies.set("auth-token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
    }
    return res;
  } catch (error) {
    console.error("[domestic/auth/me] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
