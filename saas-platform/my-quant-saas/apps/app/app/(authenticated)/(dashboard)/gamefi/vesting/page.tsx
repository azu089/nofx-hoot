'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@repo/design-system/components/ui/card';
import { Button } from '@repo/design-system/components/ui/button';
import {
  Clock,
  Coins,
  TrendingUp,
  Calendar,
  ChevronRight,
  Info,
} from 'lucide-react';

// 模拟释放数据
const mockVestingData = {
  totalVesting: 150000,
  released: 62500,
  pending: 87500,
  nextRelease: 2500,
  nextReleaseDate: '2024-01-20',
  dailyRate: 2500,
  vestingSchedule: [
    { id: '1', source: 'B类质押奖励', total: 50000, released: 25000, startDate: '2024-01-01', duration: 30 },
    { id: '2', source: '推广返佣', total: 30000, released: 15000, startDate: '2024-01-05', duration: 30 },
    { id: '3', source: '活动奖励', total: 20000, released: 10000, startDate: '2024-01-10', duration: 20 },
    { id: '4', source: 'B类质押奖励', total: 50000, released: 12500, startDate: '2024-01-15', duration: 60 },
  ],
  releaseHistory: [
    { date: '2024-01-19', amount: 2500 },
    { date: '2024-01-18', amount: 2500 },
    { date: '2024-01-17', amount: 2500 },
    { date: '2024-01-16', amount: 2500 },
    { date: '2024-01-15', amount: 2500 },
  ],
};

export default function VestingPage() {
  const data = mockVestingData;
  const overallProgress = (data.released / data.totalVesting) * 100;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">释放进度</h1>
        <p className="text-muted-foreground">查看积分线性释放进度</p>
      </div>

      {/* 总览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                <Coins className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">总锁仓积分</p>
                <p className="text-xl font-bold">{data.totalVesting.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">已释放</p>
                <p className="text-xl font-bold text-green-500">{data.released.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">待释放</p>
                <p className="text-xl font-bold text-yellow-500">{data.pending.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">明日释放</p>
                <p className="text-xl font-bold">{data.nextRelease.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 总进度 */}
      <Card>
        <CardHeader>
          <CardTitle>总体释放进度</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                已释放 {data.released.toLocaleString()} / {data.totalVesting.toLocaleString()}
              </span>
              <span className="font-medium">{overallProgress.toFixed(1)}%</span>
            </div>
            <div className="h-4 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-green-500 rounded-full transition-all"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              每日释放约 {data.dailyRate.toLocaleString()} 积分
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 各项释放计划 */}
        <Card>
          <CardHeader>
            <CardTitle>释放计划明细</CardTitle>
            <CardDescription>各项积分来源的释放进度</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.vestingSchedule.map((item) => {
                const progress = (item.released / item.total) * 100;
                const endDate = new Date(item.startDate);
                endDate.setDate(endDate.getDate() + item.duration);
                const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

                return (
                  <div key={item.id} className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">{item.source}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.duration} 天线性释放
                        </p>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {daysLeft > 0 ? `剩余 ${daysLeft} 天` : '已完成'}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {item.released.toLocaleString()} / {item.total.toLocaleString()}
                        </span>
                        <span className="font-medium">{progress.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 释放历史 */}
        <Card>
          <CardHeader>
            <CardTitle>最近释放记录</CardTitle>
            <CardDescription>过去 7 天的积分释放</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.releaseHistory.map((record, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    </div>
                    <div>
                      <p className="font-medium text-green-500">
                        +{record.amount.toLocaleString()} 积分
                      </p>
                      <p className="text-sm text-muted-foreground">{record.date}</p>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">每日释放</span>
                </div>
              ))}
            </div>

            <Button variant="ghost" className="w-full mt-4">
              查看更多
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            释放规则说明
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• B 类质押奖励积分采用线性释放，根据锁仓时长分 30-60 天释放</li>
            <li>• 推广返佣积分采用 30 天线性释放</li>
            <li>• 活动奖励积分根据活动规则释放，通常为 7-30 天</li>
            <li>• 已释放积分可立即用于兑换或使用</li>
            <li>• 每日 UTC+8 00:00 结算释放积分</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
