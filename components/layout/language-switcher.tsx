"use client";

import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Languages } from "lucide-react";

export function LanguageSwitcher() {
  const { currentLanguage, setCurrentLanguage } = useLanguage();

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentLanguage(currentLanguage === "en" ? "zh" : "en")}
            className="h-7 w-7 p-0 text-foreground hover:bg-accent flex-shrink-0"
          >
            <Languages className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {currentLanguage === "zh" ? "切换到英文" : "Switch to Chinese"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
