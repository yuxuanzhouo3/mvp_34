import { NextRequest, NextResponse } from "next/server";
import { getWechatUserByCode } from "@/lib/wechat/token-exchange";
import * as jwt from "jsonwebtoken";
import { z } from "zod";

// 请求参数验证
const androidLoginSchema = z.object({
  code: z.string().min(1, "WeChat authorization code is required"),
});

/**
 * Android微信登录接口
 * 路径: /api/wxlogin
 * 功能: 接收Android应用的微信授权code，返回token和用户信息
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const clientIP =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // 验证输入
    const validationResult = androidLoginSchema.safeParse(body);
    if (!validationResult.success) {
      console.error("[wxlogin] Validation failed:", validationResult.error.errors);
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid input",
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { code } = validationResult.data;

    // 检查Android微信配置
    const androidAppId = process.env.WECHAT_APP_ANDROID_ID;
    const androidAppSecret = process.env.WECHAT_APP_ANDROID_SECRET;

    if (!androidAppId || !androidAppSecret) {
      console.error("[wxlogin] Android WeChat configuration missing");
      return NextResponse.json(
        {
          ok: false,
          error: "WeChat Android configuration missing",
        },
        { status: 500 }
      );
    }

    console.log("[wxlogin] Exchanging code for user info", {
      appId: androidAppId,
      codeLength: code.length
    });

    // 用code换取用户信息
    const wechatUser = await getWechatUserByCode(code, androidAppId, androidAppSecret);

    console.log("[wxlogin] Got WeChat user info", {
      openid: wechatUser.openid,
      unionid: wechatUser.unionid
    });

    // 这里简化处理，实际项目中应该：
    // 1. 查询或创建用户到数据库
    // 2. 生成JWT token
    // 3. 返回完整的用户信息

    // 生成简单的JWT token（示例）
    const accessPayload = {
      openid: wechatUser.openid,
      unionid: wechatUser.unionid,
      nickname: wechatUser.nickname,
      source: "android-wechat",
    };

    const accessToken = jwt.sign(
      accessPayload,
      process.env.JWT_SECRET || "fallback-secret-key-for-development-only",
      { expiresIn: "1h" }
    );

    console.log("[wxlogin] Login successful", { openid: wechatUser.openid });

    // 返回登录成功响应
    return NextResponse.json({
      ok: true,
      token: accessToken,
      openid: wechatUser.openid,
      expiresIn: 3600,
      userInfo: {
        openid: wechatUser.openid,
        unionid: wechatUser.unionid,
        nickname: wechatUser.nickname,
        avatar: wechatUser.headimgurl,
        sex: wechatUser.sex,
        province: wechatUser.province,
        city: wechatUser.city,
        country: wechatUser.country,
      },
    });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[wxlogin] Login error:", errorMessage);

    return NextResponse.json(
      {
        ok: false,
        error: "Login failed",
        details: errorMessage,
      },
      { status: 500 }
    );
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
