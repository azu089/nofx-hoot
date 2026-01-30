'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { LoginPage as LoginPageUI } from '@/components/ui-v3/auth/login-page';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();

  // 已登录跳转到仪表盘
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleLogin = async (email: string, password: string) => {
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      // 错误由 UI 组件内部处理
      alert(err instanceof Error ? err.message : '登录失败');
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
    <LoginPageUI
      onLogin={handleLogin}
      onWalletConnect={() => {
        // TODO: 钱包连接登录
        console.log('钱包连接');
      }}
      onRegister={() => router.push('/register')}
      onForgotPassword={() => {
        // TODO: 忘记密码
        console.log('忘记密码');
      }}
    />
  );
}
