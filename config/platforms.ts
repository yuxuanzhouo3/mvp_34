import {
  Smartphone,
  Apple,
  Hexagon,
  MessageCircle,
  Bookmark,
  Wallet,
  Terminal,
  Laptop,
  AppWindow,
  Chrome
} from "lucide-react";

export type PlatformCategory = "mobile" | "miniprogram" | "desktop" | "browser";

export interface Platform {
  id: string;
  name: {
    zh: string;
    en: string;
  };
  description: {
    zh: string;
    en: string;
  };
  category: PlatformCategory;
  icon: typeof Smartphone;
  color: string;
  available: boolean;
}

export const PLATFORMS: Platform[] = [
  // 移动端
  {
    id: "android-source",
    name: { zh: "Android Source", en: "Android Source" },
    description: { zh: "Android 源码项目", en: "Android Source Project" },
    category: "mobile",
    icon: Smartphone,
    color: "from-green-500 to-green-600",
    available: true,
  },
  {
    id: "android-apk",
    name: { zh: "Android APK", en: "Android APK" },
    description: { zh: "Android 安装包", en: "Android Package" },
    category: "mobile",
    icon: Smartphone,
    color: "from-green-600 to-green-700",
    available: true,
  },
  {
    id: "ios",
    name: { zh: "iOS", en: "iOS" },
    description: { zh: "iOS Source", en: "iOS Source" },
    category: "mobile",
    icon: Apple,
    color: "from-gray-700 to-gray-900",
    available: true,
  },
  {
    id: "harmonyos-source",
    name: { zh: "HarmonyOS Source", en: "HarmonyOS Source" },
    description: { zh: "鸿蒙源码项目", en: "HarmonyOS Source Project" },
    category: "mobile",
    icon: Hexagon,
    color: "from-red-500 to-red-600",
    available: true,
  },
  // 小程序
  {
    id: "wechat",
    name: { zh: "微信小程序", en: "WeChat Mini Program" },
    description: { zh: "微信生态应用", en: "WeChat Ecosystem App" },
    category: "miniprogram",
    icon: MessageCircle,
    color: "from-green-400 to-green-500",
    available: true,
  },
  {
    id: "xiaohongshu",
    name: { zh: "小红书小程序", en: "Xiaohongshu Mini Program" },
    description: { zh: "正在开发中...", en: "Coming soon..." },
    category: "miniprogram",
    icon: Bookmark,
    color: "from-red-400 to-pink-500",
    available: false,
  },
  {
    id: "alipay",
    name: { zh: "支付宝小程序", en: "Alipay Mini Program" },
    description: { zh: "正在开发中...", en: "Coming soon..." },
    category: "miniprogram",
    icon: Wallet,
    color: "from-blue-400 to-blue-500",
    available: false,
  },
  // 桌面端
  {
    id: "windows",
    name: { zh: "Windows", en: "Windows" },
    description: { zh: "Windows桌面应用 (EXE)", en: "Windows Desktop App (EXE)" },
    category: "desktop",
    icon: AppWindow,
    color: "from-blue-500 to-blue-600",
    available: true,
  },
  {
    id: "macos",
    name: { zh: "MacOS", en: "MacOS" },
    description: { zh: "Mac桌面应用 (APP)", en: "Mac Desktop App (APP)" },
    category: "desktop",
    icon: Laptop,
    color: "from-gray-600 to-gray-800",
    available: true,
  },
  {
    id: "linux",
    name: { zh: "Linux", en: "Linux" },
    description: { zh: "Linux桌面应用", en: "Linux Desktop App" },
    category: "desktop",
    icon: Terminal,
    color: "from-orange-500 to-yellow-500",
    available: true,
  },
  // 浏览器扩展
  {
    id: "chrome",
    name: { zh: "Chrome 扩展", en: "Chrome Extension" },
    description: { zh: "Chrome 浏览器扩展", en: "Chrome Browser Extension" },
    category: "browser",
    icon: Chrome,
    color: "from-blue-500 to-green-500",
    available: true,
  },
];

export const PLATFORM_CATEGORIES = {
  mobile: {
    name: { zh: "移动端", en: "Mobile" },
    description: { zh: "原生移动应用", en: "Native Mobile Apps" },
  },
  miniprogram: {
    name: { zh: "小程序", en: "Mini Programs" },
    description: { zh: "轻量级小程序应用", en: "Lightweight Mini Programs" },
  },
  desktop: {
    name: { zh: "桌面端", en: "Desktop" },
    description: { zh: "桌面应用程序", en: "Desktop Applications" },
  },
  browser: {
    name: { zh: "浏览器扩展", en: "Browser Extensions" },
    description: { zh: "浏览器扩展插件", en: "Browser Extension Plugins" },
  },
};

export const getPlatformsByCategory = (category: PlatformCategory) => {
  return PLATFORMS.filter((p) => p.category === category);
};

export const getPlatformById = (id: string) => {
  return PLATFORMS.find((p) => p.id === id);
};
