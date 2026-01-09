"use client";

import { useState, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useUploadConfig } from "@/hooks/useUploadConfig";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, Package, Hash, FileText, Apple, AlertCircle } from "lucide-react";

interface iOSConfigProps {
  name: string;
  bundleId: string;
  versionString: string;
  buildNumber: string;
  privacyPolicy: string;
  onNameChange: (value: string) => void;
  onBundleIdChange: (value: string) => void;
  onVersionStringChange: (value: string) => void;
  onBuildNumberChange: (value: string) => void;
  onPrivacyPolicyChange: (value: string) => void;
  onIconChange: (file: File | null) => void;
}

export function IOSConfig({
  name,
  bundleId,
  versionString,
  buildNumber,
  privacyPolicy,
  onNameChange,
  onBundleIdChange,
  onVersionStringChange,
  onBuildNumberChange,
  onPrivacyPolicyChange,
  onIconChange,
}: iOSConfigProps) {
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

  const validateBundleId = (value: string) => {
    // Bundle ID should follow com.xxx.xxx format
    const regex = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i;
    return regex.test(value);
  };

  const bundleIdValid = !bundleId || validateBundleId(bundleId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-500/20 to-gray-600/20 flex items-center justify-center">
          <Apple className="h-5 w-5 text-gray-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">
            {currentLanguage === "zh" ? "iOS 应用配置" : "iOS App Configuration"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {currentLanguage === "zh"
              ? "配置您的 iOS 应用基本信息"
              : "Configure your iOS app settings"}
          </p>
        </div>
      </div>

      {/* App Name & Icon Row */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* App Icon */}
        <div className="shrink-0">
          <Label className="text-base font-medium text-foreground/80 mb-3 block">
            {currentLanguage === "zh" ? "应用图标" : "App Icon"}
          </Label>
          {!iconUploadEnabled ? (
            <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-border/30 bg-muted/30 flex flex-col items-center justify-center">
              <AlertCircle className="h-5 w-5 text-muted-foreground/50 mb-1" />
              <span className="text-xs text-muted-foreground/50">
                {currentLanguage === "zh" ? "已禁用" : "Disabled"}
              </span>
            </div>
          ) : iconPreview ? (
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-border/50 shadow-lg ring-4 ring-gray-500/10">
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
            <label className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 border-dashed border-border/50 hover:border-gray-500 cursor-pointer transition-all duration-200 bg-background/50 hover:bg-gray-500/5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-500/20 to-gray-600/20 flex items-center justify-center mb-1 group-hover:from-gray-500/30 group-hover:to-gray-600/30 transition-colors">
                <Upload className="h-5 w-5 text-gray-500" />
              </div>
              <span className="text-xs text-muted-foreground group-hover:text-gray-500 transition-colors">
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
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-gray-500 transition-colors">
              <Package className="h-5 w-5" />
            </div>
            <Input
              id="appName"
              type="text"
              placeholder={currentLanguage === "zh" ? "输入应用名称" : "Enter app name"}
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              className="h-14 pl-12 text-base rounded-xl border-2 border-border/50 bg-background/50 backdrop-blur-sm focus:border-gray-500 focus:ring-4 focus:ring-gray-500/20 transition-all duration-200"
            />
          </div>
        </div>
      </div>

      {/* Bundle ID */}
      <div className="space-y-3">
        <Label htmlFor="bundleId" className="text-base font-medium text-foreground/80">
          Bundle ID <span className="text-red-500">*</span>
        </Label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-gray-500 transition-colors">
            <Hash className="h-5 w-5" />
          </div>
          <Input
            id="bundleId"
            type="text"
            placeholder="com.example.myapp"
            value={bundleId}
            onChange={(e) => onBundleIdChange(e.target.value)}
            className={`h-14 pl-12 text-base rounded-xl border-2 bg-background/50 backdrop-blur-sm transition-all duration-200 ${
              bundleIdValid
                ? "border-border/50 focus:border-gray-500 focus:ring-4 focus:ring-gray-500/20"
                : "border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/20"
            }`}
          />
        </div>
        {!bundleIdValid && (
          <p className="text-xs text-red-500">
            {currentLanguage === "zh"
              ? "Bundle ID 格式不正确，应为 com.xxx.xxx"
              : "Invalid format. Should be com.xxx.xxx"}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {currentLanguage === "zh"
            ? "唯一标识符，用于 App Store 发布"
            : "Unique identifier for App Store publishing"}
        </p>
      </div>

      {/* Version String & Build Number Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Version String */}
        <div className="space-y-3">
          <Label htmlFor="versionString" className="text-base font-medium text-foreground/80">
            {currentLanguage === "zh" ? "版本号" : "Version"} <span className="text-red-500">*</span>
          </Label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-gray-500 transition-colors">
              <Hash className="h-5 w-5" />
            </div>
            <Input
              id="versionString"
              type="text"
              placeholder="1.0.0"
              value={versionString}
              onChange={(e) => onVersionStringChange(e.target.value)}
              className="h-14 pl-12 text-base rounded-xl border-2 border-border/50 bg-background/50 backdrop-blur-sm focus:border-gray-500 focus:ring-4 focus:ring-gray-500/20 transition-all duration-200"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {currentLanguage === "zh"
              ? "显示给用户的版本号 (x.y.z)"
              : "Version shown to users (x.y.z)"}
          </p>
        </div>

        {/* Build Number */}
        <div className="space-y-3">
          <Label htmlFor="buildNumber" className="text-base font-medium text-foreground/80">
            {currentLanguage === "zh" ? "构建号" : "Build Number"} <span className="text-red-500">*</span>
          </Label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-gray-500 transition-colors">
              <Hash className="h-5 w-5" />
            </div>
            <Input
              id="buildNumber"
              type="number"
              min="1"
              placeholder={currentLanguage === "zh" ? "例如: 1, 2, 3" : "e.g. 1, 2, 3"}
              value={buildNumber}
              onChange={(e) => onBuildNumberChange(e.target.value)}
              className="h-14 pl-12 text-base rounded-xl border-2 border-border/50 bg-background/50 backdrop-blur-sm focus:border-gray-500 focus:ring-4 focus:ring-gray-500/20 transition-all duration-200"
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
            className="min-h-[200px] pl-12 text-base rounded-xl border-2 border-border/50 bg-background/50 backdrop-blur-sm focus:border-gray-500 focus:ring-4 focus:ring-gray-500/20 transition-all duration-200 resize-none"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {currentLanguage === "zh"
            ? "隐私政策将显示在应用内的隐私政策页面"
            : "Privacy policy will be displayed in the app's privacy policy page"}
        </p>
      </div>
    </div>
  );
}
