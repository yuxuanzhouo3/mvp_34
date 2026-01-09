"use client";

import { useRouter } from "next/navigation";
import { XCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";

export default function StripeCancelPage() {
  const router = useRouter();
  const { currentLanguage } = useLanguage();
  const isZh = currentLanguage === "zh";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-[#0f1015] dark:via-[#14151a] dark:to-[#0f1015] p-4">
      <div className="max-w-md w-full">
        <div className="bg-white/80 dark:bg-white/5 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-white/10 shadow-xl p-8 text-center">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-gray-400 to-slate-500 rounded-full flex items-center justify-center shadow-lg mb-6">
            <XCircle className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {isZh ? "支付已取消" : "Payment Cancelled"}
          </h1>

          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {isZh
              ? "您已取消支付流程。如果这是误操作，您可以重新选择套餐进行订阅。"
              : "You have cancelled the payment process. If this was a mistake, you can select a plan again to subscribe."}
          </p>

          <div className="space-y-3">
            <Button
              onClick={() => router.push("/generate")}
              className="w-full h-11 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/30 transition-all duration-300 hover:shadow-xl"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {isZh ? "重新选择套餐" : "Choose Plan Again"}
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push("/")}
              className="w-full h-11 rounded-xl"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
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
