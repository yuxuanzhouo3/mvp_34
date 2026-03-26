import { Suspense } from "react";
import { AuthPage } from "@/components/auth-page";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AuthPage mode="signup" />
    </Suspense>
  );
}
