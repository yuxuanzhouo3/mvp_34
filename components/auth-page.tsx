"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { signInWithGoogle } from "@/actions/oauth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Lock, User, Eye, EyeOff, Layers } from "lucide-react";
import { toast } from "sonner";
import {
  isMiniProgram,
  parseWxMpLoginCallback,
  clearWxMpLoginParams,
  exchangeCodeForToken,
} from "@/lib/wechat-mp";

type Mode = "login" | "signup";

interface AuthPageProps {
  mode: Mode;
}

// Google图标组件
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

// 微信图标组件
function WechatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.5 4C2.46 4 0 6.24 0 8.99c0 2 1.33 3.74 3.3 4.62-.12.45-.76 2.8-.79 3.02 0 0-.02.17.09.24.11.07.24.02.24.02.32-.05 3.04-1.99 3.47-2.31.4.06.8.09 1.19.09 3.04 0 5.5-2.23 5.5-4.99C13 6.24 10.54 4 7.5 4h-2Zm12 4c-2.49 0-4.5 1.8-4.5 4.02 0 1.34.7 2.53 1.78 3.31-.09.36-.53 2.04-.55 2.2 0 0-.02.13.07.19.09.06.2.02.2.02.26-.04 2.45-1.6 2.8-1.85.32.05.65.07.97.07 2.49 0 4.5-1.8 4.5-4.02C22 9.8 19.99 8 17.5 8Z" />
    </svg>
  );
}

export function AuthPage({ mode }: AuthPageProps) {
  const { currentLanguage, isDomesticVersion } = useLanguage();
  const isZhText = currentLanguage === "zh";
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || searchParams.get("redirect") || "/";

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isInMiniProgram, setIsInMiniProgram] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
  });

  // 检测小程序环境
  useEffect(() => {
    if (isDomesticVersion) {
      const inMp = isMiniProgram();
      setIsInMiniProgram(inMp);
      console.log("[AuthPage] Mini program environment:", inMp);
    }
  }, [isDomesticVersion]);

  // 处理小程序登录回调
  const handleMpLoginCallback = useCallback(async () => {
    if (!isDomesticVersion) return;

    const callback = parseWxMpLoginCallback();
    if (!callback) return;

    console.log("[AuthPage] Processing mini program login callback:", callback);
    setIsLoading(true);

    try {
      // 如果直接收到 token，直接使用
      if (callback.token && callback.openid) {
        console.log("[AuthPage] Direct token received from mini program");
        const res = await fetch("/api/domestic/auth/mp-callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: callback.token,
            openid: callback.openid,
            expiresIn: callback.expiresIn,
            nickName: callback.nickName,
            avatarUrl: callback.avatarUrl,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || (isZhText ? "登录失败" : "Login failed"));
        }

        clearWxMpLoginParams();
        router.push(next);
        return;
      }

      // 如果收到 code，需要换取 token
      if (callback.code) {
        console.log("[AuthPage] Exchanging code for token");
        const result = await exchangeCodeForToken(
          callback.code,
          callback.nickName,
          callback.avatarUrl
        );

        if (!result.success) {
          throw new Error(result.error || (isZhText ? "登录失败" : "Login failed"));
        }

        clearWxMpLoginParams();
        router.push(next);
        return;
      }
    } catch (err) {
      console.error("[AuthPage] Mini program login callback error:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : isZhText
            ? "微信登录失败，请重试"
            : "WeChat login failed. Please try again."
      );
      clearWxMpLoginParams();
    } finally {
      setIsLoading(false);
    }
  }, [isDomesticVersion, isZhText, next, router]);

  useEffect(() => {
    handleMpLoginCallback();
  }, [handleMpLoginCallback]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === "signup") {
        // 验证密码匹配
        if (form.password !== form.confirmPassword) {
          throw new Error(isZhText ? "两次输入的密码不一致" : "Passwords do not match");
        }

        // 验证密码长度
        if (form.password.length < 6) {
          throw new Error(isZhText ? "密码至少需要6个字符" : "Password must be at least 6 characters");
        }

        if (isDomesticVersion) {
          // 国内版：使用 CloudBase 注册
          const res = await fetch("/api/domestic/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: form.email, password: form.password, name: form.name }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || (isZhText ? "注册失败" : "Sign up failed"));
          }
          toast.success(isZhText ? "注册成功！" : "Registration successful!");
          router.push("/auth/login");
        } else {
          // 国际版：使用 Supabase 注册
          const confirmRedirectTo = new URL("/auth/confirm", window.location.origin);
          confirmRedirectTo.searchParams.set("next", next || "/");

          const { data, error } = await supabase.auth.signUp({
            email: form.email,
            password: form.password,
            options: {
              data: { full_name: form.name },
              emailRedirectTo: confirmRedirectTo.toString(),
            },
          });

          if (error) {
            throw error;
          }

          // 检查邮箱是否已被注册
          if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
            throw new Error(isZhText ? "该邮箱已被注册，请直接登录" : "This email is already registered. Please sign in.");
          }

          // 注册成功后立即登出（防止未验证邮箱访问）
          await supabase.auth.signOut();

          toast.success(
            isZhText ? "注册成功！请查看邮箱完成验证" : "Registration successful! Please check your email to verify."
          );

          router.push("/auth/sign-up-success");
        }
      } else {
        // 登录流程
        if (isDomesticVersion) {
          // 国内版：使用 CloudBase 登录
          const res = await fetch("/api/domestic/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: form.email, password: form.password }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || (isZhText ? "登录失败" : "Login failed"));
          }
          toast.success(isZhText ? "登录成功" : "Login successful");
          window.location.href = next;
        } else {
          // 国际版：使用 Supabase 登录
          const { data, error } = await supabase.auth.signInWithPassword({
            email: form.email,
            password: form.password,
          });

          if (error) {
            throw error;
          }

          // 检查邮箱是否已验证
          if (!data.user?.email_confirmed_at) {
            await supabase.auth.signOut();
            throw new Error(isZhText ? "请先验证您的邮箱" : "Please verify your email first");
          }

          toast.success(isZhText ? "登录成功" : "Login successful");
          window.location.href = next;
        }
      }
    } catch (error) {
      console.error("Auth error:", error);
      toast.error(error instanceof Error ? error.message : isZhText ? "操作失败" : "Operation failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isDomesticVersion) return;
    setIsLoading(true);
    try {
      await signInWithGoogle(next);
    } catch (error) {
      if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
        return;
      }
      console.error("Google sign in error:", error);
      toast.error(isZhText ? "Google登录失败" : "Google sign in failed");
      setIsLoading(false);
    }
  };

  const handleWechatSignIn = async () => {
    if (!isDomesticVersion) return;
    setIsLoading(true);

    try {
      // 检测是否在小程序环境中
      const ua = navigator.userAgent.toLowerCase();
      const inMiniProgram = ua.includes("miniprogram") ||
        (window as any).__wxjs_environment === "miniprogram";

      if (inMiniProgram) {
        // 小程序环境：使用原生登录
        const wx = (window as any).wx;
        const mp = wx?.miniProgram;

        if (mp && typeof mp.navigateTo === "function") {
          console.log("[AuthPage] In MiniProgram environment, using native login");
          const returnUrl = window.location.href;
          const loginUrl = `/pages/webshell/login?returnUrl=${encodeURIComponent(returnUrl)}`;
          mp.navigateTo({ url: loginUrl });
          return;
        }
      }

      // PC/手机浏览器环境：使用扫码登录
      console.log("[AuthPage] Using QR code login");
      const qs = next ? `?next=${encodeURIComponent(next)}` : "";
      const res = await fetch(`/api/domestic/auth/wechat/qrcode${qs}`);
      const data = await res.json();

      if (!res.ok || !data.qrcodeUrl) {
        throw new Error(data.error || (isZhText ? "微信登录失败" : "WeChat login failed"));
      }

      window.location.href = data.qrcodeUrl;
    } catch (err) {
      console.error("[AuthPage] WeChat login error:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : isZhText
            ? "微信登录失败，请稍后再试"
            : "WeChat login failed. Please try again."
      );
      setIsLoading(false);
    }
  };

  const isLoginMode = mode === "login";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      {/* 背景效果 */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-cyan-950/20" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-cyan-500/10 via-blue-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-purple-500/10 via-blue-500/10 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              MornClient
            </span>
          </Link>
        </div>

        {/* 表单卡片 */}
        <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-8 shadow-xl">
          <h1 className="text-2xl font-bold text-center mb-2">
            {isLoginMode
              ? isZhText ? "欢迎回来" : "Welcome Back"
              : isZhText ? "创建账号" : "Create Account"}
          </h1>
          <p className="text-muted-foreground text-center mb-6">
            {isLoginMode
              ? isZhText ? "登录以继续使用" : "Sign in to continue"
              : isZhText ? "注册以开始使用" : "Sign up to get started"}
          </p>

          {/* 第三方登录按钮 - 仅在登录模式显示 */}
          {isLoginMode && (
            <>
              {isDomesticVersion ? (
                // 国内版：微信登录
                <Button
                  type="button"
                  className="w-full h-11 rounded-xl gap-3 mb-6 bg-[#00c060] hover:bg-[#00a654] text-white"
                  onClick={handleWechatSignIn}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <WechatIcon className="h-5 w-5" />
                  )}
                  {isZhText ? "使用微信登录" : "Sign in with WeChat"}
                </Button>
              ) : (
                // 国际版：Google登录
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 rounded-xl gap-3 mb-6"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <GoogleIcon className="h-5 w-5" />
                  )}
                  {isZhText ? "使用 Google 登录" : "Sign in with Google"}
                </Button>
              )}

              {/* 分割线 */}
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    {isZhText ? "或使用邮箱" : "or continue with email"}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* 邮箱表单 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 注册时显示姓名输入 */}
            {!isLoginMode && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  {isZhText ? "姓名" : "Name"}
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder={isZhText ? "请输入姓名" : "Enter your name"}
                    value={form.name}
                    onChange={handleChange}
                    className="pl-10 h-11 rounded-xl"
                    required
                  />
                </div>
              </div>
            )}

            {/* 邮箱输入 */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                {isZhText ? "邮箱" : "Email"}
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder={isZhText ? "请输入邮箱" : "Enter your email"}
                  value={form.email}
                  onChange={handleChange}
                  className="pl-10 h-11 rounded-xl"
                  required
                />
              </div>
            </div>

            {/* 密码输入 */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                {isZhText ? "密码" : "Password"}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={isZhText ? "请输入密码" : "Enter your password"}
                  value={form.password}
                  onChange={handleChange}
                  className="pl-10 pr-10 h-11 rounded-xl"
                  required
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

            {/* 注册时显示确认密码 */}
            {!isLoginMode && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">
                  {isZhText ? "确认密码" : "Confirm Password"}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder={isZhText ? "请再次输入密码" : "Confirm your password"}
                    value={form.confirmPassword}
                    onChange={handleChange}
                    className="pl-10 pr-10 h-11 rounded-xl"
                    required
                    minLength={6}
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
            )}

            {/* 登录时显示忘记密码链接 */}
            {isLoginMode && !isDomesticVersion && (
              <div className="flex justify-end">
                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-cyan-500 hover:text-cyan-400"
                >
                  {isZhText ? "忘记密码？" : "Forgot password?"}
                </Link>
              </div>
            )}

            {/* 提交按钮 */}
            <Button
              type="submit"
              className="w-full h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isLoginMode ? (
                isZhText ? "登录" : "Sign In"
              ) : (
                isZhText ? "注册" : "Sign Up"
              )}
            </Button>
          </form>

          {/* 注册页面也显示第三方登录 */}
          {!isLoginMode && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    {isZhText ? "或" : "or"}
                  </span>
                </div>
              </div>

              {isDomesticVersion ? (
                <Button
                  type="button"
                  className="w-full h-11 rounded-xl gap-3 bg-[#00c060] hover:bg-[#00a654] text-white"
                  onClick={handleWechatSignIn}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <WechatIcon className="h-5 w-5" />
                  )}
                  {isZhText ? "使用微信登录" : "Sign up with WeChat"}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 rounded-xl gap-3"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <GoogleIcon className="h-5 w-5" />
                  )}
                  {isZhText ? "使用 Google 登录" : "Sign up with Google"}
                </Button>
              )}
            </>
          )}

          {/* 切换登录/注册 */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            {isLoginMode ? (
              <>
                {isZhText ? "还没有账号？" : "Don't have an account?"}{" "}
                <Link href="/auth/sign-up" className="text-cyan-500 hover:text-cyan-400 font-medium">
                  {isZhText ? "立即注册" : "Sign up"}
                </Link>
              </>
            ) : (
              <>
                {isZhText ? "已有账号？" : "Already have an account?"}{" "}
                <Link href="/auth/login" className="text-cyan-500 hover:text-cyan-400 font-medium">
                  {isZhText ? "立即登录" : "Sign in"}
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
