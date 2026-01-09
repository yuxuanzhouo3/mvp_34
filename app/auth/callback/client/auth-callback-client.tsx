"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { trackRegisterEventClient, trackLoginEventClient } from "@/services/analytics-client";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const next = searchParams.get("next") || "/";

        // 处理hash中的tokens（magic link / OAuth隐式流程）
        if (typeof window !== "undefined" && window.location.hash) {
          const hashParams = new URLSearchParams(
            window.location.hash.replace(/^#/, "")
          );
          const access_token = hashParams.get("access_token");
          const refresh_token = hashParams.get("refresh_token");

          if (access_token && refresh_token) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });

            if (sessionError) {
              throw sessionError;
            }

            // 获取用户信息并触发埋点
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const provider = user.app_metadata?.provider || "email";
              const createdAt = new Date(user.created_at);
              const now = new Date();
              const isNewUser = (now.getTime() - createdAt.getTime()) < 5 * 60 * 1000;

              if (isNewUser) {
                trackRegisterEventClient(user.id, provider);
              } else {
                trackLoginEventClient(user.id, provider);
              }
            }

            // 清除hash
            window.history.replaceState(null, "", window.location.pathname + window.location.search);

            router.replace(next);
            return;
          }
        }

        // 如果没有tokens，尝试获取当前session
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          router.replace(next);
        } else {
          // 没有session，重定向到登录
          router.replace("/auth/login?error=no_session");
        }
      } catch (err) {
        console.error("Callback error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
        setTimeout(() => {
          router.replace("/auth/login?error=callback_error");
        }, 2000);
      }
    };

    handleCallback();
  }, [router, searchParams, supabase]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-500">{error}</p>
        <p className="text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      <p className="text-muted-foreground">Completing authentication...</p>
    </div>
  );
}

export default function AuthCallbackClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
