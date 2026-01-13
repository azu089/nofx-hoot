'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, MobileHeader, Button } from '@/components/ui';
import { gamefiApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import {
  Coins,
  Lock,
  ArrowRightLeft,
  Clock,
  Trophy,
  ChevronRight,
  TrendingUp,
  Sparkles,
} from 'lucide-react';

export default function EcosystemPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    points: 0,
    qfiBalance: '0',
    totalStaked: '0',
    stakingRewards: '0',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [pointsRes, stakingRes, tokenRes] = await Promise.all([
          gamefiApi.getPointsBalance(),
          gamefiApi.getStakingStats(),
          gamefiApi.getTokenBalance(),
        ]);

        setStats({
          points: parseFloat(pointsRes.data?.total || '0'),
          qfiBalance: tokenRes.data?.total || '0',
          totalStaked: stakingRes.data?.staked_amount || '0',
          stakingRewards: stakingRes.data?.total_accumulated || '0',
        });
      } catch (error) {
        console.error('Failed to fetch ecosystem data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const menuItems = [
    {
      icon: Lock,
      title: '质押大厅',
      description: '质押 USDT 获取收益',
      href: '/ecosystem/staking',
      color: 'text-brand-primary',
      bgColor: 'bg-brand-primary/10',
    },
    {
      icon: ArrowRightLeft,
      title: '积分兑换',
      description: '积分兑换 QFI 代币',
      href: '/ecosystem/exchange',
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      icon: Clock,
      title: '释放进度',
      description: '查看代币释放计划',
      href: '/ecosystem/vesting',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      icon: Trophy,
      title: '排行榜',
      description: '查看积分排名',
      href: '/ecosystem/leaderboard',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <MobileHeader title="生态中心" />
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-bg-tertiary rounded-xl" />
          <div className="h-48 bg-bg-tertiary rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 资产概览 - 统一大卡片 + 光球脉动 */}
      <div className="relative bg-bg-secondary rounded-2xl p-5 overflow-hidden">
        {/* 光球脉动效果 */}
        <div className="pointer-events-none absolute -top-20 right-0 h-40 w-40 animate-pulse rounded-full opacity-30 blur-3xl bg-brand-primary" />

        <div className="relative z-10">
          {/* 标题行 */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-text-secondary text-sm">生态资产</span>
          </div>

          {/* 主要数据 - 积分余额 */}
          <div className="mb-4">
            <p className="text-text-tertiary text-xs mb-1">积分余额</p>
            <p className="text-3xl font-bold font-mono text-white">
              {stats.points.toLocaleString()}
            </p>
          </div>

          {/* 次要数据 - 三列布局 */}
          <div className="grid grid-cols-3 gap-4 pt-4">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-success" />
                <span className="text-text-tertiary text-xs">QFI 代币</span>
              </div>
              <p className="text-lg font-bold font-mono text-white">
                {parseFloat(stats.qfiBalance).toLocaleString()}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Lock className="w-3.5 h-3.5 text-warning" />
                <span className="text-text-tertiary text-xs">质押总额</span>
              </div>
              <p className="text-lg font-bold font-mono text-white">
                {formatCurrency(stats.totalStaked)}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-success" />
                <span className="text-text-tertiary text-xs">累计收益</span>
              </div>
              <p className="text-lg font-bold font-mono text-success">
                +{formatCurrency(stats.stakingRewards)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 功能入口 */}
      <Card>
        <CardContent className="p-0">
          {menuItems.map((item, index) => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`w-full flex items-center justify-between p-4 hover:bg-bg-tertiary transition-colors ${
                index !== menuItems.length - 1 ? 'border-b border-border-primary' : ''
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg ${item.bgColor} flex items-center justify-center`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <div className="text-left">
                  <p className="text-white font-medium">{item.title}</p>
                  <p className="text-text-secondary text-sm">{item.description}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-text-tertiary" />
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
