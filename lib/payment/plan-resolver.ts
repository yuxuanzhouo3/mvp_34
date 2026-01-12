/**
 * 套餐价格配置
 */

export interface PlanPricing {
  id: string;
  name: string;
  nameZh: string;
  monthlyPrice: number;    // USD
  yearlyPrice: number;     // USD (total for year)
  monthlyPriceZh: number;  // CNY
  yearlyPriceZh: number;   // CNY (total for year)
}

export const PLAN_PRICING: Record<string, PlanPricing> = {
  Free: {
    id: "free",
    name: "Free",
    nameZh: "基础版",
    monthlyPrice: 0,
    yearlyPrice: 0,
    monthlyPriceZh: 0,
    yearlyPriceZh: 0,
  },
  Pro: {
    id: "pro",
    name: "Pro",
    nameZh: "专业版",
    monthlyPrice: 9.99,
    yearlyPrice: 83.88,      // $6.99 * 12
    monthlyPriceZh: 29.90,
    yearlyPriceZh: 250.80,   // ¥20.90 * 12
  },
  Team: {
    id: "team",
    name: "Team",
    nameZh: "团队版",
    monthlyPrice: 29.99,
    yearlyPrice: 251.88,     // $20.99 * 12
    monthlyPriceZh: 99.90,
    yearlyPriceZh: 838.80,   // ¥69.90 * 12
  },
};

/**
 * 解析套餐
 */
export function resolvePlan(planName?: string): PlanPricing {
  const normalized = (planName || "").toLowerCase();
  if (normalized === "pro" || normalized === "专业版") {
    return PLAN_PRICING.Pro;
  }
  if (normalized === "team" || normalized === "团队版") {
    return PLAN_PRICING.Team;
  }
  return PLAN_PRICING.Free;
}

/**
 * 提取套餐价格
 * @param plan 套餐配置
 * @param billingPeriod 计费周期
 * @param useDomesticPrice 是否使用国内价格（CNY）
 */
export function extractPlanAmount(
  plan: PlanPricing,
  billingPeriod: "monthly" | "annual",
  useDomesticPrice: boolean = false
): number {
  if (useDomesticPrice) {
    return billingPeriod === "annual" ? plan.yearlyPriceZh : plan.monthlyPriceZh;
  }
  return billingPeriod === "annual" ? plan.yearlyPrice : plan.monthlyPrice;
}

/**
 * 获取套餐的每日构建限额配置
 */
export function getPlanLimits(planName: string): {
  dailyLimit: number;
  buildExpireDays: number;
  shareExpireDays: number;
  batchBuildEnabled: boolean;
} {
  const lower = (planName || "").toLowerCase();

  switch (lower) {
    case "team":
    case "团队版":
      return {
        dailyLimit: 500,
        buildExpireDays: 90,
        shareExpireDays: 30,
        batchBuildEnabled: true,
      };
    case "pro":
    case "专业版":
      return {
        dailyLimit: 50,
        buildExpireDays: 14,
        shareExpireDays: 7,
        batchBuildEnabled: true,
      };
    default:
      return {
        dailyLimit: 5,
        buildExpireDays: 3,
        shareExpireDays: 0,
        batchBuildEnabled: false,
      };
  }
}
