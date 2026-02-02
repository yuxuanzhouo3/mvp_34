import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import jwt from "jsonwebtoken";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

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
    let user = await service.validateToken(token);

    // 如果CloudBase session验证失败，尝试JWT验证
    if (!user) {
      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || "fallback-secret-key-for-development-only"
        ) as { userId: string; email: string; region: string };

        // 从数据库获取用户信息
        const connector = new CloudBaseConnector({});
        await connector.initialize();
        const db = connector.getClient();
        const users = await db.collection("users").doc(decoded.userId).get();
        const userDoc = users?.data?.[0];

        if (userDoc) {
          user = {
            id: decoded.userId,
            email: userDoc.email,
            name: userDoc.name,
            avatar: userDoc.avatar,
            createdAt: new Date(userDoc.createdAt),
            metadata: {
              pro: userDoc.pro || false,
              region: "CN",
              plan: userDoc.plan || "free",
              plan_exp: userDoc.plan_exp || null,
              hide_ads: userDoc.hide_ads || false,
            },
          };
        }
      } catch (jwtError) {
        console.error("[domestic/auth/me] JWT verification failed:", jwtError);
      }
    }

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
