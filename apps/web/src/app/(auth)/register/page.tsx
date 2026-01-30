'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { RegisterPage as RegisterPageUI } from '@/components/ui-v3/auth/register-page';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated, isLoading } = useAuth();

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
      await register(data.email, data.password, data.nickname);
      router.push('/dashboard');
    } catch (err) {
      alert(err instanceof Error ? err.message : '注册失败');
    }
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
    <RegisterPageUI
      onRegister={handleRegister}
      onWalletConnect={() => {
        // TODO: 钱包连接注册
        console.log('钱包注册');
      }}
      onLogin={() => router.push('/login')}
    />
  );
}
