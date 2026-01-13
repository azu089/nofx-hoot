'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import {
  ArrowLeft,
  Trophy,
  Medal,
  Crown,
  Star,
} from 'lucide-react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/pull-to-refresh';

interface LeaderboardUser {
  rank: number;
  username: string;
  avatar?: string;
  points: number;
  change: number;
}

interface LeaderboardData {
  myRank: {
    position: number;
    points: number;
    change: number;
  };
  topUsers: LeaderboardUser[];
}

export default function TgLeaderboardPage() {
  const router = useRouter();
  const { haptic, user } = useTelegramContext();
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'daily' | 'weekly' | 'total'>('total');

  const fetchData = async () => {
    try {
      // 模拟数据
      const mockData: LeaderboardData = {
        myRank: {
          position: 128,
          points: 12580,
          change: 5,
        },
        topUsers: [
          { rank: 1, username: 'CryptoKing', points: 985600, change: 0 },
          { rank: 2, username: 'QuantMaster', points: 856200, change: 1 },
          { rank: 3, username: 'TradeBot88', points: 752100, change: -1 },
          { rank: 4, username: 'AlgoTrader', points: 698500, change: 2 },
          { rank: 5, username: 'DefiPro', points: 625800, change: 0 },
          { rank: 6, username: 'BlockchainX', points: 589200, change: 3 },
          { rank: 7, username: 'SmartMoney', points: 545600, change: -2 },
          { rank: 8, username: 'TechTrader', points: 498700, change: 1 },
          { rank: 9, username: 'CoinHunter', points: 456300, change: 0 },
          { rank: 10, username: 'WhaleLord', points: 412800, change: -1 },
        ],
      };
      setData(mockData);
    } catch (error) {
      console.error('获取排行榜失败:', error);
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
  }, [tab]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-400" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-300" />;
      case 3:
        return <Medal className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="text-sm font-medium text-text-secondary">#{rank}</span>;
    }
  };

  const getRankBg = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/30';
      case 2:
        return 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/30';
      case 3:
        return 'bg-gradient-to-r from-amber-600/20 to-orange-600/20 border-amber-600/30';
      default:
        return 'bg-bg-secondary border-border-primary';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-bg-tertiary/50 rounded-lg w-32" />
        <div className="h-24 bg-bg-tertiary/50 rounded-xl" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-bg-tertiary/50 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <div className="space-y-4 pb-24">
        {/* 顶部 */}
        <button
          onClick={() => { haptic('selection'); router.back(); }}
          className="flex items-center gap-2 text-text-secondary"
        >
          <ArrowLeft size={20} />
          <span className="text-lg font-medium text-white">积分排行榜</span>
        </button>

        {/* 我的排名 */}
        <div className="bg-gradient-to-r from-brand-primary/20 to-warning/20 border border-brand-primary/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-brand-primary flex items-center justify-center text-white font-bold text-lg">
                {user?.first_name?.[0] || 'U'}
              </div>
              <div>
                <p className="font-medium text-white">{user?.first_name || '我'}</p>
                <p className="text-sm text-text-secondary">
                  {data?.myRank.points.toLocaleString()} 积分
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-warning">#{data?.myRank.position}</p>
              {data?.myRank.change !== 0 && (
                <p className={`text-xs ${data?.myRank.change > 0 ? 'text-success' : 'text-danger'}`}>
                  {data?.myRank.change > 0 ? '↑' : '↓'} {Math.abs(data?.myRank.change)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="flex gap-2 p-1 bg-bg-secondary rounded-lg">
          {[
            { key: 'daily', label: '日榜' },
            { key: 'weekly', label: '周榜' },
            { key: 'total', label: '总榜' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => { setTab(item.key as any); haptic('selection'); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === item.key
                  ? 'bg-brand-primary text-white'
                  : 'text-text-secondary'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* 排行榜列表 */}
        <div className="space-y-2">
          {data?.topUsers.map((item) => (
            <div
              key={item.rank}
              className={`flex items-center justify-between p-3 rounded-xl border ${getRankBg(item.rank)}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 flex items-center justify-center">
                  {getRankIcon(item.rank)}
                </div>
                <div className="w-10 h-10 rounded-full bg-bg-tertiary flex items-center justify-center text-white font-medium">
                  {item.avatar || item.username[0]}
                </div>
                <div>
                  <p className="font-medium text-white">{item.username}</p>
                  <p className="text-xs text-text-tertiary">
                    {item.points.toLocaleString()} 积分
                  </p>
                </div>
              </div>
              {item.change !== 0 && (
                <span className={`text-xs ${item.change > 0 ? 'text-success' : 'text-danger'}`}>
                  {item.change > 0 ? '↑' : '↓'} {Math.abs(item.change)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
