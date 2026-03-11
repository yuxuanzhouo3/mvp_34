"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, RefreshCw, X } from "lucide-react";
import QRCode from "qrcode";

interface WechatPayOrder {
  out_trade_no: string;
  code_url: string;
  amount: number;
  planName: string;
  billingPeriod: string;
}

export default function WechatPayPage() {
  const { currentLanguage } = useLanguage();
  const router = useRouter();
  const isZh = currentLanguage === "zh";

  const [order, setOrder] = useState<WechatPayOrder | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [status, setStatus] = useState<"pending" | "success" | "failed" | "expired">("pending");
  const [checking, setChecking] = useState(false);
  const [countdown, setCountdown] = useState(5 * 60); // 5分钟倒计时（秒）

  // 格式化倒计时显示
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // 取消支付
  const handleCancel = () => {
    sessionStorage.removeItem("wechat_pay_order");
    router.push("/");
  };

  // 从 sessionStorage 获取订单信息
  useEffect(() => {
    const orderData = sessionStorage.getItem("wechat_pay_order");
    if (orderData) {
      try {
        const parsed = JSON.parse(orderData) as WechatPayOrder;
        setOrder(parsed);

        // 生成二维码
        QRCode.toDataURL(parsed.code_url, {
          width: 256,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        }).then(setQrCodeUrl);
      } catch (e) {
        console.error("Failed to parse order data:", e);
        router.push("/");
      }
    } else {
      router.push("/");
    }
  }, [router]);

  // 倒计时
  useEffect(() => {
    if (status !== "pending" || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setStatus("expired");
          sessionStorage.removeItem("wechat_pay_order");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status, countdown]);

  // 轮询检查支付状态
  useEffect(() => {
    if (!order || status !== "pending") return;

    const checkPaymentStatus = async () => {
      try {
        setChecking(true);
        const response = await fetch(`/api/domestic/payment/wechat/query?out_trade_no=${order.out_trade_no}`);
        const data = await response.json();

        if (data.trade_state === "SUCCESS") {
          setStatus("success");

          // 调用确认 API 处理业务逻辑（增加额度/激活订阅）
          try {
            console.log("[WeChat Payment] Confirming payment:", order.out_trade_no);
            const confirmRes = await fetch("/api/domestic/payment/wechat/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ outTradeNo: order.out_trade_no }),
            });
            const confirmData = await confirmRes.json();
            console.log("[WeChat Payment] Confirm result:", confirmData);
          } catch (confirmError) {
            console.error("[WeChat Payment] Confirm error:", confirmError);
          }

          sessionStorage.removeItem("wechat_pay_order");
          // 触发额度刷新事件
          window.dispatchEvent(new CustomEvent("quota:refresh"));
          // 3秒后跳转
          setTimeout(() => {
            router.push("/payment/success?provider=wechat&out_trade_no=" + order.out_trade_no);
          }, 3000);
        } else if (data.trade_state === "CLOSED" || data.trade_state === "REVOKED") {
          setStatus("failed");
        }
      } catch (error) {
        console.error("Failed to check payment status:", error);
      } finally {
        setChecking(false);
      }
    };

    // 每3秒检查一次
    const interval = setInterval(checkPaymentStatus, 3000);

    // 2小时后过期
    const expireTimeout = setTimeout(() => {
      setStatus("expired");
      sessionStorage.removeItem("wechat_pay_order");
    }, 2 * 60 * 60 * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(expireTimeout);
    };
  }, [order, status, router]);

  // 手动刷新状态
  const handleRefresh = async () => {
    if (!order || checking) return;

    try {
      setChecking(true);
      const response = await fetch(`/api/domestic/payment/wechat/query?out_trade_no=${order.out_trade_no}`);
      const data = await response.json();

      if (data.trade_state === "SUCCESS") {
        setStatus("success");

        // 调用确认 API 处理业务逻辑（增加额度/激活订阅）
        try {
          console.log("[WeChat Payment] Confirming payment:", order.out_trade_no);
          const confirmRes = await fetch("/api/domestic/payment/wechat/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ outTradeNo: order.out_trade_no }),
          });
          const confirmData = await confirmRes.json();
          console.log("[WeChat Payment] Confirm result:", confirmData);
        } catch (confirmError) {
          console.error("[WeChat Payment] Confirm error:", confirmError);
        }

        sessionStorage.removeItem("wechat_pay_order");
        window.dispatchEvent(new CustomEvent("quota:refresh"));
        setTimeout(() => {
          router.push("/payment/success?provider=wechat&out_trade_no=" + order.out_trade_no);
        }, 3000);
      }
    } catch (error) {
      console.error("Failed to check payment status:", error);
    } finally {
      setChecking(false);
    }
  };

  const getPlanDisplayName = (planName: string) => {
    const names: Record<string, string> = {
      pro: isZh ? "专业版" : "Pro",
      team: isZh ? "团队版" : "Team",
    };
    return names[planName.toLowerCase()] || planName;
  };

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-green-50/30 dark:from-[#0f1015] dark:via-[#14151a] dark:to-[#0f1015] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-green-500" fill="currentColor">
              <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.032zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
            </svg>
            {isZh ? "微信支付" : "WeChat Pay"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {status === "pending" && (
            <>
              {/* 订单信息 */}
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">
                  {isZh ? "订阅套餐" : "Plan"}: {getPlanDisplayName(order.planName)}
                </p>
                <p className="text-2xl font-bold text-green-600">
                  ¥{order.amount.toFixed(2)}
                </p>
              </div>

              {/* 二维码 */}
              <div className="flex flex-col items-center">
                {qrCodeUrl ? (
                  <div className="relative">
                    <div className="p-4 bg-white rounded-lg shadow-inner">
                      <img src={qrCodeUrl} alt="WeChat Pay QR Code" className="w-48 h-48" />
                    </div>
                    {/* 倒计时显示 */}
                    <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        countdown <= 60
                          ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                      }`}>
                        {isZh ? `有效期 ${formatCountdown(countdown)}` : `Expires in ${formatCountdown(countdown)}`}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center bg-gray-100 rounded-lg">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* 提示 */}
              <p className="text-center text-sm text-muted-foreground">
                {isZh ? "请使用微信扫描二维码完成支付" : "Please scan the QR code with WeChat to pay"}
              </p>

              {/* 刷新按钮和取消按钮 */}
              <div className="flex justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={checking}
                  className="gap-2"
                >
                  {checking ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {isZh ? "已完成支付？点击刷新" : "Paid? Click to refresh"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="gap-2 text-muted-foreground hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                  {isZh ? "取消支付" : "Cancel"}
                </Button>
              </div>
            </>
          )}

          {status === "success" && (
            <div className="text-center space-y-4">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
              <p className="text-lg font-semibold text-green-600">
                {isZh ? "支付成功！" : "Payment Successful!"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isZh ? "正在跳转..." : "Redirecting..."}
              </p>
            </div>
          )}

          {status === "failed" && (
            <div className="text-center space-y-4">
              <XCircle className="w-16 h-16 text-red-500 mx-auto" />
              <p className="text-lg font-semibold text-red-600">
                {isZh ? "支付失败" : "Payment Failed"}
              </p>
              <Button onClick={() => router.push("/")} variant="outline">
                {isZh ? "返回首页" : "Back to Home"}
              </Button>
            </div>
          )}

          {status === "expired" && (
            <div className="text-center space-y-4">
              <XCircle className="w-16 h-16 text-orange-500 mx-auto" />
              <p className="text-lg font-semibold text-orange-600">
                {isZh ? "二维码已过期" : "QR Code Expired"}
              </p>
              <Button onClick={() => router.push("/")} variant="outline">
                {isZh ? "返回重新支付" : "Go Back and Retry"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
