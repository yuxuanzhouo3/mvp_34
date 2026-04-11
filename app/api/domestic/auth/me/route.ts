import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import jwt from "jsonwebtoken";
import { CloudBaseConnector, isCloudBaseConfigured } from "@/lib/cloudbase/connector";
import { withCache } from "@/lib/cloudbase/cache";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveSupabaseUserWallet } from "@/services/wallet-supabase";

export const runtime = "nodejs";

/**
 * GET /api/domestic/auth/me
 * 获取当前登录用户信息（国内版）
 * 支持多种认证方式：CloudBase session → JWT → Supabase session
 */
export async function GET(req: Request) {
  try {
    // 版本隔离：国际版不允许访问此接口
    if (!IS_DOMESTIC_VERSION) {
      return new NextResponse(null, { status: 404 });
    }

    const cookieStore = await cookies();
    const cookieToken = cookieStore.get("auth-token")?.value;
    const headerToken =
      req.headers.get("x-auth-token") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      null;
    const token = cookieToken || headerToken || null;

    let user = null;

    // ── 认证方式 1: CloudBase session（需要 CloudBase 配置 + token） ──
    if (token && isCloudBaseConfigured()) {
      try {
        const service = new CloudBaseAuthService();
        user = await service.validateToken(token);
      } catch (cbError) {
        console.warn("[domestic/auth/me] CloudBase validateToken error:", cbError);
      }

      // ── 认证方式 2: JWT + CloudBase 用户查询 ──
      if (!user) {
        try {
          const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || "fallback-secret-key-for-development-only"
          ) as { userId: string; email: string; region: string };

          try {
            const userDoc = await withCache(
              `user:${decoded.userId}`,
              300,
              async () => {
                const connector = new CloudBaseConnector({});
                await connector.initialize();
                const db = connector.getClient();
                const users = await db.collection("users").doc(decoded.userId).get();
                return users?.data?.[0];
              }
            );

            if (userDoc) {
              user = {
                id: decoded.userId,
                email: userDoc.email,
                name: userDoc.name,
                avatar: userDoc.avatar,
                createdAt: new Date(userDoc.createdAt),
                metadata: {
                  pro: userDoc.pro || false,
                  region: "CN",
                  plan: userDoc.plan || "free",
                  plan_exp: userDoc.plan_exp || null,
                  hide_ads: userDoc.hide_ads || false,
                },
              };
            }
          } catch (dbError: any) {
            if (dbError?.code === "ETIMEDOUT" || dbError?.message?.includes("timeout")) {
              user = {
                id: decoded.userId,
                email: decoded.email,
                name: decoded.email.split("@")[0],
                avatar: null,
                createdAt: new Date(),
                metadata: {
                  pro: false,
                  region: "CN",
                  plan: "free",
                  plan_exp: null,
                  hide_ads: false,
                },
              };
              console.warn("[domestic/auth/me] CloudBase timeout, using JWT fallback for user:", decoded.userId);
            } else {
              throw dbError;
            }
          }
        } catch (jwtError: any) {
          if (jwtError?.name === "JsonWebTokenError" || jwtError?.name === "TokenExpiredError") {
            // JWT invalid, fall through to Supabase
          } else {
            console.error("[domestic/auth/me] Unexpected JWT error:", jwtError);
          }
        }
      }
    }

    // ── 认证方式 3: Supabase session（始终尝试，作为兜底） ──
    if (!user) {
      try {
        const supabase = await createClient();
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();
        if (supabaseUser) {
          // 从 Supabase wallet 获取真实 plan 数据
          let plan = "free";
          let planExp: string | null = null;
          try {
            const wallet = await getEffectiveSupabaseUserWallet(supabaseUser.id);
            if (wallet) {
              plan = wallet.plan || "free";
              planExp = wallet.plan_exp || null;
            }
          } catch {
            // wallet 查询失败，使用默认值
          }

          const planLower = plan.toLowerCase();
          user = {
            id: supabaseUser.id,
            email: supabaseUser.email || "",
            name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || supabaseUser.email?.split("@")[0] || "User",
            avatar: supabaseUser.user_metadata?.avatar_url || null,
            createdAt: new Date(supabaseUser.created_at),
            metadata: {
              pro: planLower !== "free" && planLower !== "basic",
              region: "CN",
              plan,
              plan_exp: planExp,
              hide_ads: false,
            },
          };
        }
      } catch (supabaseError) {
        console.warn("[domestic/auth/me] Supabase fallback error:", supabaseError);
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = NextResponse.json({ user });
    // 如果请求通过 header token 而无 cookie，则回写 cookie
    if (!cookieToken && token) {
      res.cookies.set("auth-token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
    }
    return res;
  } catch (error) {
    console.error("[domestic/auth/me] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
