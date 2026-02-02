'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { EcosystemPageV3 } from '@/components/ui-v3/ecosystem/ecosystem-page-v3';
import { MobileEcosystemV3 } from '@/components/ui-v3/mobile/mobile-ecosystem-v3';

// 后端返回的数据类型
interface StakingRecord {
  id: string;
  amount: string;
  weight: string;
  weightedAmount: string;
  stakedAt: string;
  lockDays: number;
  lockUntil: string | null;
  status: string;
}

interface StakingStats {
  totalStaked: string;
  totalWeighted: string;
  estimatedWeeklyDividend: string;
  nextDividendDate: string;
}

interface DividendRecord {
  id: string;
  periodStart: string;
  periodEnd: string;
  stakedAmount: string;
  weightedAmount: string;
  dividendAmount: string;
  status: string;
  paidAt: string | null;
}

interface GlobalStats {
  totalStakers: number;
  totalStaked: string;
  totalWeighted: string;
  lastPoolAmount: string | null;
  lastPoolDate: string | null;
}

// 排行榜数据类型
interface LeaderboardEntry {
  rank: number;
  address: string;
  staked: string;
  weight: string;
  rewards: string;
}

export default function EcosystemPage() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  // 获取我的质押列表
  const { data: myStakings } = useQuery({
    queryKey: ['staking', 'my'],
    queryFn: async () => {
      const response = await api.get<StakingRecord[]>('/staking/my');
      return response.data;
    },
    enabled: isAuthenticated,
  });

  // 获取我的质押统计
  const { data: myStats } = useQuery({
    queryKey: ['staking', 'my-stats'],
    queryFn: async () => {
      const response = await api.get<StakingStats>('/staking/my/stats');
      return response.data;
    },
    enabled: isAuthenticated,
  });

  // 获取我的分红历史
  const { data: myDividends } = useQuery({
    queryKey: ['staking', 'my-dividends'],
    queryFn: async () => {
      const response = await api.get<DividendRecord[]>('/staking/my/dividends');
      return response.data;
    },
    enabled: isAuthenticated,
  });

  // 获取全网质押统计（公开接口）
  const { data: globalStats } = useQuery({
    queryKey: ['staking', 'global-stats'],
    queryFn: async () => {
      const response = await api.get<GlobalStats>('/staking/global-stats');
      return response.data;
    },
  });

  // 获取质押排行榜（公开接口）
  const { data: leaderboard } = useQuery({
    queryKey: ['staking', 'leaderboard'],
    queryFn: async () => {
      const response = await api.get<LeaderboardEntry[]>('/staking/leaderboard');
      return response.data;
    },
  });

  // 质押
  const stakeMutation = useMutation({
    mutationFn: async (data: { amount: number; lockDays: number }) => {
      const response = await api.post('/staking', {
        amount: String(data.amount),
        lockDays: data.lockDays,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staking'] });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'balance'] });
      alert('质押成功');
    },
    onError: (error) => {
      alert(error instanceof Error ? error.message : '质押失败');
    },
  });

  // 解除质押
  const unstakeMutation = useMutation({
    mutationFn: async (recordId: string) => {
      const response = await api.post(`/staking/${recordId}/unstake`, {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staking'] });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'balance'] });
      alert('解押成功');
    },
    onError: (error) => {
      alert(error instanceof Error ? error.message : '解押失败');
    },
  });

  // 领取奖励
  const claimRewardsMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/staking/claim', {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staking'] });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'balance'] });
      alert('奖励领取成功');
    },
    onError: (error) => {
      alert(error instanceof Error ? error.message : '领取失败');
    },
  });

  // 转换质押记录格式 - 桌面端格式
  const stakeRecordsDesktop = myStakings?.map((s) => {
    const lockUntilDate = s.lockUntil ? new Date(s.lockUntil) : null;
    const now = new Date();
    const daysRemaining = lockUntilDate
      ? Math.max(0, Math.ceil((lockUntilDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    return {
      id: s.id,
      amount: parseFloat(s.amount),
      stakedAt: s.stakedAt,
      lockPeriod: s.lockDays,
      daysRemaining,
      weight: parseFloat(s.weight),
      accumulatedRewards: 0, // 后端暂无此字段
      status: (s.status === 'locked' && daysRemaining > 0
        ? 'locked'
        : s.status === 'unstaked'
          ? 'unstaked'
          : 'unlocked') as 'locked' | 'unlocked' | 'unstaked',
    };
  });

  // 转换质押记录格式 - 移动端格式
  const stakeRecordsMobile = myStakings?.map((s) => {
    const lockUntilDate = s.lockUntil ? new Date(s.lockUntil) : null;
    const stakedAtDate = new Date(s.stakedAt);
    const now = new Date();
    const daysRemaining = lockUntilDate
      ? Math.max(0, Math.ceil((lockUntilDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    // 移动端状态映射: locked -> staking, unlocked -> unlocked, unstaked -> history
    let mobileStatus: 'staking' | 'unlocked' | 'history';
    if (s.status === 'unstaked') {
      mobileStatus = 'history';
    } else if (s.status === 'locked' && daysRemaining > 0) {
      mobileStatus = 'staking';
    } else {
      mobileStatus = 'unlocked';
    }

    return {
      id: s.id,
      amount: parseFloat(s.amount),
      lockPeriod: s.lockDays,
      stakeDate: stakedAtDate.toISOString().split('T')[0],
      unlockDate: lockUntilDate ? lockUntilDate.toISOString().split('T')[0] : stakedAtDate.toISOString().split('T')[0],
      weight: parseFloat(s.weight),
      rewards: 0, // 后端暂无累计收益字段
      status: mobileStatus,
    };
  });

  // 转换分红记录格式 - 桌面端格式
  const dividendRecordsDesktop = myDividends?.map((d) => ({
    id: d.id,
    date: d.periodEnd,
    amount: parseFloat(d.dividendAmount),
    stakedAmount: parseFloat(d.stakedAmount),
    weight: parseFloat(d.weightedAmount) / parseFloat(d.stakedAmount) || 1,
    poolTotal: 0, // 后端暂无此字段
  }));

  // 转换分红记录格式 - 移动端格式
  const dividendRecordsMobile = myDividends?.map((d) => ({
    id: d.id,
    date: new Date(d.periodEnd).toISOString().split('T')[0],
    amount: parseFloat(d.dividendAmount),
    source: '平台手续费分红',
  }));

  // 计算总分红收益
  const totalDividendEarned = myDividends?.reduce(
    (sum, d) => sum + parseFloat(d.dividendAmount),
    0
  ) || 0;

  // 计算用户总质押
  const userStaked = parseFloat(myStats?.totalStaked || '0');

  // 计算预计分红
  const pendingRewardsUsdt = parseFloat(myStats?.estimatedWeeklyDividend || '0');

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden md:block">
        <EcosystemPageV3
          totalStaked={globalStats?.totalStaked}
          userStaked={userStaked}
          pendingRewardsUsdt={pendingRewardsUsdt}
          nextDistribution={myStats?.nextDividendDate}
          stakeRecords={stakeRecordsDesktop}
          dividendRecords={dividendRecordsDesktop}
          totalDividendEarned={totalDividendEarned}
          leaderboardData={leaderboard}
          onStake={(amount, periodDays) => stakeMutation.mutate({ amount, lockDays: periodDays })}
          onUnstake={(id) => unstakeMutation.mutate(id)}
          onClaimRewards={() => claimRewardsMutation.mutate()}
        />
      </div>

      {/* 移动端 */}
      <div className="block md:hidden">
        <MobileEcosystemV3
          totalStaked={globalStats?.totalStaked}
          userStaked={userStaked}
          pendingRewards={pendingRewardsUsdt}
          stakeRecords={stakeRecordsMobile}
          dividendRecords={dividendRecordsMobile}
          leaderboardData={leaderboard}
          onStake={(amount, periodDays) => stakeMutation.mutate({ amount, lockDays: periodDays })}
          onUnstake={(id) => unstakeMutation.mutate(id)}
          onClaimRewards={() => claimRewardsMutation.mutate()}
        />
      </div>
    </>
  );
}
