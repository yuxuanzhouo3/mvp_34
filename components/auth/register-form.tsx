"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { trackRegisterEventClient } from "@/services/analytics-client";

export function RegisterForm() {
  const { currentLanguage } = useLanguage();
  const { signUp } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(currentLanguage === "zh" ? "两次输入的密码不一致" : "Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError(currentLanguage === "zh" ? "密码至少需要6个字符" : "Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const { error, userId } = await signUp(email, password);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // 注册成功埋点
      if (userId) {
        trackRegisterEventClient(userId, "email");
      }
      setSuccess(true);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-8 shadow-xl text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">
            {currentLanguage === "zh" ? "注册成功！" : "Registration Successful!"}
          </h2>
          <p className="text-muted-foreground mb-6">
            {currentLanguage === "zh"
              ? "我们已向您的邮箱发送了确认邮件，请查收并点击链接完成验证。"
              : "We've sent a confirmation email to your inbox. Please check and click the link to verify your account."}
          </p>
          <Button
            onClick={() => router.push("/auth/login")}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold"
          >
            {currentLanguage === "zh" ? "前往登录" : "Go to Login"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-8 shadow-xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">
            {currentLanguage === "zh" ? "创建账户" : "Create Account"}
          </h1>
          <p className="text-muted-foreground">
            {currentLanguage === "zh"
              ? "注册以开始构建您的应用"
              : "Sign up to start building your apps"}
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
                placeholder={currentLanguage === "zh" ? "设置密码（至少6位）" : "Set password (min 6 chars)"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-12 rounded-xl"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">
              {currentLanguage === "zh" ? "确认密码" : "Confirm Password"}
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type="password"
                placeholder={currentLanguage === "zh" ? "再次输入密码" : "Confirm your password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 h-12 rounded-xl"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                {currentLanguage === "zh" ? "注册" : "Sign Up"}
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {currentLanguage === "zh" ? "已有账户？" : "Already have an account?"}{" "}
          <Link
            href="/auth/login"
            className="text-cyan-500 hover:text-cyan-400 font-medium"
          >
            {currentLanguage === "zh" ? "立即登录" : "Sign In"}
          </Link>
        </div>
      </div>
    </div>
  );
}
