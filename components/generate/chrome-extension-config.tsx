"use client";

import { useState, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useUploadConfig } from "@/hooks/useUploadConfig";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Chrome, Hash, FileText, AlertCircle } from "lucide-react";

interface ChromeExtensionConfigProps {
  name: string;
  versionName: string;
  description: string;
  onNameChange: (value: string) => void;
  onVersionNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onIconChange: (file: File | null) => void;
}

export function ChromeExtensionConfig({
  name,
  versionName,
  description,
  onNameChange,
  onVersionNameChange,
  onDescriptionChange,
  onIconChange,
}: ChromeExtensionConfigProps) {
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

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500/20 to-green-500/20 flex items-center justify-center">
          <Chrome className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-semibold">
            {currentLanguage === "zh" ? "Chrome 扩展配置" : "Chrome Extension Configuration"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {currentLanguage === "zh"
              ? "配置您的 Chrome 浏览器扩展基本信息"
              : "Configure your Chrome browser extension settings"}
          </p>
        </div>
      </div>

      {/* App Name & Icon Row */}
      <div className="flex flex-col md:flex-row gap-4 sm:gap-6">
        {/* App Icon */}
        <div className="shrink-0">
          <Label className="text-base font-medium text-foreground/80 mb-3 block">
            {currentLanguage === "zh" ? "扩展图标" : "Extension Icon"}
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
              <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-border/50 shadow-lg ring-4 ring-blue-500/10">
                <img
                  src={iconPreview}
                  alt="Extension icon preview"
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
            <label className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 border-dashed border-border/50 hover:border-blue-500 cursor-pointer transition-all duration-200 bg-background/50 hover:bg-blue-500/5 group">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500/20 to-green-500/20 flex items-center justify-center mb-1 group-hover:from-blue-500/30 group-hover:to-green-500/30 transition-colors">
                <Upload className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
              </div>
              <span className="text-xs text-muted-foreground group-hover:text-blue-500 transition-colors">
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
                ? `建议 128x128 PNG (最大 ${maxImageUploadMB}MB)`
                : `Recommended: 128x128 PNG (max ${maxImageUploadMB}MB)`}
            </p>
          )}
        </div>

        {/* Extension Name */}
        <div className="flex-1 space-y-3">
          <Label htmlFor="extensionName" className="text-base font-medium text-foreground/80">
            {currentLanguage === "zh" ? "扩展名称" : "Extension Name"} <span className="text-red-500">*</span>
          </Label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-blue-500 transition-colors">
              <Chrome className="h-5 w-5" />
            </div>
            <Input
              id="extensionName"
              type="text"
              placeholder={currentLanguage === "zh" ? "输入扩展名称" : "Enter extension name"}
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              className="h-12 sm:h-14 pl-10 sm:pl-12 text-base rounded-xl border-2 border-border/50 bg-background/50 backdrop-blur-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all duration-200"
            />
          </div>
        </div>
      </div>

      {/* Version */}
      <div className="space-y-3">
        <Label htmlFor="versionName" className="text-base font-medium text-foreground/80">
          {currentLanguage === "zh" ? "版本号" : "Version"} <span className="text-red-500">*</span>
        </Label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-blue-500 transition-colors">
            <Hash className="h-5 w-5" />
          </div>
          <Input
            id="versionName"
            type="text"
            placeholder="1.0.0"
            value={versionName}
            onChange={(e) => onVersionNameChange(e.target.value)}
            className="h-12 sm:h-14 pl-10 sm:pl-12 text-base rounded-xl border-2 border-border/50 bg-background/50 backdrop-blur-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all duration-200"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {currentLanguage === "zh"
            ? "版本号格式 (x.y.z)"
            : "Version format (x.y.z)"}
        </p>
      </div>

      {/* Description */}
      <div className="space-y-3">
        <Label htmlFor="description" className="text-base font-medium text-foreground/80">
          {currentLanguage === "zh" ? "扩展描述" : "Description"} <span className="text-red-500">*</span>
        </Label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-blue-500 transition-colors">
            <FileText className="h-5 w-5" />
          </div>
          <Input
            id="description"
            type="text"
            placeholder={currentLanguage === "zh" ? "输入扩展描述" : "Enter extension description"}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="h-12 sm:h-14 pl-10 sm:pl-12 text-base rounded-xl border-2 border-border/50 bg-background/50 backdrop-blur-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all duration-200"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {currentLanguage === "zh"
            ? "简短描述扩展的功能"
            : "Brief description of the extension's functionality"}
        </p>
      </div>
    </div>
  );
}
