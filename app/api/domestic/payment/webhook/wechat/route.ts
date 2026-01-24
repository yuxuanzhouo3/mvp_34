/**
 * 微信支付 Webhook 回调处理（国内版专用）
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { WechatPayProvider } from "@/lib/payment/providers/wechat-provider";
import { applySubscriptionPayment } from "@/lib/payment/apply-subscription";
import {
  queryPaymentRecord,
  updatePaymentRecord,
  isPaymentCompleted,
  validatePaymentAmount,
  extractUserId,
} from "@/lib/payment/payment-record-helper";
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
    console.error("[WeChat Webhook] event check error:", error);
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
    console.error("[WeChat Webhook] event save error:", error);
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
    console.error("[WeChat Webhook] event update error:", error);
    return false;
  }
}

// 成功响应
function wechatSuccess() {
  return NextResponse.json({ code: "SUCCESS", message: "Ok" }, { status: 200 });
}

// 失败响应
function wechatFail(message: string, status: number = 400) {
  return NextResponse.json({ code: "FAIL", message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    // 1. 获取 Webhook 签名信息
    const signature = request.headers.get("Wechatpay-Signature") || "";
    const timestamp = request.headers.get("Wechatpay-Timestamp") || "";
    const nonce = request.headers.get("Wechatpay-Nonce") || "";

    // 获取风控信息（从请求头中）
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "";
    const userAgent = request.headers.get("user-agent") || "";

    // 2. 读取请求体
    const body = await request.text();

    console.log("📥 [WeChat Webhook] Received:", {
      timestamp,
      nonce,
      bodyLength: body.length,
    });

    // 3. 初始化微信支付提供商
    const wechatProvider = new WechatPayProvider({
      appId: process.env.WECHAT_PAY_APP_ID!,
      mchId: process.env.WECHAT_PAY_MCH_ID!,
      apiV3Key: process.env.WECHAT_PAY_API_V3_KEY!,
      privateKey: process.env.WECHAT_PAY_PRIVATE_KEY!,
      serialNo: process.env.WECHAT_PAY_SERIAL_NO!,
      notifyUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL}/api/domestic/payment/webhook/wechat`,
    });

    // 4. 验证签名（生产环境启用）
    if (process.env.NODE_ENV === "production") {
      const isValidSignature = wechatProvider.verifyWebhookSignature(body, signature, timestamp, nonce);
      if (!isValidSignature) {
        console.error("❌ [WeChat Webhook] Signature verification failed");
        return wechatFail("Invalid signature", 401);
      }
      console.log("✅ [WeChat Webhook] Signature verified");
    } else {
      console.log("⚠️ [WeChat Webhook] Skipping signature verification (non-production)");
    }

    // 5. 解析 Webhook 数据
    const webhookData = JSON.parse(body);

    console.log("📥 [WeChat Webhook] Event type:", webhookData.event_type);

    // 6. 仅处理支付成功事件
    if (webhookData.event_type !== "TRANSACTION.SUCCESS") {
      console.log("⏭️ [WeChat Webhook] Ignoring event:", webhookData.event_type);
      return wechatSuccess();
    }

    // 7. 解密回调数据
    let paymentData: any;
    try {
      paymentData = await wechatProvider.handleWebhookNotification(webhookData);
    } catch (error) {
      console.error("❌ [WeChat Webhook] Failed to decrypt data:", error);
      return wechatFail("Decryption failed");
    }

    console.log("🔓 [WeChat Webhook] Payment verified:", {
      out_trade_no: paymentData.out_trade_no,
      trade_state: paymentData.trade_state,
    });

    // 8. 检查交易状态
    if (paymentData.trade_state !== "SUCCESS") {
      console.log("⏭️ [WeChat Webhook] Payment not successful:", paymentData.trade_state);
      return wechatSuccess();
    }

    // 9. 幂等性检查（使用 out_trade_no 而非 transaction_id，确保一致性）
    const webhookEventId = `wechat_${paymentData.out_trade_no}`;
    const eventProcessed = await isWebhookEventProcessed(webhookEventId);

    if (eventProcessed) {
      console.log("⏭️ [WeChat Webhook] Event already processed:", webhookEventId);
      return wechatSuccess();
    }

    // 10. 记录 Webhook 事件
    await saveWebhookEvent({
      id: webhookEventId,
      provider: "wechat",
      event_type: "TRANSACTION.SUCCESS",
      event_data: paymentData,
      processed: false,
      created_at: new Date().toISOString(),
    });

    // 11. 获取支付订单信息（使用 Math.round 避免浮点数精度问题）
    const amount = paymentData.amount?.total ? Math.round(paymentData.amount.total) / 100 : 0;
    const userId = paymentData.attach || "";

    const paymentRecord = await queryPaymentRecord("wechat", paymentData.out_trade_no);

    if (!paymentRecord) {
      console.error("[WeChat Webhook] Payment record not found:", paymentData.out_trade_no);
      return wechatFail("Payment record not found");
    }

    const effectiveUserId = extractUserId(paymentRecord, userId);

    if (!effectiveUserId) {
      console.error("❌ [WeChat Webhook] Missing user_id");
      return wechatFail("Missing user_id");
    }

    if (isPaymentCompleted(paymentRecord)) {
      console.log("⏭️ [WeChat Webhook] Payment already completed");
      return wechatSuccess();
    }

    // 交易金额校验
    const expectedAmount = Number(paymentRecord?.amount || 0);
    if (!validatePaymentAmount(expectedAmount, amount)) {
      console.error("[WeChat Webhook] amount mismatch", {
        out_trade_no: paymentData.out_trade_no,
        expectedAmount,
        paidAmount: amount,
      });
      return wechatFail("Amount mismatch");
    }

    // 12. 处理订阅购买
    const period = (paymentRecord?.period || paymentRecord?.metadata?.billingCycle || "monthly") as "monthly" | "annual";
    const days = Number(paymentRecord?.metadata?.days) || (period === "annual" ? 365 : 30);
    const planName = normalizePlanName(paymentRecord?.plan || paymentRecord?.metadata?.planName || "Pro") || "Pro";

    console.log("📦 [WeChat Webhook] Processing subscription for order:", paymentData.out_trade_no);

    await applySubscriptionPayment({
      userId: effectiveUserId,
      providerOrderId: paymentData.out_trade_no,
      provider: "wechat",
      period,
      days,
      planName,
    });

    // 创建订单记录
    const orderResult = await createOrder({
      userId: effectiveUserId,
      userEmail: paymentRecord?.metadata?.userEmail || undefined,
      isWechatUser: paymentRecord?.metadata?.isWechatUser || false,
      productName: `${planName} Plan (${period})`,
      productType: "subscription",
      plan: planName,
      period,
      amount,
      currency: "CNY",
      paymentMethod: "wechat",
      source: "cn",
      ipAddress,
      userAgent,
    });

    if (orderResult.success && orderResult.orderId) {
      await markOrderPaid(orderResult.orderId, paymentData.out_trade_no, paymentData.transaction_id);
      console.log("📝 [WeChat Webhook] Order created:", orderResult.orderNo);
    } else {
      console.error("❌ [WeChat Webhook] Order creation failed:", orderResult.error);
    }

    // 埋点：记录支付和订阅事件
    trackPaymentEvent(effectiveUserId, {
      amount,
      currency: "CNY",
      plan: planName,
      provider: "wechat",
      orderId: paymentData.out_trade_no,
    }).catch((err) => console.warn("[WeChat Webhook] trackPaymentEvent error:", err));

    trackSubscriptionEvent(effectiveUserId, {
      action: "subscribe",
      toPlan: planName,
      period,
    }).catch((err) => console.warn("[WeChat Webhook] trackSubscriptionEvent error:", err));

    // 13. 更新支付订单状态
    await updatePaymentRecord("wechat", paymentData.out_trade_no, {
      status: "COMPLETED",
      providerTransactionId: paymentData.transaction_id,
      updatedAt: new Date().toISOString(),
    });

    // 14. 标记 Webhook 事件为已处理
    await markWebhookEventProcessed(webhookEventId);

    console.log("✅ [WeChat Webhook] Successfully processed:", webhookEventId);

    return wechatSuccess();
  } catch (error) {
    console.error("❌ [WeChat Webhook] Processing error:", error);
    return wechatFail("Internal server error", 500);
  }
}
