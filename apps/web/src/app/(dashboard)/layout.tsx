'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, TrendingUp, BarChart3, Wallet, User } from 'lucide-react';
import { AuthGuard } from '@/components/auth-guard';

const navItems = [
  { id: 'dashboard', label: '首页', icon: Home, href: '/dashboard' },
  { id: 'strategies', label: '策略', icon: TrendingUp, href: '/strategies' },
  { id: 'trading', label: '交易', icon: BarChart3, href: '/trading' },
  { id: 'wallet', label: '资产', icon: Wallet, href: '/wallet' },
  { id: 'profile', label: '我的', icon: User, href: '/profile' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-[#0A0A0F]">
        {/* Sidebar */}
        <div className="fixed left-0 top-0 h-screen w-60 bg-[#12121A] border-r border-[#1E1E2E] z-40">
          {/* Logo */}
          <div className="flex h-16 items-center justify-center gap-2 border-b border-[#1E1E2E]">
            <Image src="/icons/hoot/logo.png" alt="Hoot" width={32} height={32} />
            <h1 className="text-2xl font-bold text-[#F8F8FC]">Hoot</h1>
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-2 p-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                    isActive
                      ? 'bg-[#1E1E2E] text-[#F8F8FC] border border-[#2A2A3A]'
                      : 'hover:bg-[#1E1E2E]/50'
                  }`}
                >
                  <Icon
                    size={20}
                    className={`transition-colors duration-200 ${
                      isActive
                        ? 'text-cyan-400'
                        : 'text-[#9090A0] group-hover:text-[#F8F8FC]'
                    }`}
                  />
                  <span
                    className={`font-medium transition-colors duration-200 ${
                      isActive
                        ? 'text-white'
                        : 'text-[#F8F8FC] group-hover:text-white'
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#1E1E2E]">
            <div className="text-xs text-center text-[#9090A0]">
              © 2026 Hoot
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="ml-60 flex-1">
          {children}
        </div>
      </div>
    </AuthGuard>
  );
}
