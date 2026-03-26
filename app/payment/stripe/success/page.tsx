"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, Loader2, AlertCircle, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";

function StripeSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session_id");
  const { currentLanguage } = useLanguage();
  const isZh = currentLanguage === "zh";

  const initialStatus = sessionId ? "loading" : "error";
  const initialError = sessionId ? null : "Missing payment session ID";

  const [status, setStatus] = useState<"loading" | "success" | "error">(initialStatus);
  const [result, setResult] = useState<{
    plan?: string;
    period?: string;
    expiresAt?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(initialError);

  useEffect(() => {
    if (!sessionId) return;

    const confirmPayment = async () => {
      try {
        const res = await fetch("/api/payment/stripe/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        const data = await res.json();

        if (data.success) {
          setResult({
            plan: data.plan,
            period: data.period,
            expiresAt: data.expiresAt,
          });
          setStatus("success");

          // 设置标记，让首页知道需要刷新用户数据
          sessionStorage.setItem("payment_completed", "true");

          // 触发配额刷新事件
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("quota:refresh"));
          }
        } else {
          setError(data.error || (isZh ? "支付确认失败" : "Payment confirmation failed"));
          setStatus("error");
        }
      } catch (err) {
        setError(isZh ? "网络错误，请稍后重试" : "Network error, please try again");
        setStatus("error");
      }
    };

    confirmPayment();
  }, [sessionId, isZh]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString(isZh ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-[#0f1015] dark:via-[#14151a] dark:to-[#0f1015]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-violet-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            {isZh ? "正在确认支付..." : "Confirming payment..."}
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-[#0f1015] dark:via-[#14151a] dark:to-[#0f1015] p-4">
        <div className="max-w-md w-full bg-white/80 dark:bg-white/5 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-white/10 shadow-xl p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <AlertCircle className="w-12 h-12 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {isZh ? "支付确认失败" : "Payment Confirmation Failed"}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error || (isZh ? "请联系客服获取帮助" : "Please contact support for assistance")}
          </p>
          <div className="space-y-3">
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="w-full"
            >
              {isZh ? "重试" : "Retry"}
            </Button>
            <Button
              onClick={() => router.push("/")}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white"
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
          {/* 成功图标 */}
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

          {/* 订阅详情 */}
          {result && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-6 text-left">
              <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-600">
                <span className="text-gray-600 dark:text-gray-400">
                  {isZh ? "套餐" : "Plan"}
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {result.plan}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-600">
                <span className="text-gray-600 dark:text-gray-400">
                  {isZh ? "周期" : "Period"}
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {result.period === "annual"
                    ? isZh ? "年付" : "Annual"
                    : isZh ? "月付" : "Monthly"}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-600 dark:text-gray-400">
                  {isZh ? "有效期至" : "Valid until"}
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatDate(result.expiresAt)}
                </span>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="space-y-3">
            <Button
              onClick={() => {
                // 强制页面刷新，确保用户数据重新获取
                window.location.href = "/generate";
              }}
              className="w-full h-11 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/30 transition-all duration-300 hover:shadow-xl"
            >
              {isZh ? "开始构建应用" : "Start Building"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                window.location.href = "/";
              }}
              className="w-full h-11 rounded-xl"
            >
              {isZh ? "返回首页" : "Back to Home"}
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

export default function StripeSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
        </div>
      }
    >
      <StripeSuccessContent />
    </Suspense>
  );
}
