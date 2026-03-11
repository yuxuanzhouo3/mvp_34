import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import BuildsClient from "./builds-client";

export const dynamic = "force-dynamic";

function LoadingFallback() {
  return (
    <div className="min-h-screen pt-20 pb-12 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
    </div>
  );
}

export default function BuildsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <BuildsClient />
    </Suspense>
  );
}
