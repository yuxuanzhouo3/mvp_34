import { useState, useEffect, useCallback } from "react";

export interface GuestBuildRecord {
  id: string;
  platform: string;
  appName: string;
  url: string;
  timestamp: number;
  status: "building" | "completed" | "failed";
  fileName?: string;
  downloadData?: string; // base64 encoded zip data
  error?: string;
}

const STORAGE_KEY = "guest_build_history";
const MAX_RECORDS = 10;

export function useGuestBuildHistory() {
  const [history, setHistory] = useState<GuestBuildRecord[]>([]);

  // 从 localStorage 加载历史记录
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as GuestBuildRecord[];
        setHistory(parsed);
      }
    } catch (error) {
      console.error("[useGuestBuildHistory] Failed to load history:", error);
    }
  }, []);

  // 保存历史记录到 localStorage
  const saveHistory = useCallback((records: GuestBuildRecord[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      setHistory(records);
    } catch (error) {
      console.error("[useGuestBuildHistory] Failed to save history:", error);
    }
  }, []);

  // 添加新的构建记录
  const addBuild = useCallback((build: Omit<GuestBuildRecord, "id" | "timestamp">) => {
    const newBuild: GuestBuildRecord = {
      ...build,
      id: `build_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    setHistory((prev) => {
      const updated = [newBuild, ...prev].slice(0, MAX_RECORDS);
      saveHistory(updated);
      return updated;
    });

    return newBuild.id;
  }, [saveHistory]);

  // 更新构建记录
  const updateBuild = useCallback((id: string, updates: Partial<GuestBuildRecord>) => {
    setHistory((prev) => {
      const updated = prev.map((build) =>
        build.id === id ? { ...build, ...updates } : build
      );
      saveHistory(updated);
      return updated;
    });
  }, [saveHistory]);

  // 删除构建记录
  const deleteBuild = useCallback((id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((build) => build.id !== id);
      saveHistory(updated);
      return updated;
    });
  }, [saveHistory]);

  // 清空所有历史记录
  const clearHistory = useCallback(() => {
    saveHistory([]);
  }, [saveHistory]);

  return {
    history,
    addBuild,
    updateBuild,
    deleteBuild,
    clearHistory,
  };
}
