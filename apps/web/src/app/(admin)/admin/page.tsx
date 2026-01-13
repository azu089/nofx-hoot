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
        <p className="text-text-secondary mt-1">实时监控平台运营状态</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 用户统计 */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">总用户数</p>
              <p className="text-2xl font-bold text-white mt-1">
                {statsLoading ? '-' : stats?.users.total.toLocaleString()}
              </p>
              <p className="text-success text-sm mt-1">
                +{stats?.users.newThisWeek || 0} 本周新增
              </p>
            </div>
            <div className="w-12 h-12 bg-brand-primary/10 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-brand-primary" />
            </div>
          </div>
        </div>

        {/* VPS 实例 */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">VPS 实例</p>
              <p className="text-2xl font-bold text-white mt-1">
                {statsLoading ? '-' : stats?.instances.total}
              </p>
              <p className="text-success text-sm mt-1">
                {stats?.instances.running || 0} 运行中
              </p>
            </div>
            <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
              <Server className="w-6 h-6 text-success" />
            </div>
          </div>
        </div>

        {/* 今日收入 */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">今日收入</p>
              <p className="text-2xl font-bold text-white mt-1">
                ${statsLoading ? '-' : stats?.revenue.today}
              </p>
              <p className="text-text-secondary text-sm mt-1">
                本月 ${stats?.revenue.thisMonth || '0'}
              </p>
            </div>
            <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-warning" />
            </div>
          </div>
        </div>

        {/* 交易统计 */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">今日交易</p>
              <p className="text-2xl font-bold text-white mt-1">
                {statsLoading ? '-' : stats?.trades.today.toLocaleString()}
              </p>
              <p className="text-success text-sm mt-1">
                成功率 {stats?.trades.successRate || 0}%
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-500" />
            </div>
          </div>
        </div>
      </div>

      {/* 告警和活动 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 系统告警 */}
        <div className="glass-card">
          <div className="p-4 border-b border-border-primary flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              系统告警
            </h2>
            <span className="px-2 py-1 bg-warning/10 text-warning text-xs rounded-full">
              {alerts?.length || 0} 条
            </span>
          </div>
          <div className="p-4 space-y-3">
            {alerts?.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-success mx-auto mb-2" />
                <p className="text-text-secondary">暂无告警</p>
              </div>
            ) : (
              alerts?.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${
                    alert.level === 'warning'
                      ? 'bg-warning/5 border-warning/20'
                      : 'bg-brand-primary/5 border-brand-primary/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-white text-sm">{alert.message}</p>
                    <span className="text-text-secondary text-xs">{alert.time}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 最近活动 */}
        <div className="glass-card">
          <div className="p-4 border-b border-border-primary">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-brand-primary" />
              最近活动
            </h2>
          </div>
          <div className="p-4 space-y-3">
            {activities?.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between py-2 border-b border-border-primary last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.type === 'user' ? 'bg-brand-primary' :
                    activity.type === 'instance' ? 'bg-success' :
                    activity.type === 'withdraw' ? 'bg-warning' :
                    'bg-danger'
                  }`} />
                  <div>
                    <p className="text-white text-sm">{activity.action}</p>
                    <p className="text-text-secondary text-xs">
                      {activity.user || activity.amount || activity.instanceId}
                    </p>
                  </div>
                </div>
                <span className="text-text-secondary text-xs flex items-center gap-1">
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
