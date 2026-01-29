"use client";

import { useGuestBuildHistory, type GuestBuildRecord } from "@/hooks/useGuestBuildHistory";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Download, Trash2, Clock, CheckCircle, XCircle, History } from "lucide-react";
import { toast } from "sonner";

export function GuestBuildHistory() {
  const { history, deleteBuild, clearHistory } = useGuestBuildHistory();
  const { currentLanguage } = useLanguage();

  const handleDownload = (build: GuestBuildRecord) => {
    if (!build.downloadData || !build.fileName) {
      toast.error(
        currentLanguage === "zh"
          ? "下载数据不可用"
          : "Download data not available"
      );
      return;
    }

    try {
      const binaryData = Uint8Array.from(atob(build.downloadData), c => c.charCodeAt(0));
      const blob = new Blob([binaryData], { type: "application/zip" });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = build.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      toast.success(
        currentLanguage === "zh"
          ? "下载成功"
          : "Download successful"
      );
    } catch (error) {
      console.error("[GuestBuildHistory] Download error:", error);
      toast.error(
        currentLanguage === "zh"
          ? "下载失败"
          : "Download failed"
      );
    }
  };

  const handleDelete = (id: string) => {
    deleteBuild(id);
    toast.success(
      currentLanguage === "zh"
        ? "已删除构建记录"
        : "Build record deleted"
    );
  };

  const handleClearAll = () => {
    if (history.length === 0) return;

    clearHistory();
    toast.success(
      currentLanguage === "zh"
        ? "已清空所有构建记录"
        : "All build records cleared"
    );
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return currentLanguage === "zh" ? "刚刚" : "Just now";
    if (minutes < 60) return currentLanguage === "zh" ? `${minutes}分钟前` : `${minutes}m ago`;
    if (hours < 24) return currentLanguage === "zh" ? `${hours}小时前` : `${hours}h ago`;
    if (days < 7) return currentLanguage === "zh" ? `${days}天前` : `${days}d ago`;

    return date.toLocaleDateString(currentLanguage === "zh" ? "zh-CN" : "en-US");
  };

  const getStatusIcon = (status: GuestBuildRecord["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "building":
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
    }
  };

  const getStatusText = (status: GuestBuildRecord["status"]) => {
    switch (status) {
      case "completed":
        return currentLanguage === "zh" ? "已完成" : "Completed";
      case "failed":
        return currentLanguage === "zh" ? "失败" : "Failed";
      case "building":
        return currentLanguage === "zh" ? "构建中" : "Building";
    }
  };

  const getPlatformName = (platform: string) => {
    const names: Record<string, { zh: string; en: string }> = {
      android: { zh: "Android", en: "Android" },
      ios: { zh: "iOS", en: "iOS" },
      harmonyos: { zh: "HarmonyOS", en: "HarmonyOS" },
      chrome: { zh: "Chrome", en: "Chrome" },
      windows: { zh: "Windows", en: "Windows" },
      macos: { zh: "macOS", en: "macOS" },
      linux: { zh: "Linux", en: "Linux" },
    };
    return names[platform]?.[currentLanguage] || platform;
  };

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mb-4">
          <History className="h-8 w-8 text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold text-foreground/90 mb-2">
          {currentLanguage === "zh" ? "暂无构建记录" : "No Build History"}
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          {currentLanguage === "zh"
            ? "您的游客构建记录将显示在这里，最多保留最近10条记录"
            : "Your guest build history will appear here, keeping up to 10 recent records"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">
            {currentLanguage === "zh" ? "构建历史" : "Build History"}
          </h3>
          <span className="text-sm text-muted-foreground">
            ({history.length}/10)
          </span>
        </div>
        {history.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {currentLanguage === "zh" ? "清空" : "Clear All"}
          </Button>
        )}
      </div>

      {/* Build List */}
      <div className="space-y-3">
        {history.map((build) => (
          <div
            key={build.id}
            className="bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 p-4 hover:border-border transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  {getStatusIcon(build.status)}
                  <span className="font-medium text-sm">
                    {build.appName}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium">
                    {getPlatformName(build.platform)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate mb-1">
                  {build.url}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{formatTime(build.timestamp)}</span>
                  <span>•</span>
                  <span>{getStatusText(build.status)}</span>
                </div>
                {build.error && (
                  <p className="text-xs text-red-500 mt-2">
                    {build.error}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {build.status === "completed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(build)}
                    className="shrink-0"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    {currentLanguage === "zh" ? "下载源码" : "Download Source"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(build.id)}
                  className="shrink-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
