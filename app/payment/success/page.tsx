"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Home, Sparkles, Loader2 } from "lucide-react";
import { IS_DOMESTIC_VERSION } from "@/config";

export default function PaymentSuccessPage() {
  const { currentLanguage } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isZh = currentLanguage === "zh";
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // 触发额度刷新事件并确认支付
  useEffect(() => {
    const confirmPayment = async () => {
      // 获取支付提供商和订单号
      const provider = searchParams.get("provider") || "alipay";
      const outTradeNo = searchParams.get("out_trade_no") || sessionStorage.getItem("alipay_order_id");

      if (IS_DOMESTIC_VERSION && outTradeNo && !confirmed) {
        setConfirming(true);
        try {
          // 根据支付提供商调用对应的 confirm API
          const confirmUrl = provider === "wechat"
            ? "/api/domestic/payment/wechat/confirm"
            : "/api/domestic/payment/alipay/confirm";

          const res = await fetch(confirmUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ outTradeNo }),
          });

          const data = await res.json();
          console.log("[PaymentSuccess] Confirm result:", data);

          if (data.success) {
            setConfirmed(true);
            // 清除 sessionStorage 中的订单号
            sessionStorage.removeItem("alipay_order_id");
            sessionStorage.removeItem("wechat_pay_order");
          }
        } catch (error) {
          console.error("[PaymentSuccess] Confirm error:", error);
        } finally {
          setConfirming(false);
        }
      } else if (!outTradeNo) {
        // 没有订单号，直接标记为已确认
        setConfirmed(true);
      }

      // 标记支付完成
      sessionStorage.setItem("payment_completed", "true");
      // 触发额度刷新
      window.dispatchEvent(new CustomEvent("quota:refresh"));
    };

    confirmPayment();
  }, [searchParams, confirmed]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-[#0f1015] dark:via-[#14151a] dark:to-[#0f1015] p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 relative">
            <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse" />
            <div className="relative w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center">
              {confirming ? (
                <Loader2 className="w-10 h-10 text-white animate-spin" />
              ) : (
                <CheckCircle className="w-10 h-10 text-white" />
              )}
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {confirming
              ? (isZh ? "正在确认支付..." : "Confirming Payment...")
              : (isZh ? "支付成功！" : "Payment Successful!")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-muted-foreground">
              {confirming
                ? (isZh ? "请稍候，正在处理您的订阅..." : "Please wait, processing your subscription...")
                : (isZh ? "感谢您的订阅！您的账户已升级。" : "Thank you for subscribing! Your account has been upgraded.")}
            </p>
            {!confirming && (
              <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <Sparkles className="w-4 h-4" />
                <span>
                  {isZh
                    ? "新的额度已生效"
                    : "Your new quota is now active"}
                </span>
              </div>
            )}
          </div>

          <div className="pt-4 space-y-3">
            <Button
              onClick={() => router.push("/generate")}
              disabled={confirming}
              className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {isZh ? "开始构建" : "Start Building"}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/")}
              disabled={confirming}
              className="w-full"
            >
              <Home className="w-4 h-4 mr-2" />
              {isZh ? "返回首页" : "Back to Home"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
