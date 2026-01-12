import { NextRequest, NextResponse } from "next/server";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";

/**
 * 微信小程序登录接口
 * POST /api/domestic/wxlogin
 *
 * 请求体:
 * {
 *   code: string,       // wx.login() 返回的 code（必填）
 *   nickName?: string,  // 用户昵称（可选）
 *   avatarUrl?: string  // 用户头像 URL（可选）
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 版本隔离：国际版不允许访问此接口
    if (!IS_DOMESTIC_VERSION) {
      return new NextResponse(null, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const { code, nickName, avatarUrl } = body;

    // 验证必填参数
    if (!code) {
      return NextResponse.json(
        { success: false, error: "INVALID_PARAMS", message: "code is required" },
        { status: 400 }
      );
    }

    // 获取微信小程序配置
    const appId = process.env.WX_MINI_APPID || process.env.WECHAT_MINI_APPID;
    const appSecret = process.env.WX_MINI_SECRET || process.env.WECHAT_MINI_SECRET;

    if (!appId || !appSecret) {
      console.error("[domestic/wxlogin] Missing WX_MINI_APPID or WX_MINI_SECRET");
      return NextResponse.json(
        { success: false, error: "CONFIG_ERROR", message: "微信小程序配置缺失" },
        { status: 500 }
      );
    }

    // 调用微信 jscode2session 接口
    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;

    const wxResponse = await fetch(wxUrl);
    const wxData = await wxResponse.json();

    // 检查微信返回结果
    if (wxData.errcode || !wxData.openid) {
      console.error("[domestic/wxlogin] jscode2session error:", wxData);
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_CODE",
          message: wxData.errmsg || "微信登录 code 无效或已过期",
        },
        { status: 401 }
      );
    }

    const { openid, unionid } = wxData;

    // 使用 CloudBase 认证服务登录/注册用户
    const auth = new CloudBaseAuthService();
    const result = await auth.signInWithWechat({
      openid,
      unionid: unionid || null,
      nickname: nickName || null,
      avatar: avatarUrl || null,
    });

    if (!result.user || !result.session) {
      console.error("[domestic/wxlogin] CloudBase auth failed:", result.error);
      return NextResponse.json(
        {
          success: false,
          error: "AUTH_FAILED",
          message: result.error?.message || "登录失败",
        },
        { status: 401 }
      );
    }

    // 计算过期时间（7天）
    const expiresIn = 7 * 24 * 60 * 60;

    // 构建响应
    const res = NextResponse.json({
      success: true,
      token: result.session.access_token,
      openid,
      expiresIn,
      user: {
        id: result.user.id,
        openid,
        nickName: result.user.name,
        avatarUrl: result.user.avatar,
        email: result.user.email,
        createdAt: result.user.createdAt,
        metadata: result.user.metadata,
      },
    });

    // 设置 cookie
    res.cookies.set("auth-token", result.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: expiresIn,
      path: "/",
    });

    return res;
  } catch (error) {
    console.error("[domestic/wxlogin] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "SERVER_ERROR",
        message: error instanceof Error ? error.message : "服务器内部错误",
      },
      { status: 500 }
    );
  }
}
