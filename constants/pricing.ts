/**
 * 套餐价格配置
 * 国际版使用 USD，国内版使用 CNY
 */

export interface PricingPlan {
  id: string;
  name: string;
  nameZh: string;
  price: string;        // 月付价格（国际版 USD）
  priceZh: string;      // 月付价格（国内版 CNY）
  annualPrice: string;  // 年付月均价格（国际版 USD）
  annualPriceZh: string; // 年付月均价格（国内版 CNY）
  features: string[];
  featuresZh: string[];
  popular: boolean;
}

export const pricingPlans: PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    nameZh: "基础版",
    price: "$0",
    priceZh: "¥0",
    annualPrice: "$0",
    annualPriceZh: "¥0",
    features: [
      "5 builds/day",
      "3-day file retention",
      "Single platform build",
    ],
    featuresZh: [
      "5次构建/天",
      "3天文件保留",
      "单平台构建",
    ],
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    nameZh: "专业版",
    price: "$9.99",
    priceZh: "¥29.90",
    annualPrice: "$6.99",
    annualPriceZh: "¥20.90",
    features: [
      "50 builds/day",
      "14-day file retention",
      "Batch build",
      "Link sharing (7 days)",
    ],
    featuresZh: [
      "50次构建/天",
      "14天文件保留",
      "批量构建",
      "链接分享（7天）",
    ],
    popular: true,
  },
  {
    id: "team",
    name: "Team",
    nameZh: "团队版",
    price: "$29.99",
    priceZh: "¥99.90",
    annualPrice: "$20.99",
    annualPriceZh: "¥69.90",
    features: [
      "500 builds/day",
      "90-day file retention",
      "Batch build",
      "Custom sharing (30 days)",
    ],
    featuresZh: [
      "500次构建/天",
      "90天文件保留",
      "批量构建",
      "自定义分享（30天）",
    ],
    popular: false,
  },
];

/**
 * 根据套餐 ID 获取套餐配置
 */
export function getPlanById(planId: string): PricingPlan | undefined {
  return pricingPlans.find(p => p.id.toLowerCase() === planId.toLowerCase());
}

/**
 * 根据套餐名称获取套餐配置（支持中英文）
 */
export function getPlanByName(name: string): PricingPlan | undefined {
  const lower = name.toLowerCase();
  return pricingPlans.find(
    p => p.name.toLowerCase() === lower || p.nameZh === name
  );
}
