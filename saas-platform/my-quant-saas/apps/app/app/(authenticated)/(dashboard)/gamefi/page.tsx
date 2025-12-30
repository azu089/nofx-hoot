'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { Button } from '@repo/design-system/components/ui/button';
import {
  Gamepad2,
  Coins,
  Trophy,
  TrendingUp,
  Clock,
  Gift,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

// 模拟 GameFi 数据
const mockGameFiData = {
  totalPoints: 125000,
  pendingPoints: 15000,
  stakedAmount: 5000,
  stakingReward: 234.56,
  vestingTotal: 50000,
  vestingReleased: 12500,
  leaderboardRank: 156,
  dailyCheckIn: 7,
};

export default function GameFiPage() {
  const data = mockGameFiData;
  const vestingProgress = (data.vestingReleased / data.vestingTotal) * 100;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gamepad2 className="w-7 h-7 text-primary" />
            GameFi 中心
          </h1>
          <p className="text-muted-foreground">质押赚取收益，积分兑换奖励</p>
        </div>
        <Button>
          <Gift className="w-4 h-4 mr-2" />
          每日签到
        </Button>
      </div>

      {/* 核心数据 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <Coins className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">总积分</p>
                <p className="text-xl font-bold">{data.totalPoints.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">质押金额</p>
                <p className="text-xl font-bold">${data.stakedAmount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">质押收益</p>
                <p className="text-xl font-bold text-green-500">+${data.stakingReward}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Trophy className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">排行榜</p>
                <p className="text-xl font-bold">第 {data.leaderboardRank} 名</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 功能入口 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/gamefi/staking">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  质押大厅
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                质押 USDT 赚取积分和收益，A 类灵活质押，B 类锁仓高收益
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">A 类年化</p>
                  <p className="text-lg font-bold text-green-500">5-8%</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">B 类年化</p>
                  <p className="text-lg font-bold text-green-500">15-30%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/gamefi/exchange">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-yellow-500" />
                  积分兑换
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                使用积分兑换 USDT 或专属权益，标准模式 / 急速模式可选
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">可用积分</p>
                  <p className="text-lg font-bold">{data.totalPoints.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">待释放</p>
                  <p className="text-lg font-bold text-yellow-500">{data.pendingPoints.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/gamefi/vesting">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                  释放进度
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                查看积分线性释放进度，已释放积分可立即使用
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">释放进度</span>
                  <span className="font-medium">{vestingProgress.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${vestingProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  已释放 {data.vestingReleased.toLocaleString()} / {data.vestingTotal.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/gamefi/leaderboard">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  排行榜
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                查看积分排行榜，排名靠前可获得额外奖励
              </p>
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">您当前排名</p>
                <p className="text-3xl font-bold text-primary">#{data.leaderboardRank}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  再获得 5,000 积分可提升 10 名
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 签到日历 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            连续签到奖励
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <div
                key={day}
                className={`flex flex-col items-center p-3 rounded-lg ${
                  day <= data.dailyCheckIn ? 'bg-primary/20' : 'bg-muted/50'
                }`}
              >
                <span className="text-xs text-muted-foreground mb-1">Day {day}</span>
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    day <= data.dailyCheckIn
                      ? 'bg-primary text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {day <= data.dailyCheckIn ? '✓' : day * 100}
                </div>
                <span className="text-xs mt-1">{day * 100}分</span>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">
            已连续签到 {data.dailyCheckIn} 天，明天签到可获得 800 积分
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
