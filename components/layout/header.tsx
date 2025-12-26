"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeSwitcher } from "./theme-switcher";
import { Menu, X, Box, Crown, LogIn, Layers } from "lucide-react";
import { useState } from "react";

export function Header() {
  const { t, currentLanguage } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/", label: t("nav.home") },
    { href: "/generate", label: t("nav.generate") },
    { href: "/builds", label: currentLanguage === "zh" ? "构建列表" : "Builds" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/90 backdrop-blur-xl shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        {/* Left: Logo & Navigation */}
        <div className="flex items-center gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative flex h-9 w-9 items-center justify-center">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 opacity-90 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 blur-lg opacity-30 group-hover:opacity-50 transition-opacity" />
              <Box className="relative h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 bg-clip-text text-transparent">
              MornClient
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-all"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5">
          {/* Settings Group */}
          <div className="flex items-center gap-0.5">
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-5 bg-border mx-2" />

          {/* Auth Group - Desktop */}
          <div className="hidden md:flex items-center gap-2">
            {/* Subscription Button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-2 text-amber-600 dark:text-amber-400 hover:text-amber-500 hover:bg-amber-500/10"
            >
              <Crown className="h-4 w-4" />
              <span className="text-sm font-medium">
                {currentLanguage === "zh" ? "订阅" : "Subscribe"}
              </span>
            </Button>

            {/* Login Button */}
            <Button
              size="sm"
              className="h-9 px-4 gap-2 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:from-cyan-400 hover:via-blue-400 hover:to-purple-500 text-white border-0 shadow-lg shadow-cyan-500/20 hover:shadow-xl hover:shadow-cyan-500/30 transition-all"
            >
              <LogIn className="h-4 w-4" />
              <span className="font-medium">{t("nav.login")}</span>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border/50 bg-background/98 backdrop-blur-xl">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="py-3 px-4 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-all"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}

            <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border/50">
              {/* Subscription Button - Mobile */}
              <Button
                variant="outline"
                size="sm"
                className="h-11 gap-2 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-xl"
              >
                <Crown className="h-4 w-4" />
                <span>{currentLanguage === "zh" ? "订阅会员" : "Subscribe"}</span>
              </Button>

              {/* Login Button - Mobile */}
              <Button
                size="sm"
                className="h-11 gap-2 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 text-white rounded-xl"
              >
                <LogIn className="h-4 w-4" />
                <span>{t("nav.login")}</span>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
