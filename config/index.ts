// 读取和规范化环境变量
const envDefaultLang = (process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE || "zh").toLowerCase();
export const DEFAULT_LANGUAGE: string = envDefaultLang === "en" ? "en" : "zh";

// 版本标识
export const IS_DOMESTIC_VERSION = DEFAULT_LANGUAGE === "zh";

// 应用配置
export const APP_CONFIG = {
  name: "OneBuild",
  description: IS_DOMESTIC_VERSION
    ? "一键构建多平台应用"
    : "Build multi-platform apps with one click",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
};

// 后端配置（预留）
export const BACKEND_CONFIG = {
  domestic: {
    // Cloudbase 配置（后续实现）
    provider: "cloudbase",
    apiBaseUrl: "/api/domestic",
  },
  international: {
    // Supabase 配置（后续实现）
    provider: "supabase",
    apiBaseUrl: "/api/international",
  },
};

// 获取当前后端配置
export const getCurrentBackendConfig = () => {
  return IS_DOMESTIC_VERSION ? BACKEND_CONFIG.domestic : BACKEND_CONFIG.international;
};
