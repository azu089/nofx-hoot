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
  Activity,
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

/** 双行统计卡：今日 + 累计 */
function DualCard({
  title, today, total, icon: Icon, color,
}: {
  title: string; today: string | number; total: string | number;
  icon: LucideIcon; color: string;
}) {
  return (
    <div className="rounded-xl p-4 border border-[#1E1E2E] bg-[#12121A] hover:border-[#2A2A3A] transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[#9090A0] font-medium">{title}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={15} />
        </div>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] text-cyan-400/70 font-medium">今日</span>
        <span className="text-lg font-bold text-white">{today}</span>
      </div>
      <div className="flex items-baseline justify-between border-t border-[#1E1E2E] mt-1.5 pt-1.5">
        <span className="text-[10px] text-[#5E5E6E] font-medium">累计</span>
        <span className="text-sm font-semibold text-[#9090A0]">{total}</span>
      </div>
    </div>
  );
}

/** 单值卡 */
function SimpleCard({
  title, value, sub, icon: Icon, color,
}: {
  title: string; value: string | number; sub?: string;
  icon: LucideIcon; color: string;
}) {
  return (
    <div className="rounded-xl p-4 border border-[#1E1E2E] bg-[#12121A] hover:border-[#2A2A3A] transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[#9090A0] font-medium">{title}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={15} />
        </div>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-[#5E5E6E] mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminDashboardPage() {
  const { data: stats, loading, error, refetch } = useAdminApi<DashboardStats>('/admin/dashboard');

  if (loading) return <AdminSkeleton mode="grid" count={16} cols={4} />;
  if (error) return <AdminErrorState message={error} onRetry={refetch} />;
  if (!stats) return <AdminErrorState message="数据为空" onRetry={refetch} />;

  const activeRate = stats.totalUsers > 0
    ? `${((stats.activeUsers / stats.totalUsers) * 100).toFixed(1)}%`
    : '0%';

  const fmt = (v: string) =>
    `$${parseFloat(v || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="p-6 space-y-5">
      <AdminPageHeader
        title="管理仪表盘"
        icon={BarChart3}
        subtitle="平台整体运营数据概览"
        onRefresh={refetch}
      />

      {/* 第一行：用户 + 资金核心（4列铺满） */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DualCard title="注册用户" today={stats.todayNewUsers} total={stats.totalUsers}
          icon={UserPlus} color="bg-blue-500/20 text-blue-400" />
        <DualCard title="充值" today={fmt(stats.todayDeposit)} total={fmt(stats.totalDeposit)}
          icon={ArrowDownToLine} color="bg-green-500/20 text-green-400" />
        <DualCard title="提现" today={fmt(stats.todayWithdraw)} total={fmt(stats.totalWithdraw)}
          icon={ArrowUpFromLine} color="bg-orange-500/20 text-orange-400" />
        <DualCard title="收入" today={fmt(stats.todayRevenue)} total={fmt(stats.totalRevenue)}
          icon={DollarSign} color="bg-yellow-500/20 text-yellow-400" />
      </div>

      {/* 第二行：Gas + 活跃 + 待审核（4列铺满） */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DualCard title="Gas 兑换" today={fmt(stats.todayGasExchange)} total={fmt(stats.totalGasExchange)}
          icon={Fuel} color="bg-cyan-500/20 text-cyan-400" />
        <DualCard title="Gas 费" today={fmt(stats.todayGasFee)} total={fmt(stats.totalGasFee)}
          icon={Flame} color="bg-rose-500/20 text-rose-400" />
        <SimpleCard title="活跃用户" value={stats.activeUsers} sub={`活跃率 ${activeRate} · 总用户 ${stats.totalUsers}`}
          icon={Activity} color="bg-teal-500/20 text-teal-400" />
        <SimpleCard title="待审核提现" value={stats.pendingWithdraws}
          icon={Wallet} color="bg-amber-500/20 text-amber-400" />
      </div>

      {/* 第三行：交易 & 策略（4列铺满） */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SimpleCard title="策略数" value={stats.totalStrategies} sub={`运行中 ${stats.activeStrategies}`}
          icon={BarChart3} color="bg-green-500/20 text-green-400" />
        <SimpleCard title="持仓数" value={stats.totalPositions} sub={`未平仓 ${stats.openPositions}`}
          icon={TrendingUp} color="bg-cyan-500/20 text-cyan-400" />
        <SimpleCard title="AI 策略" value={stats.activeStrategies} sub="运行中"
          icon={Brain} color="bg-purple-500/20 text-purple-400" />
        <SimpleCard title="风控事件" value={stats.riskEvents}
          icon={AlertTriangle} color="bg-red-500/20 text-red-400" />
      </div>
    </div>
  );
}
