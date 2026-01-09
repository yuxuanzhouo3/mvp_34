/**
 * 套餐价格配置
 */

export interface PlanPricing {
  id: string;
  name: string;
  monthlyPrice: number;  // USD
  yearlyPrice: number;   // USD (total for year)
}

export const PLAN_PRICING: Record<string, PlanPricing> = {
  Free: {
    id: "free",
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
  },
  Pro: {
    id: "pro",
    name: "Pro",
    monthlyPrice: 9.99,
    yearlyPrice: 83.88, // $6.99 * 12
  },
  Team: {
    id: "team",
    name: "Team",
    monthlyPrice: 29.99,
    yearlyPrice: 251.88, // $20.99 * 12
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
 */
export function extractPlanAmount(
  plan: PlanPricing,
  billingPeriod: "monthly" | "annual"
): number {
  if (billingPeriod === "annual") {
    return plan.yearlyPrice;
  }
  return plan.monthlyPrice;
}
