"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Sparkles, Users, Smartphone, AppWindow, Monitor } from "lucide-react";

export function Hero() {
  const { t, currentLanguage } = useLanguage();
  const [url, setUrl] = useState("");

  // Simplified platform categories
  const platformCategories = [
    {
      id: "mobile",
      name: currentLanguage === "zh" ? "移动应用" : "Mobile Apps",
      description: currentLanguage === "zh" ? "Android / iOS / 鸿蒙" : "Android / iOS / HarmonyOS",
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
      description: "Windows / macOS / Linux",
      icon: Monitor,
      color: "from-violet-500 to-purple-600",
    },
  ];

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
      {/* Animated Background */}
      <div className="absolute inset-0 -z-10">
        {/* Base gradient - different for light/dark */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-accent/30" />

        {/* Animated orbs - more subtle in light mode */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-cyan-500/10 dark:from-cyan-500/20 to-blue-500/10 dark:to-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-gradient-to-br from-purple-500/10 dark:from-purple-500/20 to-pink-500/10 dark:to-pink-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-blue-500/5 dark:from-blue-500/10 to-purple-500/5 dark:to-purple-500/10 rounded-full blur-3xl" />

        {/* Grid pattern - adjusted for light mode */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      </div>

      <div className="container mx-auto px-4 md:px-6 py-12 md:py-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 text-sm font-medium mb-8">
            <Sparkles className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <span className="bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-400 dark:to-blue-400 bg-clip-text text-transparent">
              {t("hero.badge")}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
            <span className="text-foreground">{t("hero.title.1")}</span>
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 bg-clip-text text-transparent">
              {t("hero.title.2")}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-muted-foreground mb-4 max-w-2xl mx-auto">
            {currentLanguage === "zh"
              ? "输入网站URL，自动生成多平台原生应用"
              : "Enter a website URL and generate native apps for multiple platforms"}
          </p>

          {/* Platform tags in one row */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
            {["Android", "iOS", currentLanguage === "zh" ? "鸿蒙" : "HarmonyOS", currentLanguage === "zh" ? "小程序" : "Mini Programs", "Windows", "macOS", "Linux"].map((platform) => (
              <span
                key={platform}
                className="px-3 py-1.5 text-sm font-medium rounded-full bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 text-foreground"
              >
                {platform}
              </span>
            ))}
          </div>

          {/* URL Input */}
          <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto mb-8">
            <div className="flex-1 relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl opacity-0 group-focus-within:opacity-100 blur transition-opacity" />
              <Input
                type="url"
                placeholder={t("hero.placeholder")}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="relative h-14 pl-5 pr-5 text-base rounded-xl bg-card border-2 border-border focus:border-transparent transition-all shadow-sm"
              />
            </div>
            <Link href={`/generate${url ? `?url=${encodeURIComponent(url)}` : ""}`}>
              <Button
                size="lg"
                className="h-14 px-8 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-base font-medium shadow-lg shadow-cyan-500/25 hover:shadow-xl hover:shadow-cyan-500/30 transition-all border-0"
              >
                {t("hero.cta")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>

          {/* Trust indicator */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-16">
            <Users className="h-4 w-4" />
            <span>{t("hero.trusted")}</span>
          </div>

          {/* Simplified Platform Categories */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {platformCategories.map((category) => {
              const Icon = category.icon;
              return (
                <div
                  key={category.id}
                  className="group relative p-6 rounded-2xl bg-card border border-border/50 hover:border-border shadow-sm hover:shadow-lg transition-all"
                >
                  {/* Hover glow effect */}
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${category.color} opacity-0 group-hover:opacity-5 transition-opacity`} />

                  <div className="relative">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${category.color} flex items-center justify-center shadow-lg mb-4 mx-auto`}>
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">
                      {category.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
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
