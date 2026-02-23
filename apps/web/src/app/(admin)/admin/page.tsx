'use client';

import {
  Users,
  DollarSign,
  BarChart3,
  Brain,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import {
  AdminPageHeader,
  AdminSkeleton,
  AdminErrorState,
  AdminStatCard,
} from '@/components/admin/shared';
import { useAdminApi } from '@/hooks/useAdminApi';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalStrategies: number;
  activeStrategies: number;
  totalRevenue: string;
  todayRevenue: string;
  totalPositions: number;
  openPositions: number;
  pendingWithdraws: number;
  riskEvents: number;
}

export default function AdminDashboardPage() {
  const { data: stats, loading, error, refetch } = useAdminApi<DashboardStats>('/admin/dashboard');

  if (loading) return <AdminSkeleton mode="grid" count={8} cols={4} />;
  if (error) return <AdminErrorState message={error} onRetry={refetch} />;
  if (!stats) return <AdminErrorState message="数据为空" onRetry={refetch} />;

  const activeRate =
    stats.totalUsers > 0
      ? `${((stats.activeUsers / stats.totalUsers) * 100).toFixed(1)}%`
      : '0%';

  const fmtRevenue = (v: string) =>
    `$${parseFloat(v || '0').toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader
        title="管理仪表盘"
        icon={BarChart3}
        subtitle="平台整体运营数据概览"
        onRefresh={refetch}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title="总用户"
          value={stats.totalUsers}
          sub={`活跃 ${stats.activeUsers}`}
          icon={Users}
          color="bg-blue-500/20 text-blue-400"
        />
        <AdminStatCard
          title="策略数"
          value={stats.totalStrategies}
          sub={`运行中 ${stats.activeStrategies}`}
          icon={BarChart3}
          color="bg-green-500/20 text-green-400"
        />
        <AdminStatCard
          title="总收入"
          value={fmtRevenue(stats.totalRevenue)}
          sub={`今日 ${fmtRevenue(stats.todayRevenue)}`}
          icon={DollarSign}
          color="bg-yellow-500/20 text-yellow-400"
        />
        <AdminStatCard
          title="持仓数"
          value={stats.totalPositions}
          sub={`未平仓 ${stats.openPositions}`}
          icon={TrendingUp}
          color="bg-cyan-500/20 text-cyan-400"
        />
        <AdminStatCard
          title="待审核提现"
          value={stats.pendingWithdraws}
          icon={DollarSign}
          color="bg-orange-500/20 text-orange-400"
        />
        <AdminStatCard
          title="风控事件"
          value={stats.riskEvents}
          icon={AlertTriangle}
          color="bg-red-500/20 text-red-400"
        />
        <AdminStatCard
          title="AI 策略"
          value={stats.activeStrategies}
          sub="运行中"
          icon={Brain}
          color="bg-purple-500/20 text-purple-400"
        />
        <AdminStatCard
          title="活跃率"
          value={activeRate}
          sub={`${stats.activeUsers} / ${stats.totalUsers}`}
          icon={Users}
          color="bg-teal-500/20 text-teal-400"
        />
      </div>
    </div>
  );
}
