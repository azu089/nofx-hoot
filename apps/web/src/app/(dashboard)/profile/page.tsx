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
  const { data: profile, isLoading: profileLoading, isFetching: profileFetching } = useQuery({
    queryKey: ['user', 'profile'],
    queryFn: async () => {
      const response = await api.get<{
        id: string;
        uid?: number;
        userCode?: string | null;
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
      uid: profile.uid,
      userCode: profile.userCode,
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

  // 加载中或后台刷新中 — 显示骨架屏，避免显示旧缓存（uid 闪烁问题）
  if (profileLoading || profileFetching) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-[#9090A0]">加载中...</p>
        </div>
      </div>
    );
  }

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
