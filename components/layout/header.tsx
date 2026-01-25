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
import { useIsMobile } from "@/hooks/use-mobile";
import { IS_DOMESTIC_VERSION } from "@/config";

export function Header() {
  const { t, currentLanguage } = useLanguage();
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [userPlan, setUserPlan] = useState<string>("free");
  const [userPlanExp, setUserPlanExp] = useState<string | undefined>(undefined);

  const fetchUserPlan = async () => {
    if (!user?.id) { setUserPlan("free"); setUserPlanExp(undefined); return; }

    // 国内版：从国内 API 获取
    if (IS_DOMESTIC_VERSION) {
      try {
        const res = await fetch("/api/domestic/auth/me", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setUserPlan(data.user?.metadata?.plan?.toLowerCase() || "free");
          setUserPlanExp(data.user?.metadata?.plan_exp || undefined);
        } else {
          setUserPlan("free"); setUserPlanExp(undefined);
        }
      } catch { setUserPlan("free"); setUserPlanExp(undefined); }
      return;
    }

    // 国际版：使用 Supabase
    try {
      const supabase = createClient();
      if (!supabase) { setUserPlan("free"); setUserPlanExp(undefined); return; }
      const { data } = await supabase.from("user_wallets").select("plan, plan_exp").eq("user_id", user.id).single();
      setUserPlan(data?.plan?.toLowerCase() || "free");
      setUserPlanExp(data?.plan_exp || undefined);
    } catch (error) { console.error("Failed to fetch user plan:", error); setUserPlan("free"); setUserPlanExp(undefined); }
  };

  useEffect(() => { fetchUserPlan(); }, [user?.id]);

  useEffect(() => {
    const handleQuotaRefresh = () => { console.log("[Header] quota:refresh event received"); fetchUserPlan(); };
    window.addEventListener("quota:refresh", handleQuotaRefresh);
    if (typeof window !== "undefined") {
      const paymentCompleted = sessionStorage.getItem("payment_completed");
      if (paymentCompleted === "true") { sessionStorage.removeItem("payment_completed"); fetchUserPlan(); }
    }
    return () => window.removeEventListener("quota:refresh", handleQuotaRefresh);
  }, [user?.id]);

  useEffect(() => {
    const handleOpenSubscription = () => setSubscriptionOpen(true);
    window.addEventListener("open-subscription-modal", handleOpenSubscription);
    return () => window.removeEventListener("open-subscription-modal", handleOpenSubscription);
  }, []);

  useEffect(() => { if (!isMobile && mobileMenuOpen) setMobileMenuOpen(false); }, [isMobile, mobileMenuOpen]);

  const navLinks = [
    { href: "/", label: t("nav.home") },
    { href: "/generate", label: t("nav.generate") },
    { href: "/builds", label: currentLanguage === "zh" ? "构建列表" : "Builds" },
  ];

  return (
    <>
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/90 backdrop-blur-xl shadow-sm">
      <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4 md:px-6">
        <div className="flex items-center gap-4 sm:gap-6 md:gap-8">
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group">
            <div className="relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center">
              <div className="absolute inset-0 rounded-lg sm:rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 opacity-90 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-0 rounded-lg sm:rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 blur-lg opacity-30 group-hover:opacity-50 transition-opacity" />
              <Box className="relative h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 bg-clip-text text-transparent">MornClient</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (<Link key={link.href} href={link.href} className="px-3 lg:px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-all">{link.label}</Link>))}
          </nav>
        </div>
        <div className="flex items-center gap-1 sm:gap-1.5">
          <div className="flex items-center gap-0.5 bg-muted/50 rounded-md p-0.5"><LanguageSwitcher /><ThemeSwitcher /></div>
          <div className="hidden md:block w-px h-5 bg-border mx-1.5 lg:mx-2" />
          <div className="hidden md:flex items-center gap-1.5 lg:gap-2">
            {user && (<Button variant="ghost" size="sm" className="h-8 lg:h-9 gap-1.5 lg:gap-2 text-amber-600 dark:text-amber-400 hover:text-amber-500 hover:bg-amber-500/10" onClick={() => setSubscriptionOpen(true)}><Crown className="h-4 w-4" /><span className="text-xs lg:text-sm font-medium">{currentLanguage === "zh" ? "订阅" : "Subscribe"}</span></Button>)}
            {loading ? (<div className="h-8 lg:h-9 w-8 lg:w-9 flex items-center justify-center"><Loader2 className="h-4 w-4 lg:h-5 lg:w-5 animate-spin text-muted-foreground" /></div>) : user ? (<UserMenu />) : (<Link href="/auth/login"><Button size="sm" className="h-8 lg:h-9 px-3 lg:px-4 gap-1.5 lg:gap-2 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:from-cyan-400 hover:via-blue-400 hover:to-purple-500 text-white border-0 shadow-lg shadow-cyan-500/20 hover:shadow-xl hover:shadow-cyan-500/30 transition-all"><LogIn className="h-3.5 w-3.5 lg:h-4 lg:w-4" /><span className="text-xs lg:text-sm font-medium">{t("nav.login")}</span></Button></Link>)}
          </div>
          <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 sm:h-9 sm:w-9" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>{mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</Button>
        </div>
      </div>
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border/50 bg-background/98 backdrop-blur-xl animate-in slide-in-from-top-2 duration-200">
          <nav className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-col gap-1">
            {navLinks.map((link) => (<Link key={link.href} href={link.href} className="py-2.5 sm:py-3 px-3 sm:px-4 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg sm:rounded-xl transition-all active:scale-[0.98]" onClick={() => setMobileMenuOpen(false)}>{link.label}</Link>))}
            <div className="flex flex-col gap-2 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border/50">
              {user && (<Button variant="outline" size="sm" className="h-10 sm:h-11 gap-2 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-lg sm:rounded-xl" onClick={() => { setSubscriptionOpen(true); setMobileMenuOpen(false); }}><Crown className="h-4 w-4" /><span>{currentLanguage === "zh" ? "订阅会员" : "Subscribe"}</span></Button>)}
              {loading ? (<div className="h-10 sm:h-11 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>) : user ? (<div className="flex items-center justify-center py-2"><UserMenu /></div>) : (<Link href="/auth/login" onClick={() => setMobileMenuOpen(false)}><Button size="sm" className="w-full h-10 sm:h-11 gap-2 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 text-white rounded-lg sm:rounded-xl"><LogIn className="h-4 w-4" /><span>{t("nav.login")}</span></Button></Link>)}
            </div>
          </nav>
        </div>
      )}
    </header>
    <SubscriptionModal open={subscriptionOpen} onOpenChange={setSubscriptionOpen} userId={user?.id} currentPlan={userPlan} currentPlanExp={userPlanExp} />
    </>
  );
}
