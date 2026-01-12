/**
 * 微信支付状态查询 API（国内版专用）
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { WechatPayProvider } from "@/lib/payment/providers/wechat-provider";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const outTradeNo = searchParams.get("out_trade_no");

    if (!outTradeNo) {
      return NextResponse.json(
        { success: false, error: "缺少订单号" },
        { status: 400 }
      );
    }

    // 初始化微信支付提供商
    const wechatProvider = new WechatPayProvider({
      appId: process.env.WECHAT_PAY_APP_ID!,
      mchId: process.env.WECHAT_PAY_MCH_ID!,
      apiV3Key: process.env.WECHAT_PAY_API_V3_KEY!,
      privateKey: process.env.WECHAT_PAY_PRIVATE_KEY!,
      serialNo: process.env.WECHAT_PAY_SERIAL_NO!,
      notifyUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL}/api/domestic/payment/webhook/wechat`,
    });

    // 查询订单状态
    const result = await wechatProvider.queryOrderByOutTradeNo(outTradeNo);

    return NextResponse.json({
      success: true,
      trade_state: result.tradeState,
      transaction_id: result.transactionId,
      amount: result.amount,
      success_time: result.successTime,
    });
  } catch (err) {
    console.error("❌ [WeChat Query] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "查询失败",
      },
      { status: 500 }
    );
  }
}
