'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { SettingsPage as SettingsPageUI } from '@/components/ui-v3/settings/settings-page';
import { MobileSettingsPage } from '@/components/ui-v3/mobile/mobile-settings-page';

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();

  // 绑定 Telegram
  const handleBindTelegram = () => {
    const botUsername = process.env.NEXT_PUBLIC_TG_BOT_USERNAME || 'HootQuantBot';
    // 携带绑定码跳转到 TG Bot
    window.open(`https://t.me/${botUsername}?start=bind_${user?.id || 'user'}`, '_blank');
  };

  // 绑定钱包
  const handleBindWallet = () => {
    // TODO: 打开钱包连接弹窗
    console.log('绑定钱包');
  };

  // 绑定邮箱
  const handleBindEmail = (email: string) => {
    // TODO: 调用 API 绑定邮箱
    console.log('绑定邮箱:', email);
  };

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden md:block">
        <SettingsPageUI
          userEmail={user?.email || 'user@example.com'}
          bindingStatus={{
            telegram: {
              bound: !!user?.telegramId,
              username: user?.telegramUsername,
            },
            wallet: {
              bound: !!user?.walletAddress,
              address: user?.walletAddress,
            },
            email: {
              bound: !!user?.email,
              address: user?.email,
              verified: user?.emailVerified,
            },
          }}
          onNavigate={(path) => router.push(path)}
          onSettingChange={(key, value) => {
            console.log('设置变更:', key, value);
            // TODO: 调用 API 保存设置
          }}
          onBindTelegram={handleBindTelegram}
          onBindWallet={handleBindWallet}
          onBindEmail={handleBindEmail}
        />
      </div>

      {/* 移动端 */}
      <div className="block md:hidden">
        <MobileSettingsPage onBack={() => router.push('/profile')} />
      </div>
    </>
  );
}
