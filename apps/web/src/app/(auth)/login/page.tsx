'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { LoginPage as LoginPageUI } from '@/components/ui-v3/auth/login-page';
import { MobileLoginPage } from '@/components/ui-v3/mobile/mobile-login-page';
import { WalletConnectModal } from '@/components/ui-v3/auth/wallet-connect-modal';
import { MobileWalletConnectModal } from '@/components/ui-v3/mobile/mobile-wallet-connect-modal';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, isLoading } = useAuth();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 检查是否需要直接显示邮箱表单（从注册页跳转过来时）
  const showEmailForm = searchParams.get('method') === 'email';

  // 确保客户端 hydration 完成后再根据状态渲染
  // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR hydration 检测是合理的一次性副作用
  useEffect(() => {
    setMounted(true);
  }, []);

  // 已登录跳转到仪表盘
  useEffect(() => {
    if (mounted && !isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [mounted, isLoading, isAuthenticated, router]);

  const handleLogin = async (email: string, password: string) => {
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      // 错误由 UI 组件内部处理
      alert(err instanceof Error ? err.message : '登录失败');
    }
  };

  const handleWalletSuccess = (address: string) => {
    // 钱包连接成功后，跳转到仪表盘
    // TODO: 后续接入后端钱包登录 API
    console.log('钱包连接成功:', address);
    router.push('/dashboard');
  };

  const handleTelegramLogin = () => {
    // TODO: 接入 Telegram 登录（Privy 或 TG WebApp）
    // 临时方案：跳转到 TG Bot
    const botUsername = process.env.NEXT_PUBLIC_TG_BOT_USERNAME || 'HootQuantBot';
    window.open(`https://t.me/${botUsername}?start=login`, '_blank');
  };

  // 服务端和客户端首次渲染保持一致（都显示 loading）
  // 避免 Hydration 不匹配
  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden md:block">
        <LoginPageUI
          onLogin={handleLogin}
          onWalletConnect={() => setShowWalletModal(true)}
          onTelegramLogin={handleTelegramLogin}
          onRegister={() => router.push('/register')}
          onForgotPassword={() => {
            // TODO: 忘记密码
            console.log('忘记密码');
          }}
          initialShowEmailForm={showEmailForm}
        />
        <WalletConnectModal
          isOpen={showWalletModal}
          onClose={() => setShowWalletModal(false)}
          onSuccess={handleWalletSuccess}
          mode="login"
        />
      </div>

      {/* 移动端 */}
      <div className="block md:hidden">
        <MobileLoginPage
          onLogin={handleLogin}
          onWalletConnect={() => setShowWalletModal(true)}
          onTelegramLogin={handleTelegramLogin}
          onRegister={() => router.push('/register')}
          onForgotPassword={() => console.log('忘记密码')}
        />
        <MobileWalletConnectModal
          isOpen={showWalletModal}
          onClose={() => setShowWalletModal(false)}
          onConnect={async (walletId) => {
            console.log('连接钱包:', walletId);
            // TODO: 实际连接钱包逻辑
            setShowWalletModal(false);
            router.push('/dashboard');
          }}
          mode="login"
        />
      </div>
    </>
  );
}
