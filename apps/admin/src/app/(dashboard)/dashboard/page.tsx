'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Server,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Shield,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

// 迷你趋势图组件
function MiniSparkline({
  data,
  color = '#00C087',
  height = 32
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      className="w-full"
      style={{ height }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <polygon
        fill={`url(#gradient-${color.replace('#', '')})`}
        points={`0,${height} ${points} 100,${height}`}
      />
    </svg>
  );
}

// 统计卡片组件
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  subtitleColor?: 'success' | 'danger' | 'warning' | 'muted';
  icon: React.ReactNode;
  iconBg: string;
  trend?: 'up' | 'down';
  trendValue?: string;
  sparklineData?: number[];
  sparklineColor?: string;
  loading?: boolean;
}

function StatCard({
  title,
  value,
  subtitle,
  subtitleColor = 'muted',
  icon,
  iconBg,
  trend,
  trendValue,
  sparklineData,
  sparklineColor,
  loading = false,
}: StatCardProps) {
  const subtitleColors = {
    success: 'text-[#00C087]',
    danger: 'text-[#F23645]',
    warning: 'text-[#F7931A]',
    muted: 'text-[#848E9C]',
  };

  return (
    <div className="group relative bg-[#131722] rounded-xl border border-[#2B3139] overflow-hidden transition-all duration-300 hover:border-[#3772FF]/50 hover:shadow-lg hover:shadow-[#3772FF]/5">
      {/* 顶部渐变装饰线 */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, transparent, ${iconBg}, transparent)` }}
      />

      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-[#848E9C] text-sm font-medium">{title}</p>

            {loading ? (
              <div className="h-8 w-24 bg-[#2B3139] rounded animate-pulse mt-2" />
            ) : (
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-2xl font-bold text-white tracking-tight">
                  {value}
                </p>
                {trend && trendValue && (
                  <span className={`flex items-center text-sm font-medium ${
                    trend === 'up' ? 'text-[#00C087]' : 'text-[#F23645]'
                  }`}>
                    {trend === 'up' ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    {trendValue}
                  </span>
                )}
              </div>
            )}

            {subtitle && (
              <p className={`text-sm mt-1.5 ${subtitleColors[subtitleColor]}`}>
                {subtitle}
              </p>
            )}
          </div>

          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
            style={{ backgroundColor: `${iconBg}15` }}
          >
            {icon}
          </div>
        </div>

        {/* 迷你趋势图 */}
        {sparklineData && sparklineData.length > 0 && (
          <div className="mt-4 -mx-1">
            <MiniSparkline
              data={sparklineData}
              color={sparklineColor || iconBg}
              height={40}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// 加载骨架屏
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-[#2B3139] rounded" />
      <div className="h-4 w-32 bg-[#2B3139] rounded" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[#131722] rounded-xl border border-[#2B3139] p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <div className="h-4 w-20 bg-[#2B3139] rounded" />
                <div className="h-8 w-24 bg-[#2B3139] rounded" />
                <div className="h-3 w-28 bg-[#2B3139] rounded" />
              </div>
              <div className="w-12 h-12 bg-[#2B3139] rounded-xl" />
            </div>
            <div className="mt-4 h-10 bg-[#2B3139]/50 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminOverviewPage() {
  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminApi.getStats,
  });
  const stats = statsRes?.data;

  const { data: activitiesRes, isLoading: activitiesLoading } = useQuery({
    queryKey: ['admin', 'activities'],
    queryFn: adminApi.getActivities,
  });
  const activities = activitiesRes?.data || [];

  const { data: alertsRes } = useQuery({
    queryKey: ['admin', 'alerts'],
    queryFn: adminApi.getAlerts,
  });
  const alerts = alertsRes?.data || [];

  // 模拟趋势数据（实际项目中从 API 获取）
  const mockTrendData = {
    users: [120, 132, 101, 134, 190, 230, 210, 245, 280, 310, 290, 320],
    instances: [50, 42, 65, 78, 82, 75, 90, 95, 88, 102, 98, 105],
    revenue: [1200, 1350, 1100, 1450, 1600, 1400, 1750, 1900, 1800, 2100, 1950, 2200],
    trades: [520, 630, 580, 720, 850, 790, 920, 880, 1050, 980, 1120, 1200],
  };

  if (statsLoading && activitiesLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">管理后台概览</h1>
          <p className="text-[#848E9C] mt-1">实时监控平台运营状态</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00C087]/10 text-[#00C087] rounded-full">
            <span className="w-2 h-2 bg-[#00C087] rounded-full animate-pulse" />
            系统正常
          </span>
          <span className="text-[#848E9C]">
            更新于 {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* 统计卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="总用户数"
          value={stats?.users.total.toLocaleString() || '-'}
          subtitle={`+${stats?.users.newThisWeek || 0} 本周新增`}
          subtitleColor="success"
          icon={<Users className="w-6 h-6 text-[#3772FF]" />}
          iconBg="#3772FF"
          trend="up"
          trendValue="12.5%"
          sparklineData={mockTrendData.users}
          sparklineColor="#3772FF"
          loading={statsLoading}
        />

        <StatCard
          title="VPS 实例"
          value={stats?.instances.total || '-'}
          subtitle={`${stats?.instances.running || 0} 运行中`}
          subtitleColor="success"
          icon={<Server className="w-6 h-6 text-[#00C087]" />}
          iconBg="#00C087"
          trend="up"
          trendValue="8.3%"
          sparklineData={mockTrendData.instances}
          sparklineColor="#00C087"
          loading={statsLoading}
        />

        <StatCard
          title="今日收入"
          value={`$${stats?.revenue.today || '-'}`}
          subtitle={`本月 $${stats?.revenue.thisMonth || '0'}`}
          subtitleColor="muted"
          icon={<DollarSign className="w-6 h-6 text-[#F7931A]" />}
          iconBg="#F7931A"
          trend="up"
          trendValue="23.1%"
          sparklineData={mockTrendData.revenue}
          sparklineColor="#F7931A"
          loading={statsLoading}
        />

        <StatCard
          title="今日交易"
          value={stats?.trades.today.toLocaleString() || '-'}
          subtitle={`成功率 ${stats?.trades.successRate || 0}%`}
          subtitleColor="success"
          icon={<TrendingUp className="w-6 h-6 text-[#9945FF]" />}
          iconBg="#9945FF"
          trend="up"
          trendValue="5.7%"
          sparklineData={mockTrendData.trades}
          sparklineColor="#9945FF"
          loading={statsLoading}
        />
      </div>

      {/* 告警和活动区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 系统告警 */}
        <div className="bg-[#131722] rounded-xl border border-[#2B3139] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2B3139] flex items-center justify-between bg-gradient-to-r from-[#F7931A]/5 to-transparent">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <div className="w-8 h-8 bg-[#F7931A]/10 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-[#F7931A]" />
              </div>
              系统告警
            </h2>
            <span className="px-2.5 py-1 bg-[#F7931A]/10 text-[#F7931A] text-xs font-medium rounded-full">
              {alerts?.length || 0} 条
            </span>
          </div>
          <div className="p-4 max-h-[320px] overflow-y-auto custom-scrollbar">
            {alerts?.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-[#00C087]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-[#00C087]" />
                </div>
                <p className="text-white font-medium">系统运行正常</p>
                <p className="text-[#848E9C] text-sm mt-1">暂无需要处理的告警</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts?.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-xl border transition-all duration-200 hover:translate-x-1 cursor-pointer ${
                      alert.level === 'warning'
                        ? 'bg-[#F7931A]/5 border-[#F7931A]/20 hover:border-[#F7931A]/40'
                        : alert.level === 'error'
                        ? 'bg-[#F23645]/5 border-[#F23645]/20 hover:border-[#F23645]/40'
                        : 'bg-[#3772FF]/5 border-[#3772FF]/20 hover:border-[#3772FF]/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          alert.level === 'warning' ? 'bg-[#F7931A]' :
                          alert.level === 'error' ? 'bg-[#F23645]' : 'bg-[#3772FF]'
                        }`} />
                        <div>
                          <p className="text-white text-sm font-medium">{alert.message}</p>
                          <p className="text-[#848E9C] text-xs mt-1">系统监控</p>
                        </div>
                      </div>
                      <span className="text-[#5E6673] text-xs whitespace-nowrap">{alert.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 最近活动 */}
        <div className="bg-[#131722] rounded-xl border border-[#2B3139] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2B3139] flex items-center justify-between bg-gradient-to-r from-[#3772FF]/5 to-transparent">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <div className="w-8 h-8 bg-[#3772FF]/10 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-[#3772FF]" />
              </div>
              最近活动
            </h2>
            <button className="text-[#3772FF] text-xs font-medium hover:text-[#3772FF]/80 transition-colors">
              查看全部
            </button>
          </div>
          <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
            {activities?.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-[#2B3139] rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-8 h-8 text-[#5E6673]" />
                </div>
                <p className="text-[#848E9C]">暂无活动记录</p>
              </div>
            ) : (
              <div className="divide-y divide-[#2B3139]">
                {activities?.map((activity) => (
                  <div
                    key={activity.id}
                    className="px-5 py-4 flex items-center justify-between hover:bg-[#1E222D]/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        activity.type === 'user' ? 'bg-[#3772FF]/10' :
                        activity.type === 'instance' ? 'bg-[#00C087]/10' :
                        activity.type === 'withdraw' ? 'bg-[#F7931A]/10' :
                        'bg-[#F23645]/10'
                      }`}>
                        {activity.type === 'user' && <Users className="w-5 h-5 text-[#3772FF]" />}
                        {activity.type === 'instance' && <Server className="w-5 h-5 text-[#00C087]" />}
                        {activity.type === 'withdraw' && <DollarSign className="w-5 h-5 text-[#F7931A]" />}
                        {activity.type === 'error' && <AlertTriangle className="w-5 h-5 text-[#F23645]" />}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{activity.action}</p>
                        <p className="text-[#5E6673] text-xs mt-0.5">
                          {activity.user || activity.amount || activity.instanceId}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#5E6673]">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-xs">{activity.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
