import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import AuthCallbackClient from "./auth-callback-client";

export const dynamic = "force-dynamic";

export default function AuthCallbackClientPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        </div>
      }
    >
      <AuthCallbackClient />
    </Suspense>
  );
}
