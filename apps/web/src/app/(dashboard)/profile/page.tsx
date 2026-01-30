'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ProfilePageV3 } from '@/components/ui-v3/me/profile-page-v3';

export default function ProfilePage() {
  const router = useRouter();
  const { logout } = useAuth();

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
        createdAt: string;
      }>('/auth/me');
      return response.data;
    },
  });

  // 获取推荐数据
  const { data: referralData } = useQuery({
    queryKey: ['referral', 'stats'],
    queryFn: async () => {
      const response = await api.get<{
        inviteCount: number;
        totalEarnings: string;
      }>('/referral/stats');
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
    };
  }, [profile]);

  // 转换推荐数据格式
  const referral = useMemo(() => {
    if (!referralData) return undefined;
    return {
      inviteCount: referralData.inviteCount || 0,
      totalEarnings: parseFloat(referralData.totalEarnings) || 0,
    };
  }, [referralData]);

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <ProfilePageV3
      user={userData}
      referral={referral}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
    />
  );
}
