"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { UrlInput, AppConfig, PlatformSelector } from "@/components/generate";
import { Button } from "@/components/ui/button";
import { Rocket, Sparkles, ArrowRight, Loader2 } from "lucide-react";

function GenerateContent() {
  const { t, currentLanguage } = useLanguage();
  const searchParams = useSearchParams();

  const [url, setUrl] = useState("");
  const [appName, setAppName] = useState("");
  const [appDescription, setAppDescription] = useState("");
  const [appIcon, setAppIcon] = useState<File | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  useEffect(() => {
    const urlParam = searchParams.get("url");
    if (urlParam) {
      setUrl(urlParam);
    }
  }, [searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement generation logic
    console.log({
      url,
      appName,
      appDescription,
      appIcon,
      selectedPlatforms,
    });
  };

  const isValid = url && appName && selectedPlatforms.length > 0;

  return (
    <div className="min-h-screen relative overflow-hidden pt-20">
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-cyan-950/20" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-cyan-500/10 via-blue-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-purple-500/10 via-blue-500/10 to-transparent rounded-full blur-3xl" />
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      </div>

      <div className="container mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="text-center mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            <span>
              {currentLanguage === "zh" ? "简单三步，即刻完成" : "Three Simple Steps"}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-5">
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              {t("generate.title")}
            </span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {currentLanguage === "zh"
              ? "填写基本信息，选择目标平台，一键生成多平台应用"
              : "Fill in basic info, select platforms, generate multi-platform apps with one click"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8">
          {/* Step 1: URL Input */}
          <div className="relative">
            <div className="absolute -left-4 md:-left-12 top-0 flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-cyan-500/30">
                1
              </div>
              <div className="w-px h-full bg-gradient-to-b from-cyan-500/50 to-transparent mt-2" />
            </div>
            <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-6 md:p-8 shadow-xl shadow-black/5">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                {currentLanguage === "zh" ? "输入网站地址" : "Enter Website URL"}
              </h2>
              <UrlInput value={url} onChange={setUrl} />
            </div>
          </div>

          {/* Step 2: App Config */}
          <div className="relative">
            <div className="absolute -left-4 md:-left-12 top-0 flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/30">
                2
              </div>
              <div className="w-px h-full bg-gradient-to-b from-blue-500/50 to-transparent mt-2" />
            </div>
            <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-6 md:p-8 shadow-xl shadow-black/5">
              <h2 className="text-xl font-semibold mb-6">
                {currentLanguage === "zh" ? "配置应用信息" : "Configure App Info"}
              </h2>
              <AppConfig
                name={appName}
                description={appDescription}
                onNameChange={setAppName}
                onDescriptionChange={setAppDescription}
                onIconChange={setAppIcon}
              />
            </div>
          </div>

          {/* Step 3: Platform Selection */}
          <div className="relative">
            <div className="absolute -left-4 md:-left-12 top-0 flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-500/30">
                3
              </div>
            </div>
            <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-6 md:p-8 shadow-xl shadow-black/5">
              <PlatformSelector
                selectedPlatforms={selectedPlatforms}
                onSelectionChange={setSelectedPlatforms}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-center pt-6 pb-12">
            <Button
              type="submit"
              size="lg"
              disabled={!isValid}
              className="group h-14 px-10 text-lg rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:from-cyan-400 hover:via-blue-400 hover:to-purple-500 text-white font-semibold shadow-xl shadow-cyan-500/25 hover:shadow-2xl hover:shadow-cyan-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <Rocket className="mr-2 h-5 w-5 group-hover:animate-pulse" />
              {t("generate.submit")}
              {selectedPlatforms.length > 0 && (
                <span className="ml-3 px-2.5 py-1 rounded-full bg-white/20 text-sm font-medium">
                  {selectedPlatforms.length} {currentLanguage === "zh" ? "个平台" : "platforms"}
                </span>
              )}
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
    </div>
  );
}

export default function GeneratePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <GenerateContent />
    </Suspense>
  );
}
