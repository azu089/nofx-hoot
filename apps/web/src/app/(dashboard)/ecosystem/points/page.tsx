'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, Button } from '@/components/ui';
import { MobileHeader } from '@/components/ui';
import { gamefiApi } from '@/lib/api';
import {
  Coins,
  TrendingUp,
  Gift,
  ArrowRight,
  Sparkles,
  Zap,
  Users,
  Target,
  ChevronRight,
  Calendar,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 积分中心页面
 *
 * 功能：
 * - 积分余额展示
 * - 积分获取渠道
 * - 积分使用（兑换入口）
 * - 积分记录
 */

interface PointRecord {
  id: string;
  userId: string;
  uniqueOrderId: string;
  billingType: string;
  amount: string;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  status: string;
  createdAt: string;
}

const earnMethods = [
  {
    icon: Zap,
    title: '交易挖矿',
    description: '每笔交易可获得积分奖励',
    reward: '最高 500 积分/笔',
    color: 'text-brand-primary',
    bg: 'bg-brand-primary/10',
  },
  {
    icon: Calendar,
    title: '每日签到',
    description: '连续签到获得额外奖励',
    reward: '最高 100 积分/天',
    color: 'text-success',
    bg: 'bg-success/10',
  },
  {
    icon: Users,
    title: '邀请好友',
    description: '邀请好友注册获得积分',
    reward: '1000 积分/人',
    color: 'text-warning',
    bg: 'bg-warning/10',
  },
  {
    icon: Target,
    title: '完成任务',
    description: '完成平台任务获得奖励',
    reward: '不等额积分',
    color: 'text-brand-secondary',
    bg: 'bg-brand-secondary/10',
  },
];

export default function PointsPage() {
  const [activeTab, setActiveTab] = useState<'earn' | 'records'>('earn');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pointsBalance, setPointsBalance] = useState<{
    available: string;
    frozen: string;
    total: string;
  } | null>(null);
  const [records, setRecords] = useState<PointRecord[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [balanceRes, historyRes] = await Promise.all([
          gamefiApi.getPointsBalance(),
          gamefiApi.getPointsHistory(20),
        ]);

        if (balanceRes.code === 0 && balanceRes.data) {
          setPointsBalance(balanceRes.data);
        }

        if (historyRes.code === 0 && historyRes.data) {
          setRecords(historyRes.data.history || []);
        }
      } catch (err) {
        console.error('获取积分数据失败:', err);
        setError('获取数据失败，请稍后重试');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // 计算今日和本月获得的积分
  const calculateEarnings = () => {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    let todayEarned = 0;
    let monthEarned = 0;

    records.forEach((r) => {
      const amount = parseFloat(r.amount);
      if (amount > 0) {
        const recordDate = r.createdAt.split('T')[0];
        const recordMonth = r.createdAt.slice(0, 7);

        if (recordDate === today) {
          todayEarned += amount;
        }
        if (recordMonth === currentMonth) {
          monthEarned += amount;
        }
      }
    });

    return { todayEarned, monthEarned };
  };

  const { todayEarned, monthEarned } = calculateEarnings();
  const totalPoints = parseFloat(pointsBalance?.total || '0');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-danger">{error}</p>
        <Button onClick={() => window.location.reload()}>重试</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <MobileHeader title="积分中心" subtitle="获取积分，兑换代币" />

      {/* 积分概览卡片 */}
      <Card variant="glass" className="overflow-hidden">
        <div className="p-6 bg-gradient-to-br from-warning/20 via-warning/10 to-transparent">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">我的积分</p>
              <p className="text-4xl font-bold text-warning mt-1">
                {totalPoints.toLocaleString()}
              </p>
              <p className="text-xs text-text-tertiary mt-2">
                ≈ {(totalPoints / 100).toFixed(2)} $QFI
              </p>
            </div>
            <div className="w-20 h-20 rounded-full bg-warning/20 flex items-center justify-center">
              <Coins className="w-10 h-10 text-warning" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="p-3 rounded-xl bg-bg-secondary/50">
              <p className="text-xs text-text-tertiary">今日获得</p>
              <p className="text-lg font-bold text-success">+{todayEarned.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-xl bg-bg-secondary/50">
              <p className="text-xs text-text-tertiary">本月获得</p>
              <p className="text-lg font-bold text-brand-primary">+{monthEarned.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <CardContent className="p-4 border-t border-border-primary/30">
          <div className="flex gap-3">
            <Link href="/ecosystem/exchange" className="flex-1">
              <Button variant="gradient" className="w-full">
                <ArrowRight className="w-4 h-4 mr-2" />
                兑换代币
              </Button>
            </Link>
            <Link href="/ecosystem/staking" className="flex-1">
              <Button variant="outline" className="w-full">
                <Sparkles className="w-4 h-4 mr-2" />
                去质押
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Tab 切换 */}
      <div className="flex items-center gap-2 border-b border-border-primary/30">
        <button
          onClick={() => setActiveTab('earn')}
          className={cn(
            'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'earn'
              ? 'text-brand-primary border-brand-primary'
              : 'text-text-secondary border-transparent hover:text-text-primary'
          )}
        >
          获取积分
        </button>
        <button
          onClick={() => setActiveTab('records')}
          className={cn(
            'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'records'
              ? 'text-brand-primary border-brand-primary'
              : 'text-text-secondary border-transparent hover:text-text-primary'
          )}
        >
          积分记录
        </button>
      </div>

      {/* 获取积分 */}
      {activeTab === 'earn' && (
        <div className="space-y-3">
          {earnMethods.map((method) => {
            const Icon = method.icon;
            return (
              <Card key={method.title} variant="glass" className="hover:border-brand-primary/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', method.bg)}>
                      <Icon className={cn('w-6 h-6', method.color)} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-text-primary">{method.title}</h3>
                      <p className="text-xs text-text-tertiary mt-0.5">{method.description}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-sm font-medium', method.color)}>{method.reward}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 积分记录 */}
      {activeTab === 'records' && (
        <div className="space-y-3">
          {records.length > 0 ? (
            records.map((record) => {
              const amount = parseFloat(record.amount);
              const isEarn = amount > 0;
              const displaySource = record.description || record.billingType || '积分变动';
              const displayTime = new Date(record.createdAt).toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <Card key={record.id} variant="glass">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center',
                          isEarn ? 'bg-success/10' : 'bg-danger/10'
                        )}>
                          {isEarn ? (
                            <TrendingUp className="w-5 h-5 text-success" />
                          ) : (
                            <Gift className="w-5 h-5 text-danger" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary">{displaySource}</p>
                          <p className="text-xs text-text-tertiary">{displayTime}</p>
                        </div>
                      </div>
                      <p className={cn(
                        'text-lg font-bold',
                        isEarn ? 'text-success' : 'text-danger'
                      )}>
                        {isEarn ? '+' : ''}{amount.toLocaleString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="text-center py-12 text-text-secondary">
              暂无积分记录
            </div>
          )}

          {records.length > 0 && (
            <div className="text-center py-4">
              <Button variant="ghost" className="text-text-tertiary">
                查看更多
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
