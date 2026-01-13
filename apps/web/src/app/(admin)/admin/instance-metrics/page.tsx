'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Search,
  RefreshCw,
  Cpu,
  HardDrive,
  MemoryStick,
  Wifi,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type InstanceMetric = {
  instanceId: string;
  instanceName: string;
  userId: string;
  userEmail: string;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIn: number;
  networkOut: number;
  status: string;
  lastHeartbeat: string;
  uptimeSeconds: number;
};

export default function InstanceMetricsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: metricsRes, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'instance-metrics', search, statusFilter],
    queryFn: () => adminApi.getInstanceMetrics({
      search: search || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    refetchInterval: 30000, // 每 30 秒刷新
  });
  const metricsData = metricsRes?.data;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="success">健康</Badge>;
      case 'warning':
        return <Badge variant="warning">警告</Badge>;
      case 'critical':
        return <Badge variant="danger">异常</Badge>;
      default:
        return <Badge variant="secondary">未知</Badge>;
    }
  };

  const getUsageColor = (usage: number) => {
    if (usage >= 90) return 'text-danger';
    if (usage >= 70) return 'text-warning';
    return 'text-success';
  };

  const getUsageBarColor = (usage: number) => {
    if (usage >= 90) return 'bg-danger';
    if (usage >= 70) return 'bg-warning';
    return 'bg-success';
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}天 ${hours}小时`;
    if (hours > 0) return `${hours}小时 ${mins}分钟`;
    return `${mins}分钟`;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    return date.toLocaleString('zh-CN');
  };

  // 统计数据
  const stats = {
    total: metricsData?.data?.length || 0,
    healthy: metricsData?.data?.filter((m: InstanceMetric) => m.status === 'healthy').length || 0,
    warning: metricsData?.data?.filter((m: InstanceMetric) => m.status === 'warning').length || 0,
    critical: metricsData?.data?.filter((m: InstanceMetric) => m.status === 'critical').length || 0,
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-7 h-7 text-success" />
            VPS 性能监控
          </h1>
          <p className="text-text-secondary mt-1">实时监控所有 VPS 实例的性能指标</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-brand-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-sm text-text-secondary">总实例</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.healthy}</p>
              <p className="text-sm text-text-secondary">健康</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.warning}</p>
              <p className="text-sm text-text-secondary">警告</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-danger/10 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-danger" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.critical}</p>
              <p className="text-sm text-text-secondary">异常</p>
            </div>
          </div>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
          <input
            type="text"
            placeholder="搜索实例名称或用户..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-secondary focus:outline-none focus:border-brand-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none focus:border-brand-primary"
        >
          <option value="all">全部状态</option>
          <option value="healthy">健康</option>
          <option value="warning">警告</option>
          <option value="critical">异常</option>
        </select>
      </div>

      {/* 实例列表 */}
      {isLoading ? (
        <Card className="p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
        </Card>
      ) : metricsData?.data?.length === 0 ? (
        <Card className="p-12 text-center text-text-secondary">
          暂无实例数据
        </Card>
      ) : (
        <div className="grid gap-4">
          {metricsData?.data?.map((metric: InstanceMetric) => (
            <Card key={metric.instanceId} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-white">{metric.instanceName}</h3>
                    {getStatusBadge(metric.status)}
                  </div>
                  <p className="text-text-secondary text-sm mt-1">{metric.userEmail}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-text-secondary text-sm">
                    <Clock className="w-4 h-4" />
                    心跳: {formatTime(metric.lastHeartbeat)}
                  </div>
                  <p className="text-text-secondary text-xs mt-1">
                    运行时间: {formatUptime(metric.uptimeSeconds)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-6">
                {/* CPU */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Cpu className="w-4 h-4 text-text-secondary" />
                    <span className="text-sm text-text-secondary">CPU</span>
                    <span className={`text-sm font-medium ${getUsageColor(metric.cpuUsage)}`}>
                      {metric.cpuUsage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getUsageBarColor(metric.cpuUsage)} transition-all`}
                      style={{ width: `${Math.min(metric.cpuUsage, 100)}%` }}
                    />
                  </div>
                </div>

                {/* 内存 */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MemoryStick className="w-4 h-4 text-text-secondary" />
                    <span className="text-sm text-text-secondary">内存</span>
                    <span className={`text-sm font-medium ${getUsageColor(metric.memoryUsage)}`}>
                      {metric.memoryUsage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getUsageBarColor(metric.memoryUsage)} transition-all`}
                      style={{ width: `${Math.min(metric.memoryUsage, 100)}%` }}
                    />
                  </div>
                </div>

                {/* 磁盘 */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <HardDrive className="w-4 h-4 text-text-secondary" />
                    <span className="text-sm text-text-secondary">磁盘</span>
                    <span className={`text-sm font-medium ${getUsageColor(metric.diskUsage)}`}>
                      {metric.diskUsage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getUsageBarColor(metric.diskUsage)} transition-all`}
                      style={{ width: `${Math.min(metric.diskUsage, 100)}%` }}
                    />
                  </div>
                </div>

                {/* 网络 */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Wifi className="w-4 h-4 text-text-secondary" />
                    <span className="text-sm text-text-secondary">网络</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <TrendingDown className="w-3 h-3 text-success" />
                      <span className="text-success">{formatBytes(metric.networkIn)}/s</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-brand-primary" />
                      <span className="text-brand-primary">{formatBytes(metric.networkOut)}/s</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
