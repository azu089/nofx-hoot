import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { cookies } from "next/headers";
import { isRtlLocale } from "@/i18n/config";


export const metadata: Metadata = {
  title: {
    default: "HOOT | Trade Smarter with AI",
    template: "%s | HOOT",
  },
  description:
    "Trade smarter with HOOT — AI-powered quantitative strategies, automated signals, and intelligent portfolio management for crypto markets.",
  keywords: ["crypto trading", "AI trading", "quantitative trading", "automated trading", "HOOT"],
  icons: {
    icon: "/icons/hoot/logo.png",
    apple: "/icons/hoot/logo.png",
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
  return (
    <html lang={locale} dir={dir} className="dark" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="google" content="notranslate" />
        <meta name="theme-color" content="#06B6D4" />
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
