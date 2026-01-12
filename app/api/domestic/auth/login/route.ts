import { NextResponse } from "next/server";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { trackLoginEvent } from "@/services/analytics";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // 版本隔离：国际版不允许访问 CloudBase 登录接口
    if (!IS_DOMESTIC_VERSION) {
      return new NextResponse(null, { status: 404 });
    }

    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const service = new CloudBaseAuthService();
    const result = await service.signInWithEmail(email, password);

    if (!result.user || !result.session) {
      return NextResponse.json(
        { error: result.error?.message || "Login failed" },
        { status: 401 }
      );
    }

    // 埋点：记录登录事件
    trackLoginEvent(result.user.id, {
      userAgent: req.headers.get("user-agent") || undefined,
      language: req.headers.get("accept-language")?.split(",")[0] || undefined,
      referrer: req.headers.get("referer") || undefined,
      loginMethod: "email",
    }).catch((err) => console.warn("[auth/login] trackLoginEvent error:", err));

    const res = NextResponse.json({
      success: true,
      user: result.user,
      provider: "cloudbase",
      token: result.session.access_token,
      expiresAt: result.session.expires_at,
    });

    res.cookies.set("auth-token", result.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return res;
  } catch (error) {
    console.error("[domestic/auth/login] error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
