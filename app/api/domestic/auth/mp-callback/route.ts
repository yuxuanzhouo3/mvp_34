import { NextResponse } from "next/server";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

export const runtime = "nodejs";

/**
 * POST /api/domestic/auth/mp-callback
 * 小程序登录回调接口
 * 接收小程序直接传回的 token，设置 cookie
 * 可选：更新用户的昵称和头像（新用户填写资料后）
 */
export async function POST(req: Request) {
  try {
    // 版本隔离：国际版不允许访问此接口
    if (!IS_DOMESTIC_VERSION) {
      return new NextResponse(null, { status: 404 });
    }

    const { token, openid, expiresIn, nickName, avatarUrl } = await req.json();

    if (!token || !openid) {
      return NextResponse.json(
        { error: "Token and openid required" },
        { status: 400 }
      );
    }

    // 安全验证：确保 token 确实存在于我们的 sessions 表中
    const connector = new CloudBaseConnector({});
    await connector.initialize();
    const db = connector.getClient();

    const sessions = await db.collection("sessions").where({ token }).limit(1).get();
    const session = sessions?.data?.[0] as { userId: string; expiresAt: number } | undefined;

    if (!session) {
      console.warn("[domestic/auth/mp-callback] Invalid token - session not found");
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    if (session.expiresAt < Date.now()) {
      console.warn("[domestic/auth/mp-callback] Token expired");
      return NextResponse.json({ error: "Token expired" }, { status: 401 });
    }

    // 验证 openid 与 session 用户匹配
    const users = await db.collection("users").doc(session.userId).get();
    const user = users?.data?.[0] as { wechatOpenId?: string } | undefined;

    if (!user || user.wechatOpenId !== openid) {
      console.warn("[domestic/auth/mp-callback] OpenID mismatch");
      return NextResponse.json({ error: "OpenID mismatch" }, { status: 401 });
    }

    // 如果有昵称，更新用户资料（复用已验证的用户数据）
    if (nickName && user) {
      try {
        const userDoc = user as { _id?: string; name?: string };
        // 只在用户当前昵称为空或默认值时才更新
        if (userDoc._id && (!userDoc.name || userDoc.name === "微信用户")) {
          await db.collection("users").doc(session.userId).update({ name: nickName });
          console.log("[domestic/auth/mp-callback] User name updated:", nickName);
        }
      } catch (updateError) {
        // 更新失败不影响登录流程
        console.error("[domestic/auth/mp-callback] Failed to update user profile:", updateError);
      }
    }

    // 计算过期时间
    const maxAge = expiresIn ? parseInt(expiresIn, 10) : 60 * 60 * 24 * 7; // 默认 7 天

    const res = NextResponse.json({
      success: true,
      openid,
    });

    // 设置认证 cookie
    res.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });

    console.log("[domestic/auth/mp-callback] Token set for openid:", openid);

    return res;
  } catch (error) {
    console.error("[domestic/auth/mp-callback] error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
