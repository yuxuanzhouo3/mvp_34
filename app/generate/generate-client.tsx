"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { UrlInput, AppConfig, PlatformSelector, AndroidConfig, IOSConfig, HarmonyOSConfig } from "@/components/generate";
import { WechatConfig } from "@/components/generate/wechat-config";
import { ChromeExtensionConfig } from "@/components/generate/chrome-extension-config";
import { WindowsConfig } from "@/components/generate/windows-config";
import { MacOSConfig } from "@/components/generate/macos-config";
import { LinuxConfig } from "@/components/generate/linux-config";
import { Button } from "@/components/ui/button";
import { Rocket, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

function GenerateContent() {
  const { t, currentLanguage } = useLanguage();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

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

    if (!user) {
      router.push("/auth/login?redirect=/generate");
      return;
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

      // 批量构建前预检查额度，防止竞态条件
      const quotaCheckRes = await fetch("/api/international/quota/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: platformCount }),
      });

      if (!quotaCheckRes.ok) {
        const quotaError = await quotaCheckRes.json();
        throw new Error(quotaError.error || "Quota check failed");
      }

      const quotaData = await quotaCheckRes.json();
      if (!quotaData.allowed) {
        throw new Error(
          currentLanguage === "zh"
            ? `额度不足：需要 ${platformCount} 次，剩余 ${quotaData.remaining} 次`
            : `Insufficient quota: need ${platformCount}, remaining ${quotaData.remaining}`
        );
      }

      const buildPromises: Promise<Response>[] = [];

      // Build Android if selected
      if (hasAndroid) {
        const formData = new FormData();
        formData.append("url", url);
        formData.append("appName", appName);
        formData.append("platforms", JSON.stringify(["android"]));
        formData.append("packageName", packageName);
        formData.append("versionName", androidVersionName);
        formData.append("versionCode", androidVersionCode);
        formData.append("privacyPolicy", privacyPolicy);

        if (appIcon) {
          formData.append("icon", appIcon);
        }

        buildPromises.push(
          fetch("/api/international/android/build", {
            method: "POST",
            body: formData,
          })
        );
      }

      // Build iOS if selected
      if (hasIOS) {
        const formData = new FormData();
        formData.append("url", url);
        formData.append("appName", appName);
        formData.append("bundleId", bundleId);
        formData.append("versionString", iosVersionString);
        formData.append("buildNumber", iosBuildNumber);
        formData.append("privacyPolicy", iosPrivacyPolicy);

        if (iosIcon) {
          formData.append("icon", iosIcon);
        }

        buildPromises.push(
          fetch("/api/international/ios/build", {
            method: "POST",
            body: formData,
          })
        );
      }

      // Build WeChat if selected
      if (hasWechat) {
        const formData = new FormData();
        formData.append("url", url);
        formData.append("appName", appName);
        formData.append("appId", wechatAppId);
        formData.append("version", wechatVersion);

        buildPromises.push(
          fetch("/api/international/wechat/build", {
            method: "POST",
            body: formData,
          })
        );
      }

      // Build HarmonyOS if selected
      if (hasHarmonyOS) {
        const formData = new FormData();
        formData.append("url", url);
        formData.append("appName", appName);
        formData.append("bundleName", harmonyBundleName);
        formData.append("versionName", harmonyVersionName);
        formData.append("versionCode", harmonyVersionCode);
        formData.append("privacyPolicy", harmonyPrivacyPolicy);

        if (harmonyIcon) {
          formData.append("icon", harmonyIcon);
        }

        buildPromises.push(
          fetch("/api/international/harmonyos/build", {
            method: "POST",
            body: formData,
          })
        );
      }

      // Build Chrome Extension if selected
      if (hasChrome) {
        const formData = new FormData();
        formData.append("url", url);
        formData.append("appName", chromeExtensionName);
        formData.append("versionName", chromeExtensionVersion);
        formData.append("description", chromeExtensionDescription);

        if (chromeExtensionIcon) {
          formData.append("icon", chromeExtensionIcon);
        }

        buildPromises.push(
          fetch("/api/international/chrome/build", {
            method: "POST",
            body: formData,
          })
        );
      }

      // Build Windows if selected
      if (hasWindows) {
        const formData = new FormData();
        formData.append("url", url);
        formData.append("appName", windowsAppName);

        if (windowsIcon) {
          formData.append("icon", windowsIcon);
        }

        buildPromises.push(
          fetch("/api/international/windows/build", {
            method: "POST",
            body: formData,
          })
        );
      }

      // Build macOS if selected
      if (hasMacos) {
        const formData = new FormData();
        formData.append("url", url);
        formData.append("appName", macosAppName);

        if (macosIcon) {
          formData.append("icon", macosIcon);
        }

        buildPromises.push(
          fetch("/api/international/macos/build", {
            method: "POST",
            body: formData,
          })
        );
      }

      // Build Linux if selected
      if (hasLinux) {
        const formData = new FormData();
        formData.append("url", url);
        formData.append("appName", linuxAppName);

        if (linuxIcon) {
          formData.append("icon", linuxIcon);
        }

        buildPromises.push(
          fetch("/api/international/linux/build", {
            method: "POST",
            body: formData,
          })
        );
      }

      const responses = await Promise.all(buildPromises);

      // Check if any response failed
      for (const response of responses) {
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Build failed");
        }
      }

      // 触发额度刷新事件（构建请求时已扣减额度）
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("quota:refresh"));
      }

      toast.success(
        currentLanguage === "zh"
          ? "构建任务已创建，正在处理中..."
          : "Build task created, processing..."
      );
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
    <div className="min-h-screen relative overflow-hidden pt-20">
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-cyan-950/20" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-cyan-500/10 via-blue-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-purple-500/10 via-blue-500/10 to-transparent rounded-full blur-3xl" />
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      </div>

      <div className="container mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="text-center mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            <span>
              {currentLanguage === "zh" ? "简单三步，即刻完成" : "Three Simple Steps"}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-5">
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              {t("generate.title")}
            </span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {currentLanguage === "zh"
              ? "选择目标平台，填写基本信息，一键生成多平台应用"
              : "Select platforms, fill in basic info, generate multi-platform apps with one click"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8">
          {/* Step 1: Platform Selection */}
          <div className="relative">
            <div className="absolute -left-4 md:-left-12 top-0 flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-cyan-500/30">
                1
              </div>
              <div className="w-px h-full bg-gradient-to-b from-cyan-500/50 to-transparent mt-2" />
            </div>
            <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-6 md:p-8 shadow-xl shadow-black/5">
              <PlatformSelector
                selectedPlatforms={selectedPlatforms}
                onSelectionChange={setSelectedPlatforms}
              />
            </div>
          </div>

          {/* Step 2: URL Input */}
          <div className="relative">
            <div className="absolute -left-4 md:-left-12 top-0 flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/30">
                2
              </div>
              <div className="w-px h-full bg-gradient-to-b from-blue-500/50 to-transparent mt-2" />
            </div>
            <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-6 md:p-8 shadow-xl shadow-black/5">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                {currentLanguage === "zh" ? "输入网站地址" : "Enter Website URL"}
              </h2>
              <UrlInput value={url} onChange={setUrl} />
            </div>
          </div>

          {/* Step 3: App Config - Dynamic based on platform */}
          <div className="relative">
            <div className="absolute -left-4 md:-left-12 top-0 flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-500/30">
                3
              </div>
            </div>
            <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-6 md:p-8 shadow-xl shadow-black/5">
              <h2 className="text-xl font-semibold mb-6">
                {currentLanguage === "zh" ? "配置应用信息" : "Configure App Info"}
              </h2>

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
          </div>

          {/* Submit Button */}
          <div className="flex justify-center pt-6 pb-12">
            <Button
              type="submit"
              size="lg"
              disabled={!isValid || isSubmitting}
              className="group h-14 px-10 text-lg rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:from-cyan-400 hover:via-blue-400 hover:to-purple-500 text-white font-semibold shadow-xl shadow-cyan-500/25 hover:shadow-2xl hover:shadow-cyan-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
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
