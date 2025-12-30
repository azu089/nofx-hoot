'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Server,
  DollarSign,
  TrendingUp,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

export default function AdminOverviewPage() {
  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminApi.getStats,
  });
  const stats = statsRes?.data;

  const { data: activitiesRes } = useQuery({
    queryKey: ['admin', 'activities'],
    queryFn: adminApi.getActivities,
  });
  const activities = activitiesRes?.data || [];

  const { data: alertsRes } = useQuery({
    queryKey: ['admin', 'alerts'],
    queryFn: adminApi.getAlerts,
  });
  const alerts = alertsRes?.data || [];

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-white">管理后台概览</h1>
        <p className="text-[#848E9C] mt-1">实时监控平台运营状态</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 用户统计 */}
        <div className="bg-[#131722] rounded-xl p-6 border border-[#2B3139]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#848E9C] text-sm">总用户数</p>
              <p className="text-2xl font-bold text-white mt-1">
                {statsLoading ? '-' : stats?.users.total.toLocaleString()}
              </p>
              <p className="text-[#00C087] text-sm mt-1">
                +{stats?.users.newThisWeek || 0} 本周新增
              </p>
            </div>
            <div className="w-12 h-12 bg-[#3772FF]/10 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-[#3772FF]" />
            </div>
          </div>
        </div>

        {/* VPS 实例 */}
        <div className="bg-[#131722] rounded-xl p-6 border border-[#2B3139]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#848E9C] text-sm">VPS 实例</p>
              <p className="text-2xl font-bold text-white mt-1">
                {statsLoading ? '-' : stats?.instances.total}
              </p>
              <p className="text-[#00C087] text-sm mt-1">
                {stats?.instances.running || 0} 运行中
              </p>
            </div>
            <div className="w-12 h-12 bg-[#00C087]/10 rounded-lg flex items-center justify-center">
              <Server className="w-6 h-6 text-[#00C087]" />
            </div>
          </div>
        </div>

        {/* 今日收入 */}
        <div className="bg-[#131722] rounded-xl p-6 border border-[#2B3139]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#848E9C] text-sm">今日收入</p>
              <p className="text-2xl font-bold text-white mt-1">
                ${statsLoading ? '-' : stats?.revenue.today}
              </p>
              <p className="text-[#848E9C] text-sm mt-1">
                本月 ${stats?.revenue.thisMonth || '0'}
              </p>
            </div>
            <div className="w-12 h-12 bg-[#F7931A]/10 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-[#F7931A]" />
            </div>
          </div>
        </div>

        {/* 交易统计 */}
        <div className="bg-[#131722] rounded-xl p-6 border border-[#2B3139]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#848E9C] text-sm">今日交易</p>
              <p className="text-2xl font-bold text-white mt-1">
                {statsLoading ? '-' : stats?.trades.today.toLocaleString()}
              </p>
              <p className="text-[#00C087] text-sm mt-1">
                成功率 {stats?.trades.successRate || 0}%
              </p>
            </div>
            <div className="w-12 h-12 bg-[#9945FF]/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-[#9945FF]" />
            </div>
          </div>
        </div>
      </div>

      {/* 告警和活动 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 系统告警 */}
        <div className="bg-[#131722] rounded-xl border border-[#2B3139]">
          <div className="p-4 border-b border-[#2B3139] flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#F7931A]" />
              系统告警
            </h2>
            <span className="px-2 py-1 bg-[#F7931A]/10 text-[#F7931A] text-xs rounded-full">
              {alerts?.length || 0} 条
            </span>
          </div>
          <div className="p-4 space-y-3">
            {alerts?.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-[#00C087] mx-auto mb-2" />
                <p className="text-[#848E9C]">暂无告警</p>
              </div>
            ) : (
              alerts?.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${
                    alert.level === 'warning'
                      ? 'bg-[#F7931A]/5 border-[#F7931A]/20'
                      : 'bg-[#3772FF]/5 border-[#3772FF]/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-white text-sm">{alert.message}</p>
                    <span className="text-[#848E9C] text-xs">{alert.time}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 最近活动 */}
        <div className="bg-[#131722] rounded-xl border border-[#2B3139]">
          <div className="p-4 border-b border-[#2B3139]">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#3772FF]" />
              最近活动
            </h2>
          </div>
          <div className="p-4 space-y-3">
            {activities?.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between py-2 border-b border-[#2B3139] last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.type === 'user' ? 'bg-[#3772FF]' :
                    activity.type === 'instance' ? 'bg-[#00C087]' :
                    activity.type === 'withdraw' ? 'bg-[#F7931A]' :
                    'bg-[#F23645]'
                  }`} />
                  <div>
                    <p className="text-white text-sm">{activity.action}</p>
                    <p className="text-[#848E9C] text-xs">
                      {activity.user || activity.amount || activity.instanceId}
                    </p>
                  </div>
                </div>
                <span className="text-[#848E9C] text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {activity.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
