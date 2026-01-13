'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, FileText, Shield, Scale, AlertTriangle } from 'lucide-react';

const legalLinks = [
  { href: '/legal/terms', label: '服务条款', icon: FileText },
  { href: '/legal/privacy', label: '隐私政策', icon: Shield },
  { href: '/legal/risk', label: '风险披露', icon: AlertTriangle },
  { href: '/legal/aml', label: '反洗钱政策', icon: Scale },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* 顶部导航 */}
      <header className="border-b border-border-primary bg-bg-secondary">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
              返回首页
            </Link>
            <h1 className="text-lg font-semibold text-white">法律条款</h1>
            <div className="w-20" /> {/* 占位 */}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* 侧边导航 */}
          <aside className="md:w-64 flex-shrink-0">
            <nav className="sticky top-8 space-y-2">
              {legalLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/30'
                        : 'text-text-secondary hover:bg-bg-tertiary hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* 主内容 */}
          <main className="flex-1 min-w-0">
            <div className="bg-bg-secondary rounded-xl border border-border-primary p-8">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* 页脚 */}
      <footer className="border-t border-border-primary py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center text-text-secondary text-sm">
          <p>© {new Date().getFullYear()} QuantFi. All rights reserved.</p>
          <p className="mt-1">如有疑问，请联系 support@quantfi.com</p>
        </div>
      </footer>
    </div>
  );
}
