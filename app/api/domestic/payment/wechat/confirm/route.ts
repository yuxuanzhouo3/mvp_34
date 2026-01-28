/**
 * 微信支付确认 API（国内版专用）
 * 用于前端轮询时主动确认支付状态并处理业务逻辑
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { WechatPayProvider } from "@/lib/payment/providers/wechat-provider";
import { applySubscriptionPayment } from "@/lib/payment/apply-subscription";
import { normalizePlanName } from "@/utils/plan-utils";
import { trackPaymentEvent, trackSubscriptionEvent } from "@/services/analytics";
import { createOrder, markOrderPaid } from "@/services/orders";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { outTradeNo } = body as { outTradeNo?: string };

    if (!outTradeNo) {
      return NextResponse.json(
        { success: false, error: "Missing outTradeNo" },
        { status: 400 }
      );
    }

    console.log("📥 [WeChat Confirm] Processing:", outTradeNo);

    // 1. 查询本地支付记录
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const payRes = await db
      .collection("payments")
      .where({ provider: "wechat", providerOrderId: outTradeNo })
      .limit(1)
      .get();

    const paymentRecord = (payRes?.data?.[0] as any | undefined) || null;

    if (!paymentRecord) {
      console.error("[WeChat Confirm] Payment record not found:", outTradeNo);
      return NextResponse.json(
        { success: false, error: "Payment record not found" },
        { status: 404 }
      );
    }

    // 2. 检查是否已经处理过
    const currentStatus = (paymentRecord.status || "").toString().toUpperCase();
    if (currentStatus === "COMPLETED") {
      console.log("[WeChat Confirm] Already completed:", outTradeNo);
      return NextResponse.json({
        success: true,
        status: "COMPLETED",
        message: "Payment already processed",
        productType: paymentRecord.type,
      });
    }

    // 3. 查询微信支付确认支付状态
    const wechatProvider = new WechatPayProvider({
      appId: process.env.WECHAT_PAY_APP_ID!,
      mchId: process.env.WECHAT_PAY_MCH_ID!,
      apiV3Key: process.env.WECHAT_PAY_API_V3_KEY!,
      privateKey: process.env.WECHAT_PAY_PRIVATE_KEY!,
      serialNo: process.env.WECHAT_PAY_SERIAL_NO!,
      notifyUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL}/api/domestic/payment/webhook/wechat`,
    });

    let wechatStatus: any;

    try {
      wechatStatus = await wechatProvider.queryOrderByOutTradeNo(outTradeNo);
      console.log("[WeChat Confirm] WeChat query result:", wechatStatus);
    } catch (queryError) {
      console.error("[WeChat Confirm] Query failed:", queryError);
      return NextResponse.json(
        { success: false, error: "Failed to query WeChat payment status" },
        { status: 500 }
      );
    }

    // 4. 检查支付状态
    const tradeState = wechatStatus?.tradeState;
    if (tradeState !== "SUCCESS") {
      console.log("[WeChat Confirm] Payment not successful:", tradeState);
      return NextResponse.json({
        success: false,
        status: tradeState || "UNKNOWN",
        error: "Payment not completed",
      });
    }

    // 5. 处理业务逻辑
    const userId = (paymentRecord.userId || paymentRecord.user_id || "") as string;
    if (!userId) {
      console.error("[WeChat Confirm] Missing userId in payment record:", outTradeNo);
      return NextResponse.json(
        { success: false, error: "Missing userId in payment record" },
        { status: 400 }
      );
    }

    // 处理订阅购买
    const period = (paymentRecord.period || paymentRecord?.metadata?.billingCycle || "monthly") as "monthly" | "annual";
    const days = Number(paymentRecord?.metadata?.days) || (period === "annual" ? 365 : 30);
    const planName = normalizePlanName(paymentRecord.plan || paymentRecord?.metadata?.planName || "Pro") || "Pro";
    const totalAmount = Number(paymentRecord.amount) || 0;

    console.log("[WeChat Confirm] Processing subscription:", {
      userId,
      planName,
      period,
      days,
    });

    // 创建订单记录
    const orderResult = await createOrder({
      userId,
      userEmail: paymentRecord.userEmail || paymentRecord.user_email,
      productName: `${planName} Plan (${period})`,
      productType: "subscription",
      plan: planName,
      period,
      amount: totalAmount,
      currency: "CNY",
      originalAmount: totalAmount,
      discountAmount: 0,
      paymentMethod: "wechat",
      source: "cn",
      ipAddress: paymentRecord.metadata?.ipAddress,
      userAgent: paymentRecord.metadata?.userAgent,
      country: paymentRecord.metadata?.country,
    });

    if (orderResult.success && orderResult.orderId) {
      // 标记订单为已支付
      await markOrderPaid(orderResult.orderId, outTradeNo, wechatStatus?.transactionId);
      console.log(`[WeChat Confirm] Order created: ${orderResult.orderNo}`);
    } else {
      console.error("[WeChat Confirm] Order creation failed:", orderResult.error);
    }

    await applySubscriptionPayment({
      userId,
      providerOrderId: outTradeNo,
      provider: "wechat",
      period,
      days,
      planName,
    });

    // 埋点：记录支付和订阅事件
    trackPaymentEvent(userId, {
      amount: totalAmount,
      currency: "CNY",
      plan: planName,
      provider: "wechat",
      orderId: outTradeNo,
    }).catch((err) => console.warn("[WeChat Confirm] trackPaymentEvent error:", err));

    trackSubscriptionEvent(userId, {
      action: "subscribe",
      toPlan: planName,
      period,
    }).catch((err) => console.warn("[WeChat Confirm] trackSubscriptionEvent error:", err));

    // 6. 更新支付记录状态
    const updatePayload = {
      status: "COMPLETED",
      providerTransactionId: wechatStatus?.transactionId || null,
      updatedAt: new Date().toISOString(),
    };

    if (paymentRecord._id) {
      await db.collection("payments").doc(paymentRecord._id).update(updatePayload);
    } else {
      await db
        .collection("payments")
        .where({ provider: "wechat", providerOrderId: outTradeNo })
        .update(updatePayload);
    }

    console.log("✅ [WeChat Confirm] Payment confirmed and processed:", outTradeNo);

    return NextResponse.json({
      success: true,
      status: "COMPLETED",
      productType: "SUBSCRIPTION",
      message: "Subscription activated successfully",
    });
  } catch (error) {
    console.error("❌ [WeChat Confirm] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to confirm payment",
      },
      { status: 500 }
    );
  }
}
