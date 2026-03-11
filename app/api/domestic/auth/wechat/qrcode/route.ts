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

    // 检查是否为本地开发环境（localhost 或 127.0.0.1）
    const isLocalhost = host.includes("localhost") || host.startsWith("127.0.0.1") || host.includes("::1");
    
    if (isLocalhost) {
      console.warn("[domestic/auth/wechat/qrcode] Localhost detected - WeChat OAuth requires a public domain");
      return NextResponse.json(
        {
          error: "微信登录在本地开发环境中不可用",
          code: "LOCALHOST_NOT_SUPPORTED",
          message: "微信开放平台不允许使用 localhost 作为回调地址。请使用内网穿透工具（如 ngrok）获取公网域名，或在生产环境中使用。",
          hint: "如需本地测试，请设置 NEXT_PUBLIC_APP_URL 为你的公网域名（例如：https://your-domain.ngrok.io）",
        },
        { status: 400 }
      );
    }

    const next = request.nextUrl.searchParams.get("next") || "/";
    const statePayload = JSON.stringify({ next });
    const state = Buffer.from(statePayload).toString("base64url");
    const redirectUri = `${appUrl}/auth/callback`;

    // 验证 redirect_uri 格式（微信要求必须是已配置的域名，且不能包含端口号，除非是 80/443）
    const redirectUrlObj = new URL(redirectUri);
    if (redirectUrlObj.port && redirectUrlObj.port !== "80" && redirectUrlObj.port !== "443") {
      console.warn("[domestic/auth/wechat/qrcode] Redirect URI contains non-standard port:", redirectUrlObj.port);
      return NextResponse.json(
        {
          error: "redirect_uri 格式错误",
          code: "INVALID_REDIRECT_URI",
          message: "微信开放平台要求回调地址不能包含非标准端口（仅支持 80/443）。请确保 NEXT_PUBLIC_APP_URL 不包含端口号。",
        },
        { status: 400 }
      );
    }

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
