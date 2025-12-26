"use client";

import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Languages, Check } from "lucide-react";

export function LanguageSwitcher() {
  const { currentLanguage, setCurrentLanguage } = useLanguage();

  const languages = [
    { code: "zh", label: "中文" },
    { code: "en", label: "English" },
  ] as const;

  const currentLabel = currentLanguage === "zh" ? "中文" : "EN";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-2.5 gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Languages className="h-4 w-4" />
          <span className="text-xs font-medium">{currentLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[100px]">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setCurrentLanguage(lang.code)}
            className="flex items-center justify-between gap-3"
          >
            <span>{lang.label}</span>
            {currentLanguage === lang.code && (
              <Check className="h-4 w-4 text-cyan-500" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
