'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Lock, Unlock, Gift, TrendingUp } from 'lucide-react';

export default function StakingManagementPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // 获取质押统计
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-staking-stats'],
    queryFn: async () => {
      const res = await adminApi.getStakingStats();
      return res.data;
    },
  });

  // 获取质押列表
  const { data: stakes, isLoading, refetch } = useQuery({
    queryKey: ['admin-stakes', page, statusFilter, typeFilter],
    queryFn: async () => {
      const res = await adminApi.getStakes({
        page,
        limit: 20,
        status: statusFilter || undefined,
        stakeType: typeFilter || undefined,
      });
      return res.data;
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success" outline><Lock className="w-3 h-3 mr-1" />进行中</Badge>;
      case 'completed':
        return <Badge variant="secondary" outline><Unlock className="w-3 h-3 mr-1" />已完成</Badge>;
      case 'cancelled':
        return <Badge variant="danger" outline>已取消</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    return type === 'A' ? (
      <Badge variant="primary" outline>A 类</Badge>
    ) : (
      <Badge variant="warning" outline>B 类</Badge>
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">质押管理</h1>
          <p className="text-text-secondary">查看和管理用户质押记录</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      {statsLoading ? (
        <div className="flex items-center justify-center h-24">
          <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
        </div>
      ) : stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-primary/10">
                <Lock className="w-5 h-5 text-brand-primary" />
              </div>
              <div>
                <div className="text-sm text-text-secondary">活跃质押</div>
                <div className="text-xl font-bold text-text-primary">{stats.activeStakes}</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
              <div>
                <div className="text-sm text-text-secondary">总质押金额</div>
                <div className="text-xl font-bold text-success">
                  {parseFloat(stats.totalStaked).toFixed(2)} USDT
                </div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Gift className="w-5 h-5 text-warning" />
              </div>
              <div>
                <div className="text-sm text-text-secondary">总发放奖励</div>
                <div className="text-xl font-bold text-warning">
                  {parseFloat(stats.totalRewards).toFixed(2)} QFT
                </div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="space-y-2">
              <div className="text-sm text-text-secondary">按类型分布</div>
              {stats.byType.map((t) => (
                <div key={t.type} className="flex items-center justify-between text-sm">
                  <span className="text-text-tertiary">{t.type} 类</span>
                  <span className="text-text-primary font-medium">
                    {t.count} 笔 / {parseFloat(t.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* 筛选器 */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex gap-2">
            <span className="text-sm text-text-secondary self-center">状态:</span>
            <Button
              variant={statusFilter === '' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => { setStatusFilter(''); setPage(1); }}
            >
              全部
            </Button>
            <Button
              variant={statusFilter === 'active' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => { setStatusFilter('active'); setPage(1); }}
            >
              进行中
            </Button>
            <Button
              variant={statusFilter === 'completed' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => { setStatusFilter('completed'); setPage(1); }}
            >
              已完成
            </Button>
            <Button
              variant={statusFilter === 'cancelled' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => { setStatusFilter('cancelled'); setPage(1); }}
            >
              已取消
            </Button>
          </div>
          <div className="flex gap-2">
            <span className="text-sm text-text-secondary self-center">类型:</span>
            <Button
              variant={typeFilter === '' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => { setTypeFilter(''); setPage(1); }}
            >
              全部
            </Button>
            <Button
              variant={typeFilter === 'A' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => { setTypeFilter('A'); setPage(1); }}
            >
              A 类
            </Button>
            <Button
              variant={typeFilter === 'B' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => { setTypeFilter('B'); setPage(1); }}
            >
              B 类
            </Button>
          </div>
        </div>
      </Card>

      {/* 质押列表 */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-border-primary">
          <h2 className="text-lg font-semibold text-text-primary">质押记录</h2>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-bg-tertiary">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">用户</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">类型</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">金额</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">锁定期</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">权重</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">累计奖励</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">状态</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">到期日</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary">
                  {stakes?.data.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-text-secondary">
                        暂无质押记录
                      </td>
                    </tr>
                  ) : (
                    stakes?.data.map((stake) => (
                      <tr key={stake.id} className="hover:bg-bg-tertiary/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-text-primary">{stake.userEmail}</div>
                          <div className="text-xs text-text-tertiary">{stake.userId.slice(0, 8)}...</div>
                        </td>
                        <td className="px-6 py-4">
                          {getTypeBadge(stake.stakeType)}
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-brand-primary">
                          {parseFloat(stake.amount).toFixed(2)} USDT
                        </td>
                        <td className="px-6 py-4 text-text-primary">
                          {stake.lockPeriodDays} 天
                        </td>
                        <td className="px-6 py-4 text-text-secondary">
                          {stake.weightMultiplier}x
                        </td>
                        <td className="px-6 py-4 font-mono text-success">
                          {parseFloat(stake.accumulatedReward).toFixed(4)} QFT
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(stake.status)}
                        </td>
                        <td className="px-6 py-4 text-sm text-text-secondary">
                          {formatDate(stake.endTime)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {stakes && stakes.totalPages > 1 && (
              <div className="flex justify-center gap-2 px-6 py-4 border-t border-border-primary">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  上一页
                </Button>
                <span className="flex items-center px-4 text-sm text-text-secondary">
                  {page} / {stakes.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === stakes.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  下一页
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
