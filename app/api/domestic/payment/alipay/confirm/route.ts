/**
 * 支付宝支付确认 API（国内版专用）
 * 用于同步回调时主动确认支付状态并处理业务逻辑
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { AlipayProvider } from "@/lib/payment/providers/alipay-provider";
import { applySubscriptionPayment } from "@/lib/payment/apply-subscription";
import { normalizePlanName } from "@/utils/plan-utils";
import { trackPaymentEvent, trackSubscriptionEvent } from "@/services/analytics";
import { createOrder, markOrderPaid } from "@/services/orders";
import { claimPaymentRecord, validatePaymentAmount } from "@/lib/payment/payment-record-helper";

export async function POST(request: NextRequest) {
  let claimed = false;
  let subscriptionApplied = false;
  let finalized = false;
  let providerOrderId = "";
  try {
    const body = await request.json();
    const { outTradeNo } = body as { outTradeNo?: string };

    if (!outTradeNo) {
      return NextResponse.json(
        { success: false, error: "Missing outTradeNo" },
        { status: 400 }
      );
    }

    console.log("📥 [Alipay Confirm] Processing:", outTradeNo);
    providerOrderId = outTradeNo;

    // 1. 查询本地支付记录
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const payRes = await db
      .collection("payments")
      .where({ provider: "alipay", providerOrderId: outTradeNo })
      .limit(1)
      .get();

    const paymentRecord = (payRes?.data?.[0] as any | undefined) || null;

    if (!paymentRecord) {
      console.error("[Alipay Confirm] Payment record not found:", outTradeNo);
      return NextResponse.json(
        { success: false, error: "Payment record not found" },
        { status: 404 }
      );
    }

    // 2. 检查是否已经处理过
    const currentStatus = (paymentRecord.status || "").toString().toUpperCase();
    if (currentStatus === "COMPLETED" || currentStatus === "SUCCESS" || currentStatus === "PAID") {
      console.log("[Alipay Confirm] Already completed:", outTradeNo);
      return NextResponse.json({
        success: true,
        status: "COMPLETED",
        message: "Payment already processed",
        productType: paymentRecord.type,
      });
    }
    if (currentStatus === "PROCESSING") {
      const subRes = await db
        .collection("subscriptions")
        .where({ providerOrderId: outTradeNo })
        .limit(1)
        .get();
      if ((subRes?.data?.length || 0) > 0) {
        await db
          .collection("payments")
          .where({ provider: "alipay", providerOrderId: outTradeNo })
          .update({
            status: "COMPLETED",
            updatedAt: new Date().toISOString(),
          });
        return NextResponse.json({
          success: true,
          status: "COMPLETED",
          message: "Payment already processed",
          productType: paymentRecord.type,
        });
      }
    }

    // 3. 查询支付宝确认支付状态
    const alipayProvider = new AlipayProvider(process.env);
    let alipayStatus: any;

    try {
      alipayStatus = await alipayProvider.queryPayment(outTradeNo);
      console.log("[Alipay Confirm] Alipay query result:", alipayStatus);
    } catch (queryError) {
      console.error("[Alipay Confirm] Query failed:", queryError);
      return NextResponse.json(
        { success: false, error: "Failed to query Alipay payment status" },
        { status: 500 }
      );
    }

    // 4. 检查支付状态
    const tradeStatus = alipayStatus?.trade_status;
    if (tradeStatus !== "TRADE_SUCCESS" && tradeStatus !== "TRADE_FINISHED") {
      console.log("[Alipay Confirm] Payment not successful:", tradeStatus);
      return NextResponse.json({
        success: false,
        status: tradeStatus || "UNKNOWN",
        error: "Payment not completed",
      });
    }

    const expectedAmount = Number(paymentRecord.amount) || 0;
    const paidAmount = Number(alipayStatus?.buyer_pay_amount || alipayStatus?.total_amount || 0);
    if (!validatePaymentAmount(expectedAmount, paidAmount)) {
      console.error("[Alipay Confirm] amount mismatch", {
        outTradeNo,
        expectedAmount,
        paidAmount,
      });
      return NextResponse.json(
        { success: false, error: "Amount mismatch" },
        { status: 400 }
      );
    }

    // 5. 处理业务逻辑
    const userId = (paymentRecord.userId || paymentRecord.user_id || "") as string;
    if (!userId) {
      console.error("[Alipay Confirm] Missing userId in payment record:", outTradeNo);
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

    console.log("[Alipay Confirm] Processing subscription:", {
      userId,
      planName,
      period,
      days,
    });

    const claim = await claimPaymentRecord({
      provider: "alipay",
      providerOrderId,
      record: paymentRecord,
    });
    if (!claim.claimed) {
      console.log("[Alipay Confirm] Payment already processing/processed:", outTradeNo);
      return NextResponse.json({
        success: true,
        status: "COMPLETED",
        productType: "SUBSCRIPTION",
        message: "Payment already processed",
      });
    }
    claimed = true;

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
      paymentMethod: "alipay",
      source: "cn",
      ipAddress: paymentRecord.metadata?.ipAddress,
      userAgent: paymentRecord.metadata?.userAgent,
      country: paymentRecord.metadata?.country,
    });

    if (orderResult.success && orderResult.orderId) {
      // 标记订单为已支付
      await markOrderPaid(orderResult.orderId, outTradeNo, alipayStatus?.trade_no);
      console.log(`[Alipay Confirm] Order created: ${orderResult.orderNo}`);
    } else {
      console.error("[Alipay Confirm] Order creation failed:", orderResult.error);
    }

    await applySubscriptionPayment({
      userId,
      providerOrderId,
      provider: "alipay",
      period,
      days,
      planName,
    });
    subscriptionApplied = true;

    // 埋点：记录支付和订阅事件
    trackPaymentEvent(userId, {
      amount: totalAmount,
      currency: "CNY",
      plan: planName,
      provider: "alipay",
      orderId: outTradeNo,
    }).catch((err) => console.warn("[Alipay Confirm] trackPaymentEvent error:", err));

    trackSubscriptionEvent(userId, {
      action: "subscribe",
      toPlan: planName,
      period,
    }).catch((err) => console.warn("[Alipay Confirm] trackSubscriptionEvent error:", err));

    // 6. 更新支付记录状态
    const updatePayload = {
      status: "COMPLETED",
      providerTransactionId: alipayStatus?.trade_no || null,
      updatedAt: new Date().toISOString(),
    };

    if (paymentRecord._id) {
      await db.collection("payments").doc(paymentRecord._id).update(updatePayload);
    } else {
      await db
        .collection("payments")
        .where({ provider: "alipay", providerOrderId: outTradeNo })
        .update(updatePayload);
    }
    finalized = true;

    console.log("✅ [Alipay Confirm] Payment confirmed and processed:", outTradeNo);

    return NextResponse.json({
      success: true,
      status: "COMPLETED",
      productType: "SUBSCRIPTION",
      message: "Subscription activated successfully",
    });
  } catch (error) {
    if (claimed && providerOrderId && !finalized) {
      const rollbackStatus = subscriptionApplied ? "COMPLETED" : "PENDING";
      try {
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        await db
          .collection("payments")
          .where({ provider: "alipay", providerOrderId })
          .update({
            status: rollbackStatus,
            updatedAt: new Date().toISOString(),
          });
      } catch (rollbackError) {
        console.warn("[Alipay Confirm] rollback status failed:", rollbackError);
      }
    }
    console.error("❌ [Alipay Confirm] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to confirm payment",
      },
      { status: 500 }
    );
  }
}
