/**
 * 套餐等级和工具函数
 */

export const PLAN_RANK: Record<string, number> = {
  Free: 0,
  Pro: 1,
  Team: 2,
};

/**
 * 标准化套餐名称
 */
export function normalizePlanName(p?: string): string {
  const lower = (p || "").toLowerCase();
  if (lower === "pro" || lower === "专业版") return "Pro";
  if (lower === "team" || lower === "团队版") return "Team";
  return "Free";
}

/**
 * 获取套餐等级
 */
export function getPlanRank(plan: string): number {
  return PLAN_RANK[normalizePlanName(plan)] || 0;
}

/**
 * 判断是否为升级
 */
export function isUpgrade(currentPlan: string, targetPlan: string): boolean {
  return getPlanRank(targetPlan) > getPlanRank(currentPlan);
}

/**
 * 判断是否为降级
 */
export function isDowngrade(currentPlan: string, targetPlan: string): boolean {
  return getPlanRank(targetPlan) < getPlanRank(currentPlan);
}
