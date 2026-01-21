'use client';

import { useEffect, useState } from 'react';
import { gamefiApi } from '@/lib/api';
import {
  Trophy,
  Medal,
  Crown,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  email: string;
  totalPoints: string;
  todayPoints: string;
  vipLevel: number;
}

export default function LeaderboardPage() {
  const { user } = useAuthStore();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'daily' | 'weekly' | 'total'>('total');

  const fetchData = async () => {
    try {
      const res = await gamefiApi.getLeaderboard({ limit: 100 });
      setLeaderboard(res.data?.entries || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

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

  // 计算当前用户排名
  const myRank = leaderboard.find(entry => entry.userId === user?.id);
  const myPosition = myRank ? myRank.rank : '--';
  const myPoints = myRank ? parseFloat(myRank.totalPoints) : 0;

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
    <div className="space-y-4 pb-24">
      {/* 我的排名 */}
      <div className="bg-gradient-to-r from-brand-primary/20 to-warning/20 border border-brand-primary/30 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-brand-primary flex items-center justify-center text-white font-bold text-lg">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <p className="font-medium text-white">{user?.email?.split('@')[0] || '我'}</p>
              <p className="text-sm text-text-secondary">
                {myPoints.toLocaleString()} 积分
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-warning">#{myPosition}</p>
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
            onClick={() => setTab(item.key as 'daily' | 'weekly' | 'total')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === item.key
                ? 'bg-brand-primary text-white'
                : 'text-text-secondary hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 排行榜列表 */}
      {leaderboard.length === 0 ? (
        <div className="py-12 text-center bg-bg-secondary border border-border-primary rounded-xl">
          <Trophy className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
          <p className="text-text-secondary">暂无排行数据</p>
          <p className="text-text-tertiary text-xs mt-1">快去质押赚取积分吧！</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((item) => (
            <div
              key={item.userId}
              className={`flex items-center justify-between p-3 rounded-xl border ${getRankBg(item.rank)}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 flex items-center justify-center">
                  {getRankIcon(item.rank)}
                </div>
                <div className="w-10 h-10 rounded-full bg-bg-tertiary flex items-center justify-center text-white font-medium">
                  {item.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="font-medium text-white">
                    {item.email?.split('@')[0] || `用户 ${item.userId.slice(-4)}`}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    VIP {item.vipLevel} · 今日 +{parseFloat(item.todayPoints).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-bold">
                  {parseFloat(item.totalPoints).toLocaleString()}
                </p>
                <p className="text-text-tertiary text-xs">积分</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
