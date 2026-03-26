import { NextRequest, NextResponse } from "next/server";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";

/**
 * 微信小程序登录预检查接口
 * POST /api/domestic/wxlogin/check
 */
export async function POST(request: NextRequest) {
  try {
    // 版本隔离：国际版不允许访问此接口
    if (!IS_DOMESTIC_VERSION) {
      return new NextResponse(null, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const { code } = body;

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
      console.error("[wxlogin/check] Missing WX_MINI_APPID or WX_MINI_SECRET");
      return NextResponse.json(
        { success: false, error: "CONFIG_ERROR", message: "微信小程序配置缺失" },
        { status: 500 }
      );
    }

    // 调用微信 jscode2session 接口
    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;

    console.log("[wxlogin/check] Calling jscode2session...");
    const wxResponse = await fetch(wxUrl);
    const wxData = await wxResponse.json();

    // 检查微信返回结果
    if (wxData.errcode || !wxData.openid) {
      console.error("[wxlogin/check] jscode2session error:", wxData);
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
    console.log("[wxlogin/check] Got openid:", openid);

    // 使用 CloudBase 认证服务检查并登录用户
    const auth = new CloudBaseAuthService();

    // 传入空的 nickname 和 avatar，signInWithWechat 会：
    // - 如果用户存在：返回已有用户信息（不会覆盖已有的 name/avatar）
    // - 如果用户不存在：创建新用户（使用默认值）
    const result = await auth.signInWithWechat({
      openid,
      unionid: unionid || null,
      nickname: null,
      avatar: null,
    });

    if (!result.user || !result.session) {
      console.log("[wxlogin/check] User created or login failed");
      return NextResponse.json({
        success: true,
        exists: false,
        hasProfile: false,
        openid,
      });
    }

    const user = result.user;
    // 只判断 name 是否存在且不是默认值（avatar 不落库，由小程序端显示）
    const hasProfile = !!(user.name && user.name !== "微信用户");
    console.log("[wxlogin/check] User exists, has profile:", hasProfile, "name:", user.name);

    // 计算过期时间（7天）
    const expiresIn = 7 * 24 * 60 * 60;

    // 构建响应
    const res = NextResponse.json({
      success: true,
      exists: true,
      hasProfile,
      openid,
      userName: user.name || null,
      userAvatar: user.avatar || null,
      token: result.session.access_token,
      expiresIn,
      user: {
        id: user.id,
        openid,
        nickName: user.name,
        avatarUrl: user.avatar,
        email: user.email,
        createdAt: user.createdAt,
        metadata: user.metadata,
      },
    });

    // 设置 cookie（老用户直接登录成功）
    res.cookies.set("auth-token", result.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: expiresIn,
      path: "/",
    });

    console.log("[wxlogin/check] Login completed for openid:", openid);
    return res;
  } catch (error) {
    console.error("[wxlogin/check] Error:", error);
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
