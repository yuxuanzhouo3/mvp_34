"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminLogout } from "@/actions/admin-auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Megaphone,
  Link as LinkIcon,
  Package,
  ShoppingCart,
  LogOut,
  User,
  Menu,
  X,
  BarChart3,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminSidebarProps {
  username: string;
}

const navItems = [
  {
    href: "/admin/stats",
    label: "统计",
    fullLabel: "数据统计",
    icon: BarChart3,
  },
  {
    href: "/admin/ads",
    label: "广告",
    fullLabel: "广告管理",
    icon: Megaphone,
  },
  {
    href: "/admin/social-links",
    label: "链接",
    fullLabel: "社交链接",
    icon: LinkIcon,
  },
  {
    href: "/admin/releases",
    label: "版本",
    fullLabel: "发布版本",
    icon: Package,
  },
  {
    href: "/admin/orders",
    label: "订单",
    fullLabel: "交易订单",
    icon: ShoppingCart,
  },
];

function SidebarContent({
  pathname,
  username,
  onNavClick,
}: {
  pathname: string;
  username: string;
  onNavClick: () => void;
}) {
  return (
    <>
      {/* Logo / 标题 */}
      <div className="hidden md:block p-6 border-b border-slate-200 dark:border-slate-700">
        <Link href="/admin/stats" className="flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">管理后台</span>
        </Link>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 p-3 md:p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={cn(
                "flex items-center gap-3 px-3 md:px-4 py-2.5 md:py-3 rounded-lg transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm md:text-base">{item.fullLabel}</span>
            </Link>
          );
        })}
      </nav>

      {/* 用户信息和登出 */}
      <div className="p-3 md:p-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 px-3 md:px-4 py-2 mb-2 min-w-0">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-medium truncate" title={username}>
            {username}
          </span>
        </div>

        <form action={adminLogout}>
          <Button
            type="submit"
            variant="ghost"
            className="w-full justify-start text-slate-600 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <LogOut className="h-4 w-4 mr-2 flex-shrink-0" />
            退出登录
          </Button>
        </form>
      </div>
    </>
  );
}

export default function AdminSidebar({ username }: AdminSidebarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 关闭菜单时禁止背景滚动
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const handleNavClick = () => setMobileMenuOpen(false);

  return (
    <>
      {/* 移动端顶部导航栏 */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 z-50">
        <Link href="/admin/stats" className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold">管理后台</span>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="h-9 w-9 p-0"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* 移动端侧边栏抽屉 */}
      {mobileMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40 transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="md:hidden fixed left-0 top-14 bottom-16 w-72 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col z-50 animate-in slide-in-from-left duration-200 shadow-xl">
            <SidebarContent
              pathname={pathname}
              username={username}
              onNavClick={handleNavClick}
            />
          </aside>
        </>
      )}

      {/* 移动端底部导航栏 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 z-50 safe-area-inset-bottom">
        <div className="flex items-center justify-around h-full px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]",
                  isActive
                    ? "text-primary"
                    : "text-slate-500 dark:text-slate-400 active:bg-slate-100 dark:active:bg-slate-700"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
                <span className={cn("text-xs", isActive && "font-medium")}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* 桌面端固定侧边栏 */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex-col">
        <SidebarContent
          pathname={pathname}
          username={username}
          onNavClick={handleNavClick}
        />
      </aside>
    </>
  );
}
