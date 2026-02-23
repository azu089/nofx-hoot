'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useWallet } from '@/hooks/useWallet';
import { RegisterPage as RegisterPageUI } from '@/components/ui-v3/auth/register-page';
import { MobileRegisterPage } from '@/components/ui-v3/mobile/mobile-register-page';
import { WalletConnectModal } from '@/components/ui-v3/auth/wallet-connect-modal';
import { MobileWalletConnectModal } from '@/components/ui-v3/mobile/mobile-wallet-connect-modal';

export default function RegisterPage() {
  const router = useRouter();
  const { register, walletLogin, isAuthenticated, isLoading } = useAuth();
  const { walletLogin: walletLoginHook } = useWallet();
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
      toast.error(err instanceof Error ? err.message : '注册失败');
    }
  };

  /**
   * WalletConnectModal 的 onSuccess 回调
   * 后端 wallet/login 接口会自动注册新用户（如地址首次登录则创建账户）
   * 流程：获取 nonce → 签名 → 后端登录/注册 → 写入 auth 状态
   */
  const handleWalletSuccess = async (address: string) => {
    try {
      const result = await walletLoginHook(address);
      walletLogin(result.accessToken, result.user, result.refreshToken);
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : '钱包注册失败，请重试';
      toast.error(message);
    }
  };

  /**
   * 移动端 MobileWalletConnectModal 的 onConnect 回调
   * 暂时提示用户使用桌面端，待移动端 wagmi 集成后补全
   */
  const handleMobileWalletConnect = async (_walletId: string) => {
    throw new Error('移动端钱包注册正在接入，请使用桌面端或邮箱注册');
  };

  const handleTelegramLogin = () => {
    // KNOWN-LIMITATION: TG 登录待 Privy/TG WebApp 集成，当前跳转 Bot
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
          onConnect={handleMobileWalletConnect}
          mode="register"
        />
      </div>
    </>
  );
}
