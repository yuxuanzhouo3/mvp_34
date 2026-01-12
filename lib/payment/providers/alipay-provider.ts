/**
 * 支付宝支付提供商
 * 支持电脑网站支付（PC）和手机网站支付（WAP）
 */

import * as crypto from "crypto";

interface AlipayConfig {
  appId: string;
  privateKey: string;
  alipayPublicKey: string;
  notifyUrl: string;
  returnUrl: string;
  gatewayUrl?: string;
}

export class AlipayProvider {
  private config: AlipayConfig;
  private alipaySdk: any;

  constructor(envConfig: any) {
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      "http://localhost:3000"
    ).replace(/\/$/, "");

    this.config = {
      appId: envConfig.ALIPAY_APP_ID || process.env.ALIPAY_APP_ID || "",
      privateKey: envConfig.ALIPAY_PRIVATE_KEY || process.env.ALIPAY_PRIVATE_KEY || "",
      alipayPublicKey: envConfig.ALIPAY_ALIPAY_PUBLIC_KEY || process.env.ALIPAY_ALIPAY_PUBLIC_KEY || "",
      notifyUrl: `${appUrl}/api/domestic/payment/webhook/alipay`,
      returnUrl: `${appUrl}/payment/success`,
      gatewayUrl: envConfig.ALIPAY_GATEWAY_URL || process.env.ALIPAY_GATEWAY_URL || "https://openapi.alipay.com/gateway.do",
    };

    this.initSdk();
  }

  private initSdk() {
    try {
      const { AlipaySdk } = require("alipay-sdk");

      const formatPrivateKey = (key: string) => {
        if (key.includes("BEGIN RSA PRIVATE KEY")) return key;
        if (key.includes("BEGIN PRIVATE KEY")) {
          const keyContent = key
            .replace(/-----BEGIN PRIVATE KEY-----/, "")
            .replace(/-----END PRIVATE KEY-----/, "")
            .replace(/\s/g, "");
          return `-----BEGIN RSA PRIVATE KEY-----\n${keyContent}\n-----END RSA PRIVATE KEY-----`;
        }
        return `-----BEGIN RSA PRIVATE KEY-----\n${key}\n-----END RSA PRIVATE KEY-----`;
      };

      const formatPublicKey = (key: string) => {
        if (key.includes("BEGIN")) return key;
        return `-----BEGIN PUBLIC KEY-----\n${key}\n-----END PUBLIC KEY-----`;
      };

      this.alipaySdk = new AlipaySdk({
        appId: this.config.appId,
        privateKey: formatPrivateKey(this.config.privateKey),
        signType: "RSA2",
        alipayPublicKey: formatPublicKey(this.config.alipayPublicKey),
        gateway: this.config.gatewayUrl,
        timeout: 30000,
        camelcase: false,
      });
    } catch (error) {
      console.error("[AlipayProvider] Failed to init SDK:", error);
      throw error;
    }
  }

  /**
   * 生成支付订单号
   */
  private generatePaymentId(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `ALI${timestamp}${random}`;
  }

  /**
   * 创建支付订单
   */
  async createPayment(order: {
    amount: number;
    currency: string;
    description: string;
    userId: string;
    planType?: string;
    billingCycle?: string;
    metadata?: Record<string, any>;
  }): Promise<{
    success: boolean;
    paymentId?: string;
    paymentUrl?: string;
    error?: string;
  }> {
    try {
      const outTradeNo = this.generatePaymentId();
      const productMode = (process.env.ALIPAY_PRODUCT_MODE || "page").toLowerCase();
      const isWap = productMode === "wap";

      const bizContent = {
        out_trade_no: outTradeNo,
        total_amount: order.amount.toFixed(2),
        subject: order.description,
        product_code: isWap ? "QUICK_WAP_WAY" : "FAST_INSTANT_TRADE_PAY",
        passback_params: order.userId || "",
        notify_url: this.config.notifyUrl,
        return_url: this.config.returnUrl,
      };

      const result = await this.alipaySdk.pageExec(
        isWap ? "alipay.trade.wap.pay" : "alipay.trade.page.pay",
        {
          return_url: this.config.returnUrl,
          notify_url: this.config.notifyUrl,
          bizContent,
        }
      );

      return {
        success: true,
        paymentId: outTradeNo,
        paymentUrl: result, // HTML 表单
      };
    } catch (error) {
      console.error("[AlipayProvider] createPayment error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "创建支付失败",
      };
    }
  }

  /**
   * 查询支付状态
   */
  async queryPayment(outTradeNo: string): Promise<{
    trade_status: string;
    trade_no?: string;
    total_amount?: string;
    buyer_pay_amount?: string;
  }> {
    const result = await this.alipaySdk.exec("alipay.trade.query", {
      bizContent: { out_trade_no: outTradeNo },
    });

    const tradeStatus = result.tradeStatus || result.trade_status;
    const tradeNo = result.tradeNo || result.trade_no;
    const totalAmount = result.totalAmount || result.total_amount;
    const buyerPayAmount = result.buyerPayAmount || result.buyer_pay_amount || totalAmount;

    if (result.code === "10000") {
      return {
        trade_status: tradeStatus,
        trade_no: tradeNo,
        total_amount: totalAmount,
        buyer_pay_amount: buyerPayAmount,
      };
    }

    throw new Error(`Query failed: ${result.msg} (code: ${result.code})`);
  }

  /**
   * 验证回调签名
   */
  verifyCallback(params: Record<string, string>): boolean {
    try {
      // 开发/沙箱环境跳过验证
      const nodeEnv = (process.env.NODE_ENV || "").toLowerCase().trim();
      const alipayEnv = (process.env.ALIPAY_SANDBOX || "").toLowerCase().trim();

      if (nodeEnv === "development" || alipayEnv === "true") {
        console.log("[AlipayProvider] Skipping signature verification in dev/sandbox");
        return true;
      }

      if (!params.sign || !params.sign_type) {
        console.log("[AlipayProvider] No signature in params (sync return)");
        return true;
      }

      return this.alipaySdk.checkNotifySignV2(params);
    } catch (error) {
      console.error("[AlipayProvider] verifyCallback error:", error);
      return false;
    }
  }
}

/**
 * 验证支付宝签名（独立函数）
 */
export function verifyAlipaySignature(
  params: Record<string, string>,
  publicKey?: string
): boolean {
  try {
    if (process.env.NODE_ENV !== "production" || process.env.ALIPAY_SANDBOX === "true") {
      return true;
    }

    if (!publicKey) {
      console.error("Missing Alipay public key");
      return false;
    }

    const sign = params.sign;
    const signType = params.sign_type;

    if (!sign || signType !== "RSA2") {
      console.error("Missing or invalid Alipay signature");
      return false;
    }

    const paramsToSign = { ...params };
    delete paramsToSign.sign;
    delete paramsToSign.sign_type;

    const sortedKeys = Object.keys(paramsToSign).sort();
    const signString = sortedKeys
      .map((key) => `${key}=${paramsToSign[key]}`)
      .join("&");

    const verify = crypto.createVerify("RSA-SHA256");
    verify.update(signString, "utf8");

    const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;

    return verify.verify(publicKeyPem, sign, "base64");
  } catch (error) {
    console.error("Alipay signature verification error:", error);
    return false;
  }
}
