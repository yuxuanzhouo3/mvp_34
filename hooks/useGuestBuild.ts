"use client";

import { useState, useEffect, useCallback } from "react";

const GUEST_BUILD_KEY = "mornclient_guest_build";

// 从环境变量获取游客每日构建限制
const GUEST_DAILY_LIMIT = (() => {
  const raw = process.env.NEXT_PUBLIC_GUEST_DAILY_LIMIT || "1";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(10, n); // 最大限制10次
})();

// 游客是否支持批量构建
const GUEST_SUPPORT_BATCH_BUILD = process.env.NEXT_PUBLIC_GUEST_SUPPORT_BATCH_BUILD === "true";

interface GuestBuildState {
  usedCount: number;
  lastResetDate: string;
}

export interface UseGuestBuildReturn {
  /** 是否有剩余构建次数 */
  hasRemaining: boolean;
  /** 剩余构建次数 */
  remaining: number;
  /** 每日限制 */
  limit: number;
  /** 已使用次数 */
  used: number;
  /** 是否支持批量构建 */
  supportBatchBuild: boolean;
  /** 消费一次构建次数 */
  consumeBuild: () => boolean;
  /** 重置构建次数（仅用于测试） */
  resetBuild: () => void;
  /** 检查是否可以构建指定数量 */
  canBuild: (count: number) => boolean;
}

/**
 * 游客构建次数管理 Hook
 * 基于 localStorage 存储，每日自动重置
 */
export function useGuestBuild(): UseGuestBuildReturn {
  const [state, setState] = useState<GuestBuildState>({
    usedCount: 0,
    lastResetDate: new Date().toDateString(),
  });

  // 从 localStorage 加载状态
  useEffect(() => {
    try {
      const stored = localStorage.getItem(GUEST_BUILD_KEY);
      if (stored) {
        const parsed: GuestBuildState = JSON.parse(stored);
        const today = new Date().toDateString();

        // 如果是新的一天，重置次数
        if (parsed.lastResetDate !== today) {
          const newState = { usedCount: 0, lastResetDate: today };
          setState(newState);
          localStorage.setItem(GUEST_BUILD_KEY, JSON.stringify(newState));
        } else {
          setState(parsed);
        }
      }
    } catch (e) {
      console.error("[useGuestBuild] Failed to load state:", e);
    }
  }, []);

  // 消费一次构建次数
  const consumeBuild = useCallback((): boolean => {
    const today = new Date().toDateString();

    // 检查是否需要重置
    let currentUsed = state.usedCount;
    if (state.lastResetDate !== today) {
      currentUsed = 0;
    }

    // 检查是否还有剩余次数
    if (currentUsed >= GUEST_DAILY_LIMIT) {
      return false;
    }

    // 更新状态
    const newState: GuestBuildState = {
      usedCount: currentUsed + 1,
      lastResetDate: today,
    };
    setState(newState);
    localStorage.setItem(GUEST_BUILD_KEY, JSON.stringify(newState));
    return true;
  }, [state]);

  // 重置构建次数
  const resetBuild = useCallback(() => {
    const newState: GuestBuildState = {
      usedCount: 0,
      lastResetDate: new Date().toDateString(),
    };
    setState(newState);
    localStorage.setItem(GUEST_BUILD_KEY, JSON.stringify(newState));
  }, []);

  // 检查是否可以构建指定数量
  const canBuild = useCallback((count: number): boolean => {
    const today = new Date().toDateString();
    let currentUsed = state.usedCount;
    if (state.lastResetDate !== today) {
      currentUsed = 0;
    }
    return (GUEST_DAILY_LIMIT - currentUsed) >= count;
  }, [state]);

  // 计算当前状态
  const today = new Date().toDateString();
  const currentUsed = state.lastResetDate === today ? state.usedCount : 0;
  const remaining = Math.max(0, GUEST_DAILY_LIMIT - currentUsed);

  return {
    hasRemaining: remaining > 0,
    remaining,
    limit: GUEST_DAILY_LIMIT,
    used: currentUsed,
    supportBatchBuild: GUEST_SUPPORT_BATCH_BUILD,
    consumeBuild,
    resetBuild,
    canBuild,
  };
}

/**
 * 获取游客构建配置（用于服务端）
 */
export function getGuestBuildConfig() {
  return {
    dailyLimit: GUEST_DAILY_LIMIT,
    supportBatchBuild: GUEST_SUPPORT_BATCH_BUILD,
  };
}
