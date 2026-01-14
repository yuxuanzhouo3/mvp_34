/**
 * 支付宝 Webhook 回调处理（国内版专用）
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { applySubscriptionPayment } from "@/lib/payment/apply-subscription";
import {
  queryPaymentRecord,
  updatePaymentRecord,
  isPaymentCompleted,
  validatePaymentAmount,
  extractUserId,
} from "@/lib/payment/payment-record-helper";
import { verifyAlipaySignature } from "@/lib/payment/providers/alipay-provider";
import { normalizePlanName } from "@/utils/plan-utils";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { trackPaymentEvent, trackSubscriptionEvent } from "@/services/analytics";
import { createOrder, markOrderPaid } from "@/services/orders";

// Webhook 事件幂等性检查
async function isWebhookEventProcessed(eventId: string): Promise<boolean> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();
    const result = await db
      .collection("webhook_events")
      .where({ id: eventId, processed: true })
      .get();
    return (result.data?.length || 0) > 0;
  } catch (error) {
    console.error("[Alipay Webhook] event check error:", error);
    return false;
  }
}

// 保存 Webhook 事件
async function saveWebhookEvent(event: {
  id: string;
  provider: string;
  event_type: string;
  event_data: any;
  processed: boolean;
  created_at: string;
}): Promise<boolean> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();
    await db.collection("webhook_events").add(event);
    return true;
  } catch (error) {
    console.error("[Alipay Webhook] event save error:", error);
    return false;
  }
}

// 标记事件为已处理
async function markWebhookEventProcessed(eventId: string): Promise<boolean> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();
    await db
      .collection("webhook_events")
      .where({ id: eventId })
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      });
    return true;
  } catch (error) {
    console.error("[Alipay Webhook] event update error:", error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("🔔 [Alipay Webhook] 收到 webhook 请求");

    // 获取风控信息（从请求头中）
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "";
    const userAgent = request.headers.get("user-agent") || "";

    // 支付宝在 POST body 中以 form-urlencoded 格式传递数据
    const formData = await request.formData();
    const params: Record<string, string> = {};

    // 收集所有参数
    formData.forEach((value, key) => {
      params[key] = value as string;
    });

    console.log("📝 [Alipay Webhook] 接收到的参数:", {
      outTradeNo: params.out_trade_no,
      tradeStatus: params.trade_status,
      hasSignature: !!params.sign,
    });

    // 验证支付宝签名
    const isValidSignature = verifyAlipaySignature(
      params,
      process.env.ALIPAY_ALIPAY_PUBLIC_KEY
    );

    console.log(
      "🔐 [Alipay Webhook] 签名验证:",
      isValidSignature ? "✅ 通过" : "❌ 失败"
    );

    if (!isValidSignature) {
      console.error("❌ [Alipay Webhook] Invalid Alipay webhook signature");
      return new NextResponse("failure", { status: 401 });
    }

    // 检查支付状态
    const tradeStatus = params.trade_status;
    console.log("💰 [Alipay Webhook] 支付状态:", tradeStatus);

    if (tradeStatus !== "TRADE_SUCCESS" && tradeStatus !== "TRADE_FINISHED") {
      console.log("⏭️ [Alipay Webhook] 支付状态不是最终状态，忽略:", tradeStatus);
      return new NextResponse("success");
    }

    console.log("✅ [Alipay Webhook] 支付成功，开始处理");

    // 幂等性检查（使用 out_trade_no 而非 trade_no，确保一致性）
    const webhookEventId = `alipay_${params.out_trade_no}`;
    const eventProcessed = await isWebhookEventProcessed(webhookEventId);

    if (eventProcessed) {
      console.log("⏭️ [Alipay Webhook] Event already processed:", webhookEventId);
      return new NextResponse("success");
    }

    // 记录 Webhook 事件
    await saveWebhookEvent({
      id: webhookEventId,
      provider: "alipay",
      event_type: tradeStatus,
      event_data: params,
      processed: false,
      created_at: new Date().toISOString(),
    });

    const outTradeNo = params.out_trade_no || "";
    const tradeNo = params.trade_no || "";
    const totalAmount = parseFloat(params.total_amount || "0");

    if (!outTradeNo) {
      console.error("[Alipay Webhook] Missing out_trade_no");
      return new NextResponse("failure");
    }

    // 查询支付记录
    const paymentRecord = await queryPaymentRecord("alipay", outTradeNo);

    if (!paymentRecord) {
      console.error("[Alipay Webhook] Payment record not found:", outTradeNo);
      return new NextResponse("failure");
    }

    if (isPaymentCompleted(paymentRecord)) {
      console.log("⏭️ [Alipay Webhook] Payment already completed");
      return new NextResponse("success");
    }

    // 金额校验
    const expectedAmount = Number(paymentRecord.amount || 0);
    if (!validatePaymentAmount(expectedAmount, totalAmount)) {
      console.error("[Alipay Webhook] amount mismatch", {
        outTradeNo,
        expectedAmount,
        paidAmount: totalAmount,
      });
      return new NextResponse("failure");
    }

    // 提取用户 ID
    const userId = extractUserId(paymentRecord, params.passback_params);
    if (!userId) {
      console.error("[Alipay Webhook] Missing userId in payment record:", outTradeNo);
      return new NextResponse("failure");
    }

    // 处理订阅购买
    const period = (paymentRecord.period || paymentRecord?.metadata?.billingCycle || "monthly") as "monthly" | "annual";
    const days = Number(paymentRecord?.metadata?.days) || (period === "annual" ? 365 : 30);
    const planName = normalizePlanName(paymentRecord.plan || paymentRecord?.metadata?.planName || "Pro") || "Pro";

    console.log("📦 [Alipay Webhook] Processing subscription for order:", outTradeNo);

    await applySubscriptionPayment({
      userId,
      providerOrderId: outTradeNo,
      provider: "alipay",
      period,
      days,
      planName,
    });

    // 创建订单记录
    const orderResult = await createOrder({
      userId,
      userEmail: paymentRecord?.metadata?.userEmail || undefined,
      productName: `${planName} Plan (${period})`,
      productType: "subscription",
      plan: planName,
      period,
      amount: totalAmount,
      currency: "CNY",
      paymentMethod: "alipay",
      source: "cn",
      ipAddress,
      userAgent,
    });

    if (orderResult.success && orderResult.orderId) {
      await markOrderPaid(orderResult.orderId, outTradeNo, tradeNo);
      console.log("📝 [Alipay Webhook] Order created:", orderResult.orderNo);
    } else {
      console.error("❌ [Alipay Webhook] Order creation failed:", orderResult.error);
    }

    // 埋点：记录支付和订阅事件
    trackPaymentEvent(userId, {
      amount: totalAmount,
      currency: "CNY",
      plan: planName,
      provider: "alipay",
      orderId: outTradeNo,
    }).catch((err) => console.warn("[Alipay Webhook] trackPaymentEvent error:", err));

    trackSubscriptionEvent(userId, {
      action: "subscribe",
      toPlan: planName,
      period,
    }).catch((err) => console.warn("[Alipay Webhook] trackSubscriptionEvent error:", err));

    // 更新支付记录状态
    await updatePaymentRecord("alipay", outTradeNo, {
      status: "COMPLETED",
      providerTransactionId: tradeNo || null,
      updatedAt: new Date().toISOString(),
    }, paymentRecord._id);

    // 标记事件为已处理
    await markWebhookEventProcessed(webhookEventId);

    console.log("✅ [Alipay Webhook] Successfully processed:", webhookEventId);

    // 支付宝要求返回 success 字符串
    return new NextResponse("success");
  } catch (error) {
    console.error("❌ [Alipay Webhook] 异常错误:", error);
    return new NextResponse("failure");
  }
}
