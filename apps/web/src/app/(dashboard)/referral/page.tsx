'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ReferralPageV3 } from '@/components/ui-v3/referral/referral-page-v3';

export default function ReferralPage() {
  // 获取邀请码
  const { data: inviteCodeData } = useQuery({
    queryKey: ['referral', 'invite-code'],
    queryFn: async () => {
      const response = await api.get<{ inviteCode: string }>('/referral/invite-code');
      return response.data;
    },
  });

  // 获取推荐统计
  const { data: statsData } = useQuery({
    queryKey: ['referral', 'stats'],
    queryFn: async () => {
      const response = await api.get<{
        inviteCode: string;
        totalInvites: number;
        totalRewards: string;
        pendingRewards: string;
        inviteLink: string;
      }>('/referral/stats');
      return response.data;
    },
  });

  // 获取被邀请人列表
  const { data: inviteesData } = useQuery({
    queryKey: ['referral', 'invitees'],
    queryFn: async () => {
      const response = await api.get<Array<{
        id: string;
        email: string;
        createdAt: string;
        totalRewards: string;
        status: string;
      }>>('/referral/invitees');
      return response.data;
    },
  });

  // 转换收益数据
  const earnings = useMemo(() => {
    if (!statsData) return undefined;
    return {
      total: parseFloat(statsData.totalRewards) || 0,
      activeReferrals: statsData.totalInvites || 0,
      thisMonth: parseFloat(statsData.pendingRewards) || 0,
    };
  }, [statsData]);

  // 转换推荐人列表
  const myReferrals = useMemo(() => {
    if (!inviteesData) return undefined;
    return inviteesData.map((r) => ({
      username: r.email.split('@')[0].slice(0, 3) + '***' + r.email.split('@')[0].slice(-3),
      joinDate: new Date(r.createdAt).toLocaleDateString('zh-CN'),
      earnings: parseFloat(r.totalRewards) || 0,
      status: (r.status === 'active' ? 'Active' : 'Inactive') as 'Active' | 'Inactive',
      level: 1 as const,
    }));
  }, [inviteesData]);

  return (
    <ReferralPageV3
      referralCode={inviteCodeData?.inviteCode}
      earnings={earnings}
      myReferrals={myReferrals}
      onShare={(platform) => {
        const link = inviteCodeData?.inviteCode
          ? `${window.location.origin}/register?ref=${inviteCodeData.inviteCode}`
          : window.location.origin;
        const text = `加入 Hoot 量化交易平台，使用我的邀请链接注册！`;

        if (platform === 'twitter') {
          window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`);
        } else if (platform === 'telegram') {
          window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
        } else {
          navigator.clipboard.writeText(link);
          alert('链接已复制');
        }
      }}
    />
  );
}
