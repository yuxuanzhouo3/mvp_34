"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useGuestBuild } from "@/hooks/useGuestBuild";
import { useGuestBuildHistory } from "@/hooks/useGuestBuildHistory";
import { UrlInput, AppConfig, PlatformSelector, AndroidConfig, IOSConfig, HarmonyOSConfig } from "@/components/generate";
import { WechatConfig } from "@/components/generate/wechat-config";
import { ChromeExtensionConfig } from "@/components/generate/chrome-extension-config";
import { WindowsConfig } from "@/components/generate/windows-config";
import { MacOSConfig } from "@/components/generate/macos-config";
import { LinuxConfig } from "@/components/generate/linux-config";
import { GuestBuildHistory } from "@/components/generate/guest-build-history";
import { Button } from "@/components/ui/button";
import { Rocket, Sparkles, ArrowRight, Loader2, UserX, Layers } from "lucide-react";
import { toast } from "sonner";
import { IS_DOMESTIC_VERSION } from "@/config";
import { uploadIconsBatch } from "@/lib/upload/icon-upload";

function GenerateContent() {
  const { t, currentLanguage } = useLanguage();
  const { user } = useAuth();
  const guestBuild = useGuestBuild();
  const guestBuildHistory = useGuestBuildHistory();
  const searchParams = useSearchParams();
  const router = useRouter();

  // 预加载构建列表页面（优化跳转速度）
  useEffect(() => {
    router.prefetch("/builds");
  }, [router]);

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

  // 国内版：存储已上传图标的路径
  const [uploadedIconPaths, setUploadedIconPaths] = useState<Record<string, string>>({});

  // 使用 ref 存储最新的 iconPath，避免 state 更新延迟
  const uploadedIconPathsRef = useRef<Record<string, string>>({});

  // 跟踪正在进行的图标上传 Promise
  const uploadingPromisesRef = useRef<Record<string, Promise<string | null>>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 国内版：即时上传图标到 CloudBase
  const uploadIconImmediately = async (file: File, platform: string): Promise<string | null> => {
    if (!IS_DOMESTIC_VERSION) return null;

    try {
      const formData = new FormData();
      formData.append("icon", file);
      formData.append("platform", platform);

      const response = await fetch("/api/domestic/upload-icon", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Icon upload failed");
      }

      const result = await response.json();
      return result.iconPath;
    } catch (error) {
      console.error(`[Upload Icon] Failed to upload ${platform} icon:`, error);
      toast.error(
        currentLanguage === "zh"
          ? `图标上传失败: ${error instanceof Error ? error.message : "未知错误"}`
          : `Icon upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      return null;
    }
  };

  // 国内版：删除已上传的图标
  const deleteUploadedIcon = async (iconPath: string) => {
    if (!IS_DOMESTIC_VERSION) return;

    try {
      const response = await fetch("/api/domestic/delete-icon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iconPath }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Icon delete failed");
      }
    } catch (error) {
      console.error(`[Delete Icon] Failed to delete icon:`, error);
      // 删除失败不影响用户操作，仅记录日志
    }
  };

  // 包装图标设置函数，在国内版自动上传
  const handleIconChange = async (
    file: File | null,
    platform: string,
    setter: (file: File | null) => void
  ) => {
    console.log(`[handleIconChange] Called for platform: ${platform}, file:`, file ? `${file.name} (${file.size} bytes)` : 'null');

    // 如果删除图标，清理已上传的路径
    if (!file) {
      const oldPath = uploadedIconPaths[platform];
      if (oldPath) {
        console.log(`[handleIconChange] Deleting old icon path: ${oldPath}`);
        await deleteUploadedIcon(oldPath);
        setUploadedIconPaths(prev => {
          const next = { ...prev };
          delete next[platform];
          return next;
        });
        delete uploadedIconPathsRef.current[platform];
      }
      setter(null);
      return;
    }

    // 设置文件
    setter(file);

    // 国内版：立即上传
    if (IS_DOMESTIC_VERSION) {
      console.log(`[handleIconChange] Uploading icon for ${platform}...`);
      const uploadPromise = uploadIconImmediately(file, platform);
      uploadingPromisesRef.current[platform] = uploadPromise;

      const iconPath = await uploadPromise;
      if (iconPath) {
        console.log(`[handleIconChange] Icon uploaded successfully, path: ${iconPath}`);
        // 同时更新 state 和 ref
        setUploadedIconPaths(prev => ({ ...prev, [platform]: iconPath }));
        uploadedIconPathsRef.current[platform] = iconPath;
      } else {
        console.error(`[handleIconChange] Icon upload failed for ${platform}`);
      }

      // 清理已完成的 Promise
      delete uploadingPromisesRef.current[platform];
    }
  };

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
  const generatePackageName = (name: string, platform: 'android' | 'ios' | 'harmonyos' = 'android') => {
    const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (platform === 'android') {
      return `com.${sanitized || 'myapp'}.android.app`;
    } else if (platform === 'harmonyos') {
      return `com.${sanitized || 'myapp'}_harmony.app`;
    } else {
      return `com.${sanitized || 'myapp'}.ios.app`;
    }
  };

  // 当应用名称变化时，如果包名为空或是自动生成的，则自动更新包名
  const handleAppNameWithPackage = (name: string) => {
    handleAppNameChange(name);
    const autoAndroidPackage = generatePackageName(appName, 'android');
    const autoIosPackage = generatePackageName(appName, 'ios');
    const autoHarmonyPackage = generatePackageName(appName, 'harmonyos');

    if (!packageName || packageName === autoAndroidPackage || packageName.startsWith('com.') && packageName.includes('.android.app')) {
      setPackageName(generatePackageName(name, 'android'));
    }
    if (!bundleId || bundleId === autoIosPackage || bundleId.startsWith('com.') && bundleId.includes('.ios.app')) {
      setBundleId(generatePackageName(name, 'ios'));
    }
    if (!harmonyBundleName || harmonyBundleName === autoHarmonyPackage || harmonyBundleName.startsWith('com.') && harmonyBundleName.includes('_harmony.app')) {
      setHarmonyBundleName(generatePackageName(name, 'harmonyos'));
    }
  };

  useEffect(() => {
    const urlParam = searchParams.get("url");
    if (urlParam) {
      setUrl(urlParam);
    }
  }, [searchParams]);

  // Check if Android is the only selected platform
  const isAndroidOnly = selectedPlatforms.length === 1 && (selectedPlatforms[0] === "android-source" || selectedPlatforms[0] === "android-apk");
  const hasAndroid = selectedPlatforms.includes("android-source") || selectedPlatforms.includes("android-apk");
  const hasIOS = selectedPlatforms.includes("ios");
  const hasWechat = selectedPlatforms.includes("wechat");
  const hasHarmonyOS = selectedPlatforms.includes("harmonyos-source");
  const hasChrome = selectedPlatforms.includes("chrome");
  const hasWindows = selectedPlatforms.includes("windows");
  const hasMacos = selectedPlatforms.includes("macos");
  const hasLinux = selectedPlatforms.includes("linux");
  const isIOSOnly = selectedPlatforms.length === 1 && selectedPlatforms[0] === "ios";
  const isWechatOnly = selectedPlatforms.length === 1 && selectedPlatforms[0] === "wechat";
  const isHarmonyOSOnly = selectedPlatforms.length === 1 && selectedPlatforms[0] === "harmonyos-source";
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

      // 检查游客剩余构建次数（移除强制跳转，改为友好提示）
      if (!guestBuild.hasRemaining) {
        toast.error(
          currentLanguage === "zh"
            ? `今日游客构建次数已用完（${guestBuild.limit}次/天）\n明天自动重置，或登录后继续使用`
            : `Daily guest build limit reached (${guestBuild.limit}/day)\nResets tomorrow, or login to continue`
        );
        return;
      }

      // 游客模式仅支持移动端平台（Android、iOS、HarmonyOS）
      const unsupportedPlatforms = selectedPlatforms.filter(p =>
        !["android-source", "android-apk", "ios", "harmonyos-source"].includes(p)
      );
      if (unsupportedPlatforms.length > 0) {
        toast.error(
          currentLanguage === "zh"
            ? `游客模式仅支持移动端平台（Android、iOS、HarmonyOS），请登录后使用其他平台`
            : `Guest mode only supports mobile platforms (Android, iOS, HarmonyOS). Please login for other platforms.`
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
        let currentAppName = appName;
        if (platform === "android-source" || platform === "android-apk") {
          formData.append("appName", appName);
        } else if (platform === "chrome") {
          currentAppName = chromeExtensionName;
          formData.append("appName", chromeExtensionName);
        } else if (platform === "windows") {
          currentAppName = windowsAppName;
          formData.append("appName", windowsAppName);
        } else if (platform === "macos") {
          currentAppName = macosAppName;
          formData.append("appName", macosAppName);
        } else if (platform === "linux") {
          currentAppName = linuxAppName;
          formData.append("appName", linuxAppName);
        }

        // 添加构建记录到历史
        const buildId = guestBuildHistory.addBuild({
          platform,
          appName: currentAppName,
          url,
          status: "building",
        });

        toast.info(
          currentLanguage === "zh"
            ? "游客模式构建中，请稍候..."
            : "Building in guest mode, please wait..."
        );

        const guestApiPath = IS_DOMESTIC_VERSION ? "/api/domestic/guest/build" : "/api/international/guest/build";

        try {
          const response = await fetch(guestApiPath, {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            const error = await response.json();
            // 更新构建记录为失败
            guestBuildHistory.updateBuild(buildId, {
              status: "failed",
              error: error.message || error.error || "Guest build failed",
            });
            throw new Error(error.message || error.error || "Guest build failed");
          }

          // API 成功后再消费本地次数
          guestBuild.consumeBuild();

          const result = await response.json();

          // 更新构建记录为完成，保存下载数据
          guestBuildHistory.updateBuild(buildId, {
            status: "completed",
            fileName: result.fileName,
            downloadData: result.data,
          });

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
        } catch (error) {
          // 如果是网络错误或其他未捕获的错误，更新构建记录
          if (error instanceof Error && !error.message.includes("Guest build failed")) {
            guestBuildHistory.updateBuild(buildId, {
              status: "failed",
              error: error.message,
            });
          }
          throw error;
        }

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
        iconUrl?: string; // 图标 URL（替代 base64）
        iconBase64?: string; // 保留向后兼容
        iconType?: string;
      };
      const platforms: PlatformConfig[] = [];

      // 收集需要上传的图标
      const iconsToUpload: Array<{ file: File; platform: string }> = [];
      if (hasAndroid && appIcon) {
        // 使用实际选中的 Android 平台 ID
        const androidPlatform = selectedPlatforms.find(p => p === "android-source" || p === "android-apk") || "android-source";
        iconsToUpload.push({ file: appIcon, platform: androidPlatform });
      }
      if (hasIOS && iosIcon) iconsToUpload.push({ file: iosIcon, platform: "ios" });
      if (hasHarmonyOS && harmonyIcon) iconsToUpload.push({ file: harmonyIcon, platform: "harmonyos" });
      if (hasChrome && chromeExtensionIcon) iconsToUpload.push({ file: chromeExtensionIcon, platform: "chrome" });
      if (hasWindows && windowsIcon) iconsToUpload.push({ file: windowsIcon, platform: "windows" });
      if (hasMacos && macosIcon) iconsToUpload.push({ file: macosIcon, platform: "macos" });
      if (hasLinux && linuxIcon) iconsToUpload.push({ file: linuxIcon, platform: "linux" });

      // 批量上传图标到 Supabase Storage（避免 Vercel 4.5MB 请求体限制）
      // 国内版：使用已上传的 iconPath（用户在选择图标��已立即上传）
      let iconUrls: Record<string, string> = {};

      if (iconsToUpload.length > 0 && user?.id) {
        // 国内版：等待所有正在进行的图标上传完成，然后使用已上传的 iconPath
        if (IS_DOMESTIC_VERSION) {
          console.log("[Domestic] Waiting for any pending icon uploads to complete...");
          const pendingUploads = Object.entries(uploadingPromisesRef.current);
          if (pendingUploads.length > 0) {
            console.log(`[Domestic] Found ${pendingUploads.length} pending uploads, waiting...`);
            await Promise.all(pendingUploads.map(([_, promise]) => promise));
            console.log("[Domestic] All pending uploads completed");
          }
          console.log("[Domestic] Using pre-uploaded icon paths for batch build");
          // iconPath 将在构建平台配置时从 uploadedIconPathsRef 中获取
        } else {
          // 国际版：上传到 Supabase Storage
          try {
            const uploadResults = await uploadIconsBatch(iconsToUpload, user.id);

            // 检查上传失败（仅警告，不中断构建流程）
            const failedUploads = uploadResults.filter(r => !r.success);
            if (failedUploads.length > 0) {
              console.warn("部分图标上传失败:", failedUploads);
              toast.warning(
                currentLanguage === "zh"
                  ? `部分图标上传失败: ${failedUploads.map(f => f.platform).join(", ")}，将继续构建`
                  : `Some icons failed to upload: ${failedUploads.map(f => f.platform).join(", ")}, continuing build`
              );
            }

            // 构建 URL 映射（国际版）
            uploadResults.forEach(r => {
              if (r.success && r.url) {
                iconUrls[r.platform] = r.url;
              }
            });
          } catch (uploadError) {
            console.error("图标上传异常:", uploadError);
            toast.warning(
              currentLanguage === "zh"
                ? "图标上传服务异常，将继续构建（不使用图标）"
                : "Icon upload service error, continuing build without icons"
            );
          }
        }
      }

      // 构建各平台配置
      if (hasAndroid) {
        // 使用实际选中的 Android 平台 ID
        const androidPlatform = selectedPlatforms.find(p => p === "android-source" || p === "android-apk") || "android-source";
        const latestIconPath = uploadedIconPathsRef.current[androidPlatform] || uploadedIconPaths[androidPlatform];
        platforms.push({
          platform: androidPlatform, appName, packageName,
          versionName: androidVersionName, versionCode: androidVersionCode, privacyPolicy,
          ...(IS_DOMESTIC_VERSION && latestIconPath ? { iconPath: latestIconPath } : iconUrls[androidPlatform] && { iconUrl: iconUrls[androidPlatform] }),
        });
      }
      if (hasIOS) {
        const latestIconPath = uploadedIconPathsRef.current.ios || uploadedIconPaths.ios;
        platforms.push({
          platform: "ios", appName, bundleId,
          versionString: iosVersionString, buildNumber: iosBuildNumber, privacyPolicy: iosPrivacyPolicy,
          ...(IS_DOMESTIC_VERSION && latestIconPath ? { iconPath: latestIconPath } : iconUrls.ios && { iconUrl: iconUrls.ios }),
        });
      }
      if (hasWechat) {
        platforms.push({ platform: "wechat", appName, appId: wechatAppId, version: wechatVersion });
      }
      if (hasHarmonyOS) {
        const latestIconPath = uploadedIconPathsRef.current["harmonyos-source"] || uploadedIconPaths["harmonyos-source"];
        platforms.push({
          platform: "harmonyos-source", appName, bundleName: harmonyBundleName,
          versionName: harmonyVersionName, versionCode: harmonyVersionCode, privacyPolicy: harmonyPrivacyPolicy,
          ...(IS_DOMESTIC_VERSION && latestIconPath ? { iconPath: latestIconPath } : iconUrls["harmonyos-source"] && { iconUrl: iconUrls["harmonyos-source"] }),
        });
      }
      if (hasChrome) {
        const latestIconPath = uploadedIconPathsRef.current.chrome || uploadedIconPaths.chrome;
        platforms.push({
          platform: "chrome", appName: chromeExtensionName,
          versionName: chromeExtensionVersion, description: chromeExtensionDescription,
          ...(IS_DOMESTIC_VERSION && latestIconPath ? { iconPath: latestIconPath } : iconUrls.chrome && { iconUrl: iconUrls.chrome }),
        });
      }
      if (hasWindows) {
        // 使用 ref 获取最新的 iconPath，避免 state 更新延迟
        const latestIconPath = uploadedIconPathsRef.current.windows || uploadedIconPaths.windows;
        console.log(`[Build Config] Windows platform - IS_DOMESTIC_VERSION: ${IS_DOMESTIC_VERSION}, uploadedIconPaths.windows: ${uploadedIconPaths.windows}, latestIconPath from ref: ${latestIconPath}, iconUrls.windows: ${iconUrls.windows}`);
        platforms.push({
          platform: "windows", appName: windowsAppName,
          ...(IS_DOMESTIC_VERSION && latestIconPath ? { iconPath: latestIconPath } : iconUrls.windows && { iconUrl: iconUrls.windows }),
        });
      }
      if (hasMacos) {
        const latestIconPath = uploadedIconPathsRef.current.macos || uploadedIconPaths.macos;
        platforms.push({
          platform: "macos", appName: macosAppName,
          ...(IS_DOMESTIC_VERSION && latestIconPath ? { iconPath: latestIconPath } : iconUrls.macos && { iconUrl: iconUrls.macos }),
        });
      }
      if (hasLinux) {
        const latestIconPath = uploadedIconPathsRef.current.linux || uploadedIconPaths.linux;
        platforms.push({
          platform: "linux", appName: linuxAppName,
          ...(IS_DOMESTIC_VERSION && latestIconPath ? { iconPath: latestIconPath } : iconUrls.linux && { iconUrl: iconUrls.linux }),
        });
      }

      // 检测是否为 Android APK 单独构建
      const isAndroidApkOnly = platforms.length === 1 && platforms[0].platform === "android-apk";

      let response;
      if (isAndroidApkOnly && IS_DOMESTIC_VERSION) {
        // Android APK 使用专用 API（仅国内版支持）
        const formData = new FormData();
        formData.append("url", url);
        formData.append("appName", platforms[0].appName);
        formData.append("packageName", platforms[0].packageName || "");
        formData.append("versionName", platforms[0].versionName);
        formData.append("versionCode", platforms[0].versionCode);
        formData.append("privacyPolicy", platforms[0].privacyPolicy || "");
        if (platforms[0].iconPath) {
          formData.append("iconPath", platforms[0].iconPath);
        }

        response = await fetch("/api/domestic/android-apk/build", {
          method: "POST",
          body: formData,
        });
      } else {
        // 发送批量构建请求（一次请求，服务端批量创建记录后立即返回）
        const apiPath = IS_DOMESTIC_VERSION ? "/api/domestic/batch/build" : "/api/international/batch/build";
        response = await fetch(apiPath, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, platforms }),
        });
      }

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
      // 注意：不在这里重置 isSubmitting，保持按钮禁用直到页面跳转完成
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
      // 只在出错时重置 isSubmitting，允许用户重试
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

        <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
          {/* Guest Build History - Only show for guest users */}
          {isGuestMode && guestBuildHistory.history.length > 0 && (
            <div className="bg-card/50 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-border/50 p-4 sm:p-6 md:p-8 shadow-xl shadow-black/5">
              <GuestBuildHistory />
            </div>
          )}

        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
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
                  onIconChange={(file) => handleIconChange(file, "android", setAppIcon)}
                  isApkBuild={selectedPlatforms.includes("android-apk")}
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
                    onIconChange={(file) => handleIconChange(file, "ios", setIosIcon)}
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
                    onIconChange={(file) => handleIconChange(file, "harmonyos", setHarmonyIcon)}
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
                    onIconChange={(file) => handleIconChange(file, "chrome", setChromeExtensionIcon)}
                  />
                </div>
              )}

              {/* Show Windows config if Windows is selected */}
              {hasWindows && (
                <div className={(hasAndroid || hasIOS || hasWechat || hasHarmonyOS || hasChrome) ? "mt-8 pt-8 border-t border-border/50" : ""}>
                  <WindowsConfig
                    name={windowsAppName}
                    onNameChange={setWindowsAppName}
                    onIconChange={(file) => handleIconChange(file, "windows", setWindowsIcon)}
                  />
                </div>
              )}

              {/* Show macOS config if macOS is selected */}
              {hasMacos && (
                <div className={(hasAndroid || hasIOS || hasWechat || hasHarmonyOS || hasChrome || hasWindows) ? "mt-8 pt-8 border-t border-border/50" : ""}>
                  <MacOSConfig
                    name={macosAppName}
                    onNameChange={setMacosAppName}
                    onIconChange={(file) => handleIconChange(file, "macos", setMacosIcon)}
                  />
                </div>
              )}

              {/* Show Linux config if Linux is selected */}
              {hasLinux && (
                <div className={(hasAndroid || hasIOS || hasWechat || hasHarmonyOS || hasChrome || hasWindows || hasMacos) ? "mt-8 pt-8 border-t border-border/50" : ""}>
                  <LinuxConfig
                    name={linuxAppName}
                    onNameChange={setLinuxAppName}
                    onIconChange={(file) => handleIconChange(file, "linux", setLinuxIcon)}
                  />
                </div>
              )}

              {/* Show prompt if no platform is selected */}
              {selectedPlatforms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-4 sm:mb-6">
                    <Layers className="h-8 w-8 sm:h-10 sm:w-10 text-purple-400" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-foreground/90 mb-2">
                    {currentLanguage === "zh" ? "请先选择构建平台" : "Please Select a Platform First"}
                  </h3>
                  <p className="text-sm sm:text-base text-muted-foreground text-center max-w-md">
                    {currentLanguage === "zh"
                      ? "在配置应用信息之前，请先在上方选择至少一个目标平台"
                      : "Before configuring app info, please select at least one target platform above"}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const platformSection = document.querySelector('[class*="bg-card/50"]');
                      platformSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="mt-6 px-6 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium transition-all duration-200 shadow-lg shadow-purple-500/25"
                  >
                    {currentLanguage === "zh" ? "返回选择平台" : "Go to Platform Selection"}
                  </button>
                </div>
              ) : (
                /* Show generic config if no specific platform is selected but other platforms are */
                !hasAndroid && !hasIOS && !hasWechat && !hasHarmonyOS && !hasChrome && !hasWindows && !hasMacos && !hasLinux && (
                  <AppConfig
                    name={appName}
                    description={appDescription}
                    onNameChange={setAppName}
                    onDescriptionChange={setAppDescription}
                    onIconChange={setAppIcon}
                  />
                )
              )}
          </div>

          {/* Submit Button */}
          <div className="flex flex-col items-center gap-3 sm:gap-4 pt-4 sm:pt-6 pb-8 sm:pb-12">
            {/* Guest Mode Notice */}
            {isGuestMode && (
              <div className="w-full max-w-2xl">
                <div className={`rounded-xl border bg-card p-5 sm:p-6 ${
                  guestBuild.remaining === 0
                    ? "border-red-200 dark:border-red-800"
                    : guestBuild.remaining <= 1
                    ? "border-amber-200 dark:border-amber-800"
                    : "border-border"
                }`}>
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-lg flex items-center justify-center ${
                      guestBuild.remaining === 0
                        ? "bg-red-100 dark:bg-red-900/30"
                        : guestBuild.remaining <= 1
                        ? "bg-amber-100 dark:bg-amber-900/30"
                        : "bg-cyan-100 dark:bg-cyan-900/30"
                    }`}>
                      <UserX className={`h-6 w-6 sm:h-7 sm:w-7 ${
                        guestBuild.remaining === 0
                          ? "text-red-600 dark:text-red-400"
                          : guestBuild.remaining <= 1
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-cyan-600 dark:text-cyan-400"
                      }`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg sm:text-xl font-semibold">
                          {currentLanguage === "zh" ? "游客模式" : "Guest Mode"}
                        </h3>
                        {guestBuild.remaining === 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium">
                            {currentLanguage === "zh" ? "已用完" : "Depleted"}
                          </span>
                        )}
                      </div>

                      {/* Build count with progress bar */}
                      <div className="space-y-2 mb-3">
                        <div className="flex items-baseline gap-2">
                          <span className={`text-2xl sm:text-3xl font-bold tabular-nums ${
                            guestBuild.remaining === 0
                              ? "text-red-600 dark:text-red-400"
                              : guestBuild.remaining <= 1
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-cyan-600 dark:text-cyan-400"
                          }`}>
                            {guestBuild.remaining}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            / {guestBuild.limit} {currentLanguage === "zh" ? "次" : "builds"}
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              guestBuild.remaining === 0
                                ? "bg-red-500"
                                : guestBuild.remaining <= 1
                                ? "bg-amber-500"
                                : "bg-cyan-500"
                            }`}
                            style={{ width: `${(guestBuild.remaining / guestBuild.limit) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Platform restriction */}
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span>
                          {currentLanguage === "zh"
                            ? "仅支持单平台构建（Android、iOS、HarmonyOS）"
                            : "Single platform only (Android, iOS, HarmonyOS)"}
                        </span>
                      </div>

                      {/* CTA */}
                      {guestBuild.remaining === 0 ? (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                          <span className="text-sm text-muted-foreground">
                            {currentLanguage === "zh" ? "💡 明天自动重置，或" : "💡 Resets tomorrow, or"}
                          </span>
                          <a
                            href="/auth/login?redirect=/generate"
                            className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
                          >
                            {currentLanguage === "zh" ? "立即登录" : "login now"}
                          </a>
                        </div>
                      ) : (
                        <a
                          href="/auth/login?redirect=/generate"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-muted hover:bg-muted/80 transition-colors"
                        >
                          <span>
                            {currentLanguage === "zh"
                              ? "登录解锁更多功能"
                              : "Login for unlimited builds"}
                          </span>
                          <ArrowRight className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
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
