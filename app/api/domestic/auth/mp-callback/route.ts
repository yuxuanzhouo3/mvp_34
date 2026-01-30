import { NextResponse } from "next/server";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

export const runtime = "nodejs";

/**
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

    // 如果有昵称或头像，更新用户资料
    if (nickName || avatarUrl) {
      try {
        console.log("[mp-callback] Updating user profile - nickName:", nickName, "avatarUrl:", avatarUrl ? "***" : null);
        const connector = new CloudBaseConnector({});
        await connector.initialize();
        const db = connector.getClient();

        // 通过 openid 查找用户
        const users = await db.collection("users").where({ wechatOpenId: openid }).limit(1).get();
        const user = users.data[0];

        if (user && user._id) {
          const updateData: Record<string, string> = {};

          // 只在用户当前昵称为空或默认值时才更新
          if (nickName && (!user.name || user.name === "微信用户")) {
            updateData.name = nickName;
          }

          // 只在用户当前头像为空或默认值时才更新
          if (avatarUrl && !user.avatar) {
            updateData.avatar = avatarUrl;
          }

          if (Object.keys(updateData).length > 0) {
            await db.collection("users").doc(user._id).update(updateData);
            console.log("[mp-callback] User profile updated:", updateData);
          }
        } else {
          console.warn("[mp-callback] User not found for openid:", openid);
        }
      } catch (updateError) {
        // 更新失败不影响登录流程
        console.error("[mp-callback] Failed to update user profile:", updateError);
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

    console.log("[mp-callback] Token set for openid:", openid);

    return res;
  } catch (error) {
    console.error("[mp-callback] error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
