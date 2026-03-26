"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle2, Layers } from "lucide-react";

export default function SignUpSuccessClient() {
  const { currentLanguage } = useLanguage();
  const isZhText = currentLanguage === "zh";

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

        {/* 成功卡片 */}
        <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-8 shadow-xl text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>

          <h1 className="text-2xl font-bold mb-2">
            {isZhText ? "注册成功！" : "Registration Successful!"}
          </h1>

          <p className="text-muted-foreground mb-6">
            {isZhText
              ? "我们已向您的邮箱发送了一封验证邮件，请查收并点击链接完成验证。"
              : "We've sent a verification email to your inbox. Please check and click the link to verify your account."}
          </p>

          <div className="flex items-center justify-center gap-2 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 mb-6">
            <Mail className="h-5 w-5 text-cyan-500" />
            <span className="text-sm text-cyan-500">
              {isZhText ? "请检查您的邮箱（包括垃圾邮件文件夹）" : "Please check your email (including spam folder)"}
            </span>
          </div>

          <div className="space-y-3">
            <Button asChild className="w-full h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium">
              <Link href="/auth/login">
                {isZhText ? "前往登录" : "Go to Login"}
              </Link>
            </Button>

            <Button asChild variant="ghost" className="w-full h-11 rounded-xl">
              <Link href="/">
                {isZhText ? "返回首页" : "Back to Home"}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
