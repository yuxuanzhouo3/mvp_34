"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sun, Moon } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export function ThemeSwitcher() {
  const { setTheme, theme } = useTheme();
  const { currentLanguage } = useLanguage();
  const isDarkMode = theme === "dark";

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="h-7 w-7 p-0 text-foreground hover:bg-accent flex-shrink-0"
          >
            {isDarkMode ? (
              <Sun className="w-3.5 h-3.5" />
            ) : (
              <Moon className="w-3.5 h-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {isDarkMode
            ? (currentLanguage === "zh" ? "切换到亮色模式" : "Switch to light mode")
            : (currentLanguage === "zh" ? "切换到暗色模式" : "Switch to dark mode")
          }
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
