"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { getPlanSupportBatchBuild } from "@/utils/plan-limits";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Hexagon,
  Chrome,
  Monitor,
  Archive,
  Terminal,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  Share2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Image from "next/image";
import { ShareModal } from "@/components/share/share-modal";
import { BuildProgressBarCompact } from "@/components/build/build-progress-bar";

type BuildStatus = "pending" | "processing" | "completed" | "failed";
type CategoryFilter = "all" | "mobile" | "miniprogram" | "desktop" | "browser" | "expired";

// Check if a build is expired
function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

// Category classification helper
function getBuildCategory(platform: string): "mobile" | "miniprogram" | "desktop" | "browser" {
  if (platform === "android-source" || platform === "android-apk" || platform === "ios" || platform === "harmonyos") return "mobile";
  if (platform === "wechat") return "miniprogram";
  if (platform === "chrome") return "browser";
  return "desktop"; // windows, macos, linux, etc.
}

// Build icon component - optimized with caching and lazy loading
function BuildIcon({ build, getPlatformIcon, priority = false }: {
  build: { platform: string; app_name: string; icon_url: string | null };
  getPlatformIcon: (platform: string) => React.ReactNode;
  priority?: boolean;
}) {
  // Debug logging
  console.log(`[BuildIcon] Rendering icon for build:`, {
    app_name: build.app_name,
    platform: build.platform,
    has_icon_url: !!build.icon_url,
    icon_url: build.icon_url
  });

  // If has uploaded icon, use it with optimization
  if (build.icon_url) {
    return (
      <Image
        src={build.icon_url}
        alt={build.app_name}
        fill
        className="object-cover"
        loading={priority ? "eager" : "lazy"}
        sizes="48px"
      />
    );
  }

  // Use platform icon with gradient background - using official brand colors
  const getBgClass = () => {
    switch (build.platform) {
      case "android":
        return "bg-gradient-to-br from-[#3DDC84]/10 to-[#3DDC84]/20 dark:from-[#3DDC84]/15 dark:to-[#3DDC84]/25 text-[#3DDC84]";
      case "ios":
      case "macos":
        return "bg-gradient-to-br from-gray-500/10 to-gray-600/10 dark:from-gray-500/20 dark:to-gray-600/20 text-gray-600 dark:text-gray-400";
      case "wechat":
        return "bg-gradient-to-br from-[#07C160]/10 to-[#07C160]/20 dark:from-[#07C160]/15 dark:to-[#07C160]/25 text-[#07C160]";
      case "harmonyos":
        return "bg-gradient-to-br from-[#E52828]/10 to-[#E52828]/20 dark:from-[#E52828]/15 dark:to-[#E52828]/25 text-[#E52828] dark:text-[#FF4D4D]";
      case "chrome":
        return "bg-gradient-to-br from-[#4285F4]/10 to-[#4285F4]/20 dark:from-[#4285F4]/15 dark:to-[#4285F4]/25 text-[#4285F4]";
      case "windows":
        return "bg-gradient-to-br from-[#0078D4]/10 to-[#0078D4]/20 dark:from-[#0078D4]/15 dark:to-[#0078D4]/25 text-[#0078D4]";
      case "linux":
        return "bg-gradient-to-br from-orange-500/10 to-orange-600/10 dark:from-orange-500/20 dark:to-orange-600/20 text-orange-600 dark:text-orange-400";
      default:
        return "bg-gradient-to-br from-purple-500/10 to-purple-600/10 dark:from-purple-500/20 dark:to-purple-600/20 text-purple-600 dark:text-purple-400";
    }
  };
  const bgClass = getBgClass();

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
  file_size: number | null;
  downloadUrl?: string;
}

// 每页显示数量
const PAGE_SIZE = 5;

// 格式化文件大小
function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
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
  browser: number;
  expired: number;
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
    browser: 0,
    expired: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBuilds, setSelectedBuilds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [batchBuildEnabled, setBatchBuildEnabled] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareBuild, setShareBuild] = useState<{ id: string; name: string; expiresAt: string } | null>(null);

  // 获取用户钱包数据判断是否支持批量构建（根据套餐动态判断）
  useEffect(() => {
    if (!user) return;
    const fetchWallet = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("user_wallets")
        .select("plan")
        .eq("user_id", user.id)
        .single();
      const plan = data?.plan || "Free";
      setBatchBuildEnabled(getPlanSupportBatchBuild(plan));
    };
    fetchWallet();
  }, [user]);

  const fetchBuilds = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch(api.builds.list());
      if (!response.ok) {
        throw new Error("Failed to fetch builds");
      }

      const data = await response.json();
      const buildsList = data.builds || [];
      setBuilds(buildsList);
      setStats(data.stats || { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 });

      // Calculate category stats from builds (excluding expired from category counts)
      const catStats: CategoryStats = { mobile: 0, miniprogram: 0, desktop: 0, browser: 0, expired: 0 };
      buildsList.forEach((b: BuildItem) => {
        if (b.expires_at && isExpired(b.expires_at)) {
          catStats.expired++;
        } else {
          const cat = getBuildCategory(b.platform);
          catStats[cat]++;
        }
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

  // Polling for processing builds（优化轮询策略 - 只轮询构建中的记录）
  useEffect(() => {
    const hasProcessingBuilds = builds.some(
      (b) => b.status === "pending" || b.status === "processing"
    );

    if (hasProcessingBuilds) {
      const pollProcessingBuilds = async () => {
        try {
          const response = await fetch("/api/domestic/builds/polling");
          if (response.ok) {
            const { builds: processingBuilds } = await response.json();

            // 检查是否有构建从 processing 列表中消失（说明已完成）
            const prevProcessingIds = builds
              .filter((b) => b.status === "pending" || b.status === "processing")
              .map((b) => b.id);
            const currentProcessingIds = processingBuilds.map((pb: any) => pb.id);
            const hasDisappeared = prevProcessingIds.some(
              (id) => !currentProcessingIds.includes(id)
            );

            // 如果有构建消失或完成，立即刷新完整列表
            if (hasDisappeared || processingBuilds.some((pb: any) => pb.status === "completed" || pb.status === "failed")) {
              // 立即刷新,不等待
              fetchBuilds();
              // 1秒后再次刷新,确保获取到最新状态
              setTimeout(() => fetchBuilds(), 1000);
            } else {
              // 否则只更新状态
              setBuilds((prevBuilds) =>
                prevBuilds.map((build) => {
                  const updated = processingBuilds.find((pb: any) => pb.id === build.id);
                  return updated ? { ...build, ...updated } : build;
                })
              );
            }
          }
        } catch (error) {
          console.error("Polling error:", error);
        }
      };

      // 使用更快的轮询间隔（3秒）
      const interval = setInterval(pollProcessingBuilds, 3000);
      return () => clearInterval(interval);
    }
  }, [builds, fetchBuilds]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBuilds();
  };

  const handleDownload = async (buildId: string) => {
    try {
      const response = await fetch(api.builds.get(buildId));
      if (!response.ok) {
        throw new Error("Failed to get download URL");
      }

      const data = await response.json();

      // Check if build is expired
      if (data.build?.expired) {
        toast.error(
          currentLanguage === "zh"
            ? "此构建已过期，文件已被清理"
            : "This build has expired and files have been cleaned up"
        );
        fetchBuilds(); // Refresh to update UI
        return;
      }

      if (data.build?.downloadUrl) {
        // 更严格的微信小程序环境检测
        const isMiniProgram = typeof window !== "undefined" &&
          (window as any).wx?.miniProgram &&
          (window as any).__wxjs_environment === 'miniprogram';

        // 在小程序环境中，拦截外部下载链接
        if (isMiniProgram) {
          const mp = (window as any).wx.miniProgram;
          if (typeof mp.navigateTo === "function") {
            const linkCopyPageUrl = "/pages/qrcode/qrcode?url=" + encodeURIComponent(data.build.downloadUrl);
            mp.navigateTo({ url: linkCopyPageUrl });
            return;
          }
        }

        // 非小程序环境，正常打开下载链接
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

  const handleSyncGitHub = async (buildId: string) => {
    try {
      toast.loading(
        currentLanguage === "zh" ? "正在同步GitHub构建状态..." : "Syncing GitHub build status..."
      );

      const response = await fetch(`/api/domestic/builds/${buildId}/sync-github-status`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to sync GitHub status");
      }

      const data = await response.json();

      if (data.success) {
        toast.success(
          currentLanguage === "zh" ? "同步成功！" : "Sync successful!"
        );
        fetchBuilds();
      } else {
        throw new Error(data.error || "Sync failed");
      }
    } catch (error) {
      console.error("Sync error:", error);
      toast.error(
        currentLanguage === "zh" ? "同步失败" : "Sync failed"
      );
    }
  };

  const handleDelete = async (buildId: string) => {
    if (!confirm(currentLanguage === "zh" ? "确定要删除这个构建吗？" : "Are you sure you want to delete this build?")) {
      return;
    }

    try {
      const response = await fetch(api.builds.delete(buildId), {
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

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedBuilds.size === 0) return;

    if (!confirm(
      currentLanguage === "zh"
        ? `确定要删除选中的 ${selectedBuilds.size} 个构建吗？`
        : `Are you sure you want to delete ${selectedBuilds.size} selected builds?`
    )) {
      return;
    }

    setIsDeleting(true);
    try {
      const deletePromises = Array.from(selectedBuilds).map(id =>
        fetch(api.builds.delete(id), { method: "DELETE" })
      );
      await Promise.all(deletePromises);

      toast.success(
        currentLanguage === "zh"
          ? `成功删除 ${selectedBuilds.size} 个构建`
          : `Successfully deleted ${selectedBuilds.size} builds`
      );
      setSelectedBuilds(new Set());
      fetchBuilds();
    } catch (error) {
      console.error("Batch delete error:", error);
      toast.error(
        currentLanguage === "zh" ? "批量删除失败" : "Batch delete failed"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // 切换选中状态
  const toggleSelect = (buildId: string) => {
    const newSelected = new Set(selectedBuilds);
    if (newSelected.has(buildId)) {
      newSelected.delete(buildId);
    } else {
      newSelected.add(buildId);
    }
    setSelectedBuilds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedBuilds.size === filteredBuilds.length && filteredBuilds.length > 0) {
      setSelectedBuilds(new Set());
    } else {
      setSelectedBuilds(new Set(filteredBuilds.map(b => b.id)));
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
      case "harmonyos":
        return <Hexagon className="h-5 w-5" />;
      case "chrome":
        return <Chrome className="h-5 w-5" />;
      case "windows":
        return <Monitor className="h-5 w-5" />;
      case "macos":
        return <Apple className="h-5 w-5" />;
      case "linux":
        return <Terminal className="h-5 w-5" />;
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
      case "harmonyos":
        return "HarmonyOS";
      case "chrome":
        return "Chrome";
      case "windows":
        return "Windows";
      case "macos":
        return "MacOS";
      case "linux":
        return "Linux";
      default:
        return platform;
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case "android":
        // Android 官方绿色
        return "text-[#3DDC84] dark:text-[#3DDC84] bg-[#3DDC84]/10 dark:bg-[#3DDC84]/15 border-[#3DDC84]/30 dark:border-[#3DDC84]/30";
      case "ios":
        return "text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-500/10 border-gray-200 dark:border-gray-500/20";
      case "wechat":
        // 微信官方绿色 #07C160
        return "text-[#07C160] dark:text-[#07C160] bg-[#07C160]/10 dark:bg-[#07C160]/15 border-[#07C160]/30 dark:border-[#07C160]/30";
      case "harmonyos":
        // 鸿蒙官方红色 #E52828
        return "text-[#E52828] dark:text-[#FF4D4D] bg-[#E52828]/10 dark:bg-[#E52828]/15 border-[#E52828]/30 dark:border-[#E52828]/30";
      case "chrome":
        // Chrome 多彩渐变效果用蓝色代表
        return "text-[#4285F4] dark:text-[#4285F4] bg-[#4285F4]/10 dark:bg-[#4285F4]/15 border-[#4285F4]/30 dark:border-[#4285F4]/30";
      case "windows":
        // Windows 官方蓝色 #0078D4
        return "text-[#0078D4] dark:text-[#0078D4] bg-[#0078D4]/10 dark:bg-[#0078D4]/15 border-[#0078D4]/30 dark:border-[#0078D4]/30";
      case "macos":
        // macOS 使用 Apple 灰色
        return "text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-500/10 border-gray-200 dark:border-gray-500/20";
      case "linux":
        // Linux 使用橙色
        return "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20";
      default:
        return "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
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

    // Check if build is expired
    const buildExpired = build.expires_at && isExpired(build.expires_at);

    // Category filter - expired items only show in "expired" tab
    if (categoryFilter === "expired") {
      return matchesSearch && buildExpired;
    }

    // For other tabs, exclude expired items
    if (buildExpired) {
      return false;
    }

    const matchesCategory = categoryFilter === "all" || getBuildCategory(build.platform) === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // 分页计算
  const totalPages = Math.ceil(filteredBuilds.length / PAGE_SIZE);
  const paginatedBuilds = filteredBuilds.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // 当筛选条件变化时重置页码和选中状态
  useEffect(() => {
    setCurrentPage(1);
    setSelectedBuilds(new Set());
  }, [searchQuery, categoryFilter]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen pt-16 sm:pt-20 pb-8 sm:pb-12 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen pt-16 sm:pt-20 pb-8 sm:pb-12">
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
    <div className="min-h-screen pt-16 sm:pt-20 pb-8 sm:pb-12">
      <div className="container mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Layers className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
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
        <div className="flex flex-nowrap sm:flex-wrap gap-2 mb-6 overflow-x-auto pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
          <Button
            variant={categoryFilter === "all" ? "default" : "outline"}
            size="sm"
            className={`h-9 px-4 rounded-xl gap-2 ${categoryFilter === "all" ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white" : ""}`}
            onClick={() => setCategoryFilter("all")}
          >
            <Layers className="h-4 w-4" />
            {currentLanguage === "zh" ? "全部" : "All"}
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-white/20">{stats.total - categoryStats.expired}</span>
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
          <Button
            variant={categoryFilter === "browser" ? "default" : "outline"}
            size="sm"
            className={`h-9 px-4 rounded-xl gap-2 ${categoryFilter === "browser" ? "bg-gradient-to-r from-blue-500 to-green-500 text-white" : ""}`}
            onClick={() => setCategoryFilter("browser")}
          >
            <Chrome className="h-4 w-4" />
            {currentLanguage === "zh" ? "浏览器扩展" : "Browser Extensions"}
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-white/20">{categoryStats.browser}</span>
          </Button>
          {categoryStats.expired > 0 && (
            <Button
              variant={categoryFilter === "expired" ? "default" : "outline"}
              size="sm"
              className={`h-9 px-4 rounded-xl gap-2 ${categoryFilter === "expired" ? "bg-gradient-to-r from-gray-500 to-gray-600 text-white" : "text-muted-foreground"}`}
              onClick={() => setCategoryFilter("expired")}
            >
              <Archive className="h-4 w-4" />
              {currentLanguage === "zh" ? "已过期" : "Expired"}
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-white/20">{categoryStats.expired}</span>
            </Button>
          )}
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
            {/* 全选按钮 */}
            <div
              role="button"
              tabIndex={0}
              className={`inline-flex items-center h-11 px-4 rounded-xl gap-2 border text-sm font-medium transition-colors cursor-pointer ${
                filteredBuilds.length === 0
                  ? "opacity-50 cursor-not-allowed pointer-events-none"
                  : "hover:bg-accent hover:text-accent-foreground"
              } border-input bg-background`}
              onClick={toggleSelectAll}
              onKeyDown={(e) => e.key === "Enter" && toggleSelectAll()}
            >
              <Checkbox
                checked={selectedBuilds.size > 0 && selectedBuilds.size === filteredBuilds.length}
                className="h-4 w-4"
              />
              {currentLanguage === "zh" ? "全选" : "Select All"}
            </div>
            {/* 批量删除按钮 */}
            {selectedBuilds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="h-11 px-4 rounded-xl gap-2"
                onClick={handleBatchDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {currentLanguage === "zh" ? `删除 (${selectedBuilds.size})` : `Delete (${selectedBuilds.size})`}
              </Button>
            )}
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
            paginatedBuilds.map((build) => (
              <div
                key={build.id}
                className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-card border shadow-sm hover:shadow-md transition-all ${
                  selectedBuilds.has(build.id)
                    ? "border-cyan-500 bg-cyan-500/5"
                    : "border-border/50 hover:border-border"
                }`}
              >
                <div className="flex flex-col md:flex-row gap-3 sm:gap-4 items-start">
                  {/* Left: Checkbox + Icon & Main Info */}
                  <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                    {/* Checkbox */}
                    <Checkbox
                      checked={selectedBuilds.has(build.id)}
                      onCheckedChange={() => toggleSelect(build.id)}
                      className="mt-2 sm:mt-3 h-4 w-4 sm:h-5 sm:w-5 shrink-0"
                    />
                    {/* App Icon or Platform Icon */}
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl overflow-hidden shrink-0 relative">
                      <BuildIcon
                        build={build}
                        getPlatformIcon={getPlatformIcon}
                        priority={currentPage === 1 && paginatedBuilds.indexOf(build) < 3}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Title Row */}
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <h3 className="text-sm sm:text-base font-semibold truncate">{build.app_name}</h3>
                        {/* 只有当有版本号时才显示 */}
                        {build.version_name && build.version_name !== "1.0.0" && (
                          <span className="text-sm text-muted-foreground">
                            v{build.version_name}
                            {build.version_code && build.version_code !== "1" && ` · Build ${build.version_code}`}
                          </span>
                        )}
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
                        {/* 文件大小显示 */}
                        {build.file_size && build.status === "completed" && (
                          <Badge
                            variant="outline"
                            className="shrink-0 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/20"
                          >
                            <HardDrive className="h-3 w-3 mr-1" />
                            {formatFileSize(build.file_size)}
                          </Badge>
                        )}
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
                          <BuildProgressBarCompact
                            progress={build.progress || 0}
                            platform={build.platform}
                            status={build.status}
                            language={currentLanguage as "zh" | "en"}
                          />
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
                  <div className="flex flex-col gap-3 md:shrink-0 border-t md:border-t-0 md:border-l border-border/30 pt-3 md:pt-0 md:pl-4 min-w-0 items-start md:items-end">
                    {/* Buttons */}
                    <div className="flex items-center gap-2 flex-wrap justify-start md:justify-end">
                      {build.status === "completed" && build.expires_at && !isExpired(build.expires_at) && (
                        <>
                          <Button
                            size="sm"
                            className="h-8 sm:h-9 px-3 sm:px-4 rounded-lg sm:rounded-xl gap-1.5 sm:gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20"
                            onClick={() => handleDownload(build.id)}
                          >
                            <Download className="h-4 w-4" />
                            <span className="hidden sm:inline">{currentLanguage === "zh" ? "下载源码" : "Download Source"}</span>
                            <span className="sm:hidden">{currentLanguage === "zh" ? "下载" : "Download"}</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg sm:rounded-xl gap-1.5 sm:gap-2"
                            onClick={() => {
                              setShareBuild({
                                id: build.id,
                                name: build.app_name,
                                expiresAt: build.expires_at,
                              });
                              setShareModalOpen(true);
                            }}
                          >
                            <Share2 className="h-4 w-4" />
                            <span>{currentLanguage === "zh" ? "分享" : "Share"}</span>
                          </Button>
                        </>
                      )}
                      {build.status === "processing" && build.platform === "android-apk" && build.progress === 50 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg sm:rounded-xl gap-1.5 sm:gap-2 border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
                          onClick={() => handleSyncGitHub(build.id)}
                        >
                          <RefreshCw className="h-4 w-4" />
                          <span>{currentLanguage === "zh" ? "同步状态" : "Sync Status"}</span>
                        </Button>
                      )}
                      {build.expires_at && isExpired(build.expires_at) && (
                        <Badge variant="outline" className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                          <Archive className="h-3 w-3 mr-1" />
                          {currentLanguage === "zh" ? "文件已清理" : "Files cleaned"}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 sm:h-9 px-2.5 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        onClick={() => handleDelete(build.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {/* 时间信息 - 优化移动端显示 */}
                    <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground min-w-0 justify-center md:justify-end">
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      <span className="whitespace-nowrap">{formatDate(build.created_at).date}</span>
                      <span className="whitespace-nowrap">{formatDate(build.created_at).time}</span>
                      {build.expires_at && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium text-xs whitespace-nowrap ${
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

        {/* 分页控件 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 rounded-xl"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                // 显示逻辑：第一页、最后一页、当前页及其前后各1页
                const showPage = page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                const showEllipsis = page === 2 && currentPage > 3 || page === totalPages - 1 && currentPage < totalPages - 2;

                if (showEllipsis && !showPage) {
                  return <span key={page} className="px-2 text-muted-foreground">...</span>;
                }
                if (!showPage) return null;

                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    className={`h-9 w-9 rounded-xl ${currentPage === page ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white" : ""}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 rounded-xl"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="ml-2 text-sm text-muted-foreground">
              {currentLanguage === "zh"
                ? `共 ${filteredBuilds.length} 条`
                : `${filteredBuilds.length} total`}
            </span>
          </div>
        )}
      </div>

      {/* Share Modal */}
      {shareBuild && (
        <ShareModal
          open={shareModalOpen}
          onOpenChange={setShareModalOpen}
          buildId={shareBuild.id}
          buildName={shareBuild.name}
          buildExpiresAt={shareBuild.expiresAt}
        />
      )}
    </div>
  );
}
