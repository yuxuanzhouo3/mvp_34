/**
 * 支付宝支付创建订单 API（国内版专用）
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { AlipayProvider } from "@/lib/payment/providers/alipay-provider";
import { extractPlanAmount, resolvePlan } from "@/lib/payment/plan-resolver";
import { calculateDomesticUpgradePrice, PAYMENT_CONSTANTS } from "@/lib/payment/upgrade-calculator";

// 从 cookie 获取用户 ID
async function resolveUserId(request: NextRequest): Promise<string | null> {
  try {
    const authToken = request.cookies.get("auth-token")?.value;
    if (!authToken) return null;

    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const result = await db
      .collection("sessions")
      .where({ token: authToken })
      .limit(1)
      .get();

    return result.data?.[0]?.userId || null;
  } catch (error) {
    console.error("[Alipay Create] resolveUserId error:", error);
    return null;
  }
}

// 获取用户信息（邮箱和登录方式）
async function getUserInfo(userId: string): Promise<{ email: string | null; isWechatUser: boolean }> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const result = await db
      .collection("users")
      .doc(userId)
      .get();

    const user = result.data?.[0] || result.data;
    const email = user?.email || null;
    const isWechatUser = !!(user?.wechatOpenId || user?.wechatUnionId);

    console.log("📧 [Alipay Create] getUserInfo:", { userId, email, isWechatUser, hasUser: !!user });

    return { email, isWechatUser };
  } catch (error) {
    console.error("[Alipay Create] getUserInfo error:", error);
    return { email: null, isWechatUser: false };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { planName, billingPeriod, userId } = body as {
      planName?: string;
      billingPeriod?: "monthly" | "annual";
      userId?: string;
    };

    // 如果前端未传 userId，尝试从会话获取
    if (!userId) {
      userId = (await resolveUserId(request)) || undefined;
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "用户未登录" },
        { status: 401 }
      );
    }

    // 解析套餐
    const resolvedPlan = resolvePlan(planName);
    const effectiveBillingPeriod = billingPeriod || "monthly";
    const resolvedPlanName = resolvedPlan.name;

    // 基础金额（人民币）
    const baseAmount = extractPlanAmount(resolvedPlan, effectiveBillingPeriod, true);
    let amount = baseAmount;
    let days = 0;

    // 升级补差价逻辑
    const upgradeResult = await calculateDomesticUpgradePrice({
      userId,
      targetPlan: resolvedPlan,
      billingPeriod: effectiveBillingPeriod,
      baseAmount,
    });
    amount = upgradeResult.amount;
    days = upgradeResult.totalDays || upgradeResult.days;

    if (upgradeResult.isUpgrade) {
      console.log("📝 [Alipay Create] Upgrade calculation:", {
        targetPlan: resolvedPlanName,
        billingPeriod: effectiveBillingPeriod,
        freeUpgrade: upgradeResult.freeUpgrade,
        remainingDays: upgradeResult.remainingDays,
        remainingValue: upgradeResult.remainingValue,
        upgradeAmount: amount,
        upgradeDays: upgradeResult.upgradeDays,
        purchaseDays: upgradeResult.purchaseDays,
        totalDays: days,
      });
    }

    // 设置默认天数
    if (days === 0) {
      days = effectiveBillingPeriod === "annual"
        ? PAYMENT_CONSTANTS.DAYS_PER_YEAR
        : PAYMENT_CONSTANTS.DAYS_PER_MONTH;
    }

    const description = `${resolvedPlan.nameZh || resolvedPlan.name} - ${
      effectiveBillingPeriod === "annual" ? "年度订阅" : "月度订阅"
    }`;

    // 获取用户信息
    const userInfo = await getUserInfo(userId);

    // 采集风控信息（从用户请求头中）
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "";
    const userAgent = request.headers.get("user-agent") || "";
    const country = request.headers.get("x-vercel-ip-country")
      || request.headers.get("cf-ipcountry")
      || "";

    const metadata = {
      userId,
      days,
      productType: "SUBSCRIPTION",
      billingCycle: effectiveBillingPeriod,
      planName: resolvedPlanName,
      isUpgrade: amount !== baseAmount,
      originalAmount: baseAmount,
      userEmail: userInfo.email,
      isWechatUser: userInfo.isWechatUser,
      ipAddress,
      userAgent,
      country,
    };

    // 创建支付宝支付提供商
    const alipayProvider = new AlipayProvider(process.env);

    // 创建支付订单
    const result = await alipayProvider.createPayment({
      amount,
      currency: "CNY",
      description,
      userId,
      planType: "subscription",
      billingCycle: effectiveBillingPeriod,
      metadata,
    });

    if (!result.success || !result.paymentId) {
      console.error("❌ [Alipay Create] Failed to create payment:", result.error);
      return NextResponse.json(
        { success: false, error: result.error || "创建支付失败" },
        { status: 500 }
      );
    }

    // 记录 pending 支付到数据库
    const nowIso = new Date().toISOString();
    const paymentData = {
      userId,
      provider: "alipay",
      providerOrderId: result.paymentId,
      amount,
      currency: "CNY",
      status: "PENDING",
      type: "SUBSCRIPTION",
      plan: resolvedPlanName,
      period: effectiveBillingPeriod,
      metadata,
      createdAt: nowIso,
      updatedAt: nowIso,
      source: "cn",
    };

    try {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();
      await db.collection("payments").add(paymentData);

      console.log("✅ [Alipay Create] Payment record created:", {
        paymentId: result.paymentId,
        amount,
        plan: resolvedPlanName,
      });
    } catch (dbError) {
      console.error("❌ [Alipay Create] Database error:", dbError);
      return NextResponse.json(
        { success: false, error: "创建支付失败，请稍后重试" },
        { status: 500 }
      );
    }

    // 返回支付宝 HTML 表单
    return NextResponse.json({
      success: true,
      paymentId: result.paymentId,
      formHtml: result.paymentUrl, // HTML 表单内容
      orderId: result.paymentId,
    });
  } catch (err) {
    console.error("❌ [Alipay Create] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "创建支付失败",
      },
      { status: 500 }
    );
  }
}
