'use client';

import {
  Users,
  UserPlus,
  DollarSign,
  BarChart3,
  Brain,
  TrendingUp,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Fuel,
  Flame,
  Wallet,
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
  todayNewUsers: number;
  activeUsers: number;
  totalStrategies: number;
  activeStrategies: number;
  totalRevenue: string;
  todayRevenue: string;
  totalDeposit: string;
  todayDeposit: string;
  totalWithdraw: string;
  todayWithdraw: string;
  totalGasExchange: string;
  todayGasExchange: string;
  totalGasFee: string;
  todayGasFee: string;
  totalPositions: number;
  openPositions: number;
  pendingWithdraws: number;
  riskEvents: number;
}

export default function AdminDashboardPage() {
  const { data: stats, loading, error, refetch } = useAdminApi<DashboardStats>('/admin/dashboard');

  if (loading) return <AdminSkeleton mode="grid" count={16} cols={4} />;
  if (error) return <AdminErrorState message={error} onRetry={refetch} />;
  if (!stats) return <AdminErrorState message="数据为空" onRetry={refetch} />;

  const activeRate =
    stats.totalUsers > 0
      ? `${((stats.activeUsers / stats.totalUsers) * 100).toFixed(1)}%`
      : '0%';

  const fmt = (v: string) =>
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

      {/* 用户 */}
      <div>
        <h3 className="text-xs font-semibold text-[#9090A0] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Users size={12} />用户
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <AdminStatCard
            title="总用户"
            value={stats.totalUsers}
            sub={`活跃 ${stats.activeUsers}`}
            icon={Users}
            color="bg-blue-500/20 text-blue-400"
          />
          <AdminStatCard
            title="今日注册"
            value={stats.todayNewUsers}
            icon={UserPlus}
            color="bg-indigo-500/20 text-indigo-400"
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

      {/* 资金 */}
      <div>
        <h3 className="text-xs font-semibold text-[#9090A0] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Wallet size={12} />资金
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <AdminStatCard
            title="总充值"
            value={fmt(stats.totalDeposit)}
            sub={`今日 ${fmt(stats.todayDeposit)}`}
            icon={ArrowDownToLine}
            color="bg-green-500/20 text-green-400"
          />
          <AdminStatCard
            title="总提现"
            value={fmt(stats.totalWithdraw)}
            sub={`今日 ${fmt(stats.todayWithdraw)}`}
            icon={ArrowUpFromLine}
            color="bg-orange-500/20 text-orange-400"
          />
          <AdminStatCard
            title="总收入"
            value={fmt(stats.totalRevenue)}
            sub={`今日 ${fmt(stats.todayRevenue)}`}
            icon={DollarSign}
            color="bg-yellow-500/20 text-yellow-400"
          />
          <AdminStatCard
            title="待审核提现"
            value={stats.pendingWithdraws}
            icon={DollarSign}
            color="bg-amber-500/20 text-amber-400"
          />
        </div>
      </div>

      {/* Gas */}
      <div>
        <h3 className="text-xs font-semibold text-[#9090A0] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Fuel size={12} />Gas
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <AdminStatCard
            title="总 Gas 兑换"
            value={fmt(stats.totalGasExchange)}
            sub={`今日 ${fmt(stats.todayGasExchange)}`}
            icon={Fuel}
            color="bg-cyan-500/20 text-cyan-400"
          />
          <AdminStatCard
            title="总 Gas 费"
            value={fmt(stats.totalGasFee)}
            sub={`今日 ${fmt(stats.todayGasFee)}`}
            icon={Flame}
            color="bg-rose-500/20 text-rose-400"
          />
        </div>
      </div>

      {/* 交易 & 策略 */}
      <div>
        <h3 className="text-xs font-semibold text-[#9090A0] uppercase tracking-wider mb-3 flex items-center gap-2">
          <TrendingUp size={12} />交易 & 策略
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <AdminStatCard
            title="策略数"
            value={stats.totalStrategies}
            sub={`运行中 ${stats.activeStrategies}`}
            icon={BarChart3}
            color="bg-green-500/20 text-green-400"
          />
          <AdminStatCard
            title="持仓数"
            value={stats.totalPositions}
            sub={`未平仓 ${stats.openPositions}`}
            icon={TrendingUp}
            color="bg-cyan-500/20 text-cyan-400"
          />
          <AdminStatCard
            title="AI 策略"
            value={stats.activeStrategies}
            sub="运行中"
            icon={Brain}
            color="bg-purple-500/20 text-purple-400"
          />
          <AdminStatCard
            title="风控事件"
            value={stats.riskEvents}
            icon={AlertTriangle}
            color="bg-red-500/20 text-red-400"
          />
        </div>
      </div>
    </div>
  );
}
