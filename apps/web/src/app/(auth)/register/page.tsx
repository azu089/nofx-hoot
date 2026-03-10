'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useWallet } from '@/hooks/useWallet';
import { RegisterPage as RegisterPageUI } from '@/components/ui-v3/auth/register-page';
import { MobileRegisterPage } from '@/components/ui-v3/mobile/mobile-register-page';
import { WalletConnectModal } from '@/components/ui-v3/auth/wallet-connect-modal';
import { MobileWalletConnectModal } from '@/components/ui-v3/mobile/mobile-wallet-connect-modal';

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register, walletLogin, telegramWebAppLogin, isAuthenticated, isLoading } = useAuth();
  // 从 URL ?ref= 或 ?inviteCode= 读取邀请码（TG Bot / 分享链接自动填入）
  const defaultReferralCode = searchParams.get('ref') || searchParams.get('inviteCode') || '';
  const { walletLogin: walletLoginHook } = useWallet();
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
    referralCode?: string;
  }) => {
    try {
      // 注册（后端会自动发送验证码）
      // UI 组件传递的字段名可能是 referralCode 或 inviteCode
      const inviteCode = data.inviteCode || data.referralCode;
      await register(data.email, data.password, data.nickname, inviteCode);
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

  const handleTelegramLogin = async () => {
    const tgWebApp = (window as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp;

    // 情况1：在 TG Mini App 内（initData 已注入）→ 直接静默登录/注册
    if (tgWebApp?.initData) {
      try {
        await telegramWebAppLogin(tgWebApp.initData);
        router.push('/dashboard');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Telegram 登录失败，请重试');
      }
      return;
    }

    // 情况2：在 Telegram 内但 initData 为空（Mini App 未正确启动）
    if (tgWebApp !== undefined) {
      toast.error('请关闭后重新从 Telegram Bot 菜单中打开应用');
      return;
    }

    // 情况3：普通浏览器 → 跳转到 Mini App 链接（而非 Bot 起始页）
    const botUsername = process.env.NEXT_PUBLIC_TG_BOT_USERNAME || 'HootQuantBot';
    window.location.href = `https://t.me/${botUsername}/app`;
  };

  // AuthProvider 初始化中（读取 localStorage / TG 自动登录）
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
      {/* 桌面端 */}
      <div className="hidden md:block">
        <RegisterPageUI
          onRegister={handleRegister}
          onWalletConnect={() => setShowWalletModal(true)}
          onTelegramLogin={handleTelegramLogin}
          onLogin={() => router.push('/login?method=email')}
          defaultReferralCode={defaultReferralCode}
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
          onTelegramLogin={handleTelegramLogin}
          onLogin={() => router.push('/login?method=email')}
          defaultReferralCode={defaultReferralCode}
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
