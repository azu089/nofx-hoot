import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'QuantFi - Web3 量化 SaaS 平台',
  description: 'QuantFi 提供专业的 Web3 量化交易解决方案',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'QuantFi',
  },
  applicationName: 'QuantFi',
  keywords: ['量化交易', 'Web3', 'DeFi', '加密货币', '自动交易'],
  authors: [{ name: 'QuantFi Team' }],
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: 'QuantFi',
    title: 'QuantFi - Web3 量化交易平台',
    description: '专业的 Web3 量化交易 SaaS 解决方案',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QuantFi - Web3 量化交易平台',
    description: '专业的 Web3 量化交易 SaaS 解决方案',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#3772FF',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* 防止主题闪烁：在页面加载前应用保存的主题 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('quantfi-ui-store');
                  if (stored) {
                    var parsed = JSON.parse(stored);
                    var mode = parsed.state?.themeMode || 'dark';
                    var theme = mode;
                    if (mode === 'system') {
                      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                    }
                    document.documentElement.setAttribute('data-theme', theme);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
