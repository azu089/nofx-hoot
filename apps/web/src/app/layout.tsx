import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { cookies } from "next/headers";
import { isRtlLocale } from "@/i18n/config";


// Next.js 14 App Router 标准写法：viewport 独立导出
// user-scalable=no 对 Android 有效；iOS Safari 忽略此项，需配合 CSS touch-action
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "HOOT | Trade Smarter with AI",
    template: "%s | HOOT",
  },
  description:
    "Trade smarter with HOOT — AI-powered quantitative strategies, automated signals, and intelligent portfolio management for crypto markets.",
  keywords: ["crypto trading", "AI trading", "quantitative trading", "automated trading", "HOOT"],
  icons: {
    icon: "/icons/hoot/token.png",
    apple: "/icons/hoot/token.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HOOT",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value || "zh-CN";
  const dir = isRtlLocale(locale) ? "rtl" : "ltr";
  // Middleware 已验证 cookie，这里读取结果让 AuthProvider 跳过 loading 状态
  const hasAuthToken = !!cookieStore.get("hoot_token")?.value;
  return (
    <html lang={locale} dir={dir} className="dark" suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
        <meta name="theme-color" content="#06B6D4" />
      </head>
      <body
        className="font-sans antialiased bg-[#0A0A0F] text-[#F8F8FC]"
        suppressHydrationWarning
      >
        <Providers initialAuthenticated={hasAuthToken}>{children}</Providers>
      </body>
    </html>
  );
}
