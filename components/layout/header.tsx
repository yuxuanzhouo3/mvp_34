"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeSwitcher } from "./theme-switcher";
import { UserMenu } from "@/components/auth";
import { SubscriptionModal } from "@/components/subscription/subscription-modal";
import { Menu, X, Box, Crown, LogIn, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function Header() {
  const { t, currentLanguage } = useLanguage();
  const { user, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [userPlan, setUserPlan] = useState<string>("free");
  const [userPlanExp, setUserPlanExp] = useState<string | undefined>(undefined);

  // 获取用户当前套餐
  const fetchUserPlan = async () => {
    if (!user?.id) {
      setUserPlan("free");
      setUserPlanExp(undefined);
      return;
    }

    try {
      const supabase = createClient();
      if (!supabase) {
        setUserPlan("free");
        setUserPlanExp(undefined);
        return;
      }

      const { data } = await supabase
        .from("user_wallets")
        .select("plan, plan_exp")
        .eq("user_id", user.id)
        .single();

      setUserPlan(data?.plan?.toLowerCase() || "free");
      setUserPlanExp(data?.plan_exp || undefined);
    } catch (error) {
      console.error("Failed to fetch user plan:", error);
      setUserPlan("free");
      setUserPlanExp(undefined);
    }
  };

  useEffect(() => {
    fetchUserPlan();
  }, [user?.id]);

  // 监听支付完成后的刷新事件
  useEffect(() => {
    const handleQuotaRefresh = () => {
      console.log("[Header] quota:refresh event received, refreshing user plan...");
      fetchUserPlan();
    };

    window.addEventListener("quota:refresh", handleQuotaRefresh);

    // 检查 sessionStorage 中的支付完成标记
    if (typeof window !== "undefined") {
      const paymentCompleted = sessionStorage.getItem("payment_completed");
      if (paymentCompleted === "true") {
        sessionStorage.removeItem("payment_completed");
        fetchUserPlan();
      }
    }

    return () => window.removeEventListener("quota:refresh", handleQuotaRefresh);
  }, [user?.id]);

  // 监听来自 UserMenu 的订阅弹窗事件
  useEffect(() => {
    const handleOpenSubscription = () => setSubscriptionOpen(true);
    window.addEventListener("open-subscription-modal", handleOpenSubscription);
    return () => window.removeEventListener("open-subscription-modal", handleOpenSubscription);
  }, []);

  const navLinks = [
    { href: "/", label: t("nav.home") },
    { href: "/generate", label: t("nav.generate") },
    { href: "/builds", label: currentLanguage === "zh" ? "构建列表" : "Builds" },
  ];

  return (
    <>
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
              onClick={() => setSubscriptionOpen(true)}
            >
              <Crown className="h-4 w-4" />
              <span className="text-sm font-medium">
                {currentLanguage === "zh" ? "订阅" : "Subscribe"}
              </span>
            </Button>

            {/* Auth State */}
            {loading ? (
              <div className="h-9 w-9 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : user ? (
              <UserMenu />
            ) : (
              <Link href="/auth/login">
                <Button
                  size="sm"
                  className="h-9 px-4 gap-2 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:from-cyan-400 hover:via-blue-400 hover:to-purple-500 text-white border-0 shadow-lg shadow-cyan-500/20 hover:shadow-xl hover:shadow-cyan-500/30 transition-all"
                >
                  <LogIn className="h-4 w-4" />
                  <span className="font-medium">{t("nav.login")}</span>
                </Button>
              </Link>
            )}
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
                onClick={() => {
                  setSubscriptionOpen(true);
                  setMobileMenuOpen(false);
                }}
              >
                <Crown className="h-4 w-4" />
                <span>{currentLanguage === "zh" ? "订阅会员" : "Subscribe"}</span>
              </Button>

              {/* Auth State - Mobile */}
              {loading ? (
                <div className="h-11 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : user ? (
                <div className="flex items-center justify-center py-2">
                  <UserMenu />
                </div>
              ) : (
                <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    size="sm"
                    className="w-full h-11 gap-2 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 text-white rounded-xl"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>{t("nav.login")}</span>
                  </Button>
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>

    {/* Subscription Modal */}
    <SubscriptionModal
      open={subscriptionOpen}
      onOpenChange={setSubscriptionOpen}
      userId={user?.id}
      currentPlan={userPlan}
      currentPlanExp={userPlanExp}
    />
    </>
  );
}
