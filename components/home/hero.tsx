"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Sparkles, Users, Smartphone, AppWindow, Monitor, Chrome } from "lucide-react";

export function Hero() {
  const { t, currentLanguage } = useLanguage();
  const [url, setUrl] = useState("");

  const platformCategories = [
    {
      id: "mobile",
      name: currentLanguage === "zh" ? "移动应用" : "Mobile Apps",
      description: currentLanguage === "zh" ? "Android / iOS / HarmonyOS" : "Android / iOS / HarmonyOS",
      icon: Smartphone,
      color: "from-emerald-500 to-teal-600",
    },
    {
      id: "miniprogram",
      name: currentLanguage === "zh" ? "小程序" : "Mini Programs",
      description: currentLanguage === "zh" ? "微信 / 支付宝 / 小红书" : "WeChat / Alipay / Xiaohongshu",
      icon: AppWindow,
      color: "from-cyan-500 to-blue-600",
    },
    {
      id: "desktop",
      name: currentLanguage === "zh" ? "桌面应用" : "Desktop Apps",
      description: "Windows / MacOS / Linux",
      icon: Monitor,
      color: "from-violet-500 to-purple-600",
    },
    {
      id: "browser",
      name: currentLanguage === "zh" ? "浏览器扩展" : "Browser Extensions",
      description: "Chrome",
      icon: Chrome,
      color: "from-blue-500 to-green-500",
    },
  ];

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-14 sm:pt-16">
      {/* Animated Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-accent/30" />
        <div className="absolute top-1/4 left-1/4 w-[300px] sm:w-[400px] md:w-[500px] h-[300px] sm:h-[400px] md:h-[500px] bg-gradient-to-br from-cyan-500/10 dark:from-cyan-500/20 to-blue-500/10 dark:to-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[250px] sm:w-[300px] md:w-[400px] h-[250px] sm:h-[300px] md:h-[400px] bg-gradient-to-br from-purple-500/10 dark:from-purple-500/20 to-pink-500/10 dark:to-pink-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[500px] md:w-[600px] h-[400px] sm:h-[500px] md:h-[600px] bg-gradient-to-br from-blue-500/5 dark:from-blue-500/10 to-purple-500/5 dark:to-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-[size:48px_48px] sm:bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      </div>

      <div className="container mx-auto px-3 sm:px-4 md:px-6 py-8 sm:py-12 md:py-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 text-xs sm:text-sm font-medium mb-6 sm:mb-8">
            <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-cyan-600 dark:text-cyan-400" />
            <span className="bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-400 dark:to-blue-400 bg-clip-text text-transparent">
              {t("hero.badge")}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight mb-4 sm:mb-6 leading-tight">
            <span className="text-foreground">{t("hero.title.1")}</span>
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 bg-clip-text text-transparent">
              {t("hero.title.2")}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-3 sm:mb-4 max-w-2xl mx-auto px-2">
            {currentLanguage === "zh"
              ? "输入网站URL，自动生成多平台原生应用"
              : "Enter a website URL and generate native apps for multiple platforms"}
          </p>

          {/* Platform tags */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mb-8 sm:mb-12 px-2">
            {["Android", "iOS", "HarmonyOS", currentLanguage === "zh" ? "小程序" : "Mini Programs", "Windows", "MacOS", "Linux", "Chrome"].map((platform) => (
              <span
                key={platform}
                className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-full bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 text-foreground"
              >
                {platform}
              </span>
            ))}
          </div>

          {/* URL Input */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 max-w-2xl mx-auto mb-6 sm:mb-8 px-2">
            <div className="flex-1 relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl sm:rounded-2xl opacity-0 group-focus-within:opacity-100 blur transition-opacity" />
              <Input
                type="url"
                placeholder={t("hero.placeholder")}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="relative h-12 sm:h-14 pl-4 sm:pl-5 pr-4 sm:pr-5 text-sm sm:text-base rounded-lg sm:rounded-xl bg-card border-2 border-border focus:border-transparent transition-all shadow-sm"
              />
            </div>
            <Link href={`/generate${url ? `?url=${encodeURIComponent(url)}` : ""}`} className="sm:flex-shrink-0">
              <Button
                size="lg"
                className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-8 rounded-lg sm:rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm sm:text-base font-medium shadow-lg shadow-cyan-500/25 hover:shadow-xl hover:shadow-cyan-500/30 transition-all border-0"
              >
                {t("hero.cta")}
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </Link>
          </div>

          {/* Trust indicator */}
          <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-muted-foreground mb-10 sm:mb-16">
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>{t("hero.trusted")}</span>
          </div>

          {/* Platform Categories */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto px-2">
            {platformCategories.map((category) => {
              const Icon = category.icon;
              return (
                <div
                  key={category.id}
                  className="group relative p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-card border border-border/50 hover:border-border shadow-sm hover:shadow-lg transition-all"
                >
                  <div className={`absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-br ${category.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
                  <div className="relative">
                    <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-gradient-to-br ${category.color} flex items-center justify-center shadow-lg mb-3 sm:mb-4 mx-auto`}>
                      <Icon className="h-5 w-5 sm:h-7 sm:w-7 text-white" />
                    </div>
                    <h3 className="text-sm sm:text-lg font-semibold text-foreground mb-0.5 sm:mb-1">
                      {category.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                      {category.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
