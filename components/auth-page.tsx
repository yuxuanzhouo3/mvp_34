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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Mail, Lock, User, Eye, EyeOff, Layers, Send } from "lucide-react";
import { toast } from "sonner";
import { PrivacyPolicy } from "@/components/legal/privacy-policy";
import {
  isMiniProgram,
  parseWxMpLoginCallback,
  clearWxMpLoginParams,
  exchangeCodeForToken,
} from "@/lib/wechat-mp";
import { getLoginErrorMessage } from "@/lib/auth/login-error";
import { saveAuthState, type AuthUser } from "@/lib/auth-state-manager";

type Mode = "login" | "signup" | "reset";

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
  const [isInMiniProgram, setIsInMiniProgram] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    verificationCode: "",
  });
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

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

  const handleSendCode = async () => {
    if (!form.email) {
      toast.error(isZhText ? "请先输入邮箱地址" : "Please enter email first");
      return;
    }

    setSendingCode(true);

    try {
      const response = await fetch("/api/domestic/auth/send-verification-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });

      const data = await response.json();
      console.log("[handleSendCode] Response:", { ok: response.ok, status: response.status, data });

      if (!response.ok) {
        const errorMsg = data.error || (isZhText ? "发送验证码失败" : "Failed to send code");
        console.log("[handleSendCode] Error:", errorMsg);
        toast.error(errorMsg);
        return;
      }

      setCountdown(60);
      toast.success(isZhText ? "验证码已发送" : "Verification code sent");
    } catch (err) {
      console.error("[handleSendCode] Exception:", err);
      toast.error(err instanceof Error ? err.message : (isZhText ? "发送验证码失败" : "Failed to send code"));
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === "reset") {
        // 找回密码模式
        if (isDomesticVersion) {
          // 国内版：使用验证码重置密码
          if (!form.verificationCode) {
            throw new Error(isZhText ? "请输入验证码" : "Please enter verification code");
          }
          if (!form.password) {
            throw new Error(isZhText ? "请输入新密码" : "Please enter new password");
          }
          if (form.password.length < 6) {
            throw new Error(isZhText ? "密码至少需要6个字符" : "Password must be at least 6 characters");
          }

          const res = await fetch("/api/domestic/auth/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: form.email,
              verificationCode: form.verificationCode,
              newPassword: form.password,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || (isZhText ? "重置密码失败" : "Reset password failed"));

          toast.success(isZhText ? "密码重置成功！请登录" : "Password reset successful! Please sign in");
          router.push("/auth/login");
          return;
        } else {
          // 国际版：使用 Supabase 邮件重置
          const { error } = await supabase.auth.resetPasswordForEmail(
            form.email,
            { redirectTo: `${window.location.origin}/auth/update-password` }
          );
          if (error) throw error;
          toast.success(isZhText ? "重置链接已发送到您的邮箱" : "Password reset link sent to your email");
          router.push("/auth/login");
          return;
        }
      }

      if (mode === "signup") {
        // 验证密码长度
        if (form.password.length < 6) {
          throw new Error(isZhText ? "密码至少需要6个字符" : "Password must be at least 6 characters");
        }

        if (isDomesticVersion) {
          // 国内版：使用 CloudBase 注册
          if (!form.verificationCode) {
            throw new Error(isZhText ? "请输入验证码" : "Please enter verification code");
          }

          const res = await fetch("/api/domestic/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: form.email,
              password: form.password,
              name: form.name,
              verificationCode: form.verificationCode
            }),
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
            const loginMessage = getLoginErrorMessage({
              isZh: isZhText,
              status: res.status,
              message: data.error,
            });
            throw new Error(loginMessage || data.error || (isZhText ? "登录失败" : "Login failed"));
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
            const loginMessage = getLoginErrorMessage({
              isZh: isZhText,
              message: error.message,
              status: (error as { status?: number | null })?.status ?? null,
            });
            throw new Error(loginMessage || error.message);
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
      // 检查是否在 Android WebView 环境中
      const isAndroidWebView = typeof window !== 'undefined' && !!(window as any).GoogleSignIn;

      if (isAndroidWebView) {
        // 使用 Android 原生 Google Sign-In SDK
        const { signInWithGoogle: signInWithGoogleBridge } = await import('@/lib/google-signin-bridge');
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

        if (!clientId) {
          throw new Error('Google Client ID not configured');
        }

        const result = await signInWithGoogleBridge(clientId);

        // 使用返回的 idToken 调用后端 API 完成登录
        const response = await fetch('/api/auth/google-native', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken: result.idToken,
            email: result.email,
            displayName: result.displayName
          })
        });

        if (!response.ok) {
          throw new Error('Failed to authenticate with backend');
        }

        const data = await response.json();

        // 保存认证状态
        if (data.user) {
          saveAuthState(data.user);
        }

        toast.success(isZhText ? "登录成功！" : "Sign in successful!");
        router.push(next);
        router.refresh();
      } else {
        // 使用 Supabase OAuth 流程（浏览器环境）
        await signInWithGoogle(next);
      }
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
      const ua = navigator.userAgent.toLowerCase();

      // 检测是否在小程序环境中
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

      // 检测是否在Android原生应用中
      const isAndroidApp = ua.includes("mornclient") ||
        (window as any).gonative !== undefined ||
        (window as any).median !== undefined;

      if (isAndroidApp) {
        // Android原生应用：设置JavaScript回调函数接收code
        console.log("[AuthPage] In Android app, setting up native WeChat login callback");

        const callbackName = "__wechatNativeAuthCallback";

        (window as any)[callbackName] = async (payload: any) => {
          console.log("[AuthPage] Received native WeChat login callback:", payload);

          if (!payload || typeof payload !== "object") {
            toast.error(isZhText ? "微信登录失败：无效回调" : "WeChat login failed: invalid callback");
            setIsLoading(false);
            return;
          }

          if (payload.errCode !== 0 || !payload.code) {
            toast.error(payload.errStr || (isZhText ? "微信登录已取消或失败" : "WeChat login cancelled or failed"));
            setIsLoading(false);
            return;
          }

          // 使用code调用后端API
          try {
            console.log("[AuthPage] Calling /api/wxlogin with code");
            const res = await fetch("/api/wxlogin", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code: payload.code }),
            });

            const data = await res.json();
            console.log("[AuthPage] /api/wxlogin response:", {
              ok: res.ok,
              dataOk: data.ok,
              hasToken: !!data.token,
              hasUserInfo: !!data.userInfo,
              userInfo: data.userInfo
            });

            if (!res.ok || !data.ok) {
              throw new Error(data.error || (isZhText ? "登录失败" : "Login failed"));
            }

            // 保存认证状态到localStorage
            const user: AuthUser = {
              id: data.userInfo?.openid || data.openid,
              email: `${data.userInfo?.openid || data.openid}@wechat.user`,
              name: data.userInfo?.nickname || data.userInfo?.name || "微信用户",
              avatar: data.userInfo?.avatar || data.userInfo?.avatarUrl || "",
            };

            console.log("[AuthPage] Saving auth state:", {
              token: data.token?.substring(0, 20) + "...",
              user
            });

            // 保存到 localStorage
            saveAuthState(
              data.token,
              data.token, // 使用同一个token作为refreshToken
              user,
              {
                accessTokenExpiresIn: data.expiresIn || 3600,
                refreshTokenExpiresIn: data.expiresIn || 3600,
              }
            );

            console.log("[AuthPage] Auth state saved to localStorage, cookie set by server, redirecting to:", next);
            toast.success(isZhText ? "登录成功" : "Login successful");

            // 延迟跳转，确保存储操作完成
            setTimeout(() => {
              window.location.href = next;
            }, 100);
          } catch (error) {
            console.error("[AuthPage] WeChat login API error:", error);
            toast.error(
              error instanceof Error
                ? error.message
                : isZhText
                  ? "微信登录失败，请重试"
                  : "WeChat login failed. Please try again."
            );
            setIsLoading(false);
          }
        };

        const scheme = `wechat-login://start?callback=${encodeURIComponent(callbackName)}`;
        console.log("[AuthPage] Triggering native WeChat login, scheme:", scheme);
        window.location.href = scheme;
        return;
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
            {mode === "login"
              ? isZhText ? "欢迎回来" : "Welcome Back"
              : mode === "signup"
                ? isZhText ? "创建账号" : "Create Account"
                : isZhText ? "重置密码" : "Reset Password"}
          </h1>
          <p className="text-muted-foreground text-center mb-4">
            {mode === "login"
              ? isZhText ? "登录以继续使用" : "Sign in to continue"
              : mode === "signup"
                ? isZhText ? "注册以开始使用" : "Sign up to get started"
                : isZhText ? "输入您的邮箱，我们将发送重置链接" : "Enter your email to receive a reset link"}
          </p>

          {/* 第三方登录按钮 - 仅在登录模式显示 */}
          {isLoginMode && (
            <>
              {isDomesticVersion ? (
                // 国内版：微信登录
                <Button
                  type="button"
                  className="w-full h-11 rounded-xl gap-3 mb-4 bg-[#00c060] hover:bg-[#00a654] text-white"
                  onClick={handleWechatSignIn}
                  disabled={isLoading || !agreePrivacy}
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
                  className="w-full h-11 rounded-xl gap-3 mb-4"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading || !agreePrivacy}
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
              <div className="relative mb-4">
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
            {mode === "signup" && (
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

            {/* 验证码输入 - 在注册模式或找回密码模式且国内版显示 */}
            {(mode === "signup" || mode === "reset") && isDomesticVersion && (
              <div className="space-y-2">
                <Label htmlFor="verificationCode" className="text-sm font-medium">
                  {isZhText ? "邮箱验证码" : "Verification Code"}
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="verificationCode"
                      name="verificationCode"
                      type="text"
                      placeholder={isZhText ? "输入6位验证码" : "Enter 6-digit code"}
                      value={form.verificationCode}
                      onChange={handleChange}
                      className="h-11 rounded-xl"
                      maxLength={6}
                      required
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleSendCode}
                    disabled={sendingCode || countdown > 0 || !form.email}
                    className="h-11 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {sendingCode ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : countdown > 0 ? (
                      `${countdown}s`
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-1" />
                        {isZhText ? "发送" : "Send"}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* 密码输入 - 仅在登录和注册模式显示 */}
            {mode !== "reset" && (
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
            )}

            {/* 登录时显示忘记密码链接 */}
            {isLoginMode && (
              <div className="flex justify-end">
                <Link
                  href="/auth/reset-password"
                  className="text-sm text-cyan-500 hover:text-cyan-400"
                >
                  {isZhText ? "忘记密码？" : "Forgot password?"}
                </Link>
              </div>
            )}

            {/* 隐私条款复选框 */}
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="agree-privacy"
                checked={agreePrivacy}
                onChange={(e) => setAgreePrivacy(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
              />
              <label htmlFor="agree-privacy" className="text-sm text-muted-foreground cursor-pointer">
                {isZhText ? "我已阅读并同意" : "I have read and agree to the "}
                <button
                  type="button"
                  onClick={() => setShowPrivacyDialog(true)}
                  className="text-cyan-500 hover:text-cyan-400 underline"
                >
                  {isZhText ? "《隐私条款》" : "Privacy Policy"}
                </button>
              </label>
            </div>

            {/* 提交按钮 */}
            <Button
              type="submit"
              className="w-full h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium"
              disabled={isLoading || !agreePrivacy}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : mode === "login" ? (
                isZhText ? "登录" : "Sign In"
              ) : mode === "signup" ? (
                isZhText ? "注册" : "Sign Up"
              ) : (
                isZhText ? "发送重置邮件" : "Send Reset Email"
              )}
            </Button>
          </form>

          {/* 切换登录/注册 */}
          <p className="text-center text-sm text-muted-foreground mt-4">
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
                  <span>{isZhText ? "隐私条款" : "Privacy Policy"}</span>
                </DialogTitle>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 ml-8 sm:ml-12">
                  {isZhText ? "请仔细阅读以下隐私条款" : "Please read the following privacy policy carefully"}
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
                  {isZhText ? "我已阅读并同意" : "I have read and agree"}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
