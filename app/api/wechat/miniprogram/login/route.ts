import { NextRequest, NextResponse } from "next/server";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { getWechatUserByCode } from "@/lib/wechat/token-exchange";
import * as jwt from "jsonwebtoken";
import { z } from "zod";

// 请求参数验证
const miniprogramLoginSchema = z.object({
  code: z.string().min(1, "WeChat authorization code is required"),
  nickName: z.string().optional(),
  avatarUrl: z.string().optional(),
});

// 微信 API 接口:code 换 openid（小程序）
async function getOpenIdByCode(
  code: string,
  appId: string,
  appSecret: string
): Promise<{ openid: string; session_key: string; unionid?: string }> {
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;

  console.log("[miniprogram/login] Calling WeChat jscode2session API", { appId, codeLength: code.length });

  const response = await fetch(url);
  const data = await response.json();

  if (data.errcode) {
    console.log("[miniprogram/login] WeChat API error", { errcode: data.errcode, errmsg: data.errmsg });
    throw new Error(`WeChat API error: ${data.errcode} - ${data.errmsg}`);
  }

  console.log("[miniprogram/login] WeChat API success", { openid: data.openid });

  return {
    openid: data.openid,
    session_key: data.session_key,
    unionid: data.unionid,
  };
}

// 主登录接口 - 三级回退机制
export async function POST(request: NextRequest) {
  try {
    // 版本隔离
    if (!IS_DOMESTIC_VERSION) {
      return new NextResponse(null, { status: 404 });
    }

    const body = await request.json();
    const clientIP =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // 验证输入
    const validationResult = miniprogramLoginSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid input",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    const { code } = validationResult.data;
    const nickName = validationResult.data.nickName;
    const avatarUrl = validationResult.data.avatarUrl;

    // 检查配置（三级回退：小程序 → 原生App → 网页OAuth）
    const mpAppId = process.env.WX_MINI_APPID;
    const mpAppSecret = process.env.WX_MINI_SECRET;
    const nativeAppId = process.env.WECHAT_APP_ANDROID_ID;
    const nativeAppSecret = process.env.WECHAT_APP_ANDROID_SECRET;
    const oauthAppId = process.env.WECHAT_APP_ID;
    const oauthAppSecret = process.env.WECHAT_APP_SECRET;

    const hasMpConfig = !!mpAppId && !!mpAppSecret;
    const hasNativeConfig = !!nativeAppId && !!nativeAppSecret;
    const hasOauthConfig = !!oauthAppId && !!oauthAppSecret;

    if (!hasMpConfig && !hasNativeConfig && !hasOauthConfig) {
      console.error("[miniprogram/login] Missing WeChat configuration");
      return NextResponse.json(
        {
          success: false,
          error: "WeChat configuration missing",
          code: "CONFIG_ERROR",
        },
        { status: 500 }
      );
    }

    let loginSource: "miniprogram" | "oauth" = "miniprogram";
    let openid: string;
    let unionid: string | undefined;
    let resolvedNickName = nickName;
    let resolvedAvatar = avatarUrl;

    // 三级回退机制
    try {
      if (!hasMpConfig) {
        throw new Error("Miniprogram config not available, skip to native/web fallback");
      }

      console.log("[miniprogram/login] Trying miniprogram config");
      const wechatData = await getOpenIdByCode(code, mpAppId!, mpAppSecret!);
      ({ openid, unionid } = wechatData);
      console.log("[miniprogram/login] Miniprogram login success", { openid });
      loginSource = "miniprogram";
    } catch (mpError) {
      console.log("[miniprogram/login] Miniprogram failed, trying fallback", {
        error: mpError instanceof Error ? mpError.message : String(mpError),
        hasNativeConfig,
        hasOauthConfig,
      });

      // 原生 App（Android）开放平台 AppID
      if (hasNativeConfig) {
        loginSource = "oauth";
        console.log("[miniprogram/login] Trying native app config");
        const wechatUser = await getWechatUserByCode(code, nativeAppId!, nativeAppSecret!);
        openid = wechatUser.openid;
        unionid = wechatUser.unionid;
        resolvedNickName = wechatUser.nickname || nickName || "微信用户";
        resolvedAvatar = wechatUser.headimgurl || avatarUrl || "";
        console.log("[miniprogram/login] Native app login success", { openid, unionid });
      } else if (hasOauthConfig) {
        // 网页 OAuth 兜底
        loginSource = "oauth";
        console.log("[miniprogram/login] Trying web OAuth config");
        const wechatUser = await getWechatUserByCode(code, oauthAppId!, oauthAppSecret!);
        openid = wechatUser.openid;
        unionid = wechatUser.unionid;
        resolvedNickName = wechatUser.nickname || nickName || "微信用户";
        resolvedAvatar = wechatUser.headimgurl || avatarUrl || "";
        console.log("[miniprogram/login] Web OAuth login success", { openid, unionid });
      } else {
        throw mpError;
      }
    }

    // 查询/创建用户
    const connector = new CloudBaseConnector({});
    await connector.initialize();
    const db = connector.getClient();
    const usersCollection = db.collection("users");

    let userId: string | null = null;
    let existingUser: any = null;

    // 优先用 unionid 统一账号，其次 openid
    try {
      if (unionid) {
        const unionResult = await usersCollection
          .where({ wechatUnionId: unionid })
          .limit(1)
          .get();

        if (unionResult.data && unionResult.data.length > 0) {
          existingUser = unionResult.data[0];
          userId = existingUser._id;
        }
      }

      if (!userId) {
        const queryResult = await usersCollection
          .where({ wechatOpenId: openid })
          .limit(1)
          .get();

        if (queryResult.data && queryResult.data.length > 0) {
          existingUser = queryResult.data[0];
          userId = existingUser._id;
        }
      }
    } catch (queryError) {
      console.log("[miniprogram/login] First time user", { openid });
    }

    // 创建新用户或更新现有用户
    const now = new Date().toISOString();
    const loginIdentifier = unionid || openid;
    const fallbackEmailPrefix = loginSource === "miniprogram" ? "miniprogram" : "wechat";
    const loginEmail = existingUser?.email || `${fallbackEmailPrefix}_${loginIdentifier}@local.wechat`;
    const displayName = resolvedNickName || existingUser?.name || "微信用户";
    const avatar = resolvedAvatar || existingUser?.avatar || "";

    if (!userId) {
      // 新用户
      console.log("[miniprogram/login] Creating new user", { openid, loginSource });

      const newUser = {
        wechatOpenId: openid,
        wechatUnionId: unionid,
        email: loginEmail,
        name: displayName,
        avatar,
        password: null,
        pro: false,
        subscriptionTier: "free",
        plan: "free",
        plan_exp: null,
        paymentMethod: null,
        createdAt: now,
        lastLoginAt: now,
        region: "CN",
        source: loginSource === "miniprogram" ? "miniprogram" : "wechat-oauth",
      };

      const insertResult = await usersCollection.add(newUser);
      userId = insertResult.id || insertResult._id;

      console.log("[miniprogram/login] User created", { userId });
    } else {
      // 更新现有用户
      console.log("[miniprogram/login] Updating existing user", { userId, openid, loginSource });

      const updateData: any = {
        lastLoginAt: now,
        updatedAt: now,
        ...(unionid && !existingUser?.wechatUnionId ? { wechatUnionId: unionid } : {}),
      };

      if (resolvedNickName) {
        updateData.name = resolvedNickName;
      }
      if (resolvedAvatar) {
        updateData.avatar = resolvedAvatar;
      }

      await usersCollection.doc(userId).update(updateData);

      console.log("[miniprogram/login] User updated", { userId });
    }

    if (!userId) {
      throw new Error("Failed to create or find user");
    }

    // 生成 JWT tokens
    const accessPayload = {
      userId,
      email: loginEmail,
      region: "CN",
      source: loginSource,
    };

    const accessToken = jwt.sign(
      accessPayload,
      process.env.JWT_SECRET || "fallback-secret-key-for-development-only",
      { expiresIn: "1h" }
    );

    console.log("[miniprogram/login] Generated JWT access token", { userId });

    // 返回登录成功
    return NextResponse.json({
      success: true,
      data: {
        token: accessToken,
        userInfo: {
          id: userId,
          openid: openid,
          nickname: displayName,
          avatar: avatar,
          avatarUrl: avatar,
        },
      },
      tokenMeta: {
        accessTokenExpiresIn: 3600, // 1 hour
      },
      message: "登录成功",
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[miniprogram/login] Error:", errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: "Login failed",
        code: "MINIPROGRAM_LOGIN_FAILED",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
