/**
 * 支付宝订单查询 API（国内版专用）
 * 用于查询支付宝订单状态
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { AlipayProvider } from "@/lib/payment/providers/alipay-provider";

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

    console.log("📥 [Alipay Query] Processing:", outTradeNo);

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

    // 2. 查询支付宝订单状态
    const alipayProvider = new AlipayProvider(process.env);
    let alipayStatus: any;

    try {
      alipayStatus = await alipayProvider.queryPayment(outTradeNo);
      console.log("[Alipay Query] Alipay query result:", alipayStatus);
    } catch (queryError) {
      console.error("[Alipay Query] Query failed:", queryError);
      return NextResponse.json(
        { success: false, error: "Failed to query Alipay payment status" },
        { status: 500 }
      );
    }

    // 3. 返回查询结果
    const tradeStatus = alipayStatus?.trade_status;
    const isSuccess = tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED";

    return NextResponse.json({
      success: true,
      status: tradeStatus || "UNKNOWN",
      isPaid: isSuccess,
      tradeNo: alipayStatus?.trade_no || null,
      totalAmount: alipayStatus?.total_amount || null,
      buyerPayAmount: alipayStatus?.buyer_pay_amount || null,
      localRecord: paymentRecord ? {
        status: paymentRecord.status,
        amount: paymentRecord.amount,
        plan: paymentRecord.plan,
        createdAt: paymentRecord.createdAt,
      } : null,
    });
  } catch (error) {
    console.error("❌ [Alipay Query] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to query payment",
      },
      { status: 500 }
    );
  }
}
