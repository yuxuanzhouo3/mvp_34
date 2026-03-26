"use client";

import { useLanguage } from "@/context/LanguageContext";
import { useUploadConfig } from "@/hooks/useUploadConfig";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Image, AlertTriangle, Monitor, AlertCircle } from "lucide-react";
import { useState, useRef } from "react";

interface WindowsConfigProps {
  name: string;
  onNameChange: (value: string) => void;
  onIconChange: (file: File | null) => void;
}

export function WindowsConfig({
  name,
  onNameChange,
  onIconChange,
}: WindowsConfigProps) {
  const { currentLanguage } = useLanguage();
  const { iconUploadEnabled, maxImageUploadMB, validateFileSize } = useUploadConfig();
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [iconFileName, setIconFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleIconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        return;
      }

      // Validate file size
      const validation = validateFileSize(file);
      if (!validation.valid) {
        setUploadError(
          currentLanguage === "zh"
            ? `文件大小 (${(file.size / (1024 * 1024)).toFixed(2)}MB) 超过限制 (${maxImageUploadMB}MB)`
            : validation.error || "File too large"
        );
        // 清除之前选择的文件，防止提交无效文件
        onIconChange(null);
        setIconPreview(null);
        setIconFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      setUploadError(null);
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
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-400/20 to-blue-500/20 flex items-center justify-center">
          <Monitor className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-semibold">
            {currentLanguage === "zh" ? "Windows 应用配置" : "Windows App Configuration"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {currentLanguage === "zh"
              ? "将网站打包为 Windows 桌面应用"
              : "Package your website as a Windows desktop app"}
          </p>
        </div>
      </div>

      {/* App Name */}
      <div className="space-y-3">
        <Label htmlFor="appName" className="text-base font-medium text-foreground/80">
          {currentLanguage === "zh" ? "应用名称" : "App Name"} <span className="text-red-500">*</span>
        </Label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-blue-500 transition-colors">
            <Package className="h-5 w-5" />
          </div>
          <Input
            id="appName"
            type="text"
            placeholder={currentLanguage === "zh" ? "输入应用名称" : "Enter app name"}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="h-12 sm:h-14 pl-10 sm:pl-12 text-base rounded-xl border-2 border-border/50 bg-background/50 backdrop-blur-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all duration-200"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {currentLanguage === "zh"
            ? "应用名称将显示在窗口标题和 EXE 文件名中"
            : "App name will be shown in window title and EXE filename"}
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
        {!iconUploadEnabled ? (
          <div className="border-2 border-dashed border-border/30 rounded-xl p-6 text-center bg-muted/30">
            <div className="flex flex-col items-center gap-2">
              <AlertCircle className="w-6 h-6 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground/50">
                {currentLanguage === "zh" ? "图标上传已禁用" : "Icon upload disabled"}
              </p>
            </div>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border/50 rounded-xl p-6 text-center cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-all duration-200"
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
                    ? `推荐尺寸: 256x256 像素 (最大 ${maxImageUploadMB}MB)`
                    : `Recommended: 256x256 pixels (max ${maxImageUploadMB}MB)`}
                </p>
              </div>
            )}
          </div>
        )}
        {uploadError && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {uploadError}
          </p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          onChange={handleIconSelect}
          className="hidden"
        />
      </div>

      {/* Info Box - Usage Guide */}
      <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4">
        <div className="flex items-start gap-3">
          <Monitor className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-blue-600 mb-2">
              {currentLanguage === "zh" ? "使用说明" : "Usage Guide"}
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>
                {currentLanguage === "zh"
                  ? "• 下载后直接双击 EXE 文件即可运行"
                  : "• Double-click the downloaded EXE to run"}
              </li>
              <li>
                {currentLanguage === "zh"
                  ? "• 无需安装，单文件便携版应用"
                  : "• No installation needed, single-file portable app"}
              </li>
              <li>
                {currentLanguage === "zh"
                  ? "• 可放置在任意位置运行"
                  : "• Can be placed and run from anywhere"}
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Warning Box */}
      <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-amber-600 mb-2">
              {currentLanguage === "zh" ? "安全提示" : "Security Notice"}
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>
                {currentLanguage === "zh"
                  ? "• 应用程序没有数字签名，Windows 可能显示安全警告"
                  : "• App is unsigned, Windows may show security warnings"}
              </li>
              <li>
                {currentLanguage === "zh"
                  ? "• 首次运行时点击「更多信息」→「仍要运行」"
                  : "• Click 'More info' → 'Run anyway' on first launch"}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
