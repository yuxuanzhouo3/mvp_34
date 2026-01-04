"use client";

import { useState, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, Package, Hash, FileText, Hexagon } from "lucide-react";

interface HarmonyOSConfigProps {
  name: string;
  bundleName: string;
  versionName: string;
  versionCode: string;
  privacyPolicy: string;
  onNameChange: (value: string) => void;
  onBundleNameChange: (value: string) => void;
  onVersionNameChange: (value: string) => void;
  onVersionCodeChange: (value: string) => void;
  onPrivacyPolicyChange: (value: string) => void;
  onIconChange: (file: File | null) => void;
}

export function HarmonyOSConfig({
  name,
  bundleName,
  versionName,
  versionCode,
  privacyPolicy,
  onNameChange,
  onBundleNameChange,
  onVersionNameChange,
  onVersionCodeChange,
  onPrivacyPolicyChange,
  onIconChange,
}: HarmonyOSConfigProps) {
  const { currentLanguage } = useLanguage();
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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
    onIconChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 鸿蒙包名保留字
  const RESERVED_WORDS = ['oh', 'ohos', 'harmony', 'harmonyos', 'openharmony', 'system'];

  const validateBundleName = (value: string): { valid: boolean; error?: string } => {
    // 长度检查：7~128个字符
    if (value.length < 7 || value.length > 128) {
      return { valid: false, error: currentLanguage === "zh"
        ? "包名长度必须为7~128个字符"
        : "Bundle name must be 7-128 characters" };
    }

    // 不允许连续点号
    if (/\.\./.test(value)) {
      return { valid: false, error: currentLanguage === "zh"
        ? "包名不允许连续的点号"
        : "Consecutive dots are not allowed" };
    }

    const segments = value.split('.');

    // 至少三段
    if (segments.length < 3) {
      return { valid: false, error: currentLanguage === "zh"
        ? "包名必须至少包含三段（如 com.example.app）"
        : "Bundle name must have at least 3 segments (e.g., com.example.app)" };
    }

    // 保留字检查
    for (const segment of segments) {
      if (RESERVED_WORDS.includes(segment.toLowerCase())) {
        return { valid: false, error: currentLanguage === "zh"
          ? `包名不能包含保留字 "${segment}" 作为独立段`
          : `Reserved word "${segment}" cannot be used as a standalone segment` };
      }
    }

    // 检查每一段
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      if (segment.length === 0) {
        return { valid: false, error: currentLanguage === "zh"
          ? "包名段不能为空"
          : "Segment cannot be empty" };
      }

      // 每段只能包含字母、数字、下划线
      if (!/^[a-zA-Z0-9_]+$/.test(segment)) {
        return { valid: false, error: currentLanguage === "zh"
          ? "每段只能包含英文字母、数字和下划线"
          : "Each segment can only contain letters, numbers, and underscores" };
      }

      // 首段以英文字母开头
      if (i === 0 && !/^[a-zA-Z]/.test(segment)) {
        return { valid: false, error: currentLanguage === "zh"
          ? "首段必须以英文字母开头"
          : "First segment must start with a letter" };
      }

      // 非首段以数字或英文字母开头
      if (i > 0 && !/^[a-zA-Z0-9]/.test(segment)) {
        return { valid: false, error: currentLanguage === "zh"
          ? "非首段必须以字母或数字开头"
          : "Non-first segments must start with a letter or number" };
      }

      // 每一段以数字或者英文字母结尾
      if (!/[a-zA-Z0-9]$/.test(segment)) {
        return { valid: false, error: currentLanguage === "zh"
          ? "每段必须以字母或数字结尾"
          : "Each segment must end with a letter or number" };
      }
    }

    return { valid: true };
  };

  const bundleNameValidation = bundleName ? validateBundleName(bundleName) : { valid: true };
  const bundleNameValid = bundleNameValidation.valid;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
          <Hexagon className="h-5 w-5 text-red-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">
            {currentLanguage === "zh" ? "HarmonyOS 应用配置" : "HarmonyOS App Configuration"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {currentLanguage === "zh"
              ? "配置您的鸿蒙应用基本信息"
              : "Configure your HarmonyOS app settings"}
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
          {iconPreview ? (
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-border/50 shadow-lg ring-4 ring-red-500/10">
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
            <label className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 border-dashed border-border/50 hover:border-red-500 cursor-pointer transition-all duration-200 bg-background/50 hover:bg-red-500/5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center mb-1 group-hover:from-red-500/30 group-hover:to-orange-500/30 transition-colors">
                <Upload className="h-5 w-5 text-red-500" />
              </div>
              <span className="text-xs text-muted-foreground group-hover:text-red-500 transition-colors">
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
          <p className="text-xs text-muted-foreground mt-2">
            {currentLanguage === "zh" ? "建议 1024x1024 PNG" : "Recommended: 1024x1024 PNG"}
          </p>
        </div>

        {/* App Name */}
        <div className="flex-1 space-y-3">
          <Label htmlFor="harmonyAppName" className="text-base font-medium text-foreground/80">
            {currentLanguage === "zh" ? "应用名称" : "App Name"} <span className="text-red-500">*</span>
          </Label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-red-500 transition-colors">
              <Package className="h-5 w-5" />
            </div>
            <Input
              id="harmonyAppName"
              type="text"
              placeholder={currentLanguage === "zh" ? "输入应用名称" : "Enter app name"}
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              className="h-14 pl-12 text-base rounded-xl border-2 border-border/50 bg-background/50 backdrop-blur-sm focus:border-red-500 focus:ring-4 focus:ring-red-500/20 transition-all duration-200"
            />
          </div>
        </div>
      </div>

      {/* Bundle Name */}
      <div className="space-y-3">
        <Label htmlFor="harmonyBundleName" className="text-base font-medium text-foreground/80">
          {currentLanguage === "zh" ? "包名" : "Bundle Name"} <span className="text-red-500">*</span>
        </Label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-red-500 transition-colors">
            <Hash className="h-5 w-5" />
          </div>
          <Input
            id="harmonyBundleName"
            type="text"
            placeholder="com.example_harmony.app"
            value={bundleName}
            onChange={(e) => onBundleNameChange(e.target.value)}
            className={`h-14 pl-12 text-base rounded-xl border-2 bg-background/50 backdrop-blur-sm transition-all duration-200 ${
              bundleNameValid
                ? "border-border/50 focus:border-red-500 focus:ring-4 focus:ring-red-500/20"
                : "border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/20"
            }`}
          />
        </div>
        {!bundleNameValid && bundleNameValidation.error && (
          <p className="text-xs text-red-500">{bundleNameValidation.error}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {currentLanguage === "zh"
            ? "格式：至少三段，如 com.example.app（7~128字符，不可含保留字 harmony/ohos/system 等）"
            : "Format: at least 3 segments, e.g., com.example.app (7-128 chars, no reserved words like harmony/ohos/system)"}
        </p>
      </div>

      {/* Version Name & Version Code Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Version Name */}
        <div className="space-y-3">
          <Label htmlFor="harmonyVersionName" className="text-base font-medium text-foreground/80">
            {currentLanguage === "zh" ? "版本号" : "Version"} <span className="text-red-500">*</span>
          </Label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-red-500 transition-colors">
              <Hash className="h-5 w-5" />
            </div>
            <Input
              id="harmonyVersionName"
              type="text"
              placeholder="1.0.0"
              value={versionName}
              onChange={(e) => onVersionNameChange(e.target.value)}
              className="h-14 pl-12 text-base rounded-xl border-2 border-border/50 bg-background/50 backdrop-blur-sm focus:border-red-500 focus:ring-4 focus:ring-red-500/20 transition-all duration-200"
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
          <Label htmlFor="harmonyVersionCode" className="text-base font-medium text-foreground/80">
            {currentLanguage === "zh" ? "构建号" : "Build Number"} <span className="text-red-500">*</span>
          </Label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-red-500 transition-colors">
              <Hash className="h-5 w-5" />
            </div>
            <Input
              id="harmonyVersionCode"
              type="number"
              min="1"
              placeholder={currentLanguage === "zh" ? "例如: 1, 2, 3" : "e.g. 1, 2, 3"}
              value={versionCode}
              onChange={(e) => onVersionCodeChange(e.target.value)}
              className="h-14 pl-12 text-base rounded-xl border-2 border-border/50 bg-background/50 backdrop-blur-sm focus:border-red-500 focus:ring-4 focus:ring-red-500/20 transition-all duration-200"
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
        <Label htmlFor="harmonyPrivacyPolicy" className="text-base font-medium text-foreground/80">
          {currentLanguage === "zh" ? "隐私政策" : "Privacy Policy"}
        </Label>
        <div className="relative">
          <div className="absolute left-4 top-4 text-muted-foreground">
            <FileText className="h-5 w-5" />
          </div>
          <Textarea
            id="harmonyPrivacyPolicy"
            placeholder={
              currentLanguage === "zh"
                ? "输入您的隐私政策内容（支持 Markdown 格式）..."
                : "Enter your privacy policy content (Markdown supported)..."
            }
            value={privacyPolicy}
            onChange={(e) => onPrivacyPolicyChange(e.target.value)}
            className="min-h-[200px] pl-12 text-base rounded-xl border-2 border-border/50 bg-background/50 backdrop-blur-sm focus:border-red-500 focus:ring-4 focus:ring-red-500/20 transition-all duration-200 resize-none"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {currentLanguage === "zh"
            ? "隐私政策将在首次启动时弹窗显示，支持 Markdown 格式"
            : "Privacy policy will be shown on first launch, Markdown supported"}
        </p>
      </div>
    </div>
  );
}
