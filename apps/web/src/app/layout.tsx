import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { cookies } from "next/headers";
import { isRtlLocale } from "@/i18n/config";


export const metadata: Metadata = {
  title: "Hoot - AI 量化交易平台",
  description: "Hoot - 智能量化交易，自动化投资策略",
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
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
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
