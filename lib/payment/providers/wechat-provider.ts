/**
 * 微信支付 API v3 提供商
 * 支持 NATIVE 支付（扫码支付）
 */

import crypto from "crypto";

interface WechatV3Config {
  appId: string;
  mchId: string;
  apiV3Key: string;
  privateKey: string;
  serialNo: string;
  notifyUrl: string;
}

interface CreateNativeOrderParams {
  out_trade_no: string;
  amount: number; // 金额（分）
  description: string;
  attach?: string;
}

interface PaymentStatus {
  tradeState: string;
  transactionId?: string;
  amount?: number;
  successTime?: string;
}

export class WechatPayProvider {
  private config: WechatV3Config;
  private apiBaseUrl = "https://api.mch.weixin.qq.com";

  constructor(config: WechatV3Config) {
    this.config = this.validateConfig(config);
  }

  private validateConfig(config: WechatV3Config): WechatV3Config {
    const required = ["appId", "mchId", "apiV3Key", "privateKey", "serialNo", "notifyUrl"];
    for (const key of required) {
      if (!config[key as keyof WechatV3Config]) {
        throw new Error(`Missing required config: ${key}`);
      }
    }

    if (config.apiV3Key.length !== 32) {
      throw new Error("API v3 key must be 32 bytes");
    }

    // 处理私钥格式
    let privateKey = config.privateKey.replace(/\\n/g, "\n");
    config.privateKey = privateKey;

    return config;
  }

  /**
   * NATIVE 支付下单
   */
  async createNativePayment(params: CreateNativeOrderParams): Promise<{ codeUrl: string }> {
    const requestBody: any = {
      appid: this.config.appId,
      mchid: this.config.mchId,
      description: params.description,
      out_trade_no: params.out_trade_no,
      notify_url: this.config.notifyUrl,
      amount: {
        total: params.amount,
        currency: "CNY",
      },
    };

    if (params.attach) {
      requestBody.attach = params.attach;
    }

    const response = await this.requestWithSignature(
      "POST",
      "/v3/pay/transactions/native",
      requestBody
    );

    if (!response.code_url) {
      throw new Error("No code_url in WeChat response");
    }

    return { codeUrl: response.code_url };
  }

  /**
   * 查询订单状态
   */
  async queryOrderByOutTradeNo(outTradeNo: string): Promise<PaymentStatus> {
    const path = `/v3/pay/transactions/out-trade-no/${outTradeNo}`;
    const queryParams = { mchid: this.config.mchId };

    const response = await this.requestWithSignature("GET", path, null, queryParams);

    return {
      tradeState: response.trade_state || "UNKNOWN",
      transactionId: response.transaction_id,
      amount: response.amount?.total,
      successTime: response.success_time,
    };
  }

  /**
   * 验证 Webhook 签名
   */
  verifyWebhookSignature(
    body: string,
    signature: string,
    timestamp: string,
    nonce: string
  ): boolean {
    try {
      const message = `${timestamp}\n${nonce}\n${body}\n`;
      const expectedSignature = crypto
        .createHmac("sha256", this.config.apiV3Key)
        .update(message)
        .digest("base64");

      return expectedSignature === signature;
    } catch (error) {
      console.error("WeChat signature verification error:", error);
      return false;
    }
  }

  /**
   * 解密 Webhook 回调数据
   */
  decryptWebhookData(ciphertext: string, nonce: string, associatedData: string): any {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      Buffer.from(this.config.apiV3Key, "utf-8"),
      Buffer.from(nonce, "utf-8")
    );

    decipher.setAAD(Buffer.from(associatedData, "utf-8"));

    let decrypted = decipher.update(ciphertext, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return JSON.parse(decrypted);
  }

  /**
   * 处理 Webhook 通知
   */
  async handleWebhookNotification(webhookBody: any): Promise<any> {
    const { resource } = webhookBody;

    if (!resource) {
      throw new Error("Missing resource in webhook");
    }

    return this.decryptWebhookData(
      resource.ciphertext,
      resource.nonce,
      resource.associated_data
    );
  }

  private async requestWithSignature(
    method: string,
    path: string,
    body: any = null,
    queryParams: Record<string, any> = {}
  ): Promise<any> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString("hex");

    let url = path;
    if (Object.keys(queryParams).length > 0) {
      const queryString = Object.entries(queryParams)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join("&");
      url = `${path}?${queryString}`;
    }

    const bodyStr = body ? JSON.stringify(body) : "";
    const signature = this.buildSignature(method, url, timestamp, nonce, bodyStr);

    const response = await fetch(`${this.apiBaseUrl}${url}`, {
      method,
      headers: {
        Authorization: signature,
        "Wechatpay-Timestamp": timestamp,
        "Wechatpay-Nonce": nonce,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body && method.toUpperCase() !== "GET" ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`WeChat API error: ${errorData.message || response.statusText}`);
    }

    return response.json();
  }

  private buildSignature(
    method: string,
    path: string,
    timestamp: string,
    nonce: string,
    body: string
  ): string {
    const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`;
    const privateKey = this.formatPrivateKey(this.config.privateKey);

    const sign = crypto
      .createSign("RSA-SHA256")
      .update(message)
      .sign(privateKey, "base64");

    return `WECHATPAY2-SHA256-RSA2048 mchid="${this.config.mchId}",nonce_str="${nonce}",signature="${sign}",timestamp="${timestamp}",serial_no="${this.config.serialNo}"`;
  }

  private formatPrivateKey(key: string): string {
    let cleanKey = key.trim().replace(/\s/g, "");

    const isPKCS1 = key.includes("BEGIN RSA PRIVATE KEY");
    const isPKCS8 = key.includes("BEGIN PRIVATE KEY");

    if (isPKCS1 || isPKCS8) {
      const match = key.match(/-----BEGIN[^-]*-----\s*([\s\S]*?)\s*-----END[^-]*-----/);
      if (match && match[1]) {
        cleanKey = match[1].replace(/\s/g, "");
      }
    }

    const header = isPKCS1 ? "BEGIN RSA PRIVATE KEY" : "BEGIN PRIVATE KEY";
    const footer = isPKCS1 ? "END RSA PRIVATE KEY" : "END PRIVATE KEY";

    let formattedKey = `-----${header}-----\n`;
    for (let i = 0; i < cleanKey.length; i += 64) {
      formattedKey += cleanKey.slice(i, i + 64) + "\n";
    }
    formattedKey += `-----${footer}-----`;

    return formattedKey;
  }
}
