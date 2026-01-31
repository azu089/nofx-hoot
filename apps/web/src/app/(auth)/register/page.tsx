'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { RegisterPage as RegisterPageUI } from '@/components/ui-v3/auth/register-page';
import { WalletConnectModal } from '@/components/ui-v3/auth/wallet-connect-modal';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated, isLoading } = useAuth();
  const [showWalletModal, setShowWalletModal] = useState(false);

  // 已登录跳转到仪表盘
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

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

  if (isLoading) {
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
      <RegisterPageUI
        onRegister={handleRegister}
        onWalletConnect={() => setShowWalletModal(true)}
        onLogin={() => router.push('/login')}
      />
      <WalletConnectModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        onSuccess={handleWalletSuccess}
        mode="register"
      />
    </>
  );
}
