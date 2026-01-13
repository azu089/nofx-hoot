'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { api } from '@/lib/api';
import {
  Coins,
  Trophy,
  Zap,
  Lock,
  ArrowRight,
  TrendingUp,
  Gift,
  Star,
} from 'lucide-react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/pull-to-refresh';

interface EcosystemData {
  points: {
    balance: string;
    todayEarned: string;
    totalEarned: string;
  };
  staking: {
    totalStaked: string;
    rewards: string;
    apy: string;
  };
  token: {
    balance: string;
    locked: string;
    price: string;
  };
  rank: {
    position: number;
    total: number;
  };
}

export default function TgEcosystemPage() {
  const { haptic } = useTelegramContext();
  const [data, setData] = useState<EcosystemData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      // 模拟数据，实际应从 API 获取
      const mockData: EcosystemData = {
        points: {
          balance: '12580',
          todayEarned: '150',
          totalEarned: '45680',
        },
        staking: {
          totalStaked: '5000.00',
          rewards: '125.50',
          apy: '15.2',
        },
        token: {
          balance: '1250.00',
          locked: '500.00',
          price: '0.85',
        },
        rank: {
          position: 128,
          total: 5680,
        },
      };
      setData(mockData);
    } catch (error) {
      console.error('获取生态数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      haptic('impact_light');
      await fetchData();
      haptic('notification_success');
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-32 bg-bg-tertiary/50 rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 bg-bg-tertiary/50 rounded-xl" />
          <div className="h-24 bg-bg-tertiary/50 rounded-xl" />
        </div>
        <div className="h-32 bg-bg-tertiary/50 rounded-xl" />
      </div>
    );
  }

  const menuItems = [
    {
      href: '/tg/ecosystem/staking',
      icon: Lock,
      title: '质押挖矿',
      desc: '质押赚取收益',
      color: 'text-brand-primary',
      bg: 'bg-brand-primary/10',
    },
    {
      href: '/tg/ecosystem/leaderboard',
      icon: Trophy,
      title: '排行榜',
      desc: `您排名 #${data?.rank.position || '-'}`,
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
    {
      href: '/tg/ecosystem/exchange',
      icon: Zap,
      title: '积分兑换',
      desc: '兑换 QFI 代币',
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      href: '/tg/ecosystem/vesting',
      icon: Gift,
      title: '释放进度',
      desc: '查看代币释放',
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
  ];

  return (
    <>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <div className="space-y-4 pb-24">
        {/* 积分卡片 */}
        <div className="bg-gradient-to-r from-brand-primary/20 to-success/20 border border-brand-primary/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Coins className="w-5 h-5 text-warning" />
            <span className="text-white font-medium">我的积分</span>
          </div>
          <p className="text-3xl font-bold text-white mb-2">
            {parseInt(data?.points.balance || '0').toLocaleString()}
          </p>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-text-secondary">
              今日 <span className="text-success">+{data?.points.todayEarned}</span>
            </span>
            <span className="text-text-secondary">
              累计 {parseInt(data?.points.totalEarned || '0').toLocaleString()}
            </span>
          </div>
        </div>

        {/* QFI 代币 & 质押 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-bg-secondary border border-border-primary rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-brand-primary" />
              <span className="text-xs text-text-tertiary">QFI 余额</span>
            </div>
            <p className="text-xl font-bold text-white">
              {parseFloat(data?.token.balance || '0').toFixed(2)}
            </p>
            <p className="text-xs text-text-tertiary mt-1">
              ≈ ${(parseFloat(data?.token.balance || '0') * parseFloat(data?.token.price || '0')).toFixed(2)}
            </p>
          </div>

          <div className="bg-bg-secondary border border-border-primary rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-success" />
              <span className="text-xs text-text-tertiary">质押中</span>
            </div>
            <p className="text-xl font-bold text-white">
              {parseFloat(data?.staking.totalStaked || '0').toFixed(2)}
            </p>
            <p className="text-xs text-success mt-1">
              APY {data?.staking.apy}%
            </p>
          </div>
        </div>

        {/* 质押收益 */}
        <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-text-secondary text-sm">质押收益</span>
            <Link
              href="/tg/ecosystem/staking"
              onClick={() => haptic('selection')}
              className="text-brand-primary text-xs flex items-center gap-1"
            >
              查看详情 <ArrowRight size={12} />
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-success">
                +{parseFloat(data?.staking.rewards || '0').toFixed(2)}
              </p>
              <p className="text-xs text-text-tertiary mt-1">QFI</p>
            </div>
            <div className="flex items-center gap-1 px-3 py-1.5 bg-success/10 rounded-lg">
              <TrendingUp size={14} className="text-success" />
              <span className="text-success text-sm font-medium">
                {data?.staking.apy}% APY
              </span>
            </div>
          </div>
        </div>

        {/* 功能入口 */}
        <div className="grid grid-cols-2 gap-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => haptic('selection')}
                className="bg-bg-secondary border border-border-primary rounded-xl p-4"
              >
                <div className={`w-10 h-10 rounded-full ${item.bg} flex items-center justify-center mb-3`}>
                  <Icon size={20} className={item.color} />
                </div>
                <h3 className="font-medium text-white text-sm">{item.title}</h3>
                <p className="text-xs text-text-tertiary mt-0.5">{item.desc}</p>
              </Link>
            );
          })}
        </div>

        {/* 排行榜预览 */}
        <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-warning" />
              <span className="text-white font-medium">积分排行</span>
            </div>
            <Link
              href="/tg/ecosystem/leaderboard"
              onClick={() => haptic('selection')}
              className="text-brand-primary text-xs flex items-center gap-1"
            >
              查看全部 <ArrowRight size={12} />
            </Link>
          </div>
          <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center">
                <Star size={16} className="text-warning" />
              </div>
              <div>
                <p className="text-sm text-white">我的排名</p>
                <p className="text-xs text-text-tertiary">
                  前 {((data?.rank.position || 1) / (data?.rank.total || 1) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-warning">#{data?.rank.position}</p>
              <p className="text-xs text-text-tertiary">/ {data?.rank.total}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
