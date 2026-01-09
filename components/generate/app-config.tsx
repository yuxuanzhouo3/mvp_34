"use client";

import { useState, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useUploadConfig } from "@/hooks/useUploadConfig";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, Package, AlertCircle } from "lucide-react";

interface AppConfigProps {
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onIconChange: (file: File | null) => void;
}

export function AppConfig({
  name,
  description,
  onNameChange,
  onDescriptionChange,
  onIconChange,
}: AppConfigProps) {
  const { t, currentLanguage } = useLanguage();
  const { iconUploadEnabled, maxImageUploadMB, validateFileSize } = useUploadConfig();
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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
    onIconChange(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* App Name & Icon Row */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* App Icon */}
        <div className="shrink-0">
          <Label className="text-base font-medium text-foreground/80 mb-3 block">
            {t("generate.icon.label")}
          </Label>
          {!iconUploadEnabled ? (
            <div className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 border-dashed border-border/30 bg-muted/30">
              <AlertCircle className="w-6 h-6 text-muted-foreground/50" />
              <span className="text-xs text-muted-foreground/50 mt-1">
                {currentLanguage === "zh" ? "已禁用" : "Disabled"}
              </span>
            </div>
          ) : iconPreview ? (
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-border/50 shadow-lg ring-4 ring-cyan-500/10">
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
            <label className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 border-dashed border-border/50 hover:border-cyan-500 cursor-pointer transition-all duration-200 bg-background/50 hover:bg-cyan-500/5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mb-1 group-hover:from-cyan-500/30 group-hover:to-blue-500/30 transition-colors">
                <Upload className="h-5 w-5 text-cyan-500" />
              </div>
              <span className="text-xs text-muted-foreground group-hover:text-cyan-500 transition-colors">
                {t("generate.icon.upload")}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleIconUpload}
              />
            </label>
          )}
          {uploadError && (
            <p className="text-xs text-red-500 flex items-center gap-1 mt-2">
              <AlertCircle className="h-3 w-3" />
              {uploadError}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {iconUploadEnabled
              ? (currentLanguage === "zh"
                  ? `推荐 512x512 像素 (最大 ${maxImageUploadMB}MB)`
                  : `Recommended 512x512px (max ${maxImageUploadMB}MB)`)
              : t("generate.icon.recommend")}
          </p>
        </div>

        {/* App Name */}
        <div className="flex-1 space-y-3">
          <Label htmlFor="name" className="text-base font-medium text-foreground/80">
            {t("generate.name.label")}
          </Label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-cyan-500 transition-colors">
              <Package className="h-5 w-5" />
            </div>
            <Input
              id="name"
              type="text"
              placeholder={t("generate.name.placeholder")}
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              className="h-14 pl-12 text-base rounded-xl border-2 border-border/50 bg-background/50 backdrop-blur-sm focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/20 transition-all duration-200"
            />
          </div>
        </div>
      </div>

      {/* App Description */}
      <div className="space-y-3">
        <Label htmlFor="description" className="text-base font-medium text-foreground/80">
          {t("generate.desc.label")}
        </Label>
        <Textarea
          id="description"
          placeholder={t("generate.desc.placeholder")}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          className="min-h-[120px] text-base rounded-xl border-2 border-border/50 bg-background/50 backdrop-blur-sm focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/20 transition-all duration-200 resize-none"
        />
      </div>
    </div>
  );
}
