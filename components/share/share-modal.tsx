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
  Lock,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [makePublic, setMakePublic] = useState(false);
  const [shareType, setShareType] = useState<"link" | "qrcode">("link");
  const [creating, setCreating] = useState(false);
  const [shares, setShares] = useState<ShareItem[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newShareUrl, setNewShareUrl] = useState<string | null>(null);
  const [newShareSecret, setNewShareSecret] = useState<string | null>(null);
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
      setExpiresInDays(7); // 默认7天
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
    setNewShareSecret(null);
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
          makePublic,
          expiresInDays,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create share");
      }

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

  // 监听 makePublic 变化,自动刷新分享链接
  useEffect(() => {
    // 只有在已经生成了分享链接的情况下才重新生成
    if (newShareUrl && open) {
      handleCreateShare();
    }
  }, [makePublic]);

  // 计算实际可用的最大天数
  const actualMaxDays = Math.min(maxShareDays, buildRemainingDays);
  const isTeam = (plan || "").toLowerCase() === "team";

  // 加载中状态
  if (plan === null && !planError) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[90vh]">
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
        <DialogContent className="sm:max-w-md max-h-[90vh]">
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
        <DialogContent className="sm:max-w-md max-h-[90vh]">
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {isZh ? "分享构建" : "Share Build"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto overflow-x-hidden pr-2 -mr-2">
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
                <Label>{isZh ? "分享链接有效期" : "Share Link Expires in"}</Label>
                <span className="text-sm font-medium">
                  {expiresInDays} {isZh ? "天" : expiresInDays === 1 ? "day" : "days"}
                </span>
              </div>
              <Slider
                value={[expiresInDays]}
                onValueChange={([v]) => setExpiresInDays(v)}
                min={1}
                max={30}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                {isZh
                  ? `可选择 1-30 天（实际有效期受套餐限制 ${maxShareDays} 天和构建剩余 ${buildRemainingDays} 天影响）`
                  : `Choose 1-30 days (actual expiry limited by plan: ${maxShareDays} days, build: ${buildRemainingDays} days)`}
              </p>
            </div>

            {/* 公开/私密分享选择 */}
            <div className="space-y-3">
              <Label>{isZh ? "分享类型" : "Share Type"}</Label>
              <RadioGroup
                value={makePublic ? "public" : "private"}
                onValueChange={(value) => setMakePublic(value === "public")}
              >
                <div className="flex items-center space-x-2 p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="private" id="private" />
                  <Label htmlFor="private" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Lock className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="font-medium">{isZh ? "私密分享" : "Private Share"}</p>
                      <p className="text-xs text-muted-foreground">
                        {isZh ? "需要密钥才能访问" : "Requires secret key"}
                      </p>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="public" id="public" />
                  <Label htmlFor="public" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Globe className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="font-medium">{isZh ? "公开分享" : "Public Share"}</p>
                      <p className="text-xs text-muted-foreground">
                        {isZh ? "任何人都可以访问" : "Anyone can access"}
                      </p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
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
              <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/10 overflow-hidden space-y-3">
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

                    {/* 秘钥显示（私密分享） */}
                    {newShareSecret && (
                      <div className="w-full p-3 rounded-lg border border-blue-500/30 bg-blue-500/10">
                        <div className="flex items-center gap-2 mb-2 justify-center">
                          <Lock className="h-4 w-4 text-blue-500" />
                          <Label className="text-sm font-medium">
                            {isZh ? "访问密钥" : "Access Secret"}
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 px-3 py-2 rounded-md border bg-background font-mono text-lg font-bold tracking-wider text-center">
                            {newShareSecret}
                          </div>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => handleCopy(newShareSecret, "secret")}
                          >
                            {copiedId === "secret" ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          {isZh ? "请妥善保管此密钥，访问者需要输入密钥才能查看分享内容" : "Keep this secret safe. Visitors need it to access the share"}
                        </p>
                      </div>
                    )}

                    {newShareExpiresAt && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {isZh ? "有效期至" : "Expires"}: {new Date(newShareExpiresAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
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

                    {/* 秘钥显示（私密分享） */}
                    {newShareSecret && (
                      <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/10">
                        <div className="flex items-center gap-2 mb-2">
                          <Lock className="h-4 w-4 text-blue-500" />
                          <Label className="text-sm font-medium">
                            {isZh ? "访问密钥" : "Access Secret"}
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 px-3 py-2 rounded-md border bg-background font-mono text-lg font-bold tracking-wider text-center">
                            {newShareSecret}
                          </div>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => handleCopy(newShareSecret, "secret")}
                          >
                            {copiedId === "secret" ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {isZh ? "请妥善保管此密钥，访问者需要输入密钥才能查看分享内容" : "Keep this secret safe. Visitors need it to access the share"}
                        </p>
                      </div>
                    )}

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
                          <>
                            <QrCode className="h-4 w-4 shrink-0" />
                            <span className="text-sm font-medium">
                              {isZh ? "二维码分享" : "QR Code Share"}
                            </span>
                          </>
                        ) : (
                          <>
                            <Link2 className="h-4 w-4 shrink-0" />
                            <span className="text-sm truncate">{share.shareUrl}</span>
                          </>
                        )}
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
                        {!share.expired && share.share_type !== "qrcode" && (
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

                    {/* 秘钥显示（私密分享 - 仅链接分享） */}
                    {share.secret && share.share_type !== "qrcode" && (
                      <div className="mt-2 p-2 rounded-md border border-blue-500/30 bg-blue-500/10">
                        <div className="flex items-center gap-2">
                          <Lock className="h-3 w-3 text-blue-500 shrink-0" />
                          <span className="text-xs text-muted-foreground shrink-0">
                            {isZh ? "密钥:" : "Secret:"}
                          </span>
                          <code className="flex-1 text-xs font-mono font-bold tracking-wider">
                            {share.secret}
                          </code>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0"
                            onClick={() => handleCopy(share.secret, `list-secret-${share.id}`)}
                          >
                            {copiedId === `list-secret-${share.id}` ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

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
      <DialogContent className="sm:max-w-sm max-h-[90vh]">
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

            {/* 秘钥显示（私密分享） */}
            {viewQrShare.secret && (
              <div className="w-full p-3 rounded-lg border border-blue-500/30 bg-blue-500/10">
                <div className="flex items-center gap-2 mb-2 justify-center">
                  <Lock className="h-4 w-4 text-blue-500" />
                  <Label className="text-sm font-medium">
                    {isZh ? "访问密钥" : "Access Secret"}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 rounded-md border bg-background font-mono text-lg font-bold tracking-wider text-center">
                    {viewQrShare.secret}
                  </div>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleCopy(viewQrShare.secret, `secret-${viewQrShare.id}`)}
                  >
                    {copiedId === `secret-${viewQrShare.id}` ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {isZh ? "请妥善保管此密钥，访问者需要输入密钥才能查看分享内容" : "Keep this secret safe. Visitors need it to access the share"}
                </p>
              </div>
            )}

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
