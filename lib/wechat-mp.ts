/**
 * 微信小程序登录工具库
 * 用于在 H5 页面中与微信小程序进行交互
 */

// 微信小程序 SDK 类型定义
interface WxMiniProgram {
  postMessage?: (data: unknown) => void;
  navigateTo?: (options: { url: string }) => void;
  navigateBack?: (options?: { delta?: number }) => void;
  getEnv?: (callback: (res: { miniprogram: boolean }) => void) => void;
}

interface WxObject {
  miniProgram?: WxMiniProgram;
}

declare global {
  interface Window {
    wx?: WxObject;
    __wxjs_environment?: string;
  }
}

/**
 * 检测是否在微信小程序环境中
 */
export function isMiniProgram(): boolean {
  if (typeof window === "undefined") return false;

  // 检查 userAgent
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("miniprogram")) return true;

  // 检查全局变量
  if (window.__wxjs_environment === "miniprogram") return true;

  // 检查 URL 参数
  const params = new URLSearchParams(window.location.search);
  if (params.get("_wxjs_environment") === "miniprogram") return true;

  return false;
}

/**
 * 获取微信小程序 SDK 对象
 */
export function getWxMiniProgram(): WxMiniProgram | null {
  if (typeof window === "undefined") return null;
  const wxObj = window.wx;
  if (!wxObj || typeof wxObj !== "object") return null;
  const mp = wxObj.miniProgram;
  if (!mp || typeof mp !== "object") return null;
  return mp;
}

/**
 * 等待微信 JS SDK 加载完成
 */
export function waitForWxSDK(timeout = 3000): Promise<WxMiniProgram | null> {
  return new Promise((resolve) => {
    const mp = getWxMiniProgram();
    if (mp) {
      resolve(mp);
      return;
    }

    // 轮询检查
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      const mp = getWxMiniProgram();
      if (mp) {
        clearInterval(checkInterval);
        resolve(mp);
        return;
      }
      if (Date.now() - startTime >= timeout) {
        clearInterval(checkInterval);
        resolve(null);
      }
    }, 100);
  });
}

/**
 * 使用 SDK 检测小程序环境（更准确但异步）
 */
export async function detectMiniProgramEnvBySdk(): Promise<boolean> {
  const mp = await waitForWxSDK(1000);
  if (!mp || typeof mp.getEnv !== "function") {
    return false;
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 1000);
    try {
      mp.getEnv?.((res) => {
        clearTimeout(timeout);
        resolve(res?.miniprogram === true);
      });
    } catch {
      clearTimeout(timeout);
      resolve(false);
    }
  });
}

/**
 * 综合检测是否在微信小程序环境（同步 + 异步）
 */
export async function isMiniProgramEnv(): Promise<boolean> {
  // 快速同步检测
  if (isMiniProgram()) return true;

  // 异步 SDK 检测
  return await detectMiniProgramEnvBySdk();
}

/**
 * 请求微信小程序原生登录
 * 通过 navigateTo 跳转到小程序的登录页面
 */
export async function requestWxMpLogin(returnUrl?: string): Promise<boolean> {
  const mp = await waitForWxSDK();
  if (!mp) {
    console.warn("[wechat-mp] Not in WeChat MiniProgram environment or SDK not loaded");
    return false;
  }

  const currentUrl = returnUrl || window.location.href;

  // 优先使用 navigateTo 跳转到小程序原生登录页
  if (typeof mp.navigateTo === "function") {
    const loginUrl = `/pages/webshell/login?returnUrl=${encodeURIComponent(currentUrl)}`;
    console.log("[wechat-mp] navigateTo login page:", loginUrl);
    mp.navigateTo({ url: loginUrl });
    return true;
  }

  // 备用方案：使用 postMessage 发送登录请求
  if (typeof mp.postMessage === "function") {
    console.log("[wechat-mp] postMessage REQUEST_WX_LOGIN");
    mp.postMessage({
      data: {
        type: "REQUEST_WX_LOGIN",
        returnUrl: currentUrl,
      },
    });

    // 需要触发页面卸载才能发送 postMessage
    if (typeof mp.navigateBack === "function") {
      mp.navigateBack({ delta: 1 });
    }
    return true;
  }

  console.warn("[wechat-mp] No available method to request login");
  return false;
}

/**
 * 微信小程序登录回调数据
 */
export interface WxMpLoginCallback {
  token: string | null;
  openid: string | null;
  expiresIn: string | null;
  nickName: string | null;
  avatarUrl: string | null;
  code: string | null; // 兜底方案：使用 code 换取 token
}

/**
 * 解析 URL 参数中的登录回调数据
 */
export function parseWxMpLoginCallback(): WxMpLoginCallback | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);

  // 检查是否有登录相关参数
  const token = params.get("token");
  const openid = params.get("openid");
  const code = params.get("mpCode");

  // 如果没有任何登录参数，返回 null
  if (!token && !openid && !code) {
    return null;
  }

  return {
    token,
    openid,
    expiresIn: params.get("expiresIn"),
    nickName: params.get("mpNickName") ? decodeURIComponent(params.get("mpNickName")!) : null,
    avatarUrl: params.get("mpAvatarUrl") ? decodeURIComponent(params.get("mpAvatarUrl")!) : null,
    code,
  };
}

/**
 * 清除 URL 中的登录参数
 */
export function clearWxMpLoginParams(): void {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  const paramsToRemove = [
    "token",
    "openid",
    "expiresIn",
    "mpCode",
    "mpNickName",
    "mpAvatarUrl",
    "mpProfileTs",
    "mpReadyTs",
    "mpPongTs",
  ];

  paramsToRemove.forEach((key) => url.searchParams.delete(key));

  // 使用 replaceState 避免产生历史记录
  window.history.replaceState({}, "", url.toString());
}

/**
 * 使用 code 换取 token（兜底方案）
 */
export async function exchangeCodeForToken(
  code: string,
  nickName?: string | null,
  avatarUrl?: string | null
): Promise<{
  success: boolean;
  token?: string;
  openid?: string;
  expiresIn?: number;
  user?: {
    id: string;
    openid: string;
    nickName: string | null;
    avatarUrl: string | null;
  };
  error?: string;
}> {
  try {
    const response = await fetch("/api/domestic/wxlogin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // 确保 cookie 能被存储
      body: JSON.stringify({
        code,
        nickName: nickName || undefined,
        avatarUrl: avatarUrl || undefined,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.message || data.error || "登录失败",
      };
    }

    return {
      success: true,
      token: data.token,
      openid: data.openid || data.user?.openid,
      expiresIn: data.expiresIn,
      user: data.user,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "网络错误",
    };
  }
}
