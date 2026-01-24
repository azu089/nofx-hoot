'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Weight, TrendingUp, Users, Coins, PieChart } from 'lucide-react';

interface WeightDistribution {
  userId: string;
  email: string;
  stakeType: 'A' | 'B';
  totalAmount: string;
  totalWeight: string;
  weightPercentage: string;
  stakesCount: number;
}

interface WeightStats {
  totalWeight: string;
  totalStaked: string;
  typeAWeight: string;
  typeBWeight: string;
  typeAStaked: string;
  typeBStaked: string;
  totalStakers: number;
  distribution: WeightDistribution[];
}

export default function WeightsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['staking-weights'],
    queryFn: async () => {
      const res = await api.get('/admin/staking/weights');
      return res.data as WeightStats;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-danger">加载失败，请刷新重试</p>
      </div>
    );
  }

  const stats = data;

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center">
          <Weight className="w-5 h-5 text-brand-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">全网权重分布</h1>
          <p className="text-sm text-text-secondary">查看所有用户的质押权重占比</p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-bg-secondary rounded-xl p-5 border border-border-primary">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-brand-primary/10 rounded-lg flex items-center justify-center">
              <Weight className="w-4 h-4 text-brand-primary" />
            </div>
            <span className="text-text-secondary text-sm">总权重</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {Number(stats?.totalWeight || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-bg-secondary rounded-xl p-5 border border-border-primary">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center">
              <Coins className="w-4 h-4 text-success" />
            </div>
            <span className="text-text-secondary text-sm">总质押金额</span>
          </div>
          <p className="text-2xl font-bold text-white">
            ${Number(stats?.totalStaked || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-bg-secondary rounded-xl p-5 border border-border-primary">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-warning/10 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-warning" />
            </div>
            <span className="text-text-secondary text-sm">质押人数</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats?.totalStakers || 0}</p>
        </div>

        <div className="bg-bg-secondary rounded-xl p-5 border border-border-primary">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-info/10 rounded-lg flex items-center justify-center">
              <PieChart className="w-4 h-4 text-info" />
            </div>
            <span className="text-text-secondary text-sm">平均权重</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {stats?.totalStakers && Number(stats.totalStakers) > 0
              ? (Number(stats.totalWeight) / Number(stats.totalStakers)).toFixed(2)
              : '0'}
            x
          </p>
        </div>
      </div>

      {/* A/B 类型分布 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-bg-secondary rounded-xl p-5 border border-border-primary">
          <h3 className="text-white font-medium mb-4">A 类质押（空投/积分）</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-text-secondary text-sm mb-1">质押金额</p>
              <p className="text-xl font-bold text-white">
                ${Number(stats?.typeAStaked || 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-text-secondary text-sm mb-1">总权重</p>
              <p className="text-xl font-bold text-white">
                {Number(stats?.typeAWeight || 0).toLocaleString()} <span className="text-sm text-text-secondary">(1.0x)</span>
              </p>
            </div>
          </div>
          <div className="mt-4 h-2 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-primary rounded-full"
              style={{
                width: `${
                  stats?.totalWeight && Number(stats.totalWeight) > 0
                    ? (Number(stats.typeAWeight) / Number(stats.totalWeight)) * 100
                    : 0
                }%`,
              }}
            />
          </div>
          <p className="text-xs text-text-tertiary mt-2">
            占总权重{' '}
            {stats?.totalWeight && Number(stats.totalWeight) > 0
              ? ((Number(stats.typeAWeight) / Number(stats.totalWeight)) * 100).toFixed(1)
              : 0}
            %
          </p>
        </div>

        <div className="bg-bg-secondary rounded-xl p-5 border border-border-primary">
          <h3 className="text-white font-medium mb-4">B 类质押（本金购买）</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-text-secondary text-sm mb-1">质押金额</p>
              <p className="text-xl font-bold text-white">
                ${Number(stats?.typeBStaked || 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-text-secondary text-sm mb-1">总权重</p>
              <p className="text-xl font-bold text-white">
                {Number(stats?.typeBWeight || 0).toLocaleString()} <span className="text-sm text-text-secondary">(1.0x-3.0x)</span>
              </p>
            </div>
          </div>
          <div className="mt-4 h-2 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full"
              style={{
                width: `${
                  stats?.totalWeight && Number(stats.totalWeight) > 0
                    ? (Number(stats.typeBWeight) / Number(stats.totalWeight)) * 100
                    : 0
                }%`,
              }}
            />
          </div>
          <p className="text-xs text-text-tertiary mt-2">
            占总权重{' '}
            {stats?.totalWeight && Number(stats.totalWeight) > 0
              ? ((Number(stats.typeBWeight) / Number(stats.totalWeight)) * 100).toFixed(1)
              : 0}
            %
          </p>
        </div>
      </div>

      {/* 用户权重排行 */}
      <div className="bg-bg-secondary rounded-xl border border-border-primary">
        <div className="p-4 border-b border-border-primary">
          <h3 className="text-white font-medium">用户权重排行</h3>
          <p className="text-sm text-text-secondary">按权重占比从高到低排序</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-text-secondary text-sm border-b border-border-primary">
                <th className="text-left p-4">排名</th>
                <th className="text-left p-4">用户</th>
                <th className="text-left p-4">质押类型</th>
                <th className="text-right p-4">质押金额</th>
                <th className="text-right p-4">总权重</th>
                <th className="text-right p-4">占比</th>
                <th className="text-right p-4">质押数</th>
              </tr>
            </thead>
            <tbody>
              {stats?.distribution?.map((item, index) => (
                <tr key={item.userId} className="border-b border-border-primary hover:bg-bg-tertiary">
                  <td className="p-4">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0
                          ? 'bg-yellow-500/20 text-yellow-500'
                          : index === 1
                          ? 'bg-gray-400/20 text-gray-400'
                          : index === 2
                          ? 'bg-orange-500/20 text-orange-500'
                          : 'bg-bg-tertiary text-text-secondary'
                      }`}
                    >
                      {index + 1}
                    </span>
                  </td>
                  <td className="p-4">
                    <div>
                      <p className="text-white text-sm">{item.email}</p>
                      <p className="text-text-tertiary text-xs">{item.userId.slice(0, 8)}...</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        item.stakeType === 'A'
                          ? 'bg-brand-primary/10 text-brand-primary'
                          : 'bg-success/10 text-success'
                      }`}
                    >
                      {item.stakeType} 类
                    </span>
                  </td>
                  <td className="p-4 text-right text-white">
                    ${Number(item.totalAmount).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-4 text-right text-white font-medium">
                    {Number(item.totalWeight).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-primary rounded-full"
                          style={{ width: `${Math.min(Number(item.weightPercentage), 100)}%` }}
                        />
                      </div>
                      <span className="text-white text-sm w-12 text-right">
                        {Number(item.weightPercentage).toFixed(2)}%
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-right text-text-secondary">{item.stakesCount}</td>
                </tr>
              ))}
              {(!stats?.distribution || stats.distribution.length === 0) && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-text-secondary">
                    暂无质押数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
