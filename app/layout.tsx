import type { Metadata } from "next";
import { headers } from "next/headers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/context/LanguageContext";
import { AuthProvider } from "@/context/AuthContext";
import { Header, Footer } from "@/components/layout";
import { DEFAULT_LANGUAGE } from "@/config";
import "./globals.css";

export const metadata: Metadata = {
  title: "MornClient",
  description: "Build multi-platform apps from any website",
  icons: {
    icon: "/MornClient_28x28.png",
    apple: "/MornClient_108x108.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 检测是否为 admin 路由，admin 路由不显示主站 Header/Footer
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || headersList.get("x-invoke-path") || "";
  const isAdminRoute = pathname.startsWith("/admin");

  return (
    <html lang={DEFAULT_LANGUAGE} suppressHydrationWarning>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          disableTransitionOnChange
        >
          {isAdminRoute ? (
            // Admin 路由：不显示主站布局
            children
          ) : (
            // 主站路由：显示完整布局
            <AuthProvider>
              <LanguageProvider>
                <div className="flex min-h-screen flex-col">
                  <Header />
                  <main className="flex-1">{children}</main>
                  <Footer />
                </div>
              </LanguageProvider>
            </AuthProvider>
          )}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
