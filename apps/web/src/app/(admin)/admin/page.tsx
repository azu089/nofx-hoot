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
import type { LucideIcon } from 'lucide-react';
import {
  AdminPageHeader,
  AdminSkeleton,
  AdminErrorState,
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

/** 双行统计卡：上面"今日"，下面"累计" */
function DualStatCard({
  title,
  today,
  total,
  icon: Icon,
  color,
  todayLabel = '今日',
  totalLabel = '累计',
}: {
  title: string;
  today: string | number;
  total: string | number;
  icon: LucideIcon;
  color: string;
  todayLabel?: string;
  totalLabel?: string;
}) {
  return (
    <div className="rounded-xl p-4 border border-[#1E1E2E] bg-[#12121A] hover:border-[#2A2A3A] transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[#9090A0] font-medium">{title}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={16} />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] text-cyan-400/70 font-medium uppercase tracking-wider">{todayLabel}</span>
          <span className="text-lg font-bold text-white">{today}</span>
        </div>
        <div className="flex items-baseline justify-between border-t border-[#1E1E2E] pt-2">
          <span className="text-[10px] text-[#5E5E6E] font-medium uppercase tracking-wider">{totalLabel}</span>
          <span className="text-sm font-semibold text-[#9090A0]">{total}</span>
        </div>
      </div>
    </div>
  );
}

/** 单值统计卡 */
function SimpleStatCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  color: string;
}) {
  return (
    <div className="rounded-xl p-4 border border-[#1E1E2E] bg-[#12121A] hover:border-[#2A2A3A] transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[#9090A0] font-medium">{title}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-[#5E5E6E] mt-1">{sub}</p>}
    </div>
  );
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
          <DualStatCard
            title="注册用户"
            today={stats.todayNewUsers}
            total={stats.totalUsers}
            icon={UserPlus}
            color="bg-blue-500/20 text-blue-400"
          />
          <SimpleStatCard
            title="活跃用户"
            value={stats.activeUsers}
            sub={`活跃率 ${activeRate}`}
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
          <DualStatCard
            title="充值"
            today={fmt(stats.todayDeposit)}
            total={fmt(stats.totalDeposit)}
            icon={ArrowDownToLine}
            color="bg-green-500/20 text-green-400"
          />
          <DualStatCard
            title="提现"
            today={fmt(stats.todayWithdraw)}
            total={fmt(stats.totalWithdraw)}
            icon={ArrowUpFromLine}
            color="bg-orange-500/20 text-orange-400"
          />
          <DualStatCard
            title="收入"
            today={fmt(stats.todayRevenue)}
            total={fmt(stats.totalRevenue)}
            icon={DollarSign}
            color="bg-yellow-500/20 text-yellow-400"
          />
          <SimpleStatCard
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
          <DualStatCard
            title="Gas 兑换"
            today={fmt(stats.todayGasExchange)}
            total={fmt(stats.totalGasExchange)}
            icon={Fuel}
            color="bg-cyan-500/20 text-cyan-400"
          />
          <DualStatCard
            title="Gas 费"
            today={fmt(stats.todayGasFee)}
            total={fmt(stats.totalGasFee)}
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
          <SimpleStatCard
            title="策略数"
            value={stats.totalStrategies}
            sub={`运行中 ${stats.activeStrategies}`}
            icon={BarChart3}
            color="bg-green-500/20 text-green-400"
          />
          <SimpleStatCard
            title="持仓数"
            value={stats.totalPositions}
            sub={`未平仓 ${stats.openPositions}`}
            icon={TrendingUp}
            color="bg-cyan-500/20 text-cyan-400"
          />
          <SimpleStatCard
            title="AI 策略"
            value={stats.activeStrategies}
            sub="运行中"
            icon={Brain}
            color="bg-purple-500/20 text-purple-400"
          />
          <SimpleStatCard
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
