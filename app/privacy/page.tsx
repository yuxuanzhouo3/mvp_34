import { PrivacyInternational } from "@/components/legal/privacy-international";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | MornClient",
  description: "Privacy Policy for MornClient App Builder Platform",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-cyan-950/10">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-cyan-500 hover:text-cyan-400 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-6 sm:p-8 shadow-xl">
          <PrivacyInternational />
        </div>
      </div>
    </div>
  );
}
