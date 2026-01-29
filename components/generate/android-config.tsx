"use client";

import { useState, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useUploadConfig } from "@/hooks/useUploadConfig";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, Package, Hash, FileText, Smartphone, AlertCircle } from "lucide-react";

interface AndroidConfigProps {
  name: string;
  packageName: string;
  versionName: string;
  versionCode: string;
  privacyPolicy: string;
  onNameChange: (value: string) => void;
  onPackageNameChange: (value: string) => void;
  onVersionNameChange: (value: string) => void;
  onVersionCodeChange: (value: string) => void;
  onPrivacyPolicyChange: (value: string) => void;
  onIconChange: (file: File | null) => void;
}

export function AndroidConfig({
  name,
  packageName,
  versionName,
  versionCode,
  privacyPolicy,
  onNameChange,
  onPackageNameChange,
  onVersionNameChange,
  onVersionCodeChange,
  onPrivacyPolicyChange,
  onIconChange,
}: AndroidConfigProps) {
  const { currentLanguage } = useLanguage();
  const { iconUploadEnabled, maxImageUploadMB, validateFileSize } = useUploadConfig();
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setUploadError(null);
      onIconChange(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setIconPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeIcon = () => {
    setIconPreview(null);
    setUploadError(null);
    onIconChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const validatePackageName = (value: string) => {
    // Package name should follow com.xxx.xxx format
    const regex = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i;
    return regex.test(value);
  };

  const packageNameValid = !packageName || validatePackageName(packageName);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
          <Smartphone className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-semibold">
            {currentLanguage === "zh" ? "Android 应用配置" : "Android App Configuration"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {currentLanguage === "zh"
              ? "配置您的 Android 应用基本信息"
              : "Configure your Android app settings"}
          </p>
        </div>
      </div>

      {/* App Name & Icon Row */}
      <div className="flex flex-col md:flex-row gap-4 sm:gap-6">
        {/* App Icon */}
        <div className="shrink-0">
          <Label className="text-base font-medium text-foreground/80 mb-3 block">
            {currentLanguage === "zh" ? "应用图标" : "App Icon"}
          </Label>
          {!iconUploadEnabled ? (
            <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-border/30 bg-muted/30 flex flex-col items-center justify-center">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground/50 mb-1" />
              <span className="text-xs text-muted-foreground/50">
                {currentLanguage === "zh" ? "已禁用" : "Disabled"}
              </span>
            </div>
          ) : iconPreview ? (
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-border/50 shadow-lg ring-4 ring-green-500/10">
                <img
                  src={iconPreview}
                  alt="App icon preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={removeIcon}
                className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 border-dashed border-border/50 hover:border-green-500 cursor-pointer transition-all duration-200 bg-background/50 hover:bg-green-500/5 group">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center mb-1 group-hover:from-green-500/30 group-hover:to-emerald-500/30 transition-colors">
                <Upload className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
              </div>
              <span className="text-xs text-muted-foreground group-hover:text-green-500 transition-colors">
                {currentLanguage === "zh" ? "上传" : "Upload"}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                className="hidden"
                onChange={handleIconUpload}
              />
            </label>
          )}
          {uploadError && (
            <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {uploadError}
            </p>
          )}
          {iconUploadEnabled && !uploadError && (
            <p className="text-xs text-muted-foreground mt-2">
              {currentLanguage === "zh"
                ? `建议 1024x1024 PNG (最大 ${maxImageUploadMB}MB)`
                : `Recommended: 1024x1024 PNG (max ${maxImageUploadMB}MB)`}
            </p>
          )}
        </div>

        {/* App Name */}
        <div className="flex-1 space-y-3">
          <Label htmlFor="appName" className="text-base font-medium text-foreground/80">
            {currentLanguage === "zh" ? "应用名称" : "App Name"} <span className="text-red-500">*</span>
          </Label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-green-500 transition-colors">
              <Package className="h-5 w-5" />
            </div>
            <Input
              id="appName"
              type="text"
              placeholder={currentLanguage === "zh" ? "输入应用名称" : "Enter app name"}
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              className="h-12 sm:h-14 pl-10 sm:pl-12 text-base rounded-xl border-2 border-border/50 bg-background/50 backdrop-blur-sm focus:border-green-500 focus:ring-4 focus:ring-green-500/20 transition-all duration-200"
            />
          </div>
        </div>
      </div>

      {/* Package Name */}
      <div className="space-y-3">
        <Label htmlFor="packageName" className="text-base font-medium text-foreground/80">
          {currentLanguage === "zh" ? "包名" : "Package Name"} <span className="text-red-500">*</span>
        </Label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-green-500 transition-colors">
            <Hash className="h-5 w-5" />
          </div>
          <Input
            id="packageName"
            type="text"
            placeholder="com.example.myapp"
            value={packageName}
            onChange={(e) => onPackageNameChange(e.target.value)}
            className={`h-12 sm:h-14 pl-10 sm:pl-12 text-base rounded-xl border-2 bg-background/50 backdrop-blur-sm transition-all duration-200 ${
              packageNameValid
                ? "border-border/50 focus:border-green-500 focus:ring-4 focus:ring-green-500/20"
                : "border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/20"
            }`}
          />
        </div>
        {!packageNameValid && (
          <p className="text-xs text-red-500">
            {currentLanguage === "zh"
              ? "包名格式不正确，应为 com.xxx.xxx"
              : "Invalid format. Should be com.xxx.xxx"}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {currentLanguage === "zh"
            ? "唯一标识符，用于应用商店发布"
            : "Unique identifier for app store publishing"}
        </p>
      </div>

      {/* Version Name & Version Code Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Version Name */}
        <div className="space-y-3">
          <Label htmlFor="versionName" className="text-base font-medium text-foreground/80">
            {currentLanguage === "zh" ? "版本号" : "Version"} <span className="text-red-500">*</span>
          </Label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-green-500 transition-colors">
              <Hash className="h-5 w-5" />
            </div>
            <Input
              id="versionName"
              type="text"
              placeholder="1.0.0"
              value={versionName}
              onChange={(e) => onVersionNameChange(e.target.value)}
              className="h-12 sm:h-14 pl-10 sm:pl-12 text-base rounded-xl border-2 border-border/50 bg-background/50 backdrop-blur-sm focus:border-green-500 focus:ring-4 focus:ring-green-500/20 transition-all duration-200"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {currentLanguage === "zh"
              ? "显示给用户的版本号 (x.y.z)"
              : "Version shown to users (x.y.z)"}
          </p>
        </div>

        {/* Version Code */}
        <div className="space-y-3">
          <Label htmlFor="versionCode" className="text-base font-medium text-foreground/80">
            {currentLanguage === "zh" ? "构建号" : "Build Number"} <span className="text-red-500">*</span>
          </Label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-green-500 transition-colors">
              <Hash className="h-5 w-5" />
            </div>
            <Input
              id="versionCode"
              type="number"
              min="1"
              placeholder={currentLanguage === "zh" ? "例如: 1, 2, 3" : "e.g. 1, 2, 3"}
              value={versionCode}
              onChange={(e) => onVersionCodeChange(e.target.value)}
              className="h-12 sm:h-14 pl-10 sm:pl-12 text-base rounded-xl border-2 border-border/50 bg-background/50 backdrop-blur-sm focus:border-green-500 focus:ring-4 focus:ring-green-500/20 transition-all duration-200"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {currentLanguage === "zh"
              ? "整数构建号，每次更新递增"
              : "Integer build number, increment on each update"}
          </p>
        </div>
      </div>

      {/* Privacy Policy */}
      <div className="space-y-3">
        <Label htmlFor="privacyPolicy" className="text-base font-medium text-foreground/80">
          {currentLanguage === "zh" ? "隐私政策" : "Privacy Policy"}
        </Label>
        <div className="relative">
          <div className="absolute left-4 top-4 text-muted-foreground">
            <FileText className="h-5 w-5" />
          </div>
          <Textarea
            id="privacyPolicy"
            placeholder={
              currentLanguage === "zh"
                ? "输入您的隐私政策内容（可选）..."
                : "Enter your privacy policy content (optional)..."
            }
            value={privacyPolicy}
            onChange={(e) => onPrivacyPolicyChange(e.target.value)}
            className="min-h-[200px] pl-12 text-base rounded-xl border-2 border-border/50 bg-background/50 backdrop-blur-sm focus:border-green-500 focus:ring-4 focus:ring-green-500/20 transition-all duration-200 resize-none"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {currentLanguage === "zh"
            ? "隐私政策将显示在应用内的隐私政策页面"
            : "Privacy policy will be displayed in the app's privacy policy page"}
        </p>
      </div>

      {/* Usage Instructions */}
      <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
        <h4 className="font-medium text-green-700 dark:text-green-300 mb-2">
          {currentLanguage === "zh" ? "构建说明" : "Build Instructions"}
        </h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>
            {currentLanguage === "zh"
              ? "• 构建完成后将生成 Android 源码工程压缩包"
              : "• Build generates Android source project archive"}
          </li>
          <li>
            {currentLanguage === "zh"
              ? "• 下载后需使用 Android Studio 打开工程并编译生成 APK"
              : "• Use Android Studio to open the project and build APK"}
          </li>
          <li>
            {currentLanguage === "zh"
              ? "• 源码工程可自由修改和二次开发"
              : "• Source code can be freely modified and customized"}
          </li>
        </ul>
      </div>
    </div>
  );
}
