'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, TrendingUp, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { gamefiApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function VestingPage() {
  const router = useRouter();

  // 获取释放进度数据
  const { data: vestingData, isLoading } = useQuery({
    queryKey: ['vesting-progress'],
    queryFn: gamefiApi.getVestingProgress,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
        </div>
        <h1 className="text-2xl font-bold text-white">释放进度</h1>
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-bg-tertiary rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const totalVesting = vestingData?.data?.pending || '0';
  const totalReleased = vestingData?.data?.released || '0';
  // 转换释放订单格式
  const orders = (vestingData?.data?.vestingOrders || []).map(order => ({
    id: order.orderId,
    totalAmount: order.tokensTotal,
    releasedAmount: order.tokensReleased,
    remainingAmount: order.tokensPending,
    startDate: order.vestingStartAt,
    endDate: order.vestingEndAt,
    dailyRelease: (parseFloat(order.tokensTotal) / 90).toFixed(8), // 90天线性释放
    progress: order.progress,
  }));

  const calculateProgress = () => {
    const vesting = parseFloat(totalVesting);
    const released = parseFloat(totalReleased);
    if (vesting === 0) return 0;
    return Math.round((released / (vesting + released)) * 100);
  };

  return (
    <div className="space-y-6">
      {/* 返回按钮 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </Button>
      </div>

      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-white">释放进度</h1>
        <p className="text-text-secondary mt-2">查看代币释放状态</p>
      </div>

      {/* 总览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 待释放总额 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-5 h-5 text-warning" />
              待释放总额
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {parseFloat(totalVesting).toLocaleString()} $QFI
            </div>
          </CardContent>
        </Card>

        {/* 已释放总额 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="w-5 h-5 text-success" />
              已释放总额
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {parseFloat(totalReleased).toLocaleString()} $QFI
            </div>
          </CardContent>
        </Card>

        {/* 总进度 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-5 h-5 text-brand-primary" />
              总进度
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {calculateProgress()}%
            </div>
            <div className="w-full bg-bg-tertiary rounded-full h-2 mt-4">
              <div
                className="bg-brand-primary h-2 rounded-full transition-all"
                style={{ width: `${calculateProgress()}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 每日释放预估 */}
      <Card className="border-brand-primary/30 bg-brand-primary/5">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">每日释放预估</p>
              <p className="text-2xl font-bold text-brand-primary mt-1">
                {orders.length > 0
                  ? orders
                      .reduce((sum, order) => sum + parseFloat(order.dailyRelease), 0)
                      .toFixed(4)
                  : '0.0000'}{' '}
                $QFI
              </p>
            </div>
            <div className="w-12 h-12 bg-brand-primary/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-brand-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 释放订单列表 */}
      <Card>
        <CardHeader>
          <CardTitle>释放订单列表</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-12 text-text-secondary">
              <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>暂无释放订单</p>
              <p className="text-sm mt-2">完成积分兑换后会出现在这里</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const daysRemaining = Math.ceil(
                  (new Date(order.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );
                const isCompleted = order.progress >= 100;

                return (
                  <div
                    key={order.id}
                    className="border border-border-primary rounded-lg p-6 space-y-4 bg-bg-tertiary/30"
                  >
                    {/* 订单标题 */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-white font-semibold">
                          订单 #{order.id.slice(0, 8)}
                        </h3>
                        <p className="text-sm text-text-tertiary mt-1">
                          {new Date(order.startDate).toLocaleDateString('zh-CN')} -{' '}
                          {new Date(order.endDate).toLocaleDateString('zh-CN')}
                        </p>
                      </div>
                      <div
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          isCompleted
                            ? 'bg-success/20 text-success'
                            : 'bg-brand-primary/20 text-brand-primary'
                        }`}
                      >
                        {isCompleted ? '已完成' : '释放中'}
                      </div>
                    </div>

                    {/* 数量信息 */}
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-text-tertiary">总数量</p>
                        <p className="text-white font-semibold mt-1">
                          {parseFloat(order.totalAmount).toFixed(4)} $QFI
                        </p>
                      </div>
                      <div>
                        <p className="text-text-tertiary">已释放</p>
                        <p className="text-success font-semibold mt-1">
                          {parseFloat(order.releasedAmount).toFixed(4)} $QFI
                        </p>
                      </div>
                      <div>
                        <p className="text-text-tertiary">待释放</p>
                        <p className="text-warning font-semibold mt-1">
                          {parseFloat(order.remainingAmount).toFixed(4)} $QFI
                        </p>
                      </div>
                    </div>

                    {/* 进度条 */}
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-text-secondary">释放进度</span>
                        <span className="text-white font-semibold">{order.progress}%</span>
                      </div>
                      <div className="w-full bg-bg-tertiary rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all ${
                            isCompleted ? 'bg-success' : 'bg-brand-primary'
                          }`}
                          style={{ width: `${order.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* 每日释放 */}
                    <div className="flex justify-between items-center pt-2 border-t border-border-primary">
                      <div>
                        <p className="text-text-tertiary text-sm">每日释放</p>
                        <p className="text-white font-semibold">
                          {parseFloat(order.dailyRelease).toFixed(4)} $QFI/天
                        </p>
                      </div>
                      {!isCompleted && (
                        <div className="text-right">
                          <p className="text-text-tertiary text-sm">剩余时间</p>
                          <p className="text-white font-semibold">
                            {daysRemaining > 0 ? `${daysRemaining} 天` : '即将完成'}
                          </p>
                        </div>
                      )}
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
