"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type InviteSummary = {
  referralCode: string;
  shareUrl: string;
  clickCount: number;
  invitedCount: number;
  conversionRate: number;
  rewardDays: number; // 累计奖励的会员时长（天数）
  inviterSignupBonusDays: number; // 邀请人奖励天数
  invitedSignupBonusDays: number; // 被邀请人奖励天数
};

export default function InvitePage() {
  const router = useRouter();
  const { currentLanguage } = useLanguage();
  const { user, loading } = useAuth();
  const isZh = currentLanguage === "zh";

  const [summary, setSummary] = useState<InviteSummary | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const ui = useMemo(
    () =>
      isZh
        ? {
            title: "邀请中心",
            subtitle: "分享你的邀请链接，好友注册后双方都能获得会员时长。",
            back: "返回",
            loginRequiredTitle: "请先登录",
            loginRequiredDesc: "登录后即可查看邀请链接、邀请人数和奖励会员时长。",
            goLogin: "去登录",
            linkLabel: "邀请链接",
            statClicks: "总点击",
            statInvites: "累计邀请",
            statRewards: "累计奖励会员时长",
            statRate: "转化率",
            signupReward: "注册奖励（每成功注册一次）",
            inviter: "邀请人",
            invited: "被邀请人",
            copied: "已复制",
            copy: "复制",
          }
        : {
            title: "Invite Center",
            subtitle: "Share your invite link. When friends sign up, both of you earn membership days.",
            back: "Back",
            loginRequiredTitle: "Sign in required",
            loginRequiredDesc: "Sign in to view your invite link, invite count, and reward membership days.",
            goLogin: "Sign in",
            linkLabel: "Invite link",
            statClicks: "Clicks",
            statInvites: "Invites",
            statRewards: "Reward membership days",
            statRate: "Conversion",
            signupReward: "Signup reward (per successful signup)",
            inviter: "Inviter",
            invited: "Invited",
            copied: "Copied",
            copy: "Copy",
          },
    [isZh],
  );

  const goBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }, [router]);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setLoadingData(true);
    setError("");
    try {
      const response = await fetch(`/api/invite/summary?userId=${encodeURIComponent(String(user.id))}`, {
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to load invite summary");
      }
      setSummary(result.summary || null);
    } catch (err: any) {
      setError(err?.message || "Load failed");
    } finally {
      setLoadingData(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const copyLink = async () => {
    const shareUrl = summary?.shareUrl;
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
      toast.success(isZh ? "链接已复制" : "Link copied");
    } catch {
      setCopied(false);
      toast.error(isZh ? "复制失败" : "Copy failed");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-10 space-y-4">
        <Button variant="ghost" size="sm" className="h-8 px-1 gap-1" onClick={goBack}>
          <ArrowLeft className="h-4 w-4" />
          {ui.back}
        </Button>
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {isZh ? "正在加载..." : "Loading..."}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-10 space-y-4">
        <Button variant="ghost" size="sm" className="h-8 px-1 gap-1" onClick={goBack}>
          <ArrowLeft className="h-4 w-4" />
          {ui.back}
        </Button>
        <div className="max-w-lg rounded-2xl border border-border bg-card p-8">
          <h1 className="text-2xl font-semibold">{ui.loginRequiredTitle}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{ui.loginRequiredDesc}</p>
          <Button
            className="mt-6"
            onClick={() => {
              if (typeof window !== "undefined") {
                sessionStorage.setItem(
                  "auth_error",
                  isZh ? "请先登录后查看邀请中心" : "Please sign in to use Invite Center",
                );
                sessionStorage.setItem("post_login_redirect", "/invite");
                window.location.href = "/auth/login";
              }
            }}
          >
            {ui.goLogin}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-10 space-y-6">
      <Button variant="ghost" size="sm" className="h-8 px-1 gap-1 w-fit" onClick={goBack}>
        <ArrowLeft className="h-4 w-4" />
        {ui.back}
      </Button>

      <section className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{ui.title}</h1>
        <p className="text-sm text-muted-foreground">{ui.subtitle}</p>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
          <div className="text-xs text-muted-foreground">{ui.statClicks}</div>
          <div className="mt-1 text-2xl font-semibold">{summary?.clickCount ?? 0}</div>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
          <div className="text-xs text-muted-foreground">{ui.statInvites}</div>
          <div className="mt-1 text-2xl font-semibold">{summary?.invitedCount ?? 0}</div>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
          <div className="text-xs text-muted-foreground">{ui.statRewards}</div>
          <div className="mt-1 text-2xl font-semibold">{summary?.rewardDays ?? 0} {isZh ? "天" : "days"}</div>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
          <div className="text-xs text-muted-foreground">{ui.statRate}</div>
          <div className="mt-1 text-2xl font-semibold">{summary?.conversionRate ?? 0}%</div>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold">{ui.linkLabel}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {isZh ? "复制下方链接发送给好友，邀请注册即可获得会员时长奖励。" : "Copy the link below and share it with friends to earn membership days."}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{ui.linkLabel}</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input value={summary?.shareUrl || ""} readOnly />
            <Button
              className="w-full sm:w-auto"
              variant="outline"
              onClick={() => void copyLink()}
              disabled={!summary?.shareUrl || loadingData}
            >
              <Copy className="mr-2 h-4 w-4" />
              {copied ? ui.copied : ui.copy}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 text-sm shadow-sm">
          <p className="font-medium">{ui.signupReward}</p>
          <p className="text-muted-foreground mt-1">
            {ui.inviter} +{summary?.inviterSignupBonusDays ?? 7} {isZh ? "天" : "days"} / {ui.invited} +{summary?.invitedSignupBonusDays ?? 3} {isZh ? "天" : "days"}
          </p>
        </div>
      </section>
    </div>
  );
}

