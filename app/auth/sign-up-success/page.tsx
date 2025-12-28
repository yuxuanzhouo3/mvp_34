import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import SignUpSuccessClient from "./sign-up-success-client";

export const dynamic = "force-dynamic";

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
    </div>
  );
}

export default function SignUpSuccessPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SignUpSuccessClient />
    </Suspense>
  );
}
