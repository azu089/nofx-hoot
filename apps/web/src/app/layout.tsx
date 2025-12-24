import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'QuantFi - Web3 量化 SaaS 平台',
  description: 'QuantFi 提供专业的 Web3 量化交易解决方案',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
