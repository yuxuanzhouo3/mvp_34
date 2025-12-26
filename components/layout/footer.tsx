"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { Box } from "lucide-react";

export function Footer() {
  const { t } = useLanguage();

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
      { label: t("footer.legal.terms"), href: "/terms" },
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
              <Link
                href="/privacy"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("footer.legal.privacy")}
              </Link>
              <Link
                href="/terms"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("footer.legal.terms")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
