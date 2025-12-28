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
  Monitor,
  Package,
  RefreshCw,
  Search,
  Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type BuildStatus = "pending" | "processing" | "completed" | "failed";

interface BuildItem {
  id: string;
  app_name: string;
  package_name: string;
  version_code: string;
  url: string;
  platform: string;
  status: BuildStatus;
  progress: number;
  output_file_path: string | null;
  error_message: string | null;
  created_at: string;
  downloadUrl?: string;
}

interface BuildStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
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
  const [searchQuery, setSearchQuery] = useState("");
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
      setBuilds(data.builds || []);
      setStats(data.stats || { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 });
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
      const interval = setInterval(fetchBuilds, 1000); // 每秒轮询一次，增强进度条体验
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
      case "linux":
        return <Monitor className="h-5 w-5" />;
      default:
        return <Package className="h-5 w-5" />;
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

  const filteredBuilds = builds.filter(
    (build) =>
      build.app_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      build.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      build.package_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-card border border-border/50 shadow-sm">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-sm text-muted-foreground">
              {currentLanguage === "zh" ? "全部" : "Total"}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border/50 shadow-sm">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</div>
            <div className="text-sm text-muted-foreground">
              {currentLanguage === "zh" ? "等待中" : "Pending"}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border/50 shadow-sm">
            <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{stats.processing}</div>
            <div className="text-sm text-muted-foreground">
              {currentLanguage === "zh" ? "构建中" : "Building"}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border/50 shadow-sm">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.completed}</div>
            <div className="text-sm text-muted-foreground">
              {currentLanguage === "zh" ? "已完成" : "Completed"}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border/50 shadow-sm">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.failed}</div>
            <div className="text-sm text-muted-foreground">
              {currentLanguage === "zh" ? "失败" : "Failed"}
            </div>
          </div>
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
                className="p-5 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-md hover:border-border transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Icon & Info */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 dark:from-cyan-500/20 dark:to-blue-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
                      {getPlatformIcon(build.platform)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-lg truncate">{build.app_name}</h3>
                        <Badge
                          variant="outline"
                          className={`shrink-0 ${getStatusColor(build.status)}`}
                        >
                          {getStatusIcon(build.status)}
                          <span className="ml-1.5">{getStatusText(build.status)}</span>
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mb-1">
                        {build.package_name} v{build.version_code}
                      </p>
                      <p className="text-sm text-muted-foreground truncate mb-2">{build.url}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(build.created_at)}
                        </span>
                      </div>

                      {/* Progress bar for processing status */}
                      {(build.status === "pending" || build.status === "processing") && (
                        <div className="mt-3">
                          <div className="h-2 w-full max-w-xs rounded-full bg-muted overflow-hidden">
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

                  {/* Actions */}
                  <div className="flex items-center gap-2 md:shrink-0">
                    {build.status === "completed" && (
                      <Button
                        size="sm"
                        className="h-10 px-4 rounded-xl gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20"
                        onClick={() => handleDownload(build.id)}
                      >
                        <Download className="h-4 w-4" />
                        {currentLanguage === "zh" ? "下载" : "Download"}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 px-3 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                      onClick={() => handleDelete(build.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
