"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { Box, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PrivacyPolicy } from "@/components/legal/privacy-policy";
import { SubscriptionTerms } from "@/components/legal/subscription-terms";

interface SocialLink {
  id: string;
  title: string;
  description: string | null;
  icon_url: string;
  target_url: string;
  sort_order: number;
}

interface Release {
  id: string;
  version: string;
  title: string;
  description?: string;
  download_url?: string;
  platform: string;
  published_at?: string;
}

export function Footer() {
  const { t, currentLanguage, isDomesticVersion } = useLanguage();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [linksRes, releasesRes] = await Promise.all([
          fetch(`/api/social-links/active?isDomestic=${isDomesticVersion}`),
          fetch(`/api/releases/active?isDomestic=${isDomesticVersion}`),
        ]);

        const linksData = await linksRes.json();
        const releasesData = await releasesRes.json();

        if (linksData.success) {
          console.log('Social links data:', linksData.data);
          setSocialLinks(linksData.data || []);
        }
        if (releasesData.success) setReleases(releasesData.data || []);
      } catch (error) {
        console.error("Failed to fetch footer data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [isDomesticVersion]);

  const isImageUrl = (url: string) => {
    if (!url || typeof url !== 'string') return false;
    return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('cloud://') || url.startsWith('/');
  };

  const getPlatformName = (platform: string) => {
    const names: Record<string, { zh: string; en: string }> = {
      android: { zh: "Android", en: "Android" },
      ios: { zh: "iOS", en: "iOS" },
      harmonyos: { zh: "鸿蒙", en: "HarmonyOS" },
      windows: { zh: "Windows", en: "Windows" },
      macos: { zh: "macOS", en: "macOS" },
      linux: { zh: "Linux", en: "Linux" },
      chrome: { zh: "Chrome", en: "Chrome" },
      wechat: { zh: "微信小程序", en: "WeChat" },
    };
    return names[platform]?.[currentLanguage] || platform;
  };

  return (
    <footer className="border-t border-border/40 bg-muted/30">
      <div className="container mx-auto px-4 md:px-6 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-8">
          {/* Brand - 占3列 */}
          <div className="md:col-span-3">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
              <div className="relative flex h-8 w-8 items-center justify-center">
                <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 opacity-90" />
                <Box className="relative h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                MornClient
              </span>
            </Link>
            <p className="text-sm text-muted-foreground mb-4">
              {t("footer.slogan")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("footer.copyright")}
            </p>
          </div>

          {/* 旗下产品 - 占3列 */}
          <div className="md:col-span-3">
            <h4 className="font-semibold text-foreground mb-4 text-sm">
              {t("footer.products")}
            </h4>
            {loading ? (
              <div className="grid grid-cols-8 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="w-full aspect-square rounded-md bg-muted animate-pulse" />
                ))}
              </div>
            ) : socialLinks.length > 0 ? (
              <div className="grid grid-cols-8 gap-2">
                {socialLinks.map((link) => (
                  <Popover key={link.id}>
                    <PopoverTrigger asChild>
                      <button
                        className="w-full aspect-square rounded-md border border-border/40 hover:border-primary/50 hover:bg-muted/50 transition-all flex items-center justify-center group focus:outline-none focus:ring-2 focus:ring-primary/50 overflow-hidden"
                        onMouseEnter={(e) => e.currentTarget.focus()}
                      >
                        {isImageUrl(link.icon_url) ? (
                          <img
                            src={link.icon_url}
                            alt={link.title}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                parent.innerHTML = `<span class="text-xl">${link.title.charAt(0)}</span>`;
                              }
                            }}
                          />
                        ) : (
                          <span className="text-xl">{link.icon_url}</span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="top"
                      align="center"
                      className="w-64 p-0 bg-background border-border shadow-lg z-50"
                      onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                      <div
                        className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          if (link.target_url) {
                            window.open(link.target_url, "_blank", "noopener,noreferrer");
                          }
                        }}
                      >
                        <div className="flex items-start gap-3 mb-2">
                          <div className="flex-shrink-0">
                            {isImageUrl(link.icon_url) ? (
                              <img
                                src={link.icon_url}
                                alt={link.title}
                                className="w-8 h-8 object-contain"
                              />
                            ) : (
                              <span className="text-2xl">{link.icon_url}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-foreground text-sm mb-1">
                              {link.title}
                            </h4>
                            {link.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {link.description}
                              </p>
                            )}
                          </div>
                        </div>
                        {link.target_url && (
                          <div className="text-xs text-primary hover:text-primary/80 truncate pt-2 border-t border-border/50">
                            {currentLanguage === "zh" ? "点击访问" : "Click to visit"}:{" "}
                            {link.target_url.replace("https://", "").replace("http://", "")}
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("footer.noProducts")}</p>
            )}
          </div>

          {/* 下载 - 占4列 */}
          <div className="md:col-span-4">
            <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" />
              {t("footer.download")}
            </h4>
            {loading ? (
              <div className="grid grid-cols-2 gap-2.5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-14 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : releases.length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5">
                {releases.slice(0, 6).map((release) => (
                  <a
                    key={release.id}
                    href={release.download_url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-lg border border-border/40 hover:border-primary/50 hover:bg-muted/50 transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <Download className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-foreground truncate">
                          {getPlatformName(release.platform)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          v{release.version}
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("footer.noReleases")}</p>
            )}
          </div>

          {/* 法律信息 - 占2列 */}
          <div className="md:col-span-2">
            <h4 className="font-semibold text-foreground mb-4 text-sm">
              {t("footer.legal.title")}
            </h4>
            <ul className="space-y-2.5">
              <li>
                <button
                  onClick={() => setPrivacyOpen(true)}
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors text-left"
                >
                  {t("footer.legal.privacy")}
                </button>
              </li>
              <li>
                <button
                  onClick={() => setSubscriptionOpen(true)}
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors text-left"
                >
                  {t("footer.legal.subscription")}
                </button>
              </li>
            </ul>
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
