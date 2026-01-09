"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, Loader2, ArrowRight, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";

export default function PayPalSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentLanguage } = useLanguage();
  const isZh = currentLanguage === "zh";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage(isZh ? "缺少支付令牌" : "Missing payment token");
      return;
    }

    // 调用 capture API 完成 PayPal 支付
    const capturePayment = async () => {
      try {
        const response = await fetch("/api/payment/paypal/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: token }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Payment capture failed");
        }

        setStatus("success");

        // 设置标记，让首页知道需要刷新用户数据
        sessionStorage.setItem("payment_completed", "true");

        // 触发配额刷新事件
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("quota:refresh"));
        }
      } catch (error) {
        console.error("PayPal capture error:", error);
        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : (isZh ? "支付确认失败" : "Payment confirmation failed")
        );
      }
    };

    capturePayment();
  }, [token, isZh]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-[#0f1015] dark:via-[#14151a] dark:to-[#0f1015]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            {isZh ? "正在确认 PayPal 支付..." : "Confirming PayPal payment..."}
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-[#0f1015] dark:via-[#14151a] dark:to-[#0f1015] p-4">
        <div className="max-w-md w-full">
          <div className="bg-white/80 dark:bg-white/5 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-white/10 shadow-xl p-8 text-center">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-red-400 to-rose-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 mb-6">
              <XCircle className="w-10 h-10 text-white" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {isZh ? "支付失败" : "Payment Failed"}
            </h1>

            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {errorMessage}
            </p>

            <Button
              onClick={() => router.push("/generate")}
              variant="outline"
              className="w-full h-11 rounded-xl"
            >
              {isZh ? "返回首页" : "Back to Home"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-[#0f1015] dark:via-[#14151a] dark:to-[#0f1015] p-4">
      <div className="max-w-md w-full">
        <div className="bg-white/80 dark:bg-white/5 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-white/10 shadow-xl p-8 text-center">
          <div className="relative mb-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {isZh ? "支付成功！" : "Payment Successful!"}
          </h1>

          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {isZh
              ? "感谢您的订阅！您的套餐已升级，现在可以享受所有高级功能。"
              : "Thank you for subscribing! Your plan has been upgraded and you can now enjoy all premium features."}
          </p>

          <div className="space-y-3">
            <Button
              onClick={() => router.push("/generate")}
              className="w-full h-11 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-300 hover:shadow-xl"
            >
              {isZh ? "开始构建应用" : "Start Building"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push("/builds")}
              className="w-full h-11 rounded-xl"
            >
              {isZh ? "查看我的构建" : "View My Builds"}
            </Button>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
          {isZh
            ? "如有任何问题，请联系客服支持"
            : "If you have any questions, please contact support"}
        </p>
      </div>
    </div>
  );
}
