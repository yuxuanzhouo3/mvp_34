"use client";

import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
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

type BuildStatus = "building" | "completed" | "failed";

interface BuildItem {
  id: string;
  appName: string;
  url: string;
  platforms: string[];
  status: BuildStatus;
  createdAt: string;
  progress?: number;
}

// Mock data for UI demonstration
const mockBuilds: BuildItem[] = [
  {
    id: "1",
    appName: "My Website App",
    url: "https://example.com",
    platforms: ["android", "ios", "harmonyos"],
    status: "completed",
    createdAt: "2024-12-26 10:30",
  },
  {
    id: "2",
    appName: "E-Commerce App",
    url: "https://shop.example.com",
    platforms: ["wechat", "alipay"],
    status: "building",
    createdAt: "2024-12-26 11:45",
    progress: 65,
  },
  {
    id: "3",
    appName: "Blog Reader",
    url: "https://blog.example.com",
    platforms: ["linux"],
    status: "failed",
    createdAt: "2024-12-25 15:20",
  },
  {
    id: "4",
    appName: "News Portal",
    url: "https://news.example.com",
    platforms: ["android", "ios"],
    status: "completed",
    createdAt: "2024-12-24 09:15",
  },
  {
    id: "5",
    appName: "Social App",
    url: "https://social.example.com",
    platforms: ["wechat", "xiaohongshu", "alipay"],
    status: "completed",
    createdAt: "2024-12-23 14:30",
  },
];

export default function BuildsPage() {
  const { currentLanguage } = useLanguage();
  const [builds] = useState<BuildItem[]>(mockBuilds);
  const [searchQuery, setSearchQuery] = useState("");

  const getStatusIcon = (status: BuildStatus) => {
    switch (status) {
      case "building":
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4" />;
      case "failed":
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusText = (status: BuildStatus) => {
    const texts = {
      building: currentLanguage === "zh" ? "构建中" : "Building",
      completed: currentLanguage === "zh" ? "已完成" : "Completed",
      failed: currentLanguage === "zh" ? "失败" : "Failed",
    };
    return texts[status];
  };

  const getStatusColor = (status: BuildStatus) => {
    switch (status) {
      case "building":
        return "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20";
      case "completed":
        return "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20";
      case "failed":
        return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20";
    }
  };

  const getPlatformIcon = (platforms: string[]) => {
    const hasMobile = platforms.some((p) =>
      ["android", "ios", "harmonyos"].includes(p)
    );
    const hasMiniprogram = platforms.some((p) =>
      ["wechat", "alipay", "xiaohongshu"].includes(p)
    );
    const hasDesktop = platforms.includes("linux");

    if (hasMobile) return <Smartphone className="h-5 w-5" />;
    if (hasMiniprogram) return <Package className="h-5 w-5" />;
    if (hasDesktop) return <Monitor className="h-5 w-5" />;
    return <Layers className="h-5 w-5" />;
  };

  const getPlatformLabel = (platforms: string[]) => {
    const labels: string[] = [];
    const hasMobile = platforms.some((p) =>
      ["android", "ios", "harmonyos"].includes(p)
    );
    const hasMiniprogram = platforms.some((p) =>
      ["wechat", "alipay", "xiaohongshu"].includes(p)
    );
    const hasDesktop = platforms.includes("linux");

    if (hasMobile) labels.push(currentLanguage === "zh" ? "移动端" : "Mobile");
    if (hasMiniprogram) labels.push(currentLanguage === "zh" ? "小程序" : "Mini Program");
    if (hasDesktop) labels.push(currentLanguage === "zh" ? "桌面端" : "Desktop");

    return labels.join(" + ");
  };

  const filteredBuilds = builds.filter(
    (build) =>
      build.appName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      build.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const buildingCount = builds.filter((b) => b.status === "building").length;
  const completedCount = builds.filter((b) => b.status === "completed").length;

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-card border border-border/50 shadow-sm">
            <div className="text-2xl font-bold text-foreground">{builds.length}</div>
            <div className="text-sm text-muted-foreground">
              {currentLanguage === "zh" ? "全部任务" : "Total Tasks"}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border/50 shadow-sm">
            <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{buildingCount}</div>
            <div className="text-sm text-muted-foreground">
              {currentLanguage === "zh" ? "构建中" : "Building"}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border/50 shadow-sm">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{completedCount}</div>
            <div className="text-sm text-muted-foreground">
              {currentLanguage === "zh" ? "已完成" : "Completed"}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border/50 shadow-sm">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {builds.filter((b) => b.status === "failed").length}
            </div>
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
              placeholder={currentLanguage === "zh" ? "搜索应用名称或URL..." : "Search by name or URL..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 rounded-xl border-border/50 bg-card"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-11 px-4 rounded-xl gap-2">
              <Filter className="h-4 w-4" />
              {currentLanguage === "zh" ? "筛选" : "Filter"}
            </Button>
            <Button variant="outline" size="sm" className="h-11 px-4 rounded-xl gap-2">
              <RefreshCw className="h-4 w-4" />
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
                      {getPlatformIcon(build.platforms)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-lg truncate">{build.appName}</h3>
                        <Badge
                          variant="outline"
                          className={`shrink-0 ${getStatusColor(build.status)}`}
                        >
                          {getStatusIcon(build.status)}
                          <span className="ml-1.5">{getStatusText(build.status)}</span>
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mb-2">{build.url}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Layers className="h-3.5 w-3.5" />
                          {getPlatformLabel(build.platforms)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {build.createdAt}
                        </span>
                      </div>

                      {/* Progress bar for building status */}
                      {build.status === "building" && build.progress && (
                        <div className="mt-3">
                          <div className="h-2 w-full max-w-xs rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                              style={{ width: `${build.progress}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {build.progress}% {currentLanguage === "zh" ? "已完成" : "completed"}
                          </p>
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
                      >
                        <Download className="h-4 w-4" />
                        {currentLanguage === "zh" ? "下载" : "Download"}
                      </Button>
                    )}
                    {build.status === "failed" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 px-4 rounded-xl gap-2"
                      >
                        <RefreshCw className="h-4 w-4" />
                        {currentLanguage === "zh" ? "重试" : "Retry"}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 px-3 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
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
