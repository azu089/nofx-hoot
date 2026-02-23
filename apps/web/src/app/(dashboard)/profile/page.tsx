'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ProfilePageV3 } from '@/components/ui-v3/me/profile-page-v3';
import { MobileProfilePage } from '@/components/ui-v3/mobile/mobile-profile-page';
import { PwaInstallPrompt } from '@/components/ui-v3/shared/pwa-install-prompt';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function ProfilePage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  // 监听 PWA 安装事件
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // 获取用户详情
  const { data: profile } = useQuery({
    queryKey: ['user', 'profile'],
    queryFn: async () => {
      const response = await api.get<{
        id: string;
        email: string;
        nickname: string;
        vipLevel: number;
        subscriptionTier: string;
        membershipStatus: string;
        membershipExpireAt: string | null;
        telegramId: string | null;
        telegramUsername: string | null;
        walletAddress: string | null;
        emailVerified: boolean;
        createdAt: string;
      }>('/auth/me');
      return response.data;
    },
  });

  // 转换用户数据格式
  const userData = useMemo(() => {
    if (!profile) return undefined;
    return {
      id: profile.id,
      username: profile.nickname || profile.email.split('@')[0],
      email: profile.email,
      memberSince: new Date(profile.createdAt).toLocaleDateString('zh-CN'),
      vipLevel: profile.vipLevel || 0,
      subscriptionTier: (profile.subscriptionTier || 'basic') as 'basic' | 'premium' | 'pro',
      // 会员状态
      membershipStatus: profile.membershipStatus || 'none',
      membershipExpireAt: profile.membershipExpireAt
        ? new Date(profile.membershipExpireAt).toLocaleDateString('zh-CN')
        : null,
      // 绑定状态
      telegramBound: !!profile.telegramId,
      telegramUsername: profile.telegramUsername,
      walletBound: !!profile.walletAddress,
      walletAddress: profile.walletAddress,
      emailVerified: profile.emailVerified,
    };
  }, [profile]);

  const handleNavigate = useCallback(async (path: string) => {
    if (path === 'pwa-install') {
      // Android / Desktop Chrome — 使用 beforeinstallprompt
      if (deferredPrompt) {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
        }
        return;
      }
      // iOS — 提示手动添加
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        toast.info('请点击 Safari 底部的分享按钮 ⬆️，然后选择「添加到主屏幕」');
        return;
      }
      // 已安装或不支持
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      if (isStandalone) {
        toast.info('应用已安装');
      } else {
        toast.info('请使用 Chrome / Edge 浏览器打开本网站，即可安装为桌面应用');
      }
      return;
    }
    router.push(path);
  }, [deferredPrompt, router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden md:block">
        <ProfilePageV3
          user={userData}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      </div>

      {/* 移动端 - 使用V0生成的新版组件 */}
      <div className="block md:hidden">
        <MobileProfilePage
          user={userData}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      </div>

      {/* PWA 安装提示 - 仅在个人页面显示 */}
      <PwaInstallPrompt />
    </>
  );
}
