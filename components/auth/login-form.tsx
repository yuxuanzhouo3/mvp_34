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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
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

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold"
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
    </div>
  );
}
