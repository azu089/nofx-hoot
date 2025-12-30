'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import {
  Trophy,
  Medal,
  Crown,
  TrendingUp,
  TrendingDown,
  Minus,
  User,
} from 'lucide-react';

// 模拟排行榜数据
const mockLeaderboardData = {
  myRank: 156,
  myPoints: 125000,
  myChange: 12,
  topUsers: [
    { rank: 1, name: '交易之王', points: 2500000, change: 0, avatar: '👑' },
    { rank: 2, name: '量化大师', points: 1800000, change: 2, avatar: '🥈' },
    { rank: 3, name: '币圈老炮', points: 1500000, change: -1, avatar: '🥉' },
    { rank: 4, name: 'CryptoWhale', points: 1200000, change: 1, avatar: '🐋' },
    { rank: 5, name: '稳健投资者', points: 980000, change: -2, avatar: '💎' },
    { rank: 6, name: 'BTC信仰者', points: 850000, change: 3, avatar: '₿' },
    { rank: 7, name: '链上狙击手', points: 720000, change: 0, avatar: '🎯' },
    { rank: 8, name: '套利专家', points: 680000, change: -1, avatar: '📊' },
    { rank: 9, name: '趋势猎人', points: 620000, change: 4, avatar: '🦅' },
    { rank: 10, name: '网格玩家', points: 550000, change: -2, avatar: '🕸️' },
  ],
  nearbyUsers: [
    { rank: 154, name: '用户****5821', points: 128000, change: 1 },
    { rank: 155, name: '用户****3394', points: 126500, change: -3 },
    { rank: 156, name: '我', points: 125000, change: 12, isMe: true },
    { rank: 157, name: '用户****7762', points: 123800, change: 0 },
    { rank: 158, name: '用户****9901', points: 122000, change: 5 },
  ],
  rewards: [
    { rank: '第 1 名', reward: '50,000 USDT + VIP终身' },
    { rank: '第 2-3 名', reward: '20,000 USDT + VIP年卡' },
    { rank: '第 4-10 名', reward: '5,000 USDT + VIP季卡' },
    { rank: '第 11-50 名', reward: '1,000 USDT' },
    { rank: '第 51-100 名', reward: '500 USDT' },
  ],
};

export default function LeaderboardPage() {
  const data = mockLeaderboardData;

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="w-6 text-center font-bold">{rank}</span>;
    }
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="w-7 h-7 text-yellow-500" />
          积分排行榜
        </h1>
        <p className="text-muted-foreground">排名靠前可获得丰厚奖励</p>
      </div>

      {/* 我的排名 */}
      <Card className="bg-gradient-to-r from-primary/20 to-primary/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center text-2xl">
                <User className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">我的排名</p>
                <p className="text-3xl font-bold">#{data.myRank}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">我的积分</p>
              <p className="text-2xl font-bold">{data.myPoints.toLocaleString()}</p>
              <div className="flex items-center gap-1 justify-end text-green-500">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">上升 {data.myChange} 名</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 10 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-yellow-500" />
                Top 10 排行
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.topUsers.map((user, index) => (
                  <div
                    key={user.rank}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      index < 3 ? 'bg-gradient-to-r from-yellow-500/10 to-transparent' : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 flex justify-center">
                        {getRankIcon(user.rank)}
                      </div>
                      <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center text-xl">
                        {user.avatar}
                      </div>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {user.points.toLocaleString()} 积分
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getChangeIcon(user.change)}
                      <span className="text-sm text-muted-foreground w-8">
                        {user.change === 0 ? '-' : user.change > 0 ? `+${user.change}` : user.change}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 奖励说明 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              排名奖励
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.rewards.map((item, index) => (
                <div
                  key={index}
                  className="p-3 bg-muted/50 rounded-lg"
                >
                  <p className="font-medium text-sm">{item.rank}</p>
                  <p className="text-primary text-sm">{item.reward}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4 text-center">
              每月 1 日结算上月排名奖励
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 我的附近 */}
      <Card>
        <CardHeader>
          <CardTitle>我的附近</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.nearbyUsers.map((user) => (
              <div
                key={user.rank}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  user.isMe ? 'bg-primary/20 border border-primary/50' : 'bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="w-8 text-center font-bold">{user.rank}</span>
                  <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className={`font-medium ${user.isMe ? 'text-primary' : ''}`}>
                      {user.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {user.points.toLocaleString()} 积分
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getChangeIcon(user.change)}
                  <span className="text-sm text-muted-foreground w-8">
                    {user.change === 0 ? '-' : user.change > 0 ? `+${user.change}` : user.change}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">
            再获得 {(data.nearbyUsers[1].points - data.myPoints).toLocaleString()} 积分即可超越上一名
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
