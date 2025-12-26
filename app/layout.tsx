import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/context/LanguageContext";
import { Header, Footer } from "@/components/layout";
import { DEFAULT_LANGUAGE } from "@/config";
import "./globals.css";

export const metadata: Metadata = {
  title: "OneBuild",
  description: "Build multi-platform apps from any website",
  icons: {
    icon: "/OneBuild_28x28.png",
    apple: "/OneBuild_108x108.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={DEFAULT_LANGUAGE} suppressHydrationWarning>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          disableTransitionOnChange
        >
          <LanguageProvider>
            <div className="flex min-h-screen flex-col">
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
          </LanguageProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
