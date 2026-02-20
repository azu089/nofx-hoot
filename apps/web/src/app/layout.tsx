import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/lib/providers";


export const metadata: Metadata = {
  title: "Hoot - AI 量化交易平台",
  description: "Hoot - 智能量化交易，自动化投资策略",
  icons: {
    icon: "/icons/hoot/token.png",
    apple: "/icons/hoot/logo.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HOOT",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="google" content="notranslate" />
        <meta name="theme-color" content="#06B6D4" />
        {/* Telegram WebApp SDK — 必须在 head 中同步加载 */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body
        className="font-sans antialiased bg-[#0A0A0F] text-[#F8F8FC]"
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
