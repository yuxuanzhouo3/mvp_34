/**
 * API 路径工具函数
 * 根据当前版本（国际版/国内版）自动选择正确的 API 路径
 */

import { getCurrentBackendConfig } from "@/config";

/**
 * 获取 API 基础路径
 * 国际版: /api/international
 * 国内版: /api/domestic
 */
export function getApiBasePath(): string {
  return getCurrentBackendConfig().apiBaseUrl;
}

/**
 * 构建完整的 API 路径
 * @param endpoint - API 端点，例如 "builds" 或 "android/build"
 * @returns 完整的 API 路径
 */
export function buildApiPath(endpoint: string): string {
  const basePath = getApiBasePath();
  // 确保 endpoint 不以 / 开头
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  return `${basePath}/${cleanEndpoint}`;
}

/**
 * API 端点常量
 * 统一管理所有 API 端点，便于维护
 */
export const API_ENDPOINTS = {
  // 构建相关
  BUILDS: "builds",
  BUILD_BY_ID: (id: string) => `builds/${id}`,

  // 平台构建
  ANDROID_BUILD: "android/build",
  IOS_BUILD: "ios/build",
  WECHAT_BUILD: "wechat/build",
  HARMONYOS_BUILD: "harmonyos/build",
  WINDOWS_BUILD: "windows/build",
  CHROME_BUILD: "chrome/build",
} as const;

/**
 * 便捷的 API 路径获取函数
 */
export const api = {
  builds: {
    list: () => buildApiPath(API_ENDPOINTS.BUILDS),
    get: (id: string) => buildApiPath(API_ENDPOINTS.BUILD_BY_ID(id)),
    delete: (id: string) => buildApiPath(API_ENDPOINTS.BUILD_BY_ID(id)),
  },
  platform: {
    android: () => buildApiPath(API_ENDPOINTS.ANDROID_BUILD),
    ios: () => buildApiPath(API_ENDPOINTS.IOS_BUILD),
    wechat: () => buildApiPath(API_ENDPOINTS.WECHAT_BUILD),
    harmonyos: () => buildApiPath(API_ENDPOINTS.HARMONYOS_BUILD),
    windows: () => buildApiPath(API_ENDPOINTS.WINDOWS_BUILD),
    chrome: () => buildApiPath(API_ENDPOINTS.CHROME_BUILD),
  },
};
