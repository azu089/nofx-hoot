'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useWallet } from '@/hooks/useWallet';
import { LoginPage as LoginPageUI } from '@/components/ui-v3/auth/login-page';
import { MobileLoginPage } from '@/components/ui-v3/mobile/mobile-login-page';
import { WalletConnectModal } from '@/components/ui-v3/auth/wallet-connect-modal';
import { MobileWalletConnectModal } from '@/components/ui-v3/mobile/mobile-wallet-connect-modal';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, walletLogin, telegramWebAppLogin, isAuthenticated, isLoading } = useAuth();
  const { walletLogin: walletLoginHook } = useWallet();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

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
      toast.error(err instanceof Error ? err.message : '登录失败');
    }
  };

  /**
   * WalletConnectModal 的 onSuccess 回调
   * 此时 wagmi 已连接完成，address 已确认
   * 流程：获取 nonce → 签名 → 后端登录 → 写入 auth 状态
   */
  const handleWalletSuccess = async (address: string) => {
    setWalletError(null);
    try {
      const result = await walletLoginHook(address);
      walletLogin(result.accessToken, result.user, result.refreshToken);
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : '钱包登录失败，请重试';
      setWalletError(message);
      // 重新打开 modal 让用户看到错误（或可选择 alert）
      toast.error(message);
    }
  };

  /**
   * 移动端 MobileWalletConnectModal 的 onConnect 回调
   * walletId 是钱包类型（metamask/walletconnect 等），
   * 但 MobileWalletConnectModal 没有集成 wagmi，需要走独立流程
   * 暂时使用 alert 提示用户使用桌面端，后续集成 wagmi mobile
   */
  const handleMobileWalletConnect = async (_walletId: string) => {
    // KNOWN-LIMITATION: 移动端 wagmi 钱包连接待集成，当前提示用户使用桌面端
    // 当前移动端 MobileWalletConnectModal 未集成 wagmi，地址不可用
    // 临时方案：提示用户
    throw new Error('移动端钱包登录正在接入，请使用桌面端或邮箱登录');
  };

  const handleTelegramLogin = async () => {
    // 在 TG Mini App 内时，直接用 initData 完成静默登录
    const tgWebApp = (window as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp;
    if (tgWebApp?.initData) {
      try {
        await telegramWebAppLogin(tgWebApp.initData);
        router.push('/dashboard');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Telegram 登录失败，请重试');
      }
      return;
    }
    // 普通浏览器降级：引导去 TG Bot 触发登录
    // 使用 location.href 而非 window.open，避免移动端弹窗拦截器静默阻止
    const botUsername = process.env.NEXT_PUBLIC_TG_BOT_USERNAME || 'HootQuantBot';
    window.location.href = `https://t.me/${botUsername}?start=login`;
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
          onForgotPassword={() => router.push('/forgot-password')}
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
          onForgotPassword={() => router.push('/forgot-password')}
        />
        <MobileWalletConnectModal
          isOpen={showWalletModal}
          onClose={() => setShowWalletModal(false)}
          onConnect={handleMobileWalletConnect}
          mode="login"
        />
      </div>
    </>
  );
}
