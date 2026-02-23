import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: 'noindex, nofollow',
};

export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 生产环境禁止访问预览页（必须在组件内调用，不能在模块顶层）
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  return <>{children}</>;
}
