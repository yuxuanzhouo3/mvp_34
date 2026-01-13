import { headers } from "next/headers";
import { getAdminSession } from "@/utils/session";
import AdminSidebar from "./components/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 获取当前路径
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";

  // 登录页面不需要侧边栏布局
  if (pathname.startsWith("/admin/login")) {
    return <>{children}</>;
  }

  // 中间件已处理认证重定向，这里只获取用户信息用于显示
  const session = await getAdminSession();

  // 如果没有 session，直接渲染 children（中间件会处理重定向）
  if (!session) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="flex">
        {/* 侧边栏 */}
        <AdminSidebar username={session.username} />

        {/* 主内容区 */}
        <main className="flex-1 w-full mt-14 md:mt-0 md:ml-64 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
