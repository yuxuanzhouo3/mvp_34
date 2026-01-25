"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { PLATFORMS, PLATFORM_CATEGORIES, getPlatformsByCategory } from "@/config/platforms";
import type { PlatformCategory } from "@/config/platforms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Check, Layers, Clock, Lock } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getPlanSupportBatchBuild } from "@/utils/plan-limits";
import { IS_DOMESTIC_VERSION } from "@/config";

interface PlatformSelectorProps {
  selectedPlatforms: string[];
  onSelectionChange: (platforms: string[]) => void;
}

export function PlatformSelector({ selectedPlatforms, onSelectionChange }: PlatformSelectorProps) {
  const { t, currentLanguage } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const [batchBuildEnabled, setBatchBuildEnabled] = useState(false);
  const [showGuestLoginDialog, setShowGuestLoginDialog] = useState(false);
  const [guestDialogType, setGuestDialogType] = useState<"platform" | "batch">("platform");

  // 游客���持的移动端平台
  const guestSupportedPlatforms = ["android", "ios", "harmonyos"];

  useEffect(() => {
    if (!user) return;
    const fetchPlan = async () => {
      // 国内版：从国内 API 获取
      if (IS_DOMESTIC_VERSION) {
        try {
          const res = await fetch("/api/domestic/auth/me", { credentials: "include" });
          if (res.ok) {
            const data = await res.json();
            // 兼容多种数据结构
            const plan = data.user?.metadata?.plan || data.user?.plan || "free";
            console.log("[PlatformSelector] User plan:", plan, "Full user data:", data.user);
            setBatchBuildEnabled(getPlanSupportBatchBuild(plan));
          } else {
            setBatchBuildEnabled(false);
          }
        } catch { setBatchBuildEnabled(false); }
        return;
      }

      // 国际版：使用 Supabase
      const supabase = createClient();
      const { data } = await supabase.from("user_wallets").select("plan").eq("user_id", user.id).single();
      const plan = data?.plan || "Free";
      setBatchBuildEnabled(getPlanSupportBatchBuild(plan));
    };
    fetchPlan();
  }, [user]);

  const categories: PlatformCategory[] = ["mobile", "miniprogram", "desktop", "browser"];
  const availablePlatforms = PLATFORMS.filter(p => p.available);

  const togglePlatform = (platformId: string) => {
    const platform = PLATFORMS.find(p => p.id === platformId);
    if (platform && !platform.available) {
      toast.info(currentLanguage === "zh" ? "该平台正在开发中，敬请期待" : "This platform is coming soon");
      return;
    }

    // 游客限制：仅支持移动端平台
    if (!user && !guestSupportedPlatforms.includes(platformId)) {
      setGuestDialogType("platform");
      setShowGuestLoginDialog(true);
      return;
    }

    if (selectedPlatforms.includes(platformId)) {
      onSelectionChange(selectedPlatforms.filter((id) => id !== platformId));
    } else {
      if (!batchBuildEnabled) {
        onSelectionChange([platformId]);
      } else {
        onSelectionChange([...selectedPlatforms, platformId]);
      }
    }
  };

  const toggleCategory = (category: PlatformCategory) => {
    // 游客限制：批量构建需要登录
    if (!user) {
      setGuestDialogType("batch");
      setShowGuestLoginDialog(true);
      return;
    }

    if (!batchBuildEnabled) {
      window.dispatchEvent(new CustomEvent("open-subscription-modal"));
      return;
    }
    const categoryPlatforms = getPlatformsByCategory(category).filter(p => p.available).map((p) => p.id);
    const allSelected = categoryPlatforms.every((id) => selectedPlatforms.includes(id));
    if (allSelected) {
      onSelectionChange(selectedPlatforms.filter((id) => !categoryPlatforms.includes(id)));
    } else {
      const newSelection = [...selectedPlatforms];
      categoryPlatforms.forEach((id) => { if (!newSelection.includes(id)) newSelection.push(id); });
      onSelectionChange(newSelection);
    }
  };

  const selectAll = () => {
    // 游客限制：批量构建需要登录
    if (!user) {
      setGuestDialogType("batch");
      setShowGuestLoginDialog(true);
      return;
    }

    if (!batchBuildEnabled) {
      window.dispatchEvent(new CustomEvent("open-subscription-modal"));
      return;
    }
    if (selectedPlatforms.length === availablePlatforms.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(availablePlatforms.map((p) => p.id));
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
            <Layers className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-500" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-semibold">{t("generate.platforms.title")}</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {currentLanguage === "zh" ? "选择需要生成的平台" : "Select platforms to generate"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto">
          <button type="button" onClick={selectAll} className="text-xs sm:text-sm text-cyan-500 hover:text-cyan-400 font-medium transition-colors">
            {selectedPlatforms.length === availablePlatforms.length ? (currentLanguage === "zh" ? "取消全选" : "Deselect All") : (currentLanguage === "zh" ? "全选" : "Select All")}
          </button>
          <Badge variant="secondary" className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-400 border border-cyan-500/20 text-xs">
            {t("generate.selected").replace("{count}", selectedPlatforms.length.toString())}
          </Badge>
        </div>
      </div>

      {/* Platform Categories */}
      {categories.map((category) => {
        const platforms = getPlatformsByCategory(category);
        const availableInCategory = platforms.filter(p => p.available);
        const categoryInfo = PLATFORM_CATEGORIES[category];
        const selectedInCategory = availableInCategory.filter((p) => selectedPlatforms.includes(p.id)).length;
        const allSelected = availableInCategory.length > 0 && selectedInCategory === availableInCategory.length;

        return (
          <div key={category} className="space-y-3 sm:space-y-4">
            {/* Category Header */}
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => toggleCategory(category)} className="flex items-center gap-2 sm:gap-3 group">
                <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg flex items-center justify-center border-2 transition-all duration-200 ${allSelected ? "bg-gradient-to-br from-cyan-500 to-blue-500 border-cyan-500 shadow-lg shadow-cyan-500/30" : selectedInCategory > 0 ? "bg-cyan-500/30 border-cyan-500" : "border-border/50 group-hover:border-cyan-500/50"}`}>
                  {(allSelected || selectedInCategory > 0) && (<Check className={`h-3 w-3 sm:h-4 sm:w-4 ${allSelected ? "text-white" : "text-cyan-500"}`} />)}
                </div>
                <span className="text-sm sm:text-base font-semibold text-foreground/90 group-hover:text-cyan-500 transition-colors">
                  {categoryInfo.name[currentLanguage]}
                </span>
              </button>
              <span className="text-xs sm:text-sm text-muted-foreground px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-muted/50">
                {selectedInCategory}/{availableInCategory.length}
              </span>
            </div>

            {/* Platform Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
              {platforms.map((platform) => {
                const Icon = platform.icon;
                const isSelected = selectedPlatforms.includes(platform.id);
                const isDisabled = !platform.available;

                return (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => togglePlatform(platform.id)}
                    className={`relative group text-left p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all duration-300 active:scale-[0.98] ${isDisabled ? "border-border/20 bg-muted/30 cursor-not-allowed opacity-60" : isSelected ? "border-cyan-500 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 shadow-lg shadow-cyan-500/10" : "border-border/30 bg-card/30 hover:border-cyan-500/50 hover:bg-card/50"}`}
                  >
                    {isDisabled ? (
                      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px] sm:text-xs">
                        <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        <span>{currentLanguage === "zh" ? "开发中" : "Soon"}</span>
                      </div>
                    ) : (
                      <div className={`absolute top-2 right-2 sm:top-3 sm:right-3 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center transition-all duration-200 ${isSelected ? "bg-gradient-to-br from-cyan-500 to-blue-500 shadow-md shadow-cyan-500/30" : "border-2 border-border/50 group-hover:border-cyan-500/50"}`}>
                        {isSelected && <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-white" />}
                      </div>
                    )}

                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br ${platform.color} flex items-center justify-center shadow-lg transition-transform duration-200 ${isDisabled ? "" : "group-hover:scale-105"}`}>
                        <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0 pr-5 sm:pr-6">
                        <p className="text-sm sm:text-base font-semibold text-foreground/90 mb-0.5">
                          {platform.name[currentLanguage]}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2">
                          {platform.description[currentLanguage]}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 游客登录提示对话框 */}
      <Dialog open={showGuestLoginDialog} onOpenChange={setShowGuestLoginDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-500" />
              {currentLanguage === "zh" ? "需要登录" : "Login Required"}
            </DialogTitle>
            <DialogDescription>
              {guestDialogType === "platform" ? (
                currentLanguage === "zh"
                  ? "游客模式仅支持移动端平台（Android、iOS、HarmonyOS）的单平台构建。"
                  : "Guest mode only supports single mobile platform builds (Android, iOS, HarmonyOS)."
              ) : (
                currentLanguage === "zh"
                  ? "游客模式仅支持单平台构建，批量构建功能需要登录后使用。"
                  : "Guest mode only supports single platform builds. Batch building requires login."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
              <p className="text-sm text-muted-foreground">
                {guestDialogType === "platform" ? (
                  currentLanguage === "zh"
                    ? "登录后即可解锁所有平台的构建功能，包括桌面端（Chrome、Windows、macOS、Linux）和小程序平台。"
                    : "Login to unlock all platform builds, including desktop (Chrome, Windows, macOS, Linux) and mini-program platforms."
                ) : (
                  currentLanguage === "zh"
                    ? "登录后即可使用批量构建功能，同时构建多个平台，大幅提升效率。"
                    : "Login to use batch building feature and build multiple platforms simultaneously for better efficiency."
                )}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  setShowGuestLoginDialog(false);
                  router.push("/auth/login?redirect=/generate");
                }}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500"
              >
                {currentLanguage === "zh" ? "立即登录" : "Login Now"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowGuestLoginDialog(false)}
                className="w-full"
              >
                {currentLanguage === "zh" ? "继续试用" : "Continue Trial"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
