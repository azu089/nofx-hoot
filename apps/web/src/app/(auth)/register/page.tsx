'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { RegisterPage as RegisterPageUI } from '@/components/ui-v3/auth/register-page';
import { MobileRegisterPage } from '@/components/ui-v3/mobile/mobile-register-page';
import { WalletConnectModal } from '@/components/ui-v3/auth/wallet-connect-modal';
import { MobileWalletConnectModal } from '@/components/ui-v3/mobile/mobile-wallet-connect-modal';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated, isLoading } = useAuth();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [mounted, setMounted] = useState(false);

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

  const handleRegister = async (data: {
    email: string;
    password: string;
    nickname?: string;
    inviteCode?: string;
  }) => {
    try {
      // 注册（后端会自动发送验证码）
      await register(data.email, data.password, data.nickname);
      // 跳转到邮箱验证页面
      router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '注册失败');
    }
  };

  const handleWalletSuccess = (address: string) => {
    // 钱包连接成功后，跳转到仪表盘
    // TODO: 后续接入后端钱包注册 API
    console.log('钱包注册成功:', address);
    router.push('/dashboard');
  };

  const handleTelegramLogin = () => {
    // TODO: 接入 Telegram 登录（Privy 或 TG WebApp）
    // 临时方案：跳转到 TG Bot
    const botUsername = process.env.NEXT_PUBLIC_TG_BOT_USERNAME || 'HootQuantBot';
    window.open(`https://t.me/${botUsername}?start=register`, '_blank');
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
        <RegisterPageUI
          onRegister={handleRegister}
          onWalletConnect={() => setShowWalletModal(true)}
          onTelegramLogin={handleTelegramLogin}
          onLogin={() => router.push('/login?method=email')}
        />
        <WalletConnectModal
          isOpen={showWalletModal}
          onClose={() => setShowWalletModal(false)}
          onSuccess={handleWalletSuccess}
          mode="register"
        />
      </div>

      {/* 移动端 */}
      <div className="block md:hidden">
        <MobileRegisterPage
          onRegister={handleRegister}
          onWalletConnect={() => setShowWalletModal(true)}
          onLogin={() => router.push('/login?method=email')}
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
          mode="register"
        />
      </div>
    </>
  );
}
