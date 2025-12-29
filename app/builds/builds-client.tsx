"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Layers,
  Download,
  Trash2,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Smartphone,
  Apple,
  Package,
  RefreshCw,
  Search,
  MessageCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Image from "next/image";

type BuildStatus = "pending" | "processing" | "completed" | "failed";
type CategoryFilter = "all" | "mobile" | "miniprogram" | "desktop";

// Category classification helper
function getBuildCategory(platform: string): "mobile" | "miniprogram" | "desktop" {
  if (platform === "android" || platform === "ios") return "mobile";
  if (platform === "wechat") return "miniprogram";
  return "desktop"; // windows, macos, linux, etc.
}

// Build icon component - simple platform icon display
function BuildIcon({ build, getPlatformIcon }: {
  build: { platform: string; app_name: string; icon_url: string | null };
  getPlatformIcon: (platform: string) => React.ReactNode;
}) {
  // If has uploaded icon, use it
  if (build.icon_url) {
    return (
      <Image
        src={build.icon_url}
        alt={build.app_name}
        fill
        className="object-cover"
        unoptimized
      />
    );
  }

  // Use platform icon with gradient background
  const bgClass = build.platform === "android"
    ? "bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-500/20 dark:to-emerald-500/20 text-green-600 dark:text-green-400"
    : build.platform === "ios"
    ? "bg-gradient-to-br from-gray-500/10 to-gray-600/10 dark:from-gray-500/20 dark:to-gray-600/20 text-gray-600 dark:text-gray-400"
    : build.platform === "wechat"
    ? "bg-gradient-to-br from-emerald-500/10 to-green-500/10 dark:from-emerald-500/20 dark:to-green-500/20 text-emerald-600 dark:text-emerald-400"
    : "bg-gradient-to-br from-cyan-500/10 to-blue-500/10 dark:from-cyan-500/20 dark:to-blue-500/20 text-cyan-600 dark:text-cyan-400";

  return (
    <div className={`w-full h-full flex items-center justify-center ${bgClass}`}>
      {getPlatformIcon(build.platform)}
    </div>
  );
}

interface BuildItem {
  id: string;
  app_name: string;
  package_name: string;
  version_name: string;
  version_code: string;
  url: string;
  platform: string;
  status: BuildStatus;
  progress: number;
  output_file_path: string | null;
  error_message: string | null;
  created_at: string;
  expires_at: string;
  icon_path: string | null;
  icon_url: string | null;
  downloadUrl?: string;
}

interface BuildStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

interface CategoryStats {
  mobile: number;
  miniprogram: number;
  desktop: number;
}

export default function BuildsClient() {
  const { currentLanguage } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const [builds, setBuilds] = useState<BuildItem[]>([]);
  const [stats, setStats] = useState<BuildStats>({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  });
  const [categoryStats, setCategoryStats] = useState<CategoryStats>({
    mobile: 0,
    miniprogram: 0,
    desktop: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBuilds = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch("/api/international/builds");
      if (!response.ok) {
        throw new Error("Failed to fetch builds");
      }

      const data = await response.json();
      const buildsList = data.builds || [];
      setBuilds(buildsList);
      setStats(data.stats || { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 });

      // Calculate category stats from builds
      const catStats: CategoryStats = { mobile: 0, miniprogram: 0, desktop: 0 };
      buildsList.forEach((b: BuildItem) => {
        const cat = getBuildCategory(b.platform);
        catStats[cat]++;
      });
      setCategoryStats(catStats);
    } catch (error) {
      console.error("Fetch builds error:", error);
      toast.error(
        currentLanguage === "zh" ? "加载构建列表失败" : "Failed to load builds"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, currentLanguage]);

  // Initial fetch
  useEffect(() => {
    if (!authLoading && user) {
      fetchBuilds();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [authLoading, user, fetchBuilds]);

  // Polling for processing builds
  useEffect(() => {
    const hasProcessingBuilds = builds.some(
      (b) => b.status === "pending" || b.status === "processing"
    );

    if (hasProcessingBuilds) {
      const interval = setInterval(fetchBuilds, 1000);
      return () => clearInterval(interval);
    }
  }, [builds, fetchBuilds]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBuilds();
  };

  const handleDownload = async (buildId: string) => {
    try {
      const response = await fetch(`/api/international/builds/${buildId}`);
      if (!response.ok) {
        throw new Error("Failed to get download URL");
      }

      const data = await response.json();
      if (data.build?.downloadUrl) {
        window.open(data.build.downloadUrl, "_blank");
      } else {
        throw new Error("No download URL available");
      }
    } catch (error) {
      console.error("Download error:", error);
      toast.error(
        currentLanguage === "zh" ? "下载失败" : "Download failed"
      );
    }
  };

  const handleDelete = async (buildId: string) => {
    if (!confirm(currentLanguage === "zh" ? "确定要删除这个构建吗？" : "Are you sure you want to delete this build?")) {
      return;
    }

    try {
      const response = await fetch(`/api/international/builds/${buildId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete build");
      }

      toast.success(
        currentLanguage === "zh" ? "删除成功" : "Deleted successfully"
      );
      fetchBuilds();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(
        currentLanguage === "zh" ? "删除失败" : "Delete failed"
      );
    }
  };

  const getStatusIcon = (status: BuildStatus) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "processing":
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4" />;
      case "failed":
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusText = (status: BuildStatus) => {
    const texts = {
      pending: currentLanguage === "zh" ? "等待中" : "Pending",
      processing: currentLanguage === "zh" ? "构建中" : "Building",
      completed: currentLanguage === "zh" ? "已完成" : "Completed",
      failed: currentLanguage === "zh" ? "失败" : "Failed",
    };
    return texts[status];
  };

  const getStatusColor = (status: BuildStatus) => {
    switch (status) {
      case "pending":
        return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20";
      case "processing":
        return "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20";
      case "completed":
        return "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20";
      case "failed":
        return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20";
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "android":
        return <Smartphone className="h-5 w-5" />;
      case "ios":
        return <Apple className="h-5 w-5" />;
      case "wechat":
        return <MessageCircle className="h-5 w-5" />;
      default:
        return <Package className="h-5 w-5" />;
    }
  };

  const getPlatformName = (platform: string) => {
    switch (platform) {
      case "android":
        return "Android";
      case "ios":
        return "iOS";
      case "wechat":
        return "WeChat";
      default:
        return platform;
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case "android":
        return "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20";
      case "ios":
        return "text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-500/10 border-gray-200 dark:border-gray-500/20";
      case "wechat":
        return "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20";
      default:
        return "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(currentLanguage === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getExpiresInfo = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return {
        text: currentLanguage === "zh" ? "已过期" : "Expired",
        color: "text-red-500",
        urgent: true,
      };
    } else if (diffDays === 1) {
      return {
        text: currentLanguage === "zh" ? "1天后过期" : "Expires in 1 day",
        color: "text-red-500",
        urgent: true,
      };
    } else if (diffDays <= 3) {
      return {
        text: currentLanguage === "zh" ? `${diffDays}天后过期` : `Expires in ${diffDays} days`,
        color: "text-amber-500",
        urgent: true,
      };
    } else {
      return {
        text: currentLanguage === "zh" ? `${diffDays}天后过期` : `Expires in ${diffDays} days`,
        color: "text-muted-foreground",
        urgent: false,
      };
    }
  };

  const filteredBuilds = builds.filter((build) => {
    // Search filter
    const matchesSearch =
      build.app_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      build.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      build.package_name.toLowerCase().includes(searchQuery.toLowerCase());

    // Category filter
    const matchesCategory = categoryFilter === "all" || getBuildCategory(build.platform) === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen pt-20 pb-12 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen pt-20 pb-12">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center py-16 bg-card rounded-2xl border border-border/50">
            <Layers className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              {currentLanguage === "zh" ? "请登录以查看您的构建" : "Please login to view your builds"}
            </p>
            <Button
              onClick={() => window.location.href = "/auth/login?redirect=/builds"}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white"
            >
              {currentLanguage === "zh" ? "登录" : "Login"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-12">
      <div className="container mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Layers className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                {currentLanguage === "zh" ? "构建列表" : "Build List"}
              </h1>
              <p className="text-muted-foreground">
                {currentLanguage === "zh"
                  ? "管理您的应用构建任务"
                  : "Manage your app build tasks"}
              </p>
            </div>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            variant={categoryFilter === "all" ? "default" : "outline"}
            size="sm"
            className={`h-9 px-4 rounded-xl gap-2 ${categoryFilter === "all" ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white" : ""}`}
            onClick={() => setCategoryFilter("all")}
          >
            <Layers className="h-4 w-4" />
            {currentLanguage === "zh" ? "全部" : "All"}
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-white/20">{stats.total}</span>
          </Button>
          <Button
            variant={categoryFilter === "mobile" ? "default" : "outline"}
            size="sm"
            className={`h-9 px-4 rounded-xl gap-2 ${categoryFilter === "mobile" ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white" : ""}`}
            onClick={() => setCategoryFilter("mobile")}
          >
            <Smartphone className="h-4 w-4" />
            {currentLanguage === "zh" ? "移动应用" : "Mobile Apps"}
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-white/20">{categoryStats.mobile}</span>
          </Button>
          <Button
            variant={categoryFilter === "miniprogram" ? "default" : "outline"}
            size="sm"
            className={`h-9 px-4 rounded-xl gap-2 ${categoryFilter === "miniprogram" ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white" : ""}`}
            onClick={() => setCategoryFilter("miniprogram")}
          >
            <MessageCircle className="h-4 w-4" />
            {currentLanguage === "zh" ? "小程序" : "Mini Programs"}
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-white/20">{categoryStats.miniprogram}</span>
          </Button>
          <Button
            variant={categoryFilter === "desktop" ? "default" : "outline"}
            size="sm"
            className={`h-9 px-4 rounded-xl gap-2 ${categoryFilter === "desktop" ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white" : ""}`}
            onClick={() => setCategoryFilter("desktop")}
          >
            <Package className="h-4 w-4" />
            {currentLanguage === "zh" ? "桌面应用" : "Desktop Apps"}
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-white/20">{categoryStats.desktop}</span>
          </Button>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={currentLanguage === "zh" ? "搜索应用名称、URL或包名..." : "Search by name, URL, or package..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 rounded-xl border-border/50 bg-card"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-11 px-4 rounded-xl gap-2"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {currentLanguage === "zh" ? "刷新" : "Refresh"}
            </Button>
          </div>
        </div>

        {/* Build List */}
        <div className="space-y-4">
          {filteredBuilds.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-2xl border border-border/50">
              <Layers className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">
                {currentLanguage === "zh" ? "暂无构建任务" : "No build tasks"}
              </p>
            </div>
          ) : (
            filteredBuilds.map((build) => (
              <div
                key={build.id}
                className="p-4 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-md hover:border-border transition-all"
              >
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Left: Icon & Main Info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* App Icon or Platform Icon */}
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 relative">
                      <BuildIcon build={build} getPlatformIcon={getPlatformIcon} />
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Title Row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{build.app_name}</h3>
                        <span className="text-sm text-muted-foreground">
                          v{build.version_name || "1.0.0"}
                          {build.version_code && build.version_code !== "1" && ` · Build ${build.version_code}`}
                        </span>
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-xs ${getPlatformColor(build.platform)}`}
                        >
                          {getPlatformName(build.platform)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-xs ${getStatusColor(build.status)}`}
                        >
                          {getStatusIcon(build.status)}
                          <span className="ml-1">{getStatusText(build.status)}</span>
                        </Badge>
                      </div>

                      {/* Info Row */}
                      <div className="mt-1.5 flex flex-col gap-0.5 text-sm text-muted-foreground">
                        <span className="truncate">{build.package_name}</span>
                        <a
                          href={build.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-cyan-600 dark:text-cyan-400 hover:underline text-xs"
                        >
                          {build.url}
                        </a>
                      </div>

                      {/* Progress bar for processing status */}
                      {(build.status === "pending" || build.status === "processing") && (
                        <div className="mt-3">
                          <div className="h-1.5 w-full max-w-xs rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                              style={{ width: `${build.progress || 0}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {build.progress || 0}% {currentLanguage === "zh" ? "已完成" : "completed"}
                          </p>
                        </div>
                      )}

                      {/* Error message for failed builds */}
                      {build.status === "failed" && build.error_message && (
                        <div className="mt-2 p-2 rounded-lg bg-red-500/10 text-red-500 text-xs">
                          {build.error_message}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions & Time Info */}
                  <div className="flex flex-row md:flex-col items-start md:items-end justify-between md:justify-start gap-3 md:shrink-0 border-t md:border-t-0 md:border-l border-border/30 pt-3 md:pt-0 md:pl-4">
                    {/* Buttons */}
                    <div className="flex items-center gap-2">
                      {build.status === "completed" && (
                        <Button
                          size="sm"
                          className="h-9 px-4 rounded-xl gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20"
                          onClick={() => handleDownload(build.id)}
                        >
                          <Download className="h-4 w-4" />
                          {currentLanguage === "zh" ? "下载" : "Download"}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 px-2.5 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                        onClick={() => handleDelete(build.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {/* Time Info */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(build.created_at)}</span>
                      </div>
                      {build.expires_at && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          getExpiresInfo(build.expires_at).urgent
                            ? "bg-red-500/15 text-red-600 dark:text-red-400"
                            : getExpiresInfo(build.expires_at).color === "text-orange-500"
                            ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {getExpiresInfo(build.expires_at).text}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
