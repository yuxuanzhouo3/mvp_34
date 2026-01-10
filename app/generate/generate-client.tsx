"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useGuestBuild } from "@/hooks/useGuestBuild";
import { UrlInput, AppConfig, PlatformSelector, AndroidConfig, IOSConfig, HarmonyOSConfig } from "@/components/generate";
import { WechatConfig } from "@/components/generate/wechat-config";
import { ChromeExtensionConfig } from "@/components/generate/chrome-extension-config";
import { WindowsConfig } from "@/components/generate/windows-config";
import { MacOSConfig } from "@/components/generate/macos-config";
import { LinuxConfig } from "@/components/generate/linux-config";
import { Button } from "@/components/ui/button";
import { Rocket, Sparkles, ArrowRight, Loader2, UserX } from "lucide-react";
import { toast } from "sonner";

function GenerateContent() {
  const { t, currentLanguage } = useLanguage();
  const { user } = useAuth();
  const guestBuild = useGuestBuild();
  const searchParams = useSearchParams();
  const router = useRouter();

  // 是否为游客模式
  const isGuestMode = !user;

  // Step 1: Platform selection
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  // Step 2: URL
  const [url, setUrl] = useState("");

  // Step 3: Common config
  const [appName, setAppName] = useState("");
  const [appDescription, setAppDescription] = useState("");
  const [appIcon, setAppIcon] = useState<File | null>(null);

  // Android specific config
  const [packageName, setPackageName] = useState("");
  const [androidVersionName, setAndroidVersionName] = useState("1.0.0");
  const [androidVersionCode, setAndroidVersionCode] = useState("1");
  const [privacyPolicy, setPrivacyPolicy] = useState("");

  // iOS specific config
  const [bundleId, setBundleId] = useState("");
  const [iosVersionString, setIosVersionString] = useState("1.0.0");
  const [iosBuildNumber, setIosBuildNumber] = useState("1");
  const [iosPrivacyPolicy, setIosPrivacyPolicy] = useState("");
  const [iosIcon, setIosIcon] = useState<File | null>(null);

  // WeChat specific config
  const [wechatAppId, setWechatAppId] = useState("");
  const [wechatVersion, setWechatVersion] = useState("1.0.0");

  // HarmonyOS specific config
  const [harmonyBundleName, setHarmonyBundleName] = useState("");
  const [harmonyVersionName, setHarmonyVersionName] = useState("1.0.0");
  const [harmonyVersionCode, setHarmonyVersionCode] = useState("1");
  const [harmonyPrivacyPolicy, setHarmonyPrivacyPolicy] = useState("");
  const [harmonyIcon, setHarmonyIcon] = useState<File | null>(null);

  // Chrome Extension specific config
  const [chromeExtensionName, setChromeExtensionName] = useState("");
  const [chromeExtensionVersion, setChromeExtensionVersion] = useState("1.0.0");
  const [chromeExtensionDescription, setChromeExtensionDescription] = useState("");
  const [chromeExtensionIcon, setChromeExtensionIcon] = useState<File | null>(null);

  // Windows specific config
  const [windowsAppName, setWindowsAppName] = useState("");
  const [windowsIcon, setWindowsIcon] = useState<File | null>(null);

  // macOS specific config
  const [macosAppName, setMacosAppName] = useState("");
  const [macosIcon, setMacosIcon] = useState<File | null>(null);

  // Linux specific config
  const [linuxAppName, setLinuxAppName] = useState("");
  const [linuxIcon, setLinuxIcon] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 快捷填写：当应用名称变化时，同步到其他平台
  const handleAppNameChange = (name: string) => {
    setAppName(name);
    // 同步到其他平台（如果它们还没有自定义值）
    if (!chromeExtensionName || chromeExtensionName === appName) {
      setChromeExtensionName(name);
    }
    if (!windowsAppName || windowsAppName === appName) {
      setWindowsAppName(name);
    }
    if (!macosAppName || macosAppName === appName) {
      setMacosAppName(name);
    }
    if (!linuxAppName || linuxAppName === appName) {
      setLinuxAppName(name);
    }
  };

  // 快捷填写：根据应用名称自动生成包名
  const generatePackageName = (name: string) => {
    const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `com.app.${sanitized || 'myapp'}`;
  };

  // 当应用名称变化时，如果包名为空或是自动生成的，则自动更新包名
  const handleAppNameWithPackage = (name: string) => {
    handleAppNameChange(name);
    const autoPackage = generatePackageName(appName);
    if (!packageName || packageName === autoPackage || packageName === 'com.app.myapp') {
      setPackageName(generatePackageName(name));
    }
    if (!bundleId || bundleId === autoPackage || bundleId === 'com.app.myapp') {
      setBundleId(generatePackageName(name));
    }
    if (!harmonyBundleName || harmonyBundleName === autoPackage || harmonyBundleName === 'com.app.myapp') {
      setHarmonyBundleName(generatePackageName(name));
    }
  };

  useEffect(() => {
    const urlParam = searchParams.get("url");
    if (urlParam) {
      setUrl(urlParam);
    }
  }, [searchParams]);

  // Check if Android is the only selected platform
  const isAndroidOnly = selectedPlatforms.length === 1 && selectedPlatforms[0] === "android";
  const hasAndroid = selectedPlatforms.includes("android");
  const hasIOS = selectedPlatforms.includes("ios");
  const hasWechat = selectedPlatforms.includes("wechat");
  const hasHarmonyOS = selectedPlatforms.includes("harmonyos");
  const hasChrome = selectedPlatforms.includes("chrome");
  const hasWindows = selectedPlatforms.includes("windows");
  const hasMacos = selectedPlatforms.includes("macos");
  const hasLinux = selectedPlatforms.includes("linux");
  const isIOSOnly = selectedPlatforms.length === 1 && selectedPlatforms[0] === "ios";
  const isWechatOnly = selectedPlatforms.length === 1 && selectedPlatforms[0] === "wechat";
  const isHarmonyOSOnly = selectedPlatforms.length === 1 && selectedPlatforms[0] === "harmonyos";
  const isChromeOnly = selectedPlatforms.length === 1 && selectedPlatforms[0] === "chrome";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 游客模式检查
    if (isGuestMode) {
      // 检查游客是否支持批量构建
      if (selectedPlatforms.length > 1 && !guestBuild.supportBatchBuild) {
        toast.error(
          currentLanguage === "zh"
            ? "游客模式仅支持单平台构建，请登录后使用批量构建"
            : "Guest mode only supports single platform. Please login for batch builds."
        );
        return;
      }

      // 检查游客剩余构建次数
      if (!guestBuild.hasRemaining) {
        toast.error(
          currentLanguage === "zh"
            ? `今日游客构建次数已用完（${guestBuild.limit}次/天），请登录后继续使用`
            : `Daily guest build limit reached (${guestBuild.limit}/day). Please login to continue.`
        );
        router.push("/auth/login?redirect=/generate");
        return;
      }

      // 游客模式仅支持部分平台（不支持 iOS、WeChat、HarmonyOS）
      const unsupportedPlatforms = selectedPlatforms.filter(p =>
        ["ios", "wechat", "harmonyos"].includes(p)
      );
      if (unsupportedPlatforms.length > 0) {
        toast.error(
          currentLanguage === "zh"
            ? `游客模式不支持 ${unsupportedPlatforms.join(", ")} 平台，请登录后使用`
            : `Guest mode doesn't support ${unsupportedPlatforms.join(", ")}. Please login.`
        );
        return;
      }
    }

    // Validate Android specific fields if Android is selected
    if (hasAndroid) {
      if (!appName || !packageName || !androidVersionName || !androidVersionCode) {
        toast.error(
          currentLanguage === "zh"
            ? "请填写所有必填字段"
            : "Please fill in all required fields"
        );
        return;
      }

      // Validate package name format
      const packageRegex = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i;
      if (!packageRegex.test(packageName)) {
        toast.error(
          currentLanguage === "zh"
            ? "包名格式不正确，应为 com.xxx.xxx"
            : "Invalid package name format. Should be com.xxx.xxx"
        );
        return;
      }
    }

    // Validate iOS specific fields if iOS is selected
    if (hasIOS) {
      if (!appName || !bundleId || !iosVersionString || !iosBuildNumber) {
        toast.error(
          currentLanguage === "zh"
            ? "请填写所有必填字段"
            : "Please fill in all required fields"
        );
        return;
      }

      // Validate bundle ID format
      const bundleIdRegex = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i;
      if (!bundleIdRegex.test(bundleId)) {
        toast.error(
          currentLanguage === "zh"
            ? "Bundle ID 格式不正确，应为 com.xxx.xxx"
            : "Invalid Bundle ID format. Should be com.xxx.xxx"
        );
        return;
      }
    }

    // Validate WeChat specific fields if WeChat is selected
    if (hasWechat) {
      if (!appName || !wechatAppId || !wechatVersion) {
        toast.error(
          currentLanguage === "zh"
            ? "请填写所有必填字段"
            : "Please fill in all required fields"
        );
        return;
      }

      // Validate AppID format (wx + 16 hex characters)
      const appIdRegex = /^wx[a-f0-9]{16}$/i;
      if (!appIdRegex.test(wechatAppId)) {
        toast.error(
          currentLanguage === "zh"
            ? "AppID 格式不正确，应为 wx + 16位十六进制字符"
            : "Invalid AppID format. Should be wx + 16 hex characters"
        );
        return;
      }
    }

    // Validate HarmonyOS specific fields if HarmonyOS is selected
    if (hasHarmonyOS) {
      if (!appName || !harmonyBundleName || !harmonyVersionName || !harmonyVersionCode) {
        toast.error(
          currentLanguage === "zh"
            ? "请填写所有必填字段"
            : "Please fill in all required fields"
        );
        return;
      }

      // Validate bundle name format
      const bundleNameRegex = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i;
      if (!bundleNameRegex.test(harmonyBundleName)) {
        toast.error(
          currentLanguage === "zh"
            ? "包名格式不正确，应为 com.xxx_harmony.app"
            : "Invalid bundle name format. Should be com.xxx_harmony.app"
        );
        return;
      }
    }

    // Validate Chrome Extension specific fields if Chrome is selected
    if (hasChrome) {
      if (!chromeExtensionName || !chromeExtensionVersion || !chromeExtensionDescription) {
        toast.error(
          currentLanguage === "zh"
            ? "请填写所有必填字段"
            : "Please fill in all required fields"
        );
        return;
      }
    }

    // Validate Windows specific fields if Windows is selected
    if (hasWindows) {
      if (!windowsAppName) {
        toast.error(
          currentLanguage === "zh"
            ? "请填写应用名称"
            : "Please fill in the app name"
        );
        return;
      }
    }

    // Validate macOS specific fields if macOS is selected
    if (hasMacos) {
      if (!macosAppName) {
        toast.error(
          currentLanguage === "zh"
            ? "请填写应用名称"
            : "Please fill in the app name"
        );
        return;
      }
    }

    // Validate Linux specific fields if Linux is selected
    if (hasLinux) {
      if (!linuxAppName) {
        toast.error(
          currentLanguage === "zh"
            ? "请填写应用名称"
            : "Please fill in the app name"
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // 计算选中的平台数量
      const platformCount = selectedPlatforms.length;

      // 游客模式：使用游客构建 API
      if (isGuestMode) {
        // 先检查本地是否有剩余次数（不消费，仅检查）
        if (!guestBuild.hasRemaining) {
          throw new Error(
            currentLanguage === "zh"
              ? "游客构建次数已用完"
              : "Guest build limit reached"
          );
        }

        // 游客只能构建一个平台
        const platform = selectedPlatforms[0];
        const formData = new FormData();
        formData.append("url", url);
        formData.append("platform", platform);
        formData.append("platformCount", "1");

        // 根据平台设置应用名称
        if (platform === "android") {
          formData.append("appName", appName);
        } else if (platform === "chrome") {
          formData.append("appName", chromeExtensionName);
        } else if (platform === "windows") {
          formData.append("appName", windowsAppName);
        } else if (platform === "macos") {
          formData.append("appName", macosAppName);
        } else if (platform === "linux") {
          formData.append("appName", linuxAppName);
        }

        toast.info(
          currentLanguage === "zh"
            ? "游客模式构建中，请稍候..."
            : "Building in guest mode, please wait..."
        );

        const response = await fetch("/api/international/guest/build", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || error.error || "Guest build failed");
        }

        // API 成功后再消费本地次数
        guestBuild.consumeBuild();

        const result = await response.json();

        // 下载构建结果
        const binaryData = Uint8Array.from(atob(result.data), c => c.charCodeAt(0));
        const blob = new Blob([binaryData], { type: "application/zip" });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = result.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

        toast.success(
          currentLanguage === "zh"
            ? `构建完成！剩余 ${result.remaining}/${result.limit} 次`
            : `Build completed! ${result.remaining}/${result.limit} remaining`
        );

        setIsSubmitting(false);
        return;
      }

      // 登录用户模式：使用批量构建 API（一次请求处理所有平台，立即返回）
      type PlatformConfig = {
        platform: string;
        appName: string;
        packageName?: string;
        versionName?: string;
        versionCode?: string;
        privacyPolicy?: string;
        bundleId?: string;
        versionString?: string;
        buildNumber?: string;
        appId?: string;
        version?: string;
        bundleName?: string;
        description?: string;
        iconBase64?: string;
        iconType?: string;
      };
      const platforms: PlatformConfig[] = [];

      // 辅助函数：将 File 转换为 base64
      const fileToBase64 = async (file: File | null): Promise<{ base64: string; type: string } | null> => {
        if (!file) return null;
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(",")[1];
            resolve({ base64, type: file.type });
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });
      };

      // 构建各平台配置
      if (hasAndroid) {
        const iconData = await fileToBase64(appIcon);
        platforms.push({
          platform: "android", appName, packageName,
          versionName: androidVersionName, versionCode: androidVersionCode, privacyPolicy,
          ...(iconData && { iconBase64: iconData.base64, iconType: iconData.type }),
        });
      }
      if (hasIOS) {
        const iconData = await fileToBase64(iosIcon);
        platforms.push({
          platform: "ios", appName, bundleId,
          versionString: iosVersionString, buildNumber: iosBuildNumber, privacyPolicy: iosPrivacyPolicy,
          ...(iconData && { iconBase64: iconData.base64, iconType: iconData.type }),
        });
      }
      if (hasWechat) {
        platforms.push({ platform: "wechat", appName, appId: wechatAppId, version: wechatVersion });
      }
      if (hasHarmonyOS) {
        const iconData = await fileToBase64(harmonyIcon);
        platforms.push({
          platform: "harmonyos", appName, bundleName: harmonyBundleName,
          versionName: harmonyVersionName, versionCode: harmonyVersionCode, privacyPolicy: harmonyPrivacyPolicy,
          ...(iconData && { iconBase64: iconData.base64, iconType: iconData.type }),
        });
      }
      if (hasChrome) {
        const iconData = await fileToBase64(chromeExtensionIcon);
        platforms.push({
          platform: "chrome", appName: chromeExtensionName,
          versionName: chromeExtensionVersion, description: chromeExtensionDescription,
          ...(iconData && { iconBase64: iconData.base64, iconType: iconData.type }),
        });
      }
      if (hasWindows) {
        const iconData = await fileToBase64(windowsIcon);
        platforms.push({
          platform: "windows", appName: windowsAppName,
          ...(iconData && { iconBase64: iconData.base64, iconType: iconData.type }),
        });
      }
      if (hasMacos) {
        const iconData = await fileToBase64(macosIcon);
        platforms.push({
          platform: "macos", appName: macosAppName,
          ...(iconData && { iconBase64: iconData.base64, iconType: iconData.type }),
        });
      }
      if (hasLinux) {
        const iconData = await fileToBase64(linuxIcon);
        platforms.push({
          platform: "linux", appName: linuxAppName,
          ...(iconData && { iconBase64: iconData.base64, iconType: iconData.type }),
        });
      }

      // 发送批量构建请求（一次请求，服务端批量创建记录后立即返回）
      const response = await fetch("/api/international/batch/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, platforms }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || "Batch build request failed");
      }

      // 触发额度刷新事件
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("quota:refresh"));
      }

      toast.success(
        currentLanguage === "zh"
          ? "构建任务已创建，正在处理中..."
          : "Build task created, processing..."
      );

      // 构建记录已创建，现在跳转到构建列表页面
      router.push(`/builds`);
    } catch (error) {
      console.error("Build error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : currentLanguage === "zh"
          ? "构建失败，请重试"
          : "Build failed, please try again"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validation for Android
  const isAndroidValid = hasAndroid
    ? url && appName && packageName && androidVersionName && androidVersionCode
    : true;

  // Validation for iOS
  const isIOSValid = hasIOS
    ? url && appName && bundleId && iosVersionString && iosBuildNumber
    : true;

  // Validation for WeChat
  const isWechatValid = hasWechat
    ? url && appName && wechatAppId && wechatVersion
    : true;

  // Validation for HarmonyOS
  const isHarmonyOSValid = hasHarmonyOS
    ? url && appName && harmonyBundleName && harmonyVersionName && harmonyVersionCode
    : true;

  // Validation for Chrome Extension
  const isChromeValid = hasChrome
    ? url && chromeExtensionName && chromeExtensionVersion && chromeExtensionDescription
    : true;

  // Validation for Windows
  const isWindowsValid = hasWindows
    ? url && windowsAppName
    : true;

  // Validation for macOS
  const isMacosValid = hasMacos
    ? url && macosAppName
    : true;

  // Validation for Linux
  const isLinuxValid = hasLinux
    ? url && linuxAppName
    : true;

  const isValid = selectedPlatforms.length > 0 && isAndroidValid && isIOSValid && isWechatValid && isHarmonyOSValid && isChromeValid && isWindowsValid && isMacosValid && isLinuxValid;

  return (
    <div className="min-h-screen relative overflow-hidden pt-16 sm:pt-20">
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-cyan-950/20" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-cyan-500/10 via-blue-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-purple-500/10 via-blue-500/10 to-transparent rounded-full blur-3xl" />
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 md:py-12">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            <span>
              {currentLanguage === "zh" ? "简单三步，即刻完成" : "Three Simple Steps"}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-5">
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              {t("generate.title")}
            </span>
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base md:text-lg max-w-2xl mx-auto">
            {currentLanguage === "zh"
              ? "选择目标平台，填写基本信息，一键生成多平台应用"
              : "Select platforms, fill in basic info, generate multi-platform apps with one click"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
          {/* Step 1: Platform Selection */}
          <div className="bg-card/50 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-border/50 p-4 sm:p-6 md:p-8 shadow-xl shadow-black/5">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-lg shadow-cyan-500/30 shrink-0">
                1
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-foreground/90">选择目标平台</h2>
            </div>
            <PlatformSelector
                selectedPlatforms={selectedPlatforms}
                onSelectionChange={setSelectedPlatforms}
              />
          </div>

          {/* Step 2: URL Input */}
          <div className="bg-card/50 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-border/50 p-4 sm:p-6 md:p-8 shadow-xl shadow-black/5">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-lg shadow-blue-500/30 shrink-0">
                2
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-foreground/90">
                {currentLanguage === "zh" ? "输入网站地址" : "Enter Website URL"}
              </h2>
            </div>
            <UrlInput value={url} onChange={setUrl} />
          </div>

          {/* Step 3: App Config - Dynamic based on platform */}
          <div className="bg-card/50 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-border/50 p-4 sm:p-6 md:p-8 shadow-xl shadow-black/5">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-lg shadow-purple-500/30 shrink-0">
                3
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-foreground/90">
                {currentLanguage === "zh" ? "配置应用信息" : "Configure App Info"}
              </h2>
            </div>

              {/* Show Android config if Android is selected */}
              {hasAndroid && (
                <AndroidConfig
                  name={appName}
                  packageName={packageName}
                  versionName={androidVersionName}
                  versionCode={androidVersionCode}
                  privacyPolicy={privacyPolicy}
                  onNameChange={handleAppNameWithPackage}
                  onPackageNameChange={setPackageName}
                  onVersionNameChange={setAndroidVersionName}
                  onVersionCodeChange={setAndroidVersionCode}
                  onPrivacyPolicyChange={setPrivacyPolicy}
                  onIconChange={setAppIcon}
                />
              )}

              {/* Show iOS config if iOS is selected */}
              {hasIOS && (
                <div className={hasAndroid ? "mt-8 pt-8 border-t border-border/50" : ""}>
                  <IOSConfig
                    name={appName}
                    bundleId={bundleId}
                    versionString={iosVersionString}
                    buildNumber={iosBuildNumber}
                    privacyPolicy={iosPrivacyPolicy}
                    onNameChange={handleAppNameWithPackage}
                    onBundleIdChange={setBundleId}
                    onVersionStringChange={setIosVersionString}
                    onBuildNumberChange={setIosBuildNumber}
                    onPrivacyPolicyChange={setIosPrivacyPolicy}
                    onIconChange={setIosIcon}
                  />
                </div>
              )}

              {/* Show WeChat config if WeChat is selected */}
              {hasWechat && (
                <div className={(hasAndroid || hasIOS) ? "mt-8 pt-8 border-t border-border/50" : ""}>
                  <WechatConfig
                    name={appName}
                    appId={wechatAppId}
                    version={wechatVersion}
                    onNameChange={handleAppNameChange}
                    onAppIdChange={setWechatAppId}
                    onVersionChange={setWechatVersion}
                  />
                </div>
              )}

              {/* Show HarmonyOS config if HarmonyOS is selected */}
              {hasHarmonyOS && (
                <div className={(hasAndroid || hasIOS || hasWechat) ? "mt-8 pt-8 border-t border-border/50" : ""}>
                  <HarmonyOSConfig
                    name={appName}
                    bundleName={harmonyBundleName}
                    versionName={harmonyVersionName}
                    versionCode={harmonyVersionCode}
                    privacyPolicy={harmonyPrivacyPolicy}
                    onNameChange={handleAppNameWithPackage}
                    onBundleNameChange={setHarmonyBundleName}
                    onVersionNameChange={setHarmonyVersionName}
                    onVersionCodeChange={setHarmonyVersionCode}
                    onPrivacyPolicyChange={setHarmonyPrivacyPolicy}
                    onIconChange={setHarmonyIcon}
                  />
                </div>
              )}

              {/* Show Chrome Extension config if Chrome is selected */}
              {hasChrome && (
                <div className={(hasAndroid || hasIOS || hasWechat || hasHarmonyOS) ? "mt-8 pt-8 border-t border-border/50" : ""}>
                  <ChromeExtensionConfig
                    name={chromeExtensionName}
                    versionName={chromeExtensionVersion}
                    description={chromeExtensionDescription}
                    onNameChange={setChromeExtensionName}
                    onVersionNameChange={setChromeExtensionVersion}
                    onDescriptionChange={setChromeExtensionDescription}
                    onIconChange={setChromeExtensionIcon}
                  />
                </div>
              )}

              {/* Show Windows config if Windows is selected */}
              {hasWindows && (
                <div className={(hasAndroid || hasIOS || hasWechat || hasHarmonyOS || hasChrome) ? "mt-8 pt-8 border-t border-border/50" : ""}>
                  <WindowsConfig
                    name={windowsAppName}
                    onNameChange={setWindowsAppName}
                    onIconChange={setWindowsIcon}
                  />
                </div>
              )}

              {/* Show macOS config if macOS is selected */}
              {hasMacos && (
                <div className={(hasAndroid || hasIOS || hasWechat || hasHarmonyOS || hasChrome || hasWindows) ? "mt-8 pt-8 border-t border-border/50" : ""}>
                  <MacOSConfig
                    name={macosAppName}
                    onNameChange={setMacosAppName}
                    onIconChange={setMacosIcon}
                  />
                </div>
              )}

              {/* Show Linux config if Linux is selected */}
              {hasLinux && (
                <div className={(hasAndroid || hasIOS || hasWechat || hasHarmonyOS || hasChrome || hasWindows || hasMacos) ? "mt-8 pt-8 border-t border-border/50" : ""}>
                  <LinuxConfig
                    name={linuxAppName}
                    onNameChange={setLinuxAppName}
                    onIconChange={setLinuxIcon}
                  />
                </div>
              )}

              {/* Show generic config if no specific platform is selected */}
              {!hasAndroid && !hasIOS && !hasWechat && !hasHarmonyOS && !hasChrome && !hasWindows && !hasMacos && !hasLinux && (
                <AppConfig
                  name={appName}
                  description={appDescription}
                  onNameChange={setAppName}
                  onDescriptionChange={setAppDescription}
                  onIconChange={setAppIcon}
                />
              )}
          </div>

          {/* Submit Button */}
          <div className="flex flex-col items-center gap-3 sm:gap-4 pt-4 sm:pt-6 pb-8 sm:pb-12">
            {/* Guest Mode Notice */}
            {isGuestMode && (
              <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 max-w-lg">
                <UserX className="h-5 w-5 flex-shrink-0" />
                <div className="text-sm">
                  <span className="font-medium">
                    {currentLanguage === "zh" ? "游客模式" : "Guest Mode"}
                  </span>
                  <span className="mx-1.5">·</span>
                  <span>
                    {currentLanguage === "zh"
                      ? `今日剩余 ${guestBuild.remaining}/${guestBuild.limit} 次`
                      : `${guestBuild.remaining}/${guestBuild.limit} builds remaining today`}
                  </span>
                  <span className="mx-1.5">·</span>
                  <span className="text-muted-foreground">
                    {currentLanguage === "zh"
                      ? "仅支持单平台构建"
                      : "Single platform only"}
                  </span>
                </div>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={!isValid || isSubmitting}
              className="group h-12 sm:h-14 px-6 sm:px-10 text-base sm:text-lg rounded-xl sm:rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:from-cyan-400 hover:via-blue-400 hover:to-purple-500 text-white font-semibold shadow-xl shadow-cyan-500/25 hover:shadow-2xl hover:shadow-cyan-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Rocket className="mr-2 h-5 w-5 group-hover:animate-pulse" />
                  {t("generate.submit")}
                  {selectedPlatforms.length > 0 && (
                    <span className="ml-3 px-2.5 py-1 rounded-full bg-white/20 text-sm font-medium">
                      {selectedPlatforms.length} {currentLanguage === "zh" ? "个平台" : "platforms"}
                    </span>
                  )}
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
    </div>
  );
}

export default function GenerateClient() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <GenerateContent />
    </Suspense>
  );
}
