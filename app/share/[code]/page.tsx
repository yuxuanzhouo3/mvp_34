"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Download,
  Loader2,
  AlertCircle,
  Clock,
  Eye,
  Smartphone,
  Apple,
  MessageCircle,
  Hexagon,
  Chrome,
  Monitor,
  Terminal,
  Package,
  HardDrive,
  Lock,
} from "lucide-react";

interface ShareData {
  share: {
    shareType: string;
    expiresAt: string;
    accessCount: number;
  };
  build: {
    appName: string;
    platform: string;
    versionName: string;
    fileSize: number | null;
    iconUrl: string | null;
    downloadUrl: string | null;
  };
}

// 格式化文件大小
function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function SharePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const code = params.code as string;
  const urlSecret = searchParams.get("secret");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [needsSecret, setNeedsSecret] = useState(false);
  const [secret, setSecret] = useState(urlSecret || "");
  const [data, setData] = useState<ShareData | null>(null);

  const fetchShare = async (secretKey?: string) => {
    setLoading(true);
    setError(null);

    try {
      // 构建URL，如果有秘钥则添加到查询参数
      const buildUrl = (baseUrl: string) => {
        const url = new URL(baseUrl, window.location.origin);
        if (secretKey) {
          url.searchParams.set("secret", secretKey);
        }
        return url.toString();
      };

      // 尝试国内版 API
      let res = await fetch(buildUrl(`/api/domestic/share/${code}`));
      let json = await res.json();

      // 如果国内版返回需要秘钥，直接处理
      if (res.status === 403 || json.needsSecret) {
        setNeedsSecret(true);
        setError("需要密钥才能访问此分享");
        return;
      }

      // 如果国内版失败（非403），尝试国际版 API
      if (!res.ok) {
        res = await fetch(buildUrl(`/api/international/share/${code}`));
        json = await res.json();

        // 检查国际版是否需要秘钥
        if (res.status === 403 || json.needsSecret) {
          setNeedsSecret(true);
          setError("需要密钥才能访问此分享");
          return;
        }
      }

      if (!res.ok) {
        if (json.expired) {
          setExpired(true);
        } else {
          setError(json.error || "Failed to load share");
        }
        return;
      }

      setData(json);
      setNeedsSecret(false);
    } catch (err) {
      console.error("Fetch share error:", err);
      setError("Failed to load share");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!code) return;
    fetchShare(urlSecret || undefined);
  }, [code, urlSecret]);

  const handleSecretSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchShare(secret);
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "android":
        return <Smartphone className="h-6 w-6" />;
      case "ios":
        return <Apple className="h-6 w-6" />;
      case "wechat":
        return <MessageCircle className="h-6 w-6" />;
      case "harmonyos":
        return <Hexagon className="h-6 w-6" />;
      case "chrome":
        return <Chrome className="h-6 w-6" />;
      case "windows":
        return <Monitor className="h-6 w-6" />;
      case "macos":
        return <Apple className="h-6 w-6" />;
      case "linux":
        return <Terminal className="h-6 w-6" />;
      default:
        return <Package className="h-6 w-6" />;
    }
  };

  const getPlatformName = (platform: string) => {
    switch (platform) {
      case "android": return "Android";
      case "ios": return "iOS";
      case "wechat": return "WeChat";
      case "harmonyos": return "HarmonyOS";
      case "chrome": return "Chrome";
      case "windows": return "Windows";
      case "macos": return "MacOS";
      case "linux": return "Linux";
      default: return platform;
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case "android":
        return "text-[#3DDC84] bg-[#3DDC84]/10 border-[#3DDC84]/30";
      case "ios":
      case "macos":
        return "text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-500/10 border-gray-200 dark:border-gray-500/20";
      case "wechat":
        return "text-[#07C160] bg-[#07C160]/10 border-[#07C160]/30";
      case "harmonyos":
        return "text-[#E52828] bg-[#E52828]/10 border-[#E52828]/30";
      case "chrome":
        return "text-[#4285F4] bg-[#4285F4]/10 border-[#4285F4]/30";
      case "windows":
        return "text-[#0078D4] bg-[#0078D4]/10 border-[#0078D4]/30";
      case "linux":
        return "text-orange-600 bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20";
      default:
        return "text-purple-600 bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20";
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-cyan-500 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Expired state
  if (expired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
        <div className="max-w-md w-full bg-card rounded-2xl border shadow-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <Clock className="h-8 w-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Share Expired</h1>
          <p className="text-muted-foreground">
            This share link has expired and is no longer available.
          </p>
        </div>
      </div>
    );
  }

  // Secret input state
  if (needsSecret && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
        <div className="max-w-md w-full bg-card rounded-2xl border shadow-xl p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Lock className="h-8 w-8 text-blue-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">需要密钥</h1>
          <p className="text-muted-foreground text-center mb-6">
            此分享受密钥保护，请输入密钥以查看内容
          </p>
          <form onSubmit={handleSecretSubmit} className="space-y-4">
            <Input
              type="text"
              placeholder="输入密钥"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="text-center font-mono text-lg tracking-wider uppercase"
              maxLength={8}
            />
            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500"
              disabled={!secret}
            >
              访问分享
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
        <div className="max-w-md w-full bg-card rounded-2xl border shadow-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Share Not Found</h1>
          <p className="text-muted-foreground">
            {error || "This share link is invalid or has been removed."}
          </p>
        </div>
      </div>
    );
  }

  const { share, build } = data;
  const expiresAt = new Date(share.expiresAt);
  const expiresIn = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-md w-full bg-card rounded-2xl border shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-6 text-white">
          <div className="flex items-center gap-4">
            {/* App Icon */}
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center overflow-hidden">
              {build.iconUrl ? (
                <Image
                  src={build.iconUrl}
                  alt={build.appName}
                  width={64}
                  height={64}
                  className="object-cover"
                  unoptimized
                />
              ) : (
                getPlatformIcon(build.platform)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate">{build.appName}</h1>
              <p className="text-white/80 text-sm">
                v{build.versionName}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Info badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={getPlatformColor(build.platform)}>
              {getPlatformIcon(build.platform)}
              <span className="ml-1">{getPlatformName(build.platform)}</span>
            </Badge>
            {build.fileSize && (
              <Badge variant="outline" className="text-slate-600 dark:text-slate-400">
                <HardDrive className="h-3 w-3 mr-1" />
                {formatFileSize(build.fileSize)}
              </Badge>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Eye className="h-4 w-4" />
              <span>{share.accessCount} views</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>
                {expiresIn > 0
                  ? `Expires in ${expiresIn} day${expiresIn > 1 ? "s" : ""}`
                  : "Expires today"}
              </span>
            </div>
          </div>

          {/* Download button */}
          {build.downloadUrl ? (
            <Button
              className="w-full h-12 text-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20"
              onClick={() => window.open(build.downloadUrl!, "_blank")}
            >
              <Download className="h-5 w-5 mr-2" />
              Download
            </Button>
          ) : (
            <Button className="w-full h-12" disabled>
              Download Unavailable
            </Button>
          )}

          {/* Visit Website button */}
          <Button
            variant="outline"
            className="w-full h-11"
            onClick={() => window.open(process.env.NEXT_PUBLIC_APP_URL || "/", "_blank")}
          >
            Visit Official Website
          </Button>

          {/* Footer note */}
          <p className="text-xs text-center text-muted-foreground">
            Shared via AppBuilder • Download link valid for 1 hour
          </p>
        </div>
      </div>
    </div>
  );
}
