"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { getPlanShareExpireDays } from "@/utils/plan-limits";
import { IS_DOMESTIC_VERSION } from "@/config";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Link2,
  QrCode,
  Copy,
  Check,
  Loader2,
  Clock,
  Eye,
  Trash2,
  Crown,
  Download,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buildId: string;
  buildName: string;
  buildExpiresAt: string;
}

interface ShareItem {
  id: string;
  share_code: string;
  share_type: "link" | "qrcode";
  expires_at: string;
  access_count: number;
  shareUrl: string;
  expired: boolean;
}

export function ShareModal({
  open,
  onOpenChange,
  buildId,
  buildName,
  buildExpiresAt,
}: ShareModalProps) {
  const { currentLanguage } = useLanguage();
  const { user } = useAuth();
  const isZh = currentLanguage === "zh";

  const [plan, setPlan] = useState<string | null>(null); // null = loading
  const [maxShareDays, setMaxShareDays] = useState(0);
  const [buildRemainingDays, setBuildRemainingDays] = useState(0);
  const [expireDays, setExpireDays] = useState(1);
  const [shareType, setShareType] = useState<"link" | "qrcode">("link");
  const [creating, setCreating] = useState(false);
  const [shares, setShares] = useState<ShareItem[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newShareUrl, setNewShareUrl] = useState<string | null>(null);
  const [newShareExpiresAt, setNewShareExpiresAt] = useState<string | null>(null);
  const [viewQrShare, setViewQrShare] = useState<ShareItem | null>(null);
  const [planError, setPlanError] = useState(false); // API 请求失败

  // 获取用户套餐和计算限制
  useEffect(() => {
    if (!user || !open) return;

    // 重置状态
    setPlan(null);
    setPlanError(false);

    const fetchPlan = async () => {
      let userPlan: string | null = null;

      // 国内版：从国内 API 获取
      if (IS_DOMESTIC_VERSION) {
        try {
          const res = await fetch("/api/domestic/auth/me", { credentials: "include" });
          if (res.ok) {
            const data = await res.json();
            userPlan = data.user?.metadata?.plan || data.user?.plan || data.user?.subscriptionTier || "free";
          } else {
            // API 返回错误（如 401），标记为错误状态
            setPlanError(true);
            return;
          }
        } catch {
          // 网络错误，标记为错误状态
          setPlanError(true);
          return;
        }
      } else {
        // 国际版：使用 Supabase
        const supabase = createClient();
        const { data, error } = await supabase
          .from("user_wallets")
          .select("plan")
          .eq("user_id", user.id)
          .single();
        if (error) {
          setPlanError(true);
          return;
        }
        userPlan = data?.plan || "Free";
      }

      setPlan(userPlan);

      const maxDays = getPlanShareExpireDays(userPlan || "Free");
      setMaxShareDays(maxDays);

      // 计算构建剩余有效期
      const expiresAt = new Date(buildExpiresAt);
      const now = new Date();
      const remainingMs = expiresAt.getTime() - now.getTime();
      const remainingDays = Math.max(1, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
      setBuildRemainingDays(remainingDays);

      // 设置默认有效期
      const defaultDays = Math.min(maxDays, remainingDays, 7);
      setExpireDays(defaultDays > 0 ? defaultDays : 1);
    };

    fetchPlan();
  }, [user, open, buildExpiresAt]);

  // 获取现有分享列表
  useEffect(() => {
    if (!open || !buildId) return;

    const fetchShares = async () => {
      setLoadingShares(true);
      try {
        const apiPath = IS_DOMESTIC_VERSION ? "/api/domestic/share" : "/api/international/share";
        const res = await fetch(`${apiPath}?buildId=${buildId}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setShares(data.shares || []);
        }
      } catch (error) {
        console.error("Fetch shares error:", error);
      } finally {
        setLoadingShares(false);
      }
    };

    fetchShares();
  }, [open, buildId]);

  // 创建分享
  const handleCreateShare = async () => {
    if (maxShareDays === 0) {
      toast.error(isZh ? "当前套餐不支持分享功能" : "Sharing not available for your plan");
      return;
    }

    setCreating(true);
    setNewShareUrl(null);
    setNewShareExpiresAt(null);

    try {
      const apiPath = IS_DOMESTIC_VERSION ? "/api/domestic/share" : "/api/international/share";
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          buildId,
          expireDays,
          shareType,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create share");
      }

      setNewShareUrl(data.share.shareUrl);
      setNewShareExpiresAt(data.share.expiresAt);
      toast.success(isZh ? "分享链接已创建" : "Share link created");

      // 刷新分享列表
      const listRes = await fetch(`${apiPath}?buildId=${buildId}`, { credentials: "include" });
      if (listRes.ok) {
        const listData = await listRes.json();
        setShares(listData.shares || []);
      }
    } catch (error) {
      console.error("Create share error:", error);
      toast.error(error instanceof Error ? error.message : (isZh ? "创建分享失败" : "Failed to create share"));
    } finally {
      setCreating(false);
    }
  };

  // 复制链接
  const handleCopy = async (url: string, id?: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id || "new");
      toast.success(isZh ? "已复制到剪贴板" : "Copied to clipboard");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error(isZh ? "复制失败" : "Copy failed");
    }
  };

  // 删除分享
  const handleDelete = async (shareId: string) => {
    try {
      const apiPath = IS_DOMESTIC_VERSION ? "/api/domestic/share" : "/api/international/share";
      const res = await fetch(`${apiPath}?id=${shareId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to delete share");
      }

      setShares((prev) => prev.filter((s) => s.id !== shareId));
      toast.success(isZh ? "分享已删除" : "Share deleted");
    } catch (error) {
      console.error("Delete share error:", error);
      toast.error(isZh ? "删除失败" : "Delete failed");
    }
  };

  // 计算实际可用的最大天数
  const actualMaxDays = Math.min(maxShareDays, buildRemainingDays);
  const isTeam = (plan || "").toLowerCase() === "team";

  // 加载中状态
  if (plan === null && !planError) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              {isZh ? "分享构建" : "Share Build"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-sm">
              {isZh ? "正在加载..." : "Loading..."}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // API 请求失败状态（网络超时等）
  if (planError) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              {isZh ? "分享构建" : "Share Build"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
            <h3 className="font-semibold text-lg mb-2">
              {isZh ? "网络连接失败" : "Connection Failed"}
            </h3>
            <p className="text-muted-foreground text-sm mb-6">
              {isZh
                ? "无法获取套餐信息，请检查网络后重试"
                : "Failed to load plan info. Please check your network and try again."}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setPlanError(false);
                setPlan(null);
              }}
            >
              {isZh ? "重试" : "Retry"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Free 用户提示升级
  if (maxShareDays === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              {isZh ? "分享构建" : "Share Build"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-8 text-center">
            <Crown className="h-12 w-12 text-amber-500 mb-4" />
            <h3 className="font-semibold text-lg mb-2">
              {isZh ? "升级解锁分享功能" : "Upgrade to Unlock Sharing"}
            </h3>
            <p className="text-muted-foreground text-sm mb-6">
              {isZh
                ? "Pro 套餐支持链接分享，Team 套餐支持自定义分享"
                : "Pro plan supports link sharing, Team plan supports custom sharing"}
            </p>
            <Button
              className="bg-gradient-to-r from-violet-500 to-purple-600 text-white"
              onClick={() => {
                onOpenChange(false);
                window.dispatchEvent(new CustomEvent("open-subscription-modal"));
              }}
            >
              {isZh ? "查看套餐" : "View Plans"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
  <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {isZh ? "分享构建" : "Share Build"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 overflow-hidden">
          {/* 构建信息 */}
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="font-medium truncate">{buildName}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {isZh ? `构建有效期剩余 ${buildRemainingDays} 天` : `Build expires in ${buildRemainingDays} days`}
            </p>
          </div>

          {/* 创建新分享 */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">
              {isZh ? "创建新分享" : "Create New Share"}
            </h4>

            {/* 分享类型选择（仅 Team 用户可见） */}
            {isTeam && (
              <Tabs value={shareType} onValueChange={(v) => setShareType(v as "link" | "qrcode")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="link" className="gap-2">
                    <Link2 className="h-4 w-4" />
                    {isZh ? "链接分享" : "Link"}
                  </TabsTrigger>
                  <TabsTrigger value="qrcode" className="gap-2">
                    <QrCode className="h-4 w-4" />
                    {isZh ? "二维码" : "QR Code"}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {/* 有效期设置 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{isZh ? "有效期" : "Expires in"}</Label>
                <span className="text-sm font-medium">
                  {expireDays} {isZh ? "天" : expireDays === 1 ? "day" : "days"}
                </span>
              </div>
              <Slider
                value={[expireDays]}
                onValueChange={([v]) => setExpireDays(v)}
                min={1}
                max={actualMaxDays}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                {isZh
                  ? `最长 ${actualMaxDays} 天（套餐限制 ${maxShareDays} 天，构建剩余 ${buildRemainingDays} 天）`
                  : `Max ${actualMaxDays} days (plan limit: ${maxShareDays}, build expires: ${buildRemainingDays})`}
              </p>
            </div>

            {/* 创建按钮 */}
            <Button
              className="w-full"
              onClick={handleCreateShare}
              disabled={creating}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : shareType === "qrcode" ? (
                <QrCode className="h-4 w-4 mr-2" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              {isZh ? "创建分享" : "Create Share"}
            </Button>

            {/* 新创建的分享 */}
            {newShareUrl && (
              <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/10 overflow-hidden">
                {shareType === "qrcode" ? (
                  <div className="flex flex-col items-center gap-4">
                    <QRCodeSVG id="share-qrcode" value={newShareUrl} size={160} />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(newShareUrl, "new")}
                      >
                        {copiedId === "new" ? (
                          <Check className="h-4 w-4 mr-1 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4 mr-1" />
                        )}
                        {isZh ? "复制链接" : "Copy"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const svg = document.getElementById("share-qrcode");
                          if (!svg) return;
                          const svgData = new XMLSerializer().serializeToString(svg);
                          const canvas = document.createElement("canvas");
                          const ctx = canvas.getContext("2d");
                          const img = new window.Image();
                          img.onload = () => {
                            canvas.width = img.width;
                            canvas.height = img.height;
                            ctx?.drawImage(img, 0, 0);
                            const a = document.createElement("a");
                            a.download = "share-qrcode.png";
                            a.href = canvas.toDataURL("image/png");
                            a.click();
                          };
                          img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
                        }}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        {isZh ? "下载二维码" : "Download"}
                      </Button>
                    </div>
                    {newShareExpiresAt && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {isZh ? "有效期至" : "Expires"}: {new Date(newShareExpiresAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 w-full">
                      <div className="flex-1 min-w-0 px-3 py-2 rounded-md border bg-muted/50 overflow-hidden">
                        <p className="text-sm truncate">{newShareUrl}</p>
                      </div>
                      <Button
                        size="icon"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => handleCopy(newShareUrl, "new")}
                      >
                        {copiedId === "new" ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {newShareExpiresAt && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {isZh ? "有效期至" : "Expires"}: {new Date(newShareExpiresAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 现有分享列表 */}
          {shares.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm">
                {isZh ? "已创建的分享" : "Existing Shares"}
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className={`p-3 rounded-lg border overflow-hidden ${
                      share.expired
                        ? "border-red-500/30 bg-red-500/5"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 overflow-hidden">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {share.share_type === "qrcode" ? (
                          <QrCode className="h-4 w-4 shrink-0" />
                        ) : (
                          <Link2 className="h-4 w-4 shrink-0" />
                        )}
                        <span className="text-sm truncate">{share.shareUrl}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!share.expired && share.share_type === "qrcode" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => setViewQrShare(share)}
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                        )}
                        {!share.expired && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleCopy(share.shareUrl, share.id)}
                          >
                            {copiedId === share.id ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          onClick={() => handleDelete(share.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {share.expired
                          ? (isZh ? "已过期" : "Expired")
                          : new Date(share.expires_at).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {share.access_count} {isZh ? "次访问" : "views"}
                      </span>
                      {share.expired && (
                        <Badge variant="destructive" className="text-[10px]">
                          {isZh ? "已过期" : "Expired"}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* 二维码查看弹窗 */}
    <Dialog open={!!viewQrShare} onOpenChange={() => setViewQrShare(null)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            {isZh ? "查看二维码" : "View QR Code"}
          </DialogTitle>
        </DialogHeader>
        {viewQrShare && (
          <div className="flex flex-col items-center gap-4 py-4">
            <QRCodeSVG id="view-qrcode" value={viewQrShare.shareUrl} size={200} />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(viewQrShare.shareUrl, viewQrShare.id)}
              >
                {copiedId === viewQrShare.id ? (
                  <Check className="h-4 w-4 mr-1 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 mr-1" />
                )}
                {isZh ? "复制链接" : "Copy"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const svg = document.getElementById("view-qrcode");
                  if (!svg) return;
                  const svgData = new XMLSerializer().serializeToString(svg);
                  const canvas = document.createElement("canvas");
                  const ctx = canvas.getContext("2d");
                  const img = new window.Image();
                  img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx?.drawImage(img, 0, 0);
                    const a = document.createElement("a");
                    a.download = "share-qrcode.png";
                    a.href = canvas.toDataURL("image/png");
                    a.click();
                  };
                  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
                }}
              >
                <Download className="h-4 w-4 mr-1" />
                {isZh ? "下载" : "Download"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {isZh ? "有效期至" : "Expires"}: {new Date(viewQrShare.expires_at).toLocaleDateString()}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  </>
  );
}
