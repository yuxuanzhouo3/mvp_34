"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { Box } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PrivacyPolicy } from "@/components/legal/privacy-policy";
import { SubscriptionTerms } from "@/components/legal/subscription-terms";

export function Footer() {
  const { t, currentLanguage } = useLanguage();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);

  const footerLinks = {
    product: [
      { label: t("footer.product.features"), href: "/features" },
      { label: t("footer.product.pricing"), href: "/pricing" },
      { label: t("footer.product.docs"), href: "/docs" },
      { label: t("footer.product.changelog"), href: "/changelog" },
    ],
    company: [
      { label: t("footer.company.about"), href: "/about" },
      { label: t("footer.company.blog"), href: "/blog" },
      { label: t("footer.company.careers"), href: "/careers" },
      { label: t("footer.company.contact"), href: "/contact" },
    ],
    legal: [
      { label: t("footer.legal.privacy"), href: "/privacy" },
      { label: t("footer.legal.subscription"), href: "/subscription-terms" },
      { label: t("footer.legal.refund"), href: "/refund" },
    ],
  };

  return (
    <footer className="border-t border-border/40 bg-muted/30">
      <div className="container mx-auto px-4 md:px-6 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
              <div className="relative flex h-8 w-8 items-center justify-center">
                <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 opacity-90" />
                <Box className="relative h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                MornClient
              </span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-[200px]">
              {t("footer.slogan")}
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">
              {t("footer.product")}
            </h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">
              {t("footer.company")}
            </h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">
              {t("footer.legal")}
            </h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 pt-8 border-t border-border/40">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {t("footer.copyright")}
            </p>
            <div className="flex items-center gap-6">
              <button
                onClick={() => setPrivacyOpen(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("footer.legal.privacy")}
              </button>
              <button
                onClick={() => setSubscriptionOpen(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("footer.legal.subscription")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 隐私政策弹窗 */}
      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl lg:max-w-4xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden rounded-xl sm:rounded-2xl p-0 border-0 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-50/50 via-white to-blue-50/50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900" />
          <div className="absolute top-0 right-0 w-32 sm:w-48 lg:w-64 h-32 sm:h-48 lg:h-64 bg-gradient-to-br from-cyan-400/10 to-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 sm:w-48 lg:w-64 h-32 sm:h-48 lg:h-64 bg-gradient-to-br from-purple-400/10 to-pink-500/10 rounded-full blur-3xl" />

          <div className="relative z-10 flex flex-col h-full max-h-[90vh] sm:max-h-[85vh]">
            <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200/80 dark:border-gray-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex-shrink-0">
              <DialogTitle className="flex items-center gap-2 sm:gap-3 text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                <div className="p-1.5 sm:p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg sm:rounded-xl shadow-lg shadow-cyan-500/25">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <span>{currentLanguage === "zh" ? "隐私条款" : "Privacy Policy"}</span>
              </DialogTitle>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 ml-8 sm:ml-12">
                {currentLanguage === "zh" ? "请仔细阅读以下隐私条款" : "Please read the following privacy policy carefully"}
              </p>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4 bg-white/50 dark:bg-slate-800/50">
              <PrivacyPolicy currentLanguage={currentLanguage} />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 订阅规则弹窗 */}
      <Dialog open={subscriptionOpen} onOpenChange={setSubscriptionOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl lg:max-w-4xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden rounded-xl sm:rounded-2xl p-0 border-0 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-50/50 via-white to-blue-50/50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900" />
          <div className="absolute top-0 right-0 w-32 sm:w-48 lg:w-64 h-32 sm:h-48 lg:h-64 bg-gradient-to-br from-cyan-400/10 to-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 sm:w-48 lg:w-64 h-32 sm:h-48 lg:h-64 bg-gradient-to-br from-purple-400/10 to-pink-500/10 rounded-full blur-3xl" />

          <div className="relative z-10 flex flex-col h-full max-h-[90vh] sm:max-h-[85vh]">
            <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200/80 dark:border-gray-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex-shrink-0">
              <DialogTitle className="flex items-center gap-2 sm:gap-3 text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                <div className="p-1.5 sm:p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg sm:rounded-xl shadow-lg shadow-emerald-500/25">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span>{currentLanguage === "zh" ? "订阅规则" : "Subscription Terms"}</span>
              </DialogTitle>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 ml-8 sm:ml-12">
                {currentLanguage === "zh" ? "请仔细阅读以下订阅规则" : "Please read the following subscription terms carefully"}
              </p>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4 bg-white/50 dark:bg-slate-800/50">
              <SubscriptionTerms currentLanguage={currentLanguage} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </footer>
  );
}
