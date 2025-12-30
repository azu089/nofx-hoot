'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Metadata } from 'next';

// Metadata for this page (will be defined in layout or parent server component)
// export const metadata: Metadata = {
//   title: 'GameFi 中心 | QuantFi',
//   description: '查看积分余额、质押 USDT 赚取奖励、参与排行榜竞赛',
// };
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { gamefiApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import {
  Trophy,
  Coins,
  Lock,
  ArrowRightLeft,
  TrendingUp,
  ChevronRight,
  RefreshCw,
  Star,
  Gift,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface StakeSummary {
  totalStaked: string;
  totalWeight: string;
  activeStakes: number;
  claimable: string;
}

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  nickname: string;
  total_points: string;
  stake_weight: string;
}

export default function GameFiPage() {
  const router = useRouter();
  const [pointsBalance, setPointsBalance] = useState('0');
  const [stakeSummary, setStakeSummary] = useState<StakeSummary | null>(null);
  const [topUsers, setTopUsers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const fetchData = async () => {
    try {
      const [overviewRes, leaderboardRes] = await Promise.all([
        gamefiApi.getOverview(),
        gamefiApi.getLeaderboard({ limit: 3 }),
      ]);

      // 从 overview 获取积分和质押数据
      const overview = overviewRes.data;
      setPointsBalance(overview?.points?.available || '0');

      setStakeSummary({
        totalStaked: overview?.staking?.totalStaked || '0',
        totalWeight: overview?.staking?.averageWeight || '0',
        activeStakes: overview?.staking?.activeCount || 0,
        claimable: overview?.rewards?.claimable || '0',
      });

      // 排行榜前3 - 数据在 entries 中
      // 注意：排行榜不返回个人权重，使用全局平均权重作为参考
      const entries = leaderboardRes.data?.entries || [];
      const averageWeight = overview?.staking?.averageWeight || '1.00';

      setTopUsers(entries.slice(0, 3).map((entry, index) => ({
        rank: entry.rank || index + 1,
        user_id: entry.userId,
        nickname: entry.email?.split('@')[0] || '',
        total_points: entry.totalPoints,
        stake_weight: averageWeight, // 使用全局平均权重
      })));
    } catch (error) {
      console.error('Failed to fetch GameFi data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 领取收益
  const handleClaimRewards = async () => {
    const claimableAmount = parseFloat(stakeSummary?.claimable || '0');
    if (claimableAmount <= 0) {
      toast.info('暂无可领取的分红');
      return;
    }

    setClaiming(true);
    try {
      const res = await gamefiApi.claimRewards();
      if (res.code === 0) {
        toast.success(`成功领取 ${res.data?.amount || '0'} USDT`);
        fetchData(); // 刷新数据
      } else {
        toast.error(res.message || '领取失败');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || '领取失败');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">GameFi 中心</h1>
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-bg-tertiary rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">GameFi 中心</h1>
        <Button variant="ghost" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* 积分和质押概览 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-warning/10 to-warning/10 border-warning/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">积分余额</p>
                <p className="text-3xl font-bold text-warning mt-1">
                  {parseFloat(pointsBalance).toLocaleString()}
                </p>
                <p className="text-text-tertiary text-sm mt-1">
                  ≈ {formatCurrency((parseFloat(pointsBalance) / 100).toString())}
                </p>
              </div>
              <div className="w-14 h-14 bg-warning/20 rounded-xl flex items-center justify-center">
                <Coins className="w-8 h-8 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">总质押</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {formatCurrency(stakeSummary?.totalStaked || '0')}
                </p>
                <p className="text-text-tertiary text-sm mt-1">
                  {stakeSummary?.activeStakes || 0} 笔活跃质押
                </p>
              </div>
              <div className="w-14 h-14 bg-brand-primary/20 rounded-xl flex items-center justify-center">
                <Lock className="w-8 h-8 text-brand-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">质押权重</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {stakeSummary?.totalWeight || '0'}x
                </p>
                <p className="text-success text-sm mt-1">
                  <TrendingUp className="w-3 h-3 inline mr-1" />
                  分红加成中
                </p>
              </div>
              <div className="w-14 h-14 bg-success/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 可领取分红卡片 */}
        <Card className="bg-gradient-to-br from-brand-primary/10 to-brand-primary/5 border-brand-primary/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">待领取分红</p>
                <p className="text-2xl font-bold text-brand-primary mt-1">
                  {parseFloat(stakeSummary?.claimable || '0').toFixed(2)} USDT
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-2"
                  onClick={handleClaimRewards}
                  disabled={claiming || parseFloat(stakeSummary?.claimable || '0') <= 0}
                >
                  {claiming ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      领取中
                    </>
                  ) : (
                    <>
                      <Gift className="w-3 h-3 mr-1" />
                      领取分红
                    </>
                  )}
                </Button>
              </div>
              <div className="w-14 h-14 bg-brand-primary/20 rounded-xl flex items-center justify-center">
                <Gift className="w-8 h-8 text-brand-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 功能入口 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="hover:border-brand-primary/50 transition-colors cursor-pointer">
          <CardContent
            className="p-6"
            onClick={() => router.push('/gamefi/staking')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-brand-primary/20 rounded-xl flex items-center justify-center">
                  <Lock className="w-6 h-6 text-brand-primary" />
                </div>
                <div>
                  <h3 className="text-white font-medium text-lg">质押大厅</h3>
                  <p className="text-text-tertiary text-sm">质押资产参与平台分红</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-text-tertiary" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="bg-bg-tertiary/50 p-3 rounded-lg">
                <p className="text-text-tertiary text-xs">A 类质押</p>
                <p className="text-white font-medium">积分质押 · 1.0x</p>
              </div>
              <div className="bg-bg-tertiary/50 p-3 rounded-lg">
                <p className="text-text-tertiary text-xs">B 类质押</p>
                <p className="text-white font-medium">代币质押 · 最高 3.0x</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:border-warning/50 transition-colors cursor-pointer">
          <CardContent
            className="p-6"
            onClick={() => router.push('/gamefi/exchange')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-warning/20 rounded-xl flex items-center justify-center">
                  <ArrowRightLeft className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <h3 className="text-white font-medium text-lg">积分兑换</h3>
                  <p className="text-text-tertiary text-sm">将积分兑换为 $QFI 代币</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-text-tertiary" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="bg-bg-tertiary/50 p-3 rounded-lg">
                <p className="text-text-tertiary text-xs">标准兑换</p>
                <p className="text-white font-medium">100 积分 = 1 $QFI</p>
              </div>
              <div className="bg-bg-tertiary/50 p-3 rounded-lg">
                <p className="text-text-tertiary text-xs">锁仓释放</p>
                <p className="text-white font-medium">180 天线性释放</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 排行榜预览 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-warning" />
              积分排行榜
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/gamefi/leaderboard')}
            >
              查看完整排名
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {topUsers.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">
              <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>暂无排行数据</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topUsers.map((user, index) => {
                const rankColors = [
                  'bg-warning/20 text-warning border-warning/30',
                  'bg-text-secondary/20 text-text-primary border-text-secondary/30',
                  'bg-warning/20 text-warning border-warning/30',
                ];

                return (
                  <div
                    key={user.user_id}
                    className="flex items-center justify-between p-4 bg-bg-tertiary/30 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center border ${rankColors[index]}`}
                      >
                        {index === 0 ? (
                          <Star className="w-5 h-5" />
                        ) : (
                          <span className="font-bold">{index + 1}</span>
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium">
                          {user.nickname || `用户 ${user.user_id.slice(-4)}`}
                        </p>
                        <p className="text-text-tertiary text-sm">
                          权重: {parseFloat(user.stake_weight).toFixed(2)}x
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-warning font-bold">
                        {parseFloat(user.total_points).toLocaleString()}
                      </p>
                      <p className="text-text-tertiary text-xs">积分</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
