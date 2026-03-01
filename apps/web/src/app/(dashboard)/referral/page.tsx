'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { ReferralPageV3 } from '@/components/ui-v3/referral/referral-page-v3';
import { MobileReferralPage } from '@/components/ui-v3/mobile/mobile-referral-page';
import { UserPlus, Check } from 'lucide-react';

export default function ReferralPage() {
  const router = useRouter();

  // 绑定上级邀请码状态
  const [bindCode, setBindCode] = useState('');
  const [bindStatus, setBindStatus] = useState<'idle' | 'success' | 'already'>('idle');
  const [isBinding, setIsBinding] = useState(false);

  const handleBindUpline = async () => {
    const code = bindCode.trim().toUpperCase();
    if (!code) return;
    setIsBinding(true);
    try {
      await api.post('/referral/bind', { inviteCode: code });
      setBindStatus('success');
      toast.success('已成功绑定上级');
    } catch (e: any) {
      const msg: string = e?.response?.data?.message || '';
      if (msg.includes('已绑定')) {
        setBindStatus('already');
      } else {
        toast.error(msg || '绑定失败，请检查邀请码是否正确');
      }
    } finally {
      setIsBinding(false);
    }
  };

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
        nickname: string;
        email: string;
        createdAt: string;
        totalContribution: string;
      }>>('/referral/invitees');
      return response.data;
    },
  });

  // 获取推荐排行榜
  const { data: leaderboardData } = useQuery({
    queryKey: ['referral', 'leaderboard'],
    queryFn: async () => {
      const response = await api.get<Array<{
        rank: number;
        username: string;
        referrals: number;
        earnings: number;
      }>>('/referral/leaderboard');
      return response.data;
    },
    staleTime: 60000, // 1分钟缓存
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
      id: r.id,
      username: r.nickname || (r.email.includes('@')
        ? r.email.split('@')[0].slice(0, 3) + '***' + r.email.split('@')[0].slice(-3)
        : r.email),
      joinDate: new Date(r.createdAt).toLocaleDateString('zh-CN'),
      earnings: parseFloat(r.totalContribution) || 0,
      status: 'Active' as 'Active' | 'Inactive', // 已注册即活跃
      level: 1 as const,
    }));
  }, [inviteesData]);

  // 绑定上级邀请码卡片（未绑定时显示，已绑定时替换为成功提示）
  const bindUplineSection = bindStatus === 'success' || bindStatus === 'already' ? (
    <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-[#10B981]/10 border border-[#10B981]/20 rounded-xl">
      <Check className="w-4 h-4 text-[#10B981] flex-shrink-0" />
      <span className="text-sm text-[#10B981]">
        {bindStatus === 'success' ? '已成功绑定上级，返佣关系已建立' : '您已绑定上级邀请码'}
      </span>
    </div>
  ) : (
    <div className="mb-4 p-4 bg-[#12121A] border border-[#1E1E2E] rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <UserPlus className="w-4 h-4 text-[#06B6D4]" />
        <span className="text-sm font-medium text-[#F8F8FC]">绑定上级邀请码</span>
        <span className="text-xs text-[#606070]">（每个账号只能绑定一次）</span>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={bindCode}
          onChange={(e) => setBindCode(e.target.value.toUpperCase())}
          placeholder="输入上级的邀请码"
          maxLength={12}
          className="flex-1 px-3 py-2 text-sm bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-[#06B6D4]/50"
        />
        <button
          type="button"
          onClick={handleBindUpline}
          disabled={isBinding || !bindCode.trim()}
          className="px-4 py-2 text-sm bg-[#06B6D4]/15 text-[#06B6D4] rounded-lg hover:bg-[#06B6D4]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isBinding ? '绑定中…' : '确认绑定'}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* 桌面端 — 绑定卡片在页面内容上方 */}
      <div className="hidden md:block">
        {bindUplineSection}
        <ReferralPageV3
          referralCode={inviteCodeData?.inviteCode}
          earnings={earnings}
          myReferrals={myReferrals}
          leaderboard={leaderboardData}
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
              toast.success('链接已复制');
            }
          }}
        />
      </div>

      {/* 移动端 — 绑定卡片通过 prop 注入组件内部（导航栏下方、统计卡上方） */}
      <div className="block md:hidden">
        <MobileReferralPage
          onBack={() => router.back()}
          referralCode={inviteCodeData?.inviteCode}
          earnings={earnings}
          myReferrals={myReferrals}
          leaderboard={leaderboardData}
          bindSection={bindUplineSection}
        />
      </div>
    </>
  );
}
