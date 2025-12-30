'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui';
import {
  User,
  LogOut,
  Wallet,
  Settings,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

export function Header() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-fixed bg-bg-secondary/80 backdrop-blur-md border-b border-border-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">Q</span>
            </div>
            <span className="text-xl font-bold text-text-primary">QuantFi</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {isAuthenticated ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-text-secondary hover:text-text-primary transition"
                >
                  仪表盘
                </Link>
                <Link
                  href="/strategies"
                  className="text-text-secondary hover:text-text-primary transition"
                >
                  策略市场
                </Link>
                <Link
                  href="/wallet"
                  className="text-text-secondary hover:text-text-primary transition"
                >
                  钱包
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/features"
                  className="text-text-secondary hover:text-text-primary transition"
                >
                  功能
                </Link>
                <Link
                  href="/pricing"
                  className="text-text-secondary hover:text-text-primary transition"
                >
                  定价
                </Link>
              </>
            )}
          </nav>

          {/* User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="flex items-center space-x-4">
                {/* 余额显示 */}
                <Link
                  href="/wallet"
                  className="flex items-center space-x-2 px-3 py-1.5 bg-bg-tertiary rounded-lg hover:bg-border-primary transition"
                >
                  <Wallet className="w-4 h-4 text-brand-primary" />
                  <span className="text-sm text-text-secondary">
                    {user?.vipLevel ? `VIP${user.vipLevel}` : '免费版'}
                  </span>
                </Link>

                {/* 用户下拉菜单 */}
                <div className="relative group">
                  <button className="flex items-center space-x-2 text-text-secondary hover:text-text-primary transition">
                    <User className="w-5 h-5" />
                    <span className="text-sm">{user?.email?.split('@')[0]}</span>
                  </button>
                  <div className="absolute right-0 mt-2 w-48 bg-bg-tertiary rounded-lg shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all border border-border-primary">
                    <Link
                      href="/settings"
                      className="flex items-center px-4 py-2 text-sm text-text-secondary hover:bg-bg-secondary"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      设置
                    </Link>
                    <button
                      onClick={logout}
                      className="flex items-center w-full px-4 py-2 text-sm text-text-secondary hover:bg-bg-secondary"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      退出登录
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link href="/login">
                  <Button variant="ghost">登录</Button>
                </Link>
                <Link href="/register">
                  <Button>注册</Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-text-secondary hover:text-text-primary"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-bg-secondary border-t border-border-primary">
          <div className="px-4 py-4 space-y-3">
            {isAuthenticated ? (
              <>
                <Link
                  href="/dashboard"
                  className="block text-text-secondary hover:text-text-primary py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  仪表盘
                </Link>
                <Link
                  href="/strategies"
                  className="block text-text-secondary hover:text-text-primary py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  策略市场
                </Link>
                <Link
                  href="/wallet"
                  className="block text-text-secondary hover:text-text-primary py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  钱包
                </Link>
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="block text-text-secondary hover:text-text-primary py-2 w-full text-left"
                >
                  退出登录
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="block text-text-secondary hover:text-text-primary py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  登录
                </Link>
                <Link
                  href="/register"
                  className="block text-text-secondary hover:text-text-primary py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  注册
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
