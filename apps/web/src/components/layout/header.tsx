'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui';
import {
  User,
  LogOut,
  Wallet,
  ChevronDown,
  Zap,
} from 'lucide-react';

export function Header() {
  const { user, isAuthenticated, logout } = useAuthStore();

  return (
    <header className="fixed top-0 left-0 right-0 z-fixed bg-bg-primary/95 backdrop-blur-lg">
      {/* 顶部渐变装饰线 */}
      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-brand-primary/50 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo - P1修复：已登录跳转Dashboard，未登录跳转Landing */}
          <Link href={isAuthenticated ? '/dashboard' : '/'} className="flex items-center space-x-3 group">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-brand-primary/30 transition-shadow">
                <Zap className="w-5 h-5 text-white" />
              </div>
              {/* 光晕效果 */}
              <div className="absolute inset-0 bg-brand-primary/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold text-gradient-primary">QuantFi</span>
              <span className="text-[10px] text-text-tertiary -mt-0.5">量化交易平台</span>
            </div>
          </Link>

          {/* Desktop Navigation - 仅未登录时显示导航链接，登录后由侧边栏提供导航 */}
          <nav className="hidden md:flex items-center space-x-6">
            {!isAuthenticated && (
              <>
                {/* P0修复：指向 Landing 页面的锚点，避免404 */}
                <Link
                  href="/#features"
                  className="text-text-secondary hover:text-text-primary transition"
                >
                  功能
                </Link>
                <Link
                  href="/strategies"
                  className="text-text-secondary hover:text-text-primary transition"
                >
                  策略市场
                </Link>
              </>
            )}
          </nav>

          {/* User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="flex items-center space-x-3">
                {/* 余额显示 - 优化样式 */}
                <Link
                  href="/wallet"
                  className="flex items-center space-x-2 px-3 py-1.5 bg-bg-tertiary/50 rounded-lg border border-border-primary/50 hover:border-brand-primary/50 hover:bg-brand-primary/5 transition-all group"
                >
                  <div className="w-6 h-6 bg-brand-primary/20 rounded flex items-center justify-center">
                    <Wallet className="w-3.5 h-3.5 text-brand-primary" />
                  </div>
                  <span className="text-sm font-medium text-text-primary">
                    {user?.vipLevel ? `VIP${user.vipLevel}` : '免费版'}
                  </span>
                </Link>

                {/* 用户下拉菜单 - 优化样式 */}
                <div className="relative group">
                  <button className="flex items-center space-x-2 px-3 py-1.5 rounded-lg hover:bg-bg-tertiary/50 transition-colors">
                    <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-lg flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm text-text-primary font-medium">{user?.email?.split('@')[0]}</span>
                    <ChevronDown className="w-4 h-4 text-text-tertiary" />
                  </button>
                  <div className="absolute right-0 mt-2 w-52 glass-card rounded-xl shadow-xl py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all border border-border-primary/50">
                    {/* 用户信息头部 */}
                    <div className="px-4 py-3 border-b border-border-primary/30">
                      <p className="text-sm font-medium text-text-primary">{user?.email}</p>
                      <p className="text-xs text-text-tertiary mt-0.5">
                        {user?.vipLevel ? `VIP ${user.vipLevel} 会员` : '免费用户'}
                      </p>
                    </div>
                    <div className="py-1">
                      <Link
                        href="/me"
                        className="flex items-center px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-tertiary/50 hover:text-text-primary transition-colors"
                      >
                        <User className="w-4 h-4 mr-3" />
                        个人中心
                      </Link>
                      <button
                        onClick={logout}
                        className="flex items-center w-full px-4 py-2.5 text-sm text-danger/80 hover:bg-danger/10 hover:text-danger transition-colors"
                      >
                        <LogOut className="w-4 h-4 mr-3" />
                        退出登录
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link href="/login">
                  <Button variant="ghost" className="font-medium">登录</Button>
                </Link>
                <Link href="/register">
                  <Button variant="gradient" className="font-medium">
                    <Zap className="w-4 h-4 mr-1" />
                    免费注册
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile User Menu - 简洁版，底部导航为主导航 */}
          <div className="md:hidden flex items-center gap-2">
            {isAuthenticated ? (
              <>
                {/* 钱包入口 */}
                <Link
                  href="/wallet"
                  className="p-2 rounded-lg hover:bg-bg-tertiary/50 transition-colors"
                >
                  <Wallet className="w-5 h-5 text-text-secondary" />
                </Link>
              </>
            ) : (
              <Link href="/login">
                <Button variant="gradient" size="sm">
                  登录
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
