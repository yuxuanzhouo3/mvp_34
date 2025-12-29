"use client";

import { useLanguage } from "@/context/LanguageContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Hash, MessageCircle, Tag } from "lucide-react";

interface WechatConfigProps {
  name: string;
  appId: string;
  version: string;
  onNameChange: (value: string) => void;
  onAppIdChange: (value: string) => void;
  onVersionChange: (value: string) => void;
}

export function WechatConfig({
  name,
  appId,
  version,
  onNameChange,
  onAppIdChange,
  onVersionChange,
}: WechatConfigProps) {
  const { currentLanguage } = useLanguage();

  const validateAppId = (value: string) => {
    // WeChat AppID format: wx followed by 16 hex characters
    const regex = /^wx[a-f0-9]{16}$/i;
    return !value || regex.test(value);
  };

  const appIdValid = validateAppId(appId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400/20 to-green-500/20 flex items-center justify-center">
          <MessageCircle className="h-5 w-5 text-green-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">
            {currentLanguage === "zh" ? "微信小程序配置" : "WeChat Mini Program Configuration"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {currentLanguage === "zh"
              ? "配置您的微信小程序基本信息"
              : "Configure your WeChat Mini Program settings"}
          </p>
        </div>
      </div>

      {/* App Name */}
      <div className="space-y-3">
        <Label htmlFor="appName" className="text-base font-medium text-foreground/80">
          {currentLanguage === "zh" ? "小程序名称" : "Mini Program Name"} <span className="text-red-500">*</span>
        </Label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-green-500 transition-colors">
            <Package className="h-5 w-5" />
          </div>
          <Input
            id="appName"
            type="text"
            placeholder={currentLanguage === "zh" ? "输入小程序名称" : "Enter mini program name"}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="h-14 pl-12 text-base rounded-xl border-2 border-border/50 bg-background/50 backdrop-blur-sm focus:border-green-500 focus:ring-4 focus:ring-green-500/20 transition-all duration-200"
          />
        </div>
      </div>

      {/* AppID */}
      <div className="space-y-3">
        <Label htmlFor="appId" className="text-base font-medium text-foreground/80">
          {currentLanguage === "zh" ? "AppID" : "AppID"} <span className="text-red-500">*</span>
        </Label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-green-500 transition-colors">
            <Hash className="h-5 w-5" />
          </div>
          <Input
            id="appId"
            type="text"
            placeholder="wx1234567890abcdef"
            value={appId}
            onChange={(e) => onAppIdChange(e.target.value)}
            className={`h-14 pl-12 text-base rounded-xl border-2 bg-background/50 backdrop-blur-sm transition-all duration-200 ${
              appIdValid
                ? "border-border/50 focus:border-green-500 focus:ring-4 focus:ring-green-500/20"
                : "border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/20"
            }`}
          />
        </div>
        {!appIdValid && (
          <p className="text-xs text-red-500">
            {currentLanguage === "zh"
              ? "AppID 格式不正确，应为 wx + 16位十六进制字符"
              : "Invalid format. Should be wx + 16 hex characters"}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {currentLanguage === "zh"
            ? "在微信公众平台获取的小程序 AppID"
            : "Get your AppID from WeChat Mini Program Admin Console"}
        </p>
      </div>

      {/* Version */}
      <div className="space-y-3">
        <Label htmlFor="version" className="text-base font-medium text-foreground/80">
          {currentLanguage === "zh" ? "版本号" : "Version"} <span className="text-red-500">*</span>
        </Label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-green-500 transition-colors">
            <Tag className="h-5 w-5" />
          </div>
          <Input
            id="version"
            type="text"
            placeholder="1.0.0"
            value={version}
            onChange={(e) => onVersionChange(e.target.value)}
            className="h-14 pl-12 text-base rounded-xl border-2 border-border/50 bg-background/50 backdrop-blur-sm focus:border-green-500 focus:ring-4 focus:ring-green-500/20 transition-all duration-200"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {currentLanguage === "zh"
            ? "小程序版本号，如 1.0.0"
            : "Mini Program version, e.g. 1.0.0"}
        </p>
      </div>

      {/* Info Box */}
      <div className="rounded-xl bg-green-500/5 border border-green-500/20 p-4">
        <h4 className="font-medium text-green-600 mb-2">
          {currentLanguage === "zh" ? "注意事项" : "Important Notes"}
        </h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>
            {currentLanguage === "zh"
              ? "• 小程序图标需要在微信公众平台后台设置"
              : "• Mini Program icon must be set in WeChat Admin Console"}
          </li>
          <li>
            {currentLanguage === "zh"
              ? "• 内嵌的网页 URL 必须在小程序后台配置为业务域名"
              : "• The embedded URL must be configured as a business domain"}
          </li>
          <li>
            {currentLanguage === "zh"
              ? "• 所有内嵌网页必须使用 HTTPS 协议"
              : "• All embedded pages must use HTTPS protocol"}
          </li>
          <li>
            {currentLanguage === "zh"
              ? "• 下载后需要使用微信开发者工具打开并上传"
              : "• After download, use WeChat DevTools to open and upload"}
          </li>
        </ul>
      </div>
    </div>
  );
}
