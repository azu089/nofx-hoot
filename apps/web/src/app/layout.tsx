import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hoot - AI 量化交易平台",
  description: "Hoot - 智能量化交易，自动化投资策略",
  icons: {
    icon: "/icons/hoot/token.png",
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
        <meta name="google" content="notranslate" />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-[#0A0A0F] text-[#F8F8FC]`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
