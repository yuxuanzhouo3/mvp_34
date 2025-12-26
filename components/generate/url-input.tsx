"use client";

import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Globe, AlertCircle, CheckCircle2 } from "lucide-react";

interface UrlInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function UrlInput({ value, onChange }: UrlInputProps) {
  const { t, currentLanguage } = useLanguage();
  const [isValid, setIsValid] = useState<boolean | null>(null);

  const validateUrl = (url: string) => {
    if (!url) {
      setIsValid(null);
      return;
    }
    try {
      new URL(url);
      setIsValid(true);
    } catch {
      setIsValid(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    validateUrl(newValue);
  };

  return (
    <div className="space-y-3">
      <Label htmlFor="url" className="text-base font-medium text-foreground/80">
        {t("generate.url.label")}
      </Label>
      <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-cyan-500 transition-colors">
          <Globe className="h-5 w-5" />
        </div>
        <Input
          id="url"
          type="url"
          placeholder={t("generate.url.placeholder")}
          value={value}
          onChange={handleChange}
          className={`h-14 pl-12 pr-12 text-base rounded-xl border-2 bg-background/50 backdrop-blur-sm transition-all duration-200 ${
            isValid === true
              ? "border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/20"
              : isValid === false
              ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
              : "border-border/50 focus:border-cyan-500 focus:ring-cyan-500/20"
          } focus:ring-4`}
        />
        {isValid !== null && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            {isValid ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500" />
            )}
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {isValid === false ? (
          <span className="text-red-500">
            {currentLanguage === "zh"
              ? "请输入有效的URL地址，需包含 https://"
              : "Please enter a valid URL with https://"}
          </span>
        ) : (
          t("generate.url.helper")
        )}
      </p>
    </div>
  );
}
