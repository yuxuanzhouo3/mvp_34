import { NextRequest, NextResponse } from "next/server";
import { IS_DOMESTIC_VERSION } from "@/config";

export const runtime = "nodejs";

/**
 * GET /api/domestic/auth/wechat/qrcode
 * 返回微信扫码登录的二维码 URL
 * 可选 query: next 用于回跳后跳转
 */
export async function GET(request: NextRequest) {
  try {
    // 版本隔离：国际版不返回微信扫码登录二维码
    if (!IS_DOMESTIC_VERSION) {
      console.log("[domestic/auth/wechat/qrcode] Not domestic version, returning 404");
      return new NextResponse(null, { status: 404 });
    }

    const appId = process.env.WECHAT_APP_ID;
    console.log("[domestic/auth/wechat/qrcode] WECHAT_APP_ID configured:", appId ? "yes" : "no");

    // 优先使用环境变量配置的域名；若未配置，则回落到请求头推断
    const envAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const forwardedHost = request.headers.get("x-forwarded-host");
    const host = forwardedHost || request.headers.get("host") || "";
    const scheme =
      envAppUrl?.startsWith("http") ||
      host.includes("localhost") ||
      host.startsWith("127.0.0.1")
        ? null
        : forwardedProto || "https";
    const inferredUrl =
      host && scheme ? `${scheme}://${host}` : host ? `http://${host}` : null;
    const appUrl = (envAppUrl || inferredUrl || "").replace(/\/$/, "");

    if (!appId || !appUrl) {
      console.error("[domestic/auth/wechat/qrcode] Config missing - appId:", appId ? "yes" : "no", "appUrl:", appUrl || "empty");
      return NextResponse.json(
        { error: "WeChat config missing", code: "CONFIG_ERROR" },
        { status: 500 }
      );
    }

    const next = request.nextUrl.searchParams.get("next") || "/";
    const statePayload = JSON.stringify({ next });
    const state = Buffer.from(statePayload).toString("base64url");
    const redirectUri = `${appUrl}/auth/callback`;

    const qrcodeUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=${appId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`;

    return NextResponse.json({
      supported: true,
      appId,
      qrcodeUrl,
      redirectUri,
      state,
    });
  } catch (error) {
    console.error("[domestic/auth/wechat/qrcode] error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
