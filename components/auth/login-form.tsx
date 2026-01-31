"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, ArrowRight } from "lucide-react";
import { trackLoginEventClient } from "@/services/analytics-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PrivacyPolicy } from "@/components/legal/privacy-policy";
import { getLoginErrorMessage } from "@/lib/auth/login-error";

export function LoginForm() {
  const { currentLanguage } = useLanguage();
  const { signIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/generate";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error, userId } = await signIn(email, password);

    if (error) {
      const friendlyMessage = getLoginErrorMessage({
        isZh: currentLanguage === "zh",
        message: error.message,
      });
      setError(friendlyMessage || error.message);
      setLoading(false);
    } else {
      // 登录成功埋点
      if (userId) {
        trackLoginEventClient(userId, "email");
      }
      router.push(redirect);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-8 shadow-xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">
            {currentLanguage === "zh" ? "欢迎回来" : "Welcome Back"}
          </h1>
          <p className="text-muted-foreground">
            {currentLanguage === "zh"
              ? "登录您的账户继续"
              : "Sign in to your account to continue"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">
              {currentLanguage === "zh" ? "邮箱" : "Email"}
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder={currentLanguage === "zh" ? "输入您的邮箱" : "Enter your email"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12 rounded-xl"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              {currentLanguage === "zh" ? "密码" : "Password"}
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder={currentLanguage === "zh" ? "输入您的密码" : "Enter your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-12 rounded-xl"
                required
              />
            </div>
          </div>

          {/* 隐私条款勾选 */}
          <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={agreePrivacy}
              onChange={(e) => setAgreePrivacy(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
            />
            <span className="leading-snug flex flex-wrap items-center gap-1">
              {currentLanguage === "zh" ? "我已阅读并同意" : "I have read and agree to the"}
              <button
                type="button"
                className="text-cyan-500 hover:text-cyan-400 underline transition-colors"
                onClick={() => setShowPrivacyDialog(true)}
              >
                {currentLanguage === "zh" ? "《隐私条款》" : "Privacy Policy"}
              </button>
            </span>
          </label>

          <Button
            type="submit"
            disabled={loading || !agreePrivacy}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                {currentLanguage === "zh" ? "登录" : "Sign In"}
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {currentLanguage === "zh" ? "还没有账户？" : "Don't have an account?"}{" "}
          <Link
            href="/auth/register"
            className="text-cyan-500 hover:text-cyan-400 font-medium"
          >
            {currentLanguage === "zh" ? "立即注册" : "Sign Up"}
          </Link>
        </div>
      </div>

      {/* 隐私条款弹窗 */}
      <Dialog open={showPrivacyDialog} onOpenChange={setShowPrivacyDialog}>
        <DialogContent className="w-[95vw] sm:max-w-2xl lg:max-w-4xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden rounded-xl sm:rounded-2xl p-0 border-0 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-50/50 via-white to-blue-50/50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900" />
          <div className="absolute top-0 right-0 w-32 sm:w-48 lg:w-64 h-32 sm:h-48 lg:h-64 bg-gradient-to-br from-cyan-400/10 to-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 sm:w-48 lg:w-64 h-32 sm:h-48 lg:h-64 bg-gradient-to-br from-purple-400/10 to-pink-500/10 rounded-full blur-3xl" />

          <div className="relative z-10 flex flex-col h-full max-h-[90vh] sm:max-h-[85vh]">
            <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200/80 dark:border-gray-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex-shrink-0">
              <DialogTitle className="flex items-center gap-2 sm:gap-3 text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                <div className="p-1.5 sm:p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg sm:rounded-xl shadow-lg shadow-cyan-500/25">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <span>{currentLanguage === "zh" ? "隐私条款" : "Privacy Policy"}</span>
              </DialogTitle>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 ml-8 sm:ml-12">
                {currentLanguage === "zh" ? "请仔细阅读以下隐私条款" : "Please read the following privacy policy carefully"}
              </p>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4 bg-white/50 dark:bg-slate-800/50">
              <PrivacyPolicy currentLanguage={currentLanguage} />
            </div>

            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200/80 dark:border-gray-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex-shrink-0">
              <button
                onClick={() => {
                  setShowPrivacyDialog(false);
                  setAgreePrivacy(true);
                }}
                className="w-full py-2 sm:py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white text-sm sm:text-base font-medium rounded-lg sm:rounded-xl shadow-lg shadow-cyan-500/25 hover:shadow-xl hover:shadow-cyan-500/30 transition-all duration-300 hover:-translate-y-0.5"
              >
                {currentLanguage === "zh" ? "我已阅读并同意" : "I have read and agree"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
