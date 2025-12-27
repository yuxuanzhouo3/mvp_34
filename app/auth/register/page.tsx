"use client";

import { Suspense } from "react";
import { RegisterForm } from "@/components/auth";
import { Loader2, Sparkles } from "lucide-react";

function RegisterContent() {
  return (
    <div className="min-h-screen relative overflow-hidden pt-20 pb-12">
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-cyan-950/20" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-cyan-500/10 via-blue-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-purple-500/10 via-blue-500/10 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mb-8">
            <Sparkles className="h-4 w-4" />
            <span>MornClient</span>
          </div>
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <RegisterContent />
    </Suspense>
  );
}
