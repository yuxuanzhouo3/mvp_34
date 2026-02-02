import { NextRequest, NextResponse } from "next/server";
import { POST as miniprogramLogin } from "./miniprogram/login/route";

/**
 * Android微信登录接口（转发到三级回退机制）
 * 路径: /api/wxlogin
 * 功能: 接收Android应用的微信授权code，返回token和用户信息
 */
export async function POST(request: NextRequest) {
  try {
    // 转发给三级回退机制的登录逻辑
    const response = await miniprogramLogin(request);
    const data = await response.json();

    if (data.success && data.data) {
      // 转换为Android APK期望的响应格式
      return NextResponse.json({
        ok: true,
        token: data.data.token,
        openid: data.data.userInfo?.openid,
        expiresIn: data.tokenMeta?.accessTokenExpiresIn || 3600,
        userInfo: data.data.userInfo
      });
    }

    return NextResponse.json({
      ok: false,
      error: data.error || "登录失败",
      details: data.details
    }, { status: response.status });

  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message || "服务器错误"
    }, { status: 500 });
  }
}

// 支持 OPTIONS 请求以兼容跨域
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
