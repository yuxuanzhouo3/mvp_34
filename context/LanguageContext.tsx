"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { DEFAULT_LANGUAGE } from "@/config";

type Language = "zh" | "en";

interface LanguageContextType {
  currentLanguage: Language;
  setCurrentLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// 翻译文本
const translations: Record<Language, Record<string, string>> = {
  zh: {
    // 导航
    "nav.home": "首页",
    "nav.generate": "开始构建",
    "nav.login": "登录",
    "nav.signup": "免费试用",

    // Hero
    "hero.badge": "支持 7+ 平台",
    "hero.title.1": "一键构建",
    "hero.title.2": "多平台应用",
    "hero.subtitle": "输入网站URL，自动生成 Android、iOS、鸿蒙、小程序、Linux 等多平台原生应用",
    "hero.placeholder": "请输入您的网站地址，例如 https://example.com",
    "hero.cta": "立即构建",
    "hero.cta.secondary": "了解更多",
    "hero.trusted": "已有 1000+ 开发者信赖",

    // 功能特性
    "features.title": "为什么选择 OneBuild",
    "features.subtitle": "简单、快速、专业的跨平台应用构建方案",
    "features.fast.title": "极速构建",
    "features.fast.desc": "云端并行编译，分钟级生成应用",
    "features.multi.title": "全平台覆盖",
    "features.multi.desc": "一次配置，7大平台同步生成",
    "features.custom.title": "深度定制",
    "features.custom.desc": "图标、启动页、权限等全方位自定义",
    "features.secure.title": "企业级安全",
    "features.secure.desc": "代码混淆加密，应用安全有保障",

    // 平台
    "platforms.title": "支持的平台",
    "platforms.subtitle": "一次构建，全平台发布",
    "platforms.mobile": "移动应用",
    "platforms.miniprogram": "小程序",
    "platforms.desktop": "桌面应用",

    // 生成页面
    "generate.title": "构建您的应用",
    "generate.subtitle": "只需几步，即可生成多平台应用",
    "generate.url.label": "网站地址",
    "generate.url.placeholder": "https://your-website.com",
    "generate.url.helper": "请输入完整的网站地址，包含 https://",
    "generate.name.label": "应用名称",
    "generate.name.placeholder": "我的应用",
    "generate.desc.label": "应用描述（可选）",
    "generate.desc.placeholder": "简单描述您的应用功能...",
    "generate.icon.label": "应用图标",
    "generate.icon.upload": "上传图标",
    "generate.icon.recommend": "推荐尺寸 512×512",
    "generate.platforms.title": "选择目标平台",
    "generate.submit": "开始构建",
    "generate.selected": "已选 {count} 个平台",

    // 页脚
    "footer.slogan": "让应用开发更简单",
    "footer.copyright": "© 2024 OneBuild. 保留所有权利。",
    "footer.product": "产品",
    "footer.product.features": "功能特性",
    "footer.product.pricing": "订阅方案",
    "footer.product.docs": "开发文档",
    "footer.product.changelog": "更新日志",
    "footer.company": "公司",
    "footer.company.about": "关于我们",
    "footer.company.blog": "技术博客",
    "footer.company.careers": "加入我们",
    "footer.company.contact": "联系方式",
    "footer.legal": "法律",
    "footer.legal.privacy": "隐私政策",
    "footer.legal.terms": "服务条款",
    "footer.legal.subscription": "订阅规则",
    "footer.legal.refund": "退款政策",

    // 通用
    "common.loading": "加载中...",
    "common.error": "出错了",
    "common.retry": "重试",
  },
  en: {
    // Navigation
    "nav.home": "Home",
    "nav.generate": "Build",
    "nav.login": "Login",
    "nav.signup": "Try Free",

    // Hero
    "hero.badge": "7+ Platforms Supported",
    "hero.title.1": "Build",
    "hero.title.2": "Multi-Platform Apps",
    "hero.subtitle": "Enter a website URL and automatically generate native apps for Android, iOS, HarmonyOS, Mini Programs, Linux and more",
    "hero.placeholder": "Enter your website URL, e.g. https://example.com",
    "hero.cta": "Build Now",
    "hero.cta.secondary": "Learn More",
    "hero.trusted": "Trusted by 1000+ developers",

    // Features
    "features.title": "Why OneBuild",
    "features.subtitle": "Simple, fast, and professional cross-platform app building solution",
    "features.fast.title": "Lightning Fast",
    "features.fast.desc": "Cloud parallel compilation, generate apps in minutes",
    "features.multi.title": "Full Coverage",
    "features.multi.desc": "Configure once, generate for 7 platforms simultaneously",
    "features.custom.title": "Deep Customization",
    "features.custom.desc": "Icons, splash screens, permissions - fully customizable",
    "features.secure.title": "Enterprise Security",
    "features.secure.desc": "Code obfuscation and encryption for app security",

    // Platforms
    "platforms.title": "Supported Platforms",
    "platforms.subtitle": "Build once, deploy everywhere",
    "platforms.mobile": "Mobile Apps",
    "platforms.miniprogram": "Mini Programs",
    "platforms.desktop": "Desktop Apps",

    // Generate Page
    "generate.title": "Build Your App",
    "generate.subtitle": "Just a few steps to generate multi-platform apps",
    "generate.url.label": "Website URL",
    "generate.url.placeholder": "https://your-website.com",
    "generate.url.helper": "Enter complete URL including https://",
    "generate.name.label": "App Name",
    "generate.name.placeholder": "My App",
    "generate.desc.label": "Description (Optional)",
    "generate.desc.placeholder": "Briefly describe your app...",
    "generate.icon.label": "App Icon",
    "generate.icon.upload": "Upload Icon",
    "generate.icon.recommend": "Recommended 512×512",
    "generate.platforms.title": "Select Target Platforms",
    "generate.submit": "Start Building",
    "generate.selected": "{count} selected",

    // Footer
    "footer.slogan": "Making app development easier",
    "footer.copyright": "© 2024 OneBuild. All rights reserved.",
    "footer.product": "Product",
    "footer.product.features": "Features",
    "footer.product.pricing": "Pricing",
    "footer.product.docs": "Documentation",
    "footer.product.changelog": "Changelog",
    "footer.company": "Company",
    "footer.company.about": "About Us",
    "footer.company.blog": "Blog",
    "footer.company.careers": "Careers",
    "footer.company.contact": "Contact",
    "footer.legal": "Legal",
    "footer.legal.privacy": "Privacy Policy",
    "footer.legal.terms": "Terms of Service",
    "footer.legal.subscription": "Subscription Terms",
    "footer.legal.refund": "Refund Policy",

    // Common
    "common.loading": "Loading...",
    "common.error": "Something went wrong",
    "common.retry": "Retry",
  },
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const storageKey = `onebuild-language`;
  const [currentLanguage, setCurrentLanguageState] = useState<Language>(DEFAULT_LANGUAGE as Language);

  useEffect(() => {
    const savedLanguage = localStorage.getItem(storageKey);
    if (savedLanguage === "zh" || savedLanguage === "en") {
      setCurrentLanguageState(savedLanguage);
    }
  }, []);

  const setCurrentLanguage = (lang: Language) => {
    setCurrentLanguageState(lang);
    localStorage.setItem(storageKey, lang);
    document.documentElement.lang = lang;
  };

  const t = (key: string): string => {
    return translations[currentLanguage][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ currentLanguage, setCurrentLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
