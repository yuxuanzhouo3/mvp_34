"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Crown, Zap, Calendar, Hammer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getAllPlansConfig } from "@/utils/plan-limits";
import { IS_DOMESTIC_VERSION } from "@/config";

// 套餐样式配置
const PLAN_STYLE = {
  Free: {
    color: "from-gray-400 to-gray-500",
    bgColor: "bg-gray-100 dark:bg-gray-800",
    textColor: "text-gray-600 dark:text-gray-400",
  },
  Pro: {
    color: "from-violet-500 to-purple-600",
    bgColor: "bg-violet-100 dark:bg-violet-900/30",
    textColor: "text-violet-600 dark:text-violet-400",
  },
  Team: {
    color: "from-amber-500 to-orange-600",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    textColor: "text-amber-600 dark:text-amber-400",
  },
};

// 从环境变量获取套餐配置
const PLAN_CONFIG = getAllPlansConfig();

interface WalletData {
  plan: string;
  plan_exp: string | null;
  daily_builds_limit: number;
  daily_builds_used: number;
  file_retention_days: number;
}

export function UserMenu() {
  const { currentLanguage } = useLanguage();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const isZh = currentLanguage === "zh";

  // 获取用户钱包数据
  const fetchWallet = async () => {
    if (!user) return;

    // 国内版从 API 获取钱包数据
    if (IS_DOMESTIC_VERSION) {
      try {
        const res = await fetch("/api/domestic/wallet", {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setWallet({
            plan: data.plan || "Free",
            plan_exp: data.plan_exp || null,
            daily_builds_limit: data.daily_builds_limit || 3,
            daily_builds_used: data.daily_builds_used || 0,
            file_retention_days: data.file_retention_days || 3,
          });
        } else {
          // API 失败时使用默认值
          setWallet({
            plan: "Free",
            plan_exp: null,
            daily_builds_limit: 3,
            daily_builds_used: 0,
            file_retention_days: 3,
          });
        }
      } catch (error) {
        console.error("[UserMenu] Failed to fetch wallet:", error);
        setWallet({
          plan: "Free",
          plan_exp: null,
          daily_builds_limit: 3,
          daily_builds_used: 0,
          file_retention_days: 3,
        });
      }
      return;
    }

    const supabase = createClient();
    const { data } = await supabase
      .from("user_wallets")
      .select("plan, plan_exp, daily_builds_limit, daily_builds_used, file_retention_days")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setWallet(data);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, [user]);

  // 监听额度刷新事件（构建完成、支付完成等场景）
  useEffect(() => {
    const handleQuotaRefresh = () => {
      fetchWallet();
    };

    window.addEventListener("quota:refresh", handleQuotaRefresh);
    return () => window.removeEventListener("quota:refresh", handleQuotaRefresh);
  }, [user]);

  const handleSignOut = async () => {
    setLoading(true);
    await signOut();
    router.push("/");
    router.refresh();
    setLoading(false);
  };

  if (!user) return null;

  // 用户信息 - 兼容国内版和国际版
  const userAny = user as any;
  const avatarUrl = IS_DOMESTIC_VERSION
    ? userAny.avatar
    : userAny.user_metadata?.avatar_url || userAny.user_metadata?.picture;
  const displayName = IS_DOMESTIC_VERSION
    ? userAny.name || userAny.email?.split("@")[0]
    : userAny.user_metadata?.full_name || userAny.user_metadata?.name || userAny.email?.split("@")[0];
  const userEmail = userAny.email;
  const avatarLetter = (displayName || userEmail || "U").charAt(0).toUpperCase();

  // 套餐信息
  const plan = wallet?.plan || "Free";
  const planStyle = PLAN_STYLE[plan as keyof typeof PLAN_STYLE] || PLAN_STYLE.Free;
  const planConfig = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG] || PLAN_CONFIG.Free;
  const dailyUsed = wallet?.daily_builds_used || 0;
  const dailyLimit = wallet?.daily_builds_limit || planConfig.dailyLimit;
  const dailyRemaining = Math.max(0, dailyLimit - dailyUsed);
  const dailyPercent = dailyLimit > 0 ? (dailyRemaining / dailyLimit) * 100 : 0;
  const isLow = dailyRemaining <= 1;

  // 到期时间
  const expDate = wallet?.plan_exp ? new Date(wallet.plan_exp) : null;
  const expDateStr = expDate
    ? expDate.toLocaleDateString(isZh ? "zh-CN" : "en-US", { year: "numeric", month: "short", day: "numeric" })
    : null;

  const AvatarContent = () => {
    if (avatarUrl) {
      return (
        <Image
          src={avatarUrl}
          alt={displayName || "User avatar"}
          width={40}
          height={40}
          className="rounded-full"
          unoptimized
        />
      );
    }
    return <span className="text-white font-semibold">{avatarLetter}</span>;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={`relative h-10 w-10 rounded-full overflow-hidden ${
            avatarUrl ? "p-0" : "bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500"
          }`}
        >
          <AvatarContent />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72" align="end" forceMount>
        {/* 用户信息 */}
        <div className="flex items-center gap-3 p-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-full overflow-hidden ${
              avatarUrl ? "" : "bg-gradient-to-br from-cyan-500 to-blue-600"
            }`}
          >
            <AvatarContent />
          </div>
          <div className="flex flex-col space-y-0.5 flex-1 min-w-0">
            {displayName && (
              <p className="text-sm font-medium truncate">{displayName}</p>
            )}
            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* 订阅身份铭牌 */}
        <div className="p-3 space-y-3">
          {/* 套餐标识 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg bg-gradient-to-br ${planStyle.color}`}>
                <Crown className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm">{plan}</span>
                  {plan !== "Free" && (
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${planStyle.textColor} border-current`}>
                      {isZh ? "订阅中" : "Active"}
                    </Badge>
                  )}
                </div>
                {expDateStr && plan !== "Free" && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                    <Calendar className="w-3 h-3" />
                    <span>{isZh ? `${expDateStr} 到期` : `Expires ${expDateStr}`}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 每日构建额度 */}
          <div className={`p-2.5 rounded-lg ${planStyle.bgColor}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <Hammer className="w-3.5 h-3.5" />
                {isZh ? "今日构建" : "Daily Builds"}
              </span>
              <span className={`text-xs font-bold ${isLow ? "text-red-500" : planStyle.textColor}`}>
                {dailyRemaining}/{dailyLimit}
              </span>
            </div>
            <Progress value={dailyPercent} className="h-1.5" />
            <div className="text-[10px] text-muted-foreground mt-1">
              {isZh ? "每日 00:00 UTC 重置" : "Resets daily at 00:00 UTC"}
            </div>
          </div>

          {/* 文件保留天数 */}
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-muted-foreground">{isZh ? "文件保留" : "File Retention"}</span>
            <span className="font-medium">
              {wallet?.file_retention_days || 3} {isZh ? "天" : "days"}
            </span>
          </div>

          {/* 升级提示 (仅 Free 用户) */}
          {plan === "Free" && (
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs gap-1.5 border-violet-300 dark:border-violet-700 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20"
                onClick={() => {
                  // 触发订阅弹窗 (通过自定义事件)
                  window.dispatchEvent(new CustomEvent("open-subscription-modal"));
                }}
              >
                <Zap className="w-3.5 h-3.5" />
                {isZh ? "升级获取更多额度" : "Upgrade for more builds"}
              </Button>
            </div>
          )}
        </div>

        <DropdownMenuSeparator />

        {/* 退出登录 */}
        <DropdownMenuItem
          onClick={handleSignOut}
          disabled={loading}
          className="cursor-pointer text-red-500 focus:text-red-500 m-1"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {isZh ? "退出登录" : "Sign Out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
