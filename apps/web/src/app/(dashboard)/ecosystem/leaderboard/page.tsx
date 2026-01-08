'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { gamefiApi } from '@/lib/api';
import {
  Trophy,
  Star,
  Medal,
  RefreshCw,
} from 'lucide-react';
import { MobileHeader } from '@/components/ui';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  email: string;
  totalPoints: string;
  todayPoints: string;
  vipLevel: number;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await gamefiApi.getLeaderboard({ limit: 100 });
      // 排行榜数据在 data.entries 中
      setLeaderboard(res.data?.entries || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return {
          bg: 'bg-gradient-to-r from-warning/20 to-warning/10',
          border: 'border-warning/50',
          badge: 'bg-warning/20 text-warning border-warning/30',
          icon: Star,
        };
      case 2:
        return {
          bg: 'bg-gradient-to-r from-text-secondary/10 to-text-primary/10',
          border: 'border-text-secondary/30',
          badge: 'bg-text-secondary/20 text-text-primary border-text-secondary/30',
          icon: Medal,
        };
      case 3:
        return {
          bg: 'bg-gradient-to-r from-warning/10 to-warning/5',
          border: 'border-warning/30',
          badge: 'bg-warning/20 text-warning border-warning/30',
          icon: Medal,
        };
      default:
        return {
          bg: 'bg-bg-tertiary/30',
          border: 'border-border-primary',
          badge: 'bg-bg-tertiary text-text-secondary border-border-secondary',
          icon: null,
        };
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <MobileHeader title="积分排行榜" />
        <div className="animate-pulse space-y-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-20 bg-bg-tertiary rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // 分离前三名和其他
  const topThree = leaderboard.slice(0, 3);
  const others = leaderboard.slice(3);

  return (
    <div className="space-y-6">
      <MobileHeader
        title="积分排行榜"
        subtitle="查看积分排名"
        rightAction={
          <Button variant="ghost" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新
          </Button>
        }
      />

      {leaderboard.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-text-disabled" />
            <h3 className="text-lg font-medium text-white mb-2">暂无排行数据</h3>
            <p className="text-text-secondary">快去质押赚取积分吧！</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 前三名展示 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 第二名 */}
            {topThree[1] && (
              <Card className={`${getRankStyle(2).bg} ${getRankStyle(2).border} order-1 md:order-0`}>
                <CardContent className="p-6 text-center">
                  <div
                    className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center border-2 ${getRankStyle(2).badge}`}
                  >
                    <Medal className="w-8 h-8" />
                  </div>
                  <p className="text-white font-bold mt-4 text-lg">
                    {topThree[1].email?.split('@')[0] || `用户 ${topThree[1].userId.slice(-4)}`}
                  </p>
                  <p className="text-text-tertiary text-sm">第 2 名</p>
                  <p className="text-2xl font-bold text-text-primary mt-2">
                    {parseFloat(topThree[1].totalPoints).toLocaleString()}
                  </p>
                  <p className="text-text-tertiary text-xs">积分</p>
                </CardContent>
              </Card>
            )}

            {/* 第一名 */}
            {topThree[0] && (
              <Card className={`${getRankStyle(1).bg} ${getRankStyle(1).border} order-0 md:order-1 transform md:scale-105`}>
                <CardContent className="p-6 text-center">
                  <div
                    className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center border-2 ${getRankStyle(1).badge}`}
                  >
                    <Star className="w-10 h-10" />
                  </div>
                  <p className="text-white font-bold mt-4 text-xl">
                    {topThree[0].email?.split('@')[0] || `用户 ${topThree[0].userId.slice(-4)}`}
                  </p>
                  <p className="text-warning text-sm">第 1 名</p>
                  <p className="text-3xl font-bold text-warning mt-2">
                    {parseFloat(topThree[0].totalPoints).toLocaleString()}
                  </p>
                  <p className="text-text-tertiary text-xs">积分</p>
                </CardContent>
              </Card>
            )}

            {/* 第三名 */}
            {topThree[2] && (
              <Card className={`${getRankStyle(3).bg} ${getRankStyle(3).border} order-2`}>
                <CardContent className="p-6 text-center">
                  <div
                    className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center border-2 ${getRankStyle(3).badge}`}
                  >
                    <Medal className="w-8 h-8" />
                  </div>
                  <p className="text-white font-bold mt-4 text-lg">
                    {topThree[2].email?.split('@')[0] || `用户 ${topThree[2].userId.slice(-4)}`}
                  </p>
                  <p className="text-text-tertiary text-sm">第 3 名</p>
                  <p className="text-2xl font-bold text-warning mt-2">
                    {parseFloat(topThree[2].totalPoints).toLocaleString()}
                  </p>
                  <p className="text-text-tertiary text-xs">积分</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 其他排名 */}
          {others.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-text-secondary" />
                  更多排名
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {others.map((user) => {
                    const rank = user.rank;
                    const style = getRankStyle(rank);

                    return (
                      <div
                        key={user.userId}
                        className={`flex items-center justify-between p-4 rounded-lg ${style.bg} border ${style.border}`}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center border ${style.badge}`}
                          >
                            <span className="font-bold text-sm">{rank}</span>
                          </div>
                          <div>
                            <p className="text-white font-medium">
                              {user.email?.split('@')[0] || `用户 ${user.userId.slice(-4)}`}
                            </p>
                            <p className="text-text-tertiary text-sm">
                              VIP {user.vipLevel} · 今日 +{parseFloat(user.todayPoints).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-bold">
                            {parseFloat(user.totalPoints).toLocaleString()}
                          </p>
                          <p className="text-text-tertiary text-xs">积分</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
