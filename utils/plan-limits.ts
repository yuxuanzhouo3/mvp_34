/**
 * 套餐配额配置管理模块
 * 从环境变量动态读取配置，提供类型安全的 getter 函数
 */

// ============================================================================
// Free 套餐配置
// ============================================================================

export function getFreeDailyLimit(): number {
  const raw = process.env.NEXT_PUBLIC_FREE_DAILY_LIMIT || "5";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 5;
  return Math.min(100, n);
}

export function getFreeBuildExpireDays(): number {
  const raw = process.env.NEXT_PUBLIC_FREE_BUILD_EXPIRE_DAYS || "3";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 3;
  return Math.min(30, n);
}

export function getFreeSupportBatchBuild(): boolean {
  const raw = process.env.NEXT_PUBLIC_FREE_SUPPORT_BATCH_BUILD || "false";
  return raw.toLowerCase() === "true";
}

// ============================================================================
// Pro 套餐配置
// ============================================================================

export function getProDailyLimit(): number {
  const raw = process.env.NEXT_PUBLIC_PRO_DAILY_LIMIT || "50";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 50;
  return Math.min(1000, n);
}

export function getProBuildExpireDays(): number {
  const raw = process.env.NEXT_PUBLIC_PRO_BUILD_EXPIRE_DAYS || "14";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 14;
  return Math.min(90, n);
}

export function getProShareExpireDays(): number {
  const raw = process.env.NEXT_PUBLIC_PRO_SHARE_EXPIRE_DAYS || "7";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 7;
  return Math.min(30, n);
}

export function getProSupportBatchBuild(): boolean {
  const raw = process.env.NEXT_PUBLIC_PRO_SUPPORT_BATCH_BUILD || "true";
  return raw.toLowerCase() === "true";
}

// ============================================================================
// Team 套餐配置
// ============================================================================

export function getTeamDailyLimit(): number {
  const raw = process.env.NEXT_PUBLIC_TEAM_DAILY_LIMIT || "500";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 500;
  return Math.min(10000, n);
}

export function getTeamBuildExpireDays(): number {
  const raw = process.env.NEXT_PUBLIC_TEAM_BUILD_EXPIRE_DAYS || "90";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 90;
  return Math.min(365, n);
}

export function getTeamShareExpireDays(): number {
  const raw = process.env.NEXT_PUBLIC_TEAM_SHARE_EXPIRE_DAYS || "30";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 30;
  return Math.min(90, n);
}

export function getTeamSupportBatchBuild(): boolean {
  const raw = process.env.NEXT_PUBLIC_TEAM_SUPPORT_BATCH_BUILD || "true";
  return raw.toLowerCase() === "true";
}

// ============================================================================
// 通用辅助函数
// ============================================================================

export type PlanType = "Free" | "Pro" | "Team";

/**
 * 根据套餐获取每日构建限额
 */
export function getPlanDailyLimit(plan: string): number {
  const planLower = (plan || "").toLowerCase();
  switch (planLower) {
    case "pro":
      return getProDailyLimit();
    case "team":
      return getTeamDailyLimit();
    default:
      return getFreeDailyLimit();
  }
}

/**
 * 根据套餐获取文件保留天数
 */
export function getPlanBuildExpireDays(plan: string): number {
  const planLower = (plan || "").toLowerCase();
  switch (planLower) {
    case "pro":
      return getProBuildExpireDays();
    case "team":
      return getTeamBuildExpireDays();
    default:
      return getFreeBuildExpireDays();
  }
}

/**
 * 根据套餐获取分享链接有效天数
 */
export function getPlanShareExpireDays(plan: string): number {
  const planLower = (plan || "").toLowerCase();
  switch (planLower) {
    case "pro":
      return getProShareExpireDays();
    case "team":
      return getTeamShareExpireDays();
    default:
      return 0; // Free 不支持分享
  }
}

/**
 * 根据套餐判断是否支持批量构建
 */
export function getPlanSupportBatchBuild(plan: string): boolean {
  const planLower = (plan || "").toLowerCase();
  switch (planLower) {
    case "pro":
      return getProSupportBatchBuild();
    case "team":
      return getTeamSupportBatchBuild();
    default:
      return getFreeSupportBatchBuild();
  }
}

/**
 * 获取完整的套餐配置
 */
export function getPlanConfig(plan: string) {
  return {
    dailyLimit: getPlanDailyLimit(plan),
    buildExpireDays: getPlanBuildExpireDays(plan),
    shareExpireDays: getPlanShareExpireDays(plan),
    supportBatchBuild: getPlanSupportBatchBuild(plan),
  };
}

/**
 * 获取所有套餐配置（用于 UI 展示）
 */
export function getAllPlansConfig() {
  return {
    Free: {
      dailyLimit: getFreeDailyLimit(),
      buildExpireDays: getFreeBuildExpireDays(),
      shareExpireDays: 0,
      supportBatchBuild: getFreeSupportBatchBuild(),
    },
    Pro: {
      dailyLimit: getProDailyLimit(),
      buildExpireDays: getProBuildExpireDays(),
      shareExpireDays: getProShareExpireDays(),
      supportBatchBuild: getProSupportBatchBuild(),
    },
    Team: {
      dailyLimit: getTeamDailyLimit(),
      buildExpireDays: getTeamBuildExpireDays(),
      shareExpireDays: getTeamShareExpireDays(),
      supportBatchBuild: getTeamSupportBatchBuild(),
    },
  };
}
