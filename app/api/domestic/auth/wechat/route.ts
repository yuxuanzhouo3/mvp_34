import { NextRequest, NextResponse } from "next/server";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { trackWechatLoginEvent } from "@/services/analytics";
import * as jwt from "jsonwebtoken";

/**
 * POST /api/domestic/auth/wechat
 * 使用微信 OAuth code 登录（国内版）
 * 请求体: { code: string, state: string }
 */
export async function POST(request: NextRequest) {
  try {
    // 版本隔离：国际版不允许访问国内版微信登录接口
    if (!IS_DOMESTIC_VERSION) {
      return new NextResponse(null, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const code = body?.code as string | undefined;
    const state = body?.state as string | undefined;

    if (!code) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    // 验证 state 参数（防止 CSRF 攻击）
    if (!state) {
      return NextResponse.json({ error: "Missing state parameter" }, { status: 400 });
    }

    // 解析并验证 state 格式
    try {
      const statePayload = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
      // state 必须包含 next 字段（由 qrcode 接口生成）
      if (typeof statePayload !== "object" || !("next" in statePayload)) {
        return NextResponse.json({ error: "Invalid state format" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid state encoding" }, { status: 400 });
    }

    const appId = process.env.WECHAT_APP_ID;
    const appSecret = process.env.WECHAT_APP_SECRET;

    if (!appId || !appSecret) {
      return NextResponse.json(
        { error: "WeChat config missing", code: "CONFIG_ERROR" },
        { status: 500 }
      );
    }

    // 1) 交换 access_token
    const tokenRes = await fetch(
      `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${encodeURIComponent(
        code
      )}&grant_type=authorization_code`
    );
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData.errcode) {
      return NextResponse.json(
        { error: "WeChat token exchange failed", details: tokenData },
        { status: 401 }
      );
    }

    const { access_token, openid, unionid } = tokenData;
    if (!access_token || !openid) {
      return NextResponse.json(
        { error: "Invalid WeChat response", details: tokenData },
        { status: 401 }
      );
    }

    // 2) 获取用户信息
    const userRes = await fetch(
      `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}`
    );
    const userData = await userRes.json();
    if (!userRes.ok || userData.errcode) {
      return NextResponse.json(
        { error: "Failed to fetch WeChat userinfo", details: userData },
        { status: 401 }
      );
    }

    const auth = new CloudBaseAuthService();
    const result = await auth.signInWithWechat({
      openid,
      unionid,
      nickname: userData.nickname,
      avatar: userData.headimgurl,
    });

    if (!result.user || !result.session) {
      return NextResponse.json(
        { error: result.error?.message || "Login failed" },
        { status: 401 }
      );
    }

    // 判断是否为新用户（创建时间在5分钟内）
    const isNewUser = result.user.createdAt &&
      (new Date().getTime() - new Date(result.user.createdAt).getTime()) < 5 * 60 * 1000;

    // 埋点：记录微信登录事件
    trackWechatLoginEvent(result.user.id, {
      userAgent: request.headers.get("user-agent") || undefined,
      language: request.headers.get("accept-language")?.split(",")[0] || undefined,
      isNewUser,
    }).catch((err) => console.warn("[auth/wechat] trackWechatLoginEvent error:", err));

    // 使用 CloudBase session token（与构建API兼容）
    const res = NextResponse.json({
      success: true,
      user: result.user,
      token: result.session.access_token,
      accessToken: result.session.access_token,
      tokenMeta: {
        accessTokenExpiresIn: Math.floor((result.session.expires_at - Date.now()) / 1000),
      },
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
    console.error("[domestic/auth/wechat] error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
