"use client";

import { useLanguage } from "@/context/LanguageContext";
import { PLATFORMS, PLATFORM_CATEGORIES, getPlatformsByCategory } from "@/config/platforms";
import type { PlatformCategory } from "@/config/platforms";
import { Badge } from "@/components/ui/badge";
import { Check, Layers } from "lucide-react";

interface PlatformSelectorProps {
  selectedPlatforms: string[];
  onSelectionChange: (platforms: string[]) => void;
}

export function PlatformSelector({ selectedPlatforms, onSelectionChange }: PlatformSelectorProps) {
  const { t, currentLanguage } = useLanguage();

  const categories: PlatformCategory[] = ["mobile", "miniprogram", "desktop", "browser"];

  const togglePlatform = (platformId: string) => {
    if (selectedPlatforms.includes(platformId)) {
      onSelectionChange(selectedPlatforms.filter((id) => id !== platformId));
    } else {
      onSelectionChange([...selectedPlatforms, platformId]);
    }
  };

  const toggleCategory = (category: PlatformCategory) => {
    const categoryPlatforms = getPlatformsByCategory(category).map((p) => p.id);
    const allSelected = categoryPlatforms.every((id) => selectedPlatforms.includes(id));

    if (allSelected) {
      onSelectionChange(selectedPlatforms.filter((id) => !categoryPlatforms.includes(id)));
    } else {
      const newSelection = [...selectedPlatforms];
      categoryPlatforms.forEach((id) => {
        if (!newSelection.includes(id)) {
          newSelection.push(id);
        }
      });
      onSelectionChange(newSelection);
    }
  };

  const selectAll = () => {
    if (selectedPlatforms.length === PLATFORMS.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(PLATFORMS.map((p) => p.id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
            <Layers className="h-5 w-5 text-cyan-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{t("generate.platforms.title")}</h3>
            <p className="text-sm text-muted-foreground">
              {currentLanguage === "zh" ? "选择需要生成的平台" : "Select platforms to generate"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={selectAll}
            className="text-sm text-cyan-500 hover:text-cyan-400 font-medium transition-colors"
          >
            {selectedPlatforms.length === PLATFORMS.length
              ? currentLanguage === "zh" ? "取消全选" : "Deselect All"
              : currentLanguage === "zh" ? "全选" : "Select All"}
          </button>
          <Badge
            variant="secondary"
            className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-400 border border-cyan-500/20"
          >
            {t("generate.selected").replace("{count}", selectedPlatforms.length.toString())}
          </Badge>
        </div>
      </div>

      {/* Platform Categories */}
      {categories.map((category) => {
        const platforms = getPlatformsByCategory(category);
        const categoryInfo = PLATFORM_CATEGORIES[category];
        const selectedInCategory = platforms.filter((p) => selectedPlatforms.includes(p.id)).length;
        const allSelected = selectedInCategory === platforms.length;

        return (
          <div key={category} className="space-y-4">
            {/* Category Header */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => toggleCategory(category)}
                className="flex items-center gap-3 group"
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all duration-200 ${
                    allSelected
                      ? "bg-gradient-to-br from-cyan-500 to-blue-500 border-cyan-500 shadow-lg shadow-cyan-500/30"
                      : selectedInCategory > 0
                      ? "bg-cyan-500/30 border-cyan-500"
                      : "border-border/50 group-hover:border-cyan-500/50"
                  }`}
                >
                  {(allSelected || selectedInCategory > 0) && (
                    <Check className={`h-4 w-4 ${allSelected ? "text-white" : "text-cyan-500"}`} />
                  )}
                </div>
                <span className="font-semibold text-foreground/90 group-hover:text-cyan-500 transition-colors">
                  {categoryInfo.name[currentLanguage]}
                </span>
              </button>
              <span className="text-sm text-muted-foreground px-2.5 py-1 rounded-full bg-muted/50">
                {selectedInCategory}/{platforms.length}
              </span>
            </div>

            {/* Platform Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {platforms.map((platform) => {
                const Icon = platform.icon;
                const isSelected = selectedPlatforms.includes(platform.id);

                return (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => togglePlatform(platform.id)}
                    className={`relative group text-left p-4 rounded-xl border-2 transition-all duration-300 ${
                      isSelected
                        ? "border-cyan-500 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 shadow-lg shadow-cyan-500/10"
                        : "border-border/30 bg-card/30 hover:border-cyan-500/50 hover:bg-card/50"
                    }`}
                  >
                    {/* Selection indicator */}
                    <div
                      className={`absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 ${
                        isSelected
                          ? "bg-gradient-to-br from-cyan-500 to-blue-500 shadow-md shadow-cyan-500/30"
                          : "border-2 border-border/50 group-hover:border-cyan-500/50"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>

                    <div className="flex items-start gap-3">
                      {/* Platform Icon */}
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${platform.color} flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-105`}
                      >
                        <Icon className="h-6 w-6 text-white" />
                      </div>

                      {/* Platform Info */}
                      <div className="flex-1 min-w-0 pr-6">
                        <p className="font-semibold text-foreground/90 mb-0.5">
                          {platform.name[currentLanguage]}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
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
    </div>
  );
}
