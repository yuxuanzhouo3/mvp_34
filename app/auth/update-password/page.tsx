"use client";

import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const dynamic = "force-dynamic";

export default function Page() {
  const supabase = createClient();
  const router = useRouter();
  const { currentLanguage } = useLanguage();
  const isZhText = currentLanguage === "zh";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "updating" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // 处理从邮件链接跳转过来的情况，设置 session
  useEffect(() => {
    const handleHashTokens = async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const access_token = hashParams.get("access_token");
      const refresh_token = hashParams.get("refresh_token");

      if (access_token && refresh_token) {
        console.info("[UpdatePassword] Setting session from hash tokens");
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (error) {
          console.error("[UpdatePassword] Failed to set session:", error.message);
          setError(error.message);
          setStatus("error");
        }
        // 清除 URL hash
        window.history.replaceState(null, "", window.location.pathname);
      }
    };
    handleHashTokens();
  }, [supabase]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 验证密码
    if (password.length < 6) {
      setError(isZhText ? "密码长度至少为6位" : "Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError(isZhText ? "两次输入的密码不一致" : "Passwords do not match");
      return;
    }

    setStatus("updating");

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setStatus("error");
        setError(error.message);
      } else {
        setStatus("success");
        toast.success(isZhText ? "密码已更新成功！" : "Password updated successfully!");
        // 密码更新成功后,用户已经通过邮件链接认证,直接跳转到首页
        setTimeout(() => {
          router.push("/");
        }, 1500);
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : (isZhText ? "更新失败" : "Update failed"));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-6 sm:py-8">
      {/* 背景效果 */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-cyan-950/20" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-cyan-500/10 via-blue-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-purple-500/10 via-blue-500/10 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        {/* 表单卡片 */}
        <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-5 sm:p-6 shadow-xl">
          <h1 className="text-2xl font-bold text-center mb-2">
            {isZhText ? "设置新密码" : "Set New Password"}
          </h1>
          <p className="text-muted-foreground text-center mb-6">
            {isZhText ? "请输入您的新密码" : "Please enter your new password"}
          </p>

          <form onSubmit={handleUpdate} className="space-y-4">
            {/* 新密码输入 */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                {isZhText ? "新密码" : "New Password"}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={isZhText ? "新密码 (至少6位)" : "New password (min 6 chars)"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 rounded-xl"
                  required
                  disabled={status === "updating" || status === "success"}
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* 确认密码输入 */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">
                {isZhText ? "确认新密码" : "Confirm New Password"}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder={isZhText ? "确认新密码" : "Confirm new password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 rounded-xl"
                  required
                  disabled={status === "updating" || status === "success"}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg p-3">
                {error}
              </div>
            )}

            {/* 成功提示 */}
            {status === "success" && (
              <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-lg p-3">
                <p>{isZhText ? "密码已更新成功！" : "Password updated successfully!"}</p>
                <p className="mt-1">{isZhText ? "正在跳转到首页..." : "Redirecting to home..."}</p>
              </div>
            )}

            {/* 提交按钮 */}
            <Button
              type="submit"
              className="w-full h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium"
              disabled={status === "updating" || status === "success"}
            >
              {status === "updating" ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  {isZhText ? "更新中..." : "Updating..."}
                </>
              ) : (
                isZhText ? "确认更新" : "Update Password"
              )}
            </Button>
          </form>

          {/* 返回登录链接 */}
          <div className="text-center mt-4">
            <Link href="/auth/login" className="text-sm text-cyan-500 hover:text-cyan-400">
              {isZhText ? "返回登录" : "Back to Login"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
