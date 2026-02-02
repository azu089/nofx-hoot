'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useBindings, formatAddress } from '@/hooks/useBindings';
import { useWallet } from '@/hooks/useWallet';
import { SettingsPage as SettingsPageUI } from '@/components/ui-v3/settings/settings-page';
import { MobileSettingsPage } from '@/components/ui-v3/mobile/mobile-settings-page';
import { TelegramBindModal } from '@/components/ui-v3/settings/telegram-bind-modal';
import { WalletConnectModal } from '@/components/ui-v3/auth/wallet-connect-modal';

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    bindingStatus,
    telegramBindCode,
    telegramBindCodeExpiry,
    isLoading: bindingLoading,
    error: bindingError,
    fetchProfile,
    generateTelegramBindCode,
    bindWallet,
  } = useBindings();
  const { address, isConnected, signMessage } = useWallet();

  // 弹窗状态
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletBindLoading, setWalletBindLoading] = useState(false);

  // 获取用户绑定状态
  useEffect(() => {
    fetchProfile().catch(console.error);
  }, [fetchProfile]);

  // 当钱包连接后自动绑定
  const handleWalletConnected = useCallback(async (walletAddress: string) => {
    if (!walletAddress) return;

    setWalletBindLoading(true);
    try {
      await bindWallet(walletAddress);
      setShowWalletModal(false);
      // 刷新用户信息
      await fetchProfile();
    } catch (err) {
      console.error('绑定钱包失败:', err);
    } finally {
      setWalletBindLoading(false);
    }
  }, [bindWallet, fetchProfile]);

  // 绑定 Telegram - 打开弹窗显示绑定码
  const handleBindTelegram = () => {
    setShowTelegramModal(true);
  };

  // 绑定钱包 - 打开钱包连接弹窗
  const handleBindWallet = () => {
    setShowWalletModal(true);
  };

  // 绑定邮箱
  const handleBindEmail = async (email: string) => {
    // 设置页面的邮箱绑定弹窗内部处理
    console.log('绑定邮箱:', email);
  };

  // 合并本地用户信息和 API 返回的绑定状态
  const mergedBindingStatus = {
    telegram: bindingStatus.telegram?.bound
      ? bindingStatus.telegram
      : {
          bound: !!user?.telegramId,
          username: user?.telegramUsername,
        },
    wallet: bindingStatus.wallet?.bound
      ? bindingStatus.wallet
      : {
          bound: !!user?.walletAddress,
          address: user?.walletAddress,
        },
    email: bindingStatus.email?.bound
      ? bindingStatus.email
      : {
          bound: !!user?.email,
          address: user?.email,
          verified: user?.emailVerified,
        },
  };

  const botUsername = process.env.NEXT_PUBLIC_TG_BOT_USERNAME || 'HootQuantBot';

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden md:block">
        <SettingsPageUI
          userEmail={user?.email || 'user@example.com'}
          bindingStatus={mergedBindingStatus}
          onNavigate={(path) => router.push(path)}
          onSettingChange={(key, value) => {
            console.log('设置变更:', key, value);
          }}
          onBindTelegram={handleBindTelegram}
          onBindWallet={handleBindWallet}
          onBindEmail={handleBindEmail}
        />
      </div>

      {/* 移动端 */}
      <div className="block md:hidden">
        <MobileSettingsPage
          onBack={() => router.push('/profile')}
          bindingStatus={mergedBindingStatus}
          onBindTelegram={handleBindTelegram}
          onBindWallet={handleBindWallet}
        />
      </div>

      {/* Telegram 绑定弹窗 */}
      <TelegramBindModal
        isOpen={showTelegramModal}
        onClose={() => setShowTelegramModal(false)}
        bindCode={telegramBindCode}
        expiresAt={telegramBindCodeExpiry}
        isLoading={bindingLoading}
        onGenerateCode={generateTelegramBindCode}
        botUsername={botUsername}
      />

      {/* 钱包绑定弹窗 */}
      <WalletConnectModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        mode="register"
        onSuccess={handleWalletConnected}
      />
    </>
  );
}
