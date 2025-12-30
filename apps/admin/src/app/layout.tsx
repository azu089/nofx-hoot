import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'QuantFi 管理后台',
  description: 'QuantFi 管理后台 - 平台监控与管理',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'QuantFi Admin',
  },
  applicationName: 'QuantFi Admin',
  keywords: ['管理后台', '量化交易', 'Web3', '平台监控'],
  authors: [{ name: 'QuantFi Team' }],
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: 'QuantFi 管理后台',
    title: 'QuantFi 管理后台',
    description: '平台监控与管理系统',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#F23645', // 红色主题
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
