"use client";

import { useState, useMemo } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { IS_DOMESTIC_VERSION } from "@/config";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Crown,
  Check,
  Zap,
  Users,
  Sparkles,
  Clock,
  Share2,
  Layers,
  CreditCard,
  Loader2,
  Star,
  Rocket,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAllPlansConfig } from "@/utils/plan-limits";
import { toast } from "sonner";
import { PLAN_RANK, normalizePlanName } from "@/utils/plan-utils";

// 从环境变量获取套餐配置
const PLANS_CONFIG = getAllPlansConfig();

// 动态生成套餐特性列表
function generatePlanFeatures(planId: string, isZh: boolean): string[] {
  const config = PLANS_CONFIG[planId === "free" ? "Free" : planId === "pro" ? "Pro" : "Team"];
  const features: string[] = [];

  // 每日构建次数
  features.push(isZh ? `${config.dailyLimit}次构建/天` : `${config.dailyLimit} builds/day`);

  // 文件保留天数
  features.push(isZh ? `${config.buildExpireDays}天文件保留` : `${config.buildExpireDays}-day file retention`);

  if (planId === "free") {
    features.push(isZh ? "单平台构建" : "Single platform");
  } else {
    // 批量构建
    if (config.supportBatchBuild) {
      features.push(isZh ? "批量构建" : "Batch build");
    }
    // 分享功能（Pro 和 Team 不同描述）
    if (config.shareExpireDays > 0) {
      if (planId === "pro") {
        features.push(isZh ? `链接分享（${config.shareExpireDays}天）` : `Link sharing (${config.shareExpireDays} days)`);
      } else if (planId === "team") {
        features.push(isZh ? `自定义分享（${config.shareExpireDays}天）` : `Custom sharing (${config.shareExpireDays} days)`);
      }
    }
  }

  return features;
}

interface SubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  currentPlan?: string;
  currentPlanExp?: string;
}

// 套餐主题配色
const getPlanTheme = (planId: string) => {
  if (planId === "free") {
    return {
      gradient: "from-emerald-500 to-teal-600",
      bgGradient: "from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30",
      border: "border-emerald-200 dark:border-emerald-800",
      selectedBorder: "border-emerald-500",
      ring: "ring-emerald-500/30",
      text: "text-emerald-600 dark:text-emerald-400",
      icon: <Star className="w-6 h-6" />,
    };
  }
  if (planId === "pro") {
    return {
      gradient: "from-violet-500 to-purple-600",
      bgGradient: "from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30",
      border: "border-violet-200 dark:border-violet-800",
      selectedBorder: "border-violet-500",
      ring: "ring-violet-500/30",
      text: "text-violet-600 dark:text-violet-400",
      icon: <Rocket className="w-6 h-6" />,
    };
  }
  // team
  return {
    gradient: "from-amber-500 to-orange-600",
    bgGradient: "from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30",
    border: "border-amber-200 dark:border-amber-800",
    selectedBorder: "border-amber-500",
    ring: "ring-amber-500/30",
    text: "text-amber-600 dark:text-amber-400",
    icon: <Shield className="w-6 h-6" />,
  };
};

// 套餐基础数据（价格等静态信息）
interface PlanBase {
  id: string;
  name: string;
  nameZh?: string;
  price: string;
  originalPrice: string | null;
  period: string;
  periodZh?: string;
  popular: boolean;
  disabled: boolean;
}

// 完整套餐数据（包含动态特性）
interface Plan extends PlanBase {
  features: string[];
  featuresZh?: string[];
}

// 国际版套餐基础数据
const internationalPlansBase: { monthly: PlanBase[]; yearly: PlanBase[] } = {
  monthly: [
    { id: "free", name: "Free", nameZh: "免费版", price: "$0", originalPrice: null, period: "/mo", periodZh: "/月", popular: false, disabled: true },
    { id: "pro", name: "Pro", nameZh: "专业版", price: "$9.99", originalPrice: null, period: "/mo", periodZh: "/月", popular: true, disabled: false },
    { id: "team", name: "Team", nameZh: "团队版", price: "$29.99", originalPrice: null, period: "/mo", periodZh: "/月", popular: false, disabled: false },
  ],
  yearly: [
    { id: "free", name: "Free", nameZh: "免费版", price: "$0", originalPrice: null, period: "/mo", periodZh: "/月", popular: false, disabled: true },
    { id: "pro", name: "Pro", nameZh: "专业版", price: "$6.99", originalPrice: "$9.99", period: "/mo", periodZh: "/月", popular: true, disabled: false },
    { id: "team", name: "Team", nameZh: "团队版", price: "$20.99", originalPrice: "$29.99", period: "/mo", periodZh: "/月", popular: false, disabled: false },
  ],
};

// 国内版套餐基础数据
const domesticPlansBase: { monthly: PlanBase[]; yearly: PlanBase[] } = {
  monthly: [
    { id: "free", name: "基础版", price: "¥0", originalPrice: null, period: "/月", popular: false, disabled: true },
    { id: "pro", name: "专业版", price: "¥29.90", originalPrice: null, period: "/月", popular: true, disabled: false },
    { id: "team", name: "团队版", price: "¥99.90", originalPrice: null, period: "/月", popular: false, disabled: false },
  ],
  yearly: [
    { id: "free", name: "基础版", price: "¥0", originalPrice: null, period: "/月", popular: false, disabled: true },
    { id: "pro", name: "专业版", price: "¥20.90", originalPrice: "¥29.90", period: "/月", popular: true, disabled: false },
    { id: "team", name: "团队版", price: "¥69.90", originalPrice: "¥99.90", period: "/月", popular: false, disabled: false },
  ],
};

// 动态生成完整套餐数据
function getPlansWithFeatures(basePlans: { monthly: PlanBase[]; yearly: PlanBase[] }, isZh: boolean): { monthly: Plan[]; yearly: Plan[] } {
  const addFeatures = (plans: PlanBase[]): Plan[] =>
    plans.map(plan => ({
      ...plan,
      features: generatePlanFeatures(plan.id, false),
      featuresZh: generatePlanFeatures(plan.id, true),
    }));

  return {
    monthly: addFeatures(basePlans.monthly),
    yearly: addFeatures(basePlans.yearly),
  };
}

export function SubscriptionModal({ open, onOpenChange, userId, currentPlan, currentPlanExp }: SubscriptionModalProps) {
  const { currentLanguage } = useLanguage();
  const isDomestic = IS_DOMESTIC_VERSION;
  const isZh = currentLanguage === "zh";
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedPayment, setSelectedPayment] = useState(isDomestic ? "alipay" : "stripe");
  const [isProcessing, setIsProcessing] = useState(false);

  // 动态生成套餐数据（从环境变量读取配额）
  const internationalPlans = getPlansWithFeatures(internationalPlansBase, isZh);
  const domesticPlans = getPlansWithFeatures(domesticPlansBase, isZh);

  const plans = isDomestic ? domesticPlans : internationalPlans;
  const currentPlans = plans[billingCycle];

  // 判断套餐是否为当前套餐
  const isCurrentPlan = (planId: string) => {
    if (!currentPlan) return planId === "free";
    return currentPlan.toLowerCase() === planId.toLowerCase();
  };

  // 价格计算逻辑
  const pricingInfo = useMemo(() => {
    if (!selectedPlan) {
      return { payable: null, isUpgrade: false, isDowngrade: false, isSameActive: false, remainingDays: 0, convertedDays: 0, freeUpgrade: false, symbol: "" };
    }

    const symbol = isDomestic ? "¥" : "$";
    const msPerDay = 1000 * 60 * 60 * 24;

    // 获取套餐价格
    const getPlanPrice = (planId: string, period: "monthly" | "yearly") => {
      const planData = isDomestic ? domesticPlansBase : internationalPlansBase;
      const plan = planData[period].find(p => p.id === planId);
      if (!plan) return 0;
      const priceStr = plan.price.replace(/[^0-9.]/g, "");
      const price = parseFloat(priceStr) || 0;
      return period === "yearly" ? price * 12 : price;
    };

    const targetPrice = getPlanPrice(selectedPlan.id, billingCycle);
    const targetMonthlyPrice = getPlanPrice(selectedPlan.id, "monthly");

    const currentPlanKey = normalizePlanName(currentPlan || "").toLowerCase();
    const targetPlanKey = selectedPlan.id.toLowerCase();
    const currentRank = PLAN_RANK[normalizePlanName(currentPlan || "")] || 0;
    const targetRank = PLAN_RANK[normalizePlanName(selectedPlan.id)] || 0;

    const now = Date.now();
    const exp = currentPlanExp ? new Date(currentPlanExp).getTime() : null;
    const currentActive = exp ? exp > now : false;

    const isUpgrade = currentActive && targetRank > currentRank && currentRank > 0;
    const isDowngrade = currentActive && targetRank < currentRank;
    const isSameActive = currentActive && targetRank === currentRank && currentRank > 0;

    // 非升级场景：直接返回目标价格
    if (!isUpgrade) {
      return { payable: targetPrice, isUpgrade: false, isDowngrade, isSameActive, remainingDays: 0, convertedDays: 0, freeUpgrade: false, symbol };
    }

    // 升级场景：计算剩余价值折算
    const remainingDays = Math.max(0, Math.ceil(((exp || now) - now) / msPerDay));
    const currentMonthlyPrice = getPlanPrice(currentPlanKey, "monthly");
    const currentDailyPrice = currentMonthlyPrice / 30;
    const targetDailyPrice = targetMonthlyPrice / 30;
    const remainingValue = remainingDays * currentDailyPrice;
    const targetDays = billingCycle === "yearly" ? 365 : 30;

    const freeUpgrade = remainingValue >= targetPrice;
    let payable: number;
    let convertedDays: number;

    if (freeUpgrade) {
      payable = 0.01;
      convertedDays = Math.floor(remainingValue / targetDailyPrice);
    } else {
      payable = Math.max(0.01, targetPrice - remainingValue);
      convertedDays = targetDays;
    }

    payable = Math.round(payable * 100) / 100;

    return { payable, isUpgrade: true, isDowngrade: false, isSameActive: false, remainingDays, convertedDays, remainingValue: Math.round(remainingValue * 100) / 100, freeUpgrade, symbol };
  }, [selectedPlan, billingCycle, currentPlan, currentPlanExp, isDomestic]);

  const handleSubscribe = async () => {
    if (!selectedPlan || selectedPlan.disabled || selectedPlan.id === "free") return;

    if (!userId) {
      toast.error(isZh ? "请先登录" : "Please login first");
      return;
    }

    setIsProcessing(true);

    try {
      const billingPeriod = billingCycle === "yearly" ? "annual" : "monthly";

      if (selectedPayment === "stripe") {
        // Stripe 支付
        const response = await fetch("/api/payment/stripe/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planName: selectedPlan.id,
            billingPeriod,
            userId,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to create Stripe session");
        }

        // 跳转到 Stripe 支付页面
        if (data.url) {
          window.location.href = data.url;
        }
      } else if (selectedPayment === "paypal") {
        // PayPal 支付
        const response = await fetch("/api/payment/paypal/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planName: selectedPlan.id,
            billingPeriod,
            userId,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to create PayPal order");
        }

        // 跳转到 PayPal 支付页面
        if (data.approvalUrl) {
          window.location.href = data.approvalUrl;
        }
      } else if (selectedPayment === "alipay" || selectedPayment === "wechat") {
        // 国内支付
        const apiEndpoint = selectedPayment === "alipay"
          ? "/api/domestic/payment/alipay/create"
          : "/api/domestic/payment/wechat/create";

        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            planName: selectedPlan.id,
            billingPeriod,
            userId,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "创建支付失败");
        }

        if (selectedPayment === "alipay" && data.formHtml) {
          // 支付宝：保存订单号到 sessionStorage，用于支付成功页面确认
          if (data.paymentId || data.orderId) {
            sessionStorage.setItem("alipay_order_id", data.paymentId || data.orderId);
          }
          // 使用 HTML 表单提交
          const div = document.createElement("div");
          div.innerHTML = data.formHtml;
          document.body.appendChild(div);
          const form = div.querySelector("form");
          if (form) {
            form.submit();
          } else {
            throw new Error("支付宝表单解析失败");
          }
        } else if (selectedPayment === "wechat" && data.code_url) {
          // 微信支付：显示二维码弹窗
          // 存储订单信息到 sessionStorage，跳转到支付页面
          sessionStorage.setItem("wechat_pay_order", JSON.stringify({
            out_trade_no: data.out_trade_no,
            code_url: data.code_url,
            amount: data.amount,
            planName: selectedPlan.id,
            billingPeriod,
          }));
          window.location.href = "/payment/wechat";
        }
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast.error(
        isZh
          ? `支付失败: ${error instanceof Error ? error.message : "未知错误"}`
          : `Payment failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[52rem] bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-[#0f1015] dark:via-[#14151a] dark:to-[#0f1015] border-0 overflow-hidden shadow-2xl rounded-2xl p-0">
        {/* 装饰性背景 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-gradient-to-br from-blue-400/10 to-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-gradient-to-br from-emerald-400/10 to-teal-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 p-4 md:p-5">
          {/* 标题区 */}
          <DialogHeader className="text-center mb-3 md:mb-4">
            <DialogTitle className="flex items-center justify-center gap-2 text-lg md:text-xl font-bold">
              <div className="p-1.5 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-lg shadow-lg shadow-orange-500/25">
                <Crown className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
              <span className="text-gray-900 dark:text-white font-bold">
                {isZh ? "升级您的套餐" : "Upgrade Your Plan"}
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* 月付/年付切换 */}
          <div className="flex items-center justify-center mb-3 md:mb-4">
            <div className="bg-white/80 dark:bg-white/5 backdrop-blur-sm rounded-xl p-1 flex shadow-lg border border-gray-200/50 dark:border-white/10">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBillingCycle("monthly")}
                className={cn(
                  "px-3 md:px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-300",
                  billingCycle === "monthly"
                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-lg"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                {isZh ? "月付" : "Monthly"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBillingCycle("yearly")}
                className={cn(
                  "px-3 md:px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-300",
                  billingCycle === "yearly"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                {isZh ? "年付" : "Yearly"}
                <Badge className="ml-1.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[9px] px-1.5 py-0 font-bold border-0">
                  -30%
                </Badge>
              </Button>
            </div>
          </div>

          {/* 套餐卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-5">
            {currentPlans.map((plan) => {
              const isSelected = selectedPlan?.id === plan.id;
              const theme = getPlanTheme(plan.id);
              const isCurrent = isCurrentPlan(plan.id);
              // 允许同级续费：只禁用 Free 套餐，当前套餐可以选择（续费）
              const isDisabled = plan.disabled || plan.id === "free";

              return (
                <div
                  key={plan.id}
                  onClick={() => !isDisabled && setSelectedPlan(plan)}
                  className={cn(
                    "relative cursor-pointer transition-all duration-300 group",
                    isSelected ? "scale-[1.02]" : "hover:scale-[1.01]",
                    isDisabled && "cursor-default opacity-60",
                    plan.id === "free" && "hidden md:block"
                  )}
                >
                  {/* 选中时的外发光效果 */}
                  {isSelected && (
                    <div className={`absolute inset-0 bg-gradient-to-r ${theme.gradient} opacity-20 blur-xl rounded-xl -z-10`} />
                  )}

                  <div className={cn(
                    "relative h-full rounded-xl border-2 transition-all duration-300 overflow-hidden",
                    isSelected
                      ? `${theme.selectedBorder} shadow-xl ring-2 ${theme.ring}`
                      : `${theme.border} hover:shadow-lg`
                  )}>
                    {/* 卡片背景渐变 */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${theme.bgGradient} opacity-50`} />
                    <div className="absolute inset-0 bg-white/60 dark:bg-[#14151a]/60 backdrop-blur-sm" />

                    {/* 热门标签 */}
                    {plan.popular && (
                      <div className="absolute -top-px left-1/2 transform -translate-x-1/2">
                        <Badge className={`bg-gradient-to-r ${theme.gradient} text-white px-2 py-0.5 text-[9px] font-bold shadow-lg border-0 rounded-b-lg rounded-t-none`}>
                          <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                          {isZh ? "最受欢迎" : "Popular"}
                        </Badge>
                      </div>
                    )}

                    {/* 选中指示器 */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 z-10">
                        <div className={`w-5 h-5 rounded-full bg-gradient-to-r ${theme.gradient} flex items-center justify-center shadow-lg`}>
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      </div>
                    )}

                    <div className={cn("relative p-3 md:p-4", plan.popular && "pt-6")}>
                      {/* 套餐图标和名称 */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gradient-to-br ${theme.gradient} flex items-center justify-center shadow`}>
                          <div className="text-white scale-50 md:scale-75">{theme.icon}</div>
                        </div>
                        <h3 className="text-sm md:text-base font-bold text-gray-900 dark:text-white">
                          {isZh && plan.nameZh ? plan.nameZh : plan.name}
                        </h3>
                      </div>

                      {/* 价格区域 */}
                      <div className="mb-3 py-2.5 border-y border-gray-200/50 dark:border-white/10">
                        <div className="flex items-baseline gap-0.5">
                          <span className={`text-lg md:text-xl font-extrabold ${theme.text}`}>
                            {plan.price}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400 text-[10px]">
                            {isZh && plan.periodZh ? plan.periodZh : plan.period}
                          </span>
                        </div>
                        {plan.originalPrice && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] text-gray-400 line-through">
                              {plan.originalPrice}
                            </span>
                            <Badge className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[8px] px-1 py-0 font-bold border-0">
                              {isZh ? "省30%" : "-30%"}
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* 特性列表 */}
                      <ul className="space-y-1.5">
                        {(isZh && plan.featuresZh ? plan.featuresZh : plan.features).map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <div className={`w-3.5 h-3.5 rounded-full bg-gradient-to-r ${theme.gradient} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                              <Check className="w-2 h-2 text-white" />
                            </div>
                            <span className="text-[10px] md:text-xs text-gray-700 dark:text-gray-300 leading-tight">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      {/* 选择提示 */}
                      <div className="mt-3 pt-2.5 border-t border-gray-200/50 dark:border-white/10 text-center">
                        <span className={cn(
                          "text-[10px] font-medium transition-colors",
                          isSelected ? theme.text : "text-gray-400 dark:text-gray-500"
                        )}>
                          {isDisabled
                            ? (isZh ? "当前套餐" : "Current")
                            : isCurrent
                              ? isSelected
                                ? (isZh ? "✓ 续费此套餐" : "✓ Renew")
                                : (isZh ? "点击续费" : "Renew")
                              : isSelected
                                ? (isZh ? "✓ 已选择" : "✓ Selected")
                                : (isZh ? "点击选择" : "Select")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 支付区域 */}
          <div className={cn(
            "transition-all duration-300",
            selectedPlan && !selectedPlan.disabled && selectedPlan.id !== "free" ? "opacity-100" : "opacity-50 pointer-events-none"
          )}>
            <div className="p-3 md:p-4 bg-white/80 dark:bg-white/5 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-white/10 shadow-lg">
              <div className="flex items-center justify-between gap-2">
                {/* 支付方式选择 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] md:text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center">
                    <CreditCard className="w-3 h-3 mr-1" />
                    {isZh ? "支付:" : "Pay:"}
                  </span>
                  <div className="flex gap-1.5">
                    {isDomestic ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setSelectedPayment("alipay")}
                          className={cn(
                            "px-2 py-1 rounded-md text-[10px] font-semibold transition-all duration-300",
                            selectedPayment === "alipay"
                              ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow"
                              : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                          )}
                        >
                          💳 支付宝
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedPayment("wechat")}
                          className={cn(
                            "px-2 py-1 rounded-md text-[10px] font-semibold transition-all duration-300",
                            selectedPayment === "wechat"
                              ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow"
                              : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                          )}
                        >
                          💬 微信
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setSelectedPayment("stripe")}
                          className={cn(
                            "px-2 py-1 rounded-md text-[10px] font-semibold transition-all duration-300",
                            selectedPayment === "stripe"
                              ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow"
                              : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                          )}
                        >
                          💳 Stripe
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedPayment("paypal")}
                          className={cn(
                            "px-2 py-1 rounded-md text-[10px] font-semibold transition-all duration-300",
                            selectedPayment === "paypal"
                              ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow"
                              : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                          )}
                        >
                          🅿️ PayPal
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* 订阅按钮 */}
                <Button
                  disabled={isProcessing || !selectedPlan || selectedPlan.disabled || selectedPlan.id === "free"}
                  onClick={handleSubscribe}
                  className="h-8 md:h-9 px-4 md:px-6 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 hover:from-blue-600 hover:via-indigo-600 hover:to-purple-700 text-white font-bold text-xs md:text-sm rounded-lg shadow-lg shadow-indigo-500/30 transition-all duration-300 hover:shadow-xl hover:scale-[1.02]"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin mr-1.5" />
                      {isZh ? "处理中..." : "Processing..."}
                    </>
                  ) : (
                    <>
                      <Rocket className="w-3 h-3 md:w-4 md:h-4 mr-1.5" />
                      {pricingInfo.payable !== null
                        ? `${pricingInfo.isSameActive ? (isZh ? "续费" : "Renew") : (isZh ? "订阅" : "Subscribe")} ${pricingInfo.symbol}${pricingInfo.payable.toFixed(2)}`
                        : (isZh ? "确认订阅" : "Subscribe")}
                    </>
                  )}
                </Button>
              </div>

              {/* 升级折算提示 */}
              {pricingInfo.isUpgrade && (
                <div className={cn(
                  "mt-2 md:mt-3 p-2 rounded-lg border text-center text-[10px] md:text-xs",
                  pricingInfo.freeUpgrade
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/50"
                    : "bg-blue-50 dark:bg-blue-950/30 border-blue-200/50"
                )}>
                  {pricingInfo.freeUpgrade ? (
                    <span className="text-emerald-700 dark:text-emerald-300">
                      🎁 {isZh ? `免费升级！剩余 ${pricingInfo.remainingDays} 天折算为 ${pricingInfo.convertedDays} 天新套餐` : `Free upgrade! Your remaining ${pricingInfo.remainingDays} days converted to ${pricingInfo.convertedDays} days on new plan`}
                    </span>
                  ) : (
                    <span className="text-blue-700 dark:text-blue-300">
                      📊 {isZh ? `剩余 ${pricingInfo.remainingDays} 天已抵扣，仅需支付 ${pricingInfo.symbol}${pricingInfo.payable?.toFixed(2)}` : `Your remaining ${pricingInfo.remainingDays} days deducted. Pay only ${pricingInfo.symbol}${pricingInfo.payable?.toFixed(2)}`}
                    </span>
                  )}
                </div>
              )}

              {/* 同级续费提示 */}
              {pricingInfo.isSameActive && (
                <div className="mt-2 md:mt-3 p-2 rounded-lg border bg-amber-50 dark:bg-amber-950/30 border-amber-200/50 text-center text-[10px] md:text-xs">
                  <span className="text-amber-700 dark:text-amber-300">
                    🔄 {isZh ? "续费将在当前套餐到期后自动顺延" : "Renewal will extend from your current expiration date"}
                  </span>
                </div>
              )}

              {/* 降级提示 */}
              {pricingInfo.isDowngrade && (
                <div className="mt-2 md:mt-3 p-2 rounded-lg border bg-orange-50 dark:bg-orange-950/30 border-orange-200/50 text-center text-[10px] md:text-xs">
                  <span className="text-orange-700 dark:text-orange-300">
                    ⏳ {isZh ? "降级将在当前套餐到期后生效" : "Downgrade will take effect after current plan expires"}
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
