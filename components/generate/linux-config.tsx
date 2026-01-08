"use client";

import { useLanguage } from "@/context/LanguageContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Image, AlertTriangle, Terminal } from "lucide-react";
import { useState, useRef } from "react";

interface LinuxConfigProps {
  name: string;
  onNameChange: (value: string) => void;
  onIconChange: (file: File | null) => void;
}

export function LinuxConfig({
  name,
  onNameChange,
  onIconChange,
}: LinuxConfigProps) {
  const { currentLanguage } = useLanguage();
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [iconFileName, setIconFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleIconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        return;
      }

      onIconChange(file);
      setIconFileName(file.name);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => setIconPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveIcon = () => {
    onIconChange(null);
    setIconPreview(null);
    setIconFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400/20 to-orange-500/20 flex items-center justify-center">
          <Terminal className="h-5 w-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">
            {currentLanguage === "zh" ? "Linux 应用配置" : "Linux App Configuration"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {currentLanguage === "zh"
              ? "将网站打包为 Linux 桌面应用"
              : "Package your website as a Linux desktop app"}
          </p>
        </div>
      </div>

      {/* App Name */}
      <div className="space-y-3">
        <Label htmlFor="appName" className="text-base font-medium text-foreground/80">
          {currentLanguage === "zh" ? "应用名称" : "App Name"} <span className="text-red-500">*</span>
        </Label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-orange-500 transition-colors">
            <Package className="h-5 w-5" />
          </div>
          <Input
            id="appName"
            type="text"
            placeholder={currentLanguage === "zh" ? "输入应用名称" : "Enter app name"}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="h-14 pl-12 text-base rounded-xl border-2 border-border/50 bg-background/50 backdrop-blur-sm focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all duration-200"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {currentLanguage === "zh"
            ? "应用名称将显示在窗口标题和文件夹名中"
            : "App name will be shown in window title and folder name"}
        </p>
      </div>

      {/* Icon Upload */}
      <div className="space-y-3">
        <Label className="text-base font-medium text-foreground/80">
          {currentLanguage === "zh" ? "应用图标" : "App Icon"}{" "}
          <span className="text-muted-foreground text-sm font-normal">
            ({currentLanguage === "zh" ? "可选" : "Optional"})
          </span>
        </Label>
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border/50 rounded-xl p-6 text-center cursor-pointer hover:border-orange-500/50 hover:bg-orange-500/5 transition-all duration-200"
        >
          {iconPreview ? (
            <div className="flex flex-col items-center gap-3">
              <img
                src={iconPreview}
                alt="Icon preview"
                className="w-16 h-16 rounded-lg object-cover shadow-md"
              />
              <p className="text-sm text-muted-foreground">{iconFileName}</p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveIcon();
                }}
                className="text-xs text-red-500 hover:text-red-600 transition-colors"
              >
                {currentLanguage === "zh" ? "移除图标" : "Remove icon"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
                <Image className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {currentLanguage === "zh"
                  ? "点击上传图标 (PNG/JPG)"
                  : "Click to upload icon (PNG/JPG)"}
              </p>
              <p className="text-xs text-muted-foreground/70">
                {currentLanguage === "zh"
                  ? "推荐尺寸: 512x512 像素"
                  : "Recommended: 512x512 pixels"}
              </p>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          onChange={handleIconSelect}
          className="hidden"
        />
      </div>

      {/* Info Box - Usage Guide */}
      <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-4">
        <div className="flex items-start gap-3">
          <Terminal className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-orange-700 dark:text-orange-300 mb-2">
              {currentLanguage === "zh" ? "使用说明" : "Usage Guide"}
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>
                {currentLanguage === "zh"
                  ? "• 下载 tar.gz 文件后解压：tar -xzf AppName.tar.gz"
                  : "• Extract after download: tar -xzf AppName.tar.gz"}
              </li>
              <li>
                {currentLanguage === "zh"
                  ? "• 进入目录后运行：./appname"
                  : "• Run from directory: ./appname"}
              </li>
              <li>
                {currentLanguage === "zh"
                  ? "• 基于 Tauri 构建，体积小巧（约 8-15MB）"
                  : "• Built with Tauri, lightweight (~8-15MB)"}
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Warning Box */}
      <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-amber-600 mb-2">
              {currentLanguage === "zh" ? "运行提示" : "Runtime Notice"}
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>
                {currentLanguage === "zh"
                  ? "• 首次运行可能需要添加执行权限：chmod +x ./appname"
                  : "• May need to add execute permission: chmod +x ./appname"}
              </li>
              <li>
                {currentLanguage === "zh"
                  ? "• 需要 WebKit2GTK 运行时（大多数发行版已预装）"
                  : "• Requires WebKit2GTK runtime (pre-installed on most distros)"}
              </li>
              <li>
                {currentLanguage === "zh"
                  ? "• 支持 Ubuntu、Fedora、Arch 等主流发行版"
                  : "• Supports Ubuntu, Fedora, Arch and other major distros"}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
