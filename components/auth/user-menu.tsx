"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Layers } from "lucide-react";

export function UserMenu() {
  const { currentLanguage } = useLanguage();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    await signOut();
    router.push("/");
    router.refresh();
    setLoading(false);
  };

  if (!user) return null;

  // Get avatar URL from user metadata (Google OAuth provides avatar_url)
  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
  // Get display name
  const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0];
  // Get first letter for fallback avatar
  const avatarLetter = (displayName || user.email || "U").charAt(0).toUpperCase();

  const AvatarContent = () => {
    if (avatarUrl) {
      return (
        <Image
          src={avatarUrl}
          alt={displayName || "User avatar"}
          width={40}
          height={40}
          className="rounded-full"
          unoptimized // Google avatar URLs are external
        />
      );
    }
    return (
      <span className="text-white font-semibold">{avatarLetter}</span>
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={`relative h-10 w-10 rounded-full overflow-hidden ${
            avatarUrl ? "p-0" : "bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500"
          }`}
        >
          <AvatarContent />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <div className="flex items-center gap-2 p-2">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full overflow-hidden ${
            avatarUrl ? "" : "bg-gradient-to-br from-cyan-500 to-blue-600"
          }`}>
            <AvatarContent />
          </div>
          <div className="flex flex-col space-y-0.5">
            {displayName && displayName !== user.email?.split("@")[0] && (
              <p className="text-sm font-medium truncate max-w-[160px]">
                {displayName}
              </p>
            )}
            <p className="text-xs text-muted-foreground truncate max-w-[160px]">
              {user.email}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push("/builds")}
          className="cursor-pointer"
        >
          <Layers className="mr-2 h-4 w-4" />
          {currentLanguage === "zh" ? "构建列表" : "My Builds"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          disabled={loading}
          className="cursor-pointer text-red-500 focus:text-red-500"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {currentLanguage === "zh" ? "退出登录" : "Sign Out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
