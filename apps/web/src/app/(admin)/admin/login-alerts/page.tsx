'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquareWarning,
  Search,
  RefreshCw,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  Ban,
  Shield,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

type LoginAlert = {
  id: string;
  userId: string;
  userEmail: string;
  alertType: string;
  severity: string;
  description: string;
  ipAddress: string;
  location: string | null;
  deviceInfo: string | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

const alertTypeLabels: Record<string, string> = {
  new_device: '新设备登录',
  new_location: '异地登录',
  multiple_failures: '多次失败',
  suspicious_activity: '可疑活动',
  vpn_detected: 'VPN 检测',
};

const severityBadges: Record<string, { variant: 'success' | 'warning' | 'danger' | 'secondary'; label: string }> = {
  low: { variant: 'success', label: '低' },
  medium: { variant: 'warning', label: '中' },
  high: { variant: 'danger', label: '高' },
  critical: { variant: 'danger', label: '严重' },
};

export default function LoginAlertsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedAlert, setSelectedAlert] = useState<LoginAlert | null>(null);

  const { data: alertsRes, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'login-alerts', page, search, severityFilter, statusFilter],
    queryFn: () => adminApi.getLoginAlerts({
      page,
      userId: search || undefined,
      severity: severityFilter === 'all' ? undefined : severityFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
  });
  const alertsData = alertsRes?.data;

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminApi.reviewLoginAlert(id, status),
    onSuccess: () => {
      toast.success('已处理');
      queryClient.invalidateQueries({ queryKey: ['admin', 'login-alerts'] });
      setSelectedAlert(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || '操作失败');
    },
  });

  const banUserMutation = useMutation({
    mutationFn: (userId: string) => adminApi.banUser(userId),
    onSuccess: () => {
      toast.success('用户已封禁');
      queryClient.invalidateQueries({ queryKey: ['admin', 'login-alerts'] });
      setSelectedAlert(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || '操作失败');
    },
  });

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  // 统计数据
  const stats = {
    total: alertsData?.stats?.total || 0,
    pending: alertsData?.stats?.pending || 0,
    critical: alertsData?.stats?.critical || 0,
    today: alertsData?.stats?.today || 0,
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquareWarning className="w-7 h-7 text-warning" />
            登录告警
          </h1>
          <p className="text-text-secondary mt-1">监控异常登录行为，及时发现安全风险</p>
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
              <Shield className="w-5 h-5 text-brand-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-sm text-text-secondary">总告警</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.pending}</p>
              <p className="text-sm text-text-secondary">待处理</p>
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
              <p className="text-sm text-text-secondary">严重告警</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.today}</p>
              <p className="text-sm text-text-secondary">今日新增</p>
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
            placeholder="搜索用户 ID 或邮箱..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-secondary focus:outline-none focus:border-brand-primary"
          />
        </div>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none focus:border-brand-primary"
        >
          <option value="all">全部严重程度</option>
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
          <option value="critical">严重</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none focus:border-brand-primary"
        >
          <option value="all">全部状态</option>
          <option value="pending">待处理</option>
          <option value="reviewed">已审核</option>
          <option value="dismissed">已忽略</option>
          <option value="actioned">已处理</option>
        </select>
      </div>

      {/* 告警列表 */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-primary">
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">用户</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">告警类型</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">严重程度</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">IP / 位置</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">状态</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">时间</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-text-secondary">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-text-secondary">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      加载中...
                    </div>
                  </td>
                </tr>
              ) : alertsData?.data?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-text-secondary">
                    暂无告警
                  </td>
                </tr>
              ) : (
                alertsData?.data?.map((alert: LoginAlert) => (
                  <tr key={alert.id} className="border-b border-border-primary hover:bg-bg-tertiary">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-white font-medium">{alert.userEmail}</p>
                        <p className="text-text-secondary text-xs">{alert.userId.slice(0, 8)}...</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-white">{alertTypeLabels[alert.alertType]}</span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={severityBadges[alert.severity]?.variant || 'secondary'}>
                        {severityBadges[alert.severity]?.label || alert.severity}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-text-secondary" />
                        <div>
                          <p className="text-white font-mono text-sm">{alert.ipAddress}</p>
                          <p className="text-text-secondary text-xs">{alert.location || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={
                          alert.status === 'pending' ? 'warning' :
                          alert.status === 'actioned' ? 'danger' :
                          alert.status === 'reviewed' ? 'success' :
                          'secondary'
                        }
                      >
                        {alert.status === 'pending' ? '待处理' :
                         alert.status === 'reviewed' ? '已审核' :
                         alert.status === 'dismissed' ? '已忽略' :
                         '已处理'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-text-secondary flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatTime(alert.createdAt)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedAlert(alert)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        查看
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className="px-6 py-4 border-t border-border-primary flex items-center justify-between">
          <p className="text-text-secondary text-sm">
            共 {alertsData?.total || 0} 条记录
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white disabled:opacity-50"
            >
              上一页
            </button>
            <span className="px-4 py-2 text-white">
              {page} / {alertsData?.totalPages || 1}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= (alertsData?.totalPages || 1)}
              className="px-4 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      {/* 告警详情对话框 */}
      <Dialog
        open={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
        title="告警详情"
        className="max-w-lg"
      >
        {selectedAlert && (
          <div className="space-y-4">
            <Card className="p-4 bg-bg-tertiary">
              <div className="flex items-center justify-between mb-3">
                <span className="text-text-secondary">用户</span>
                <span className="text-white">{selectedAlert.userEmail}</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-text-secondary">告警类型</span>
                <span className="text-white">{alertTypeLabels[selectedAlert.alertType]}</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-text-secondary">严重程度</span>
                <Badge variant={severityBadges[selectedAlert.severity]?.variant || 'secondary'}>
                  {severityBadges[selectedAlert.severity]?.label}
                </Badge>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-text-secondary">IP 地址</span>
                <span className="text-white font-mono">{selectedAlert.ipAddress}</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-text-secondary">位置</span>
                <span className="text-white">{selectedAlert.location || '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">设备</span>
                <span className="text-white">{selectedAlert.deviceInfo || '-'}</span>
              </div>
            </Card>

            <div className="p-4 bg-bg-tertiary rounded-lg">
              <p className="text-text-secondary text-sm mb-2">描述</p>
              <p className="text-white">{selectedAlert.description}</p>
            </div>

            {selectedAlert.status === 'pending' && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => reviewMutation.mutate({ id: selectedAlert.id, status: 'dismissed' })}
                  isLoading={reviewMutation.isPending}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  忽略
                </Button>
                <Button
                  variant="success"
                  className="flex-1"
                  onClick={() => reviewMutation.mutate({ id: selectedAlert.id, status: 'reviewed' })}
                  isLoading={reviewMutation.isPending}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  标记已审核
                </Button>
              </div>
            )}

            {(selectedAlert.severity === 'high' || selectedAlert.severity === 'critical') && (
              <Button
                variant="danger"
                className="w-full"
                onClick={() => banUserMutation.mutate(selectedAlert.userId)}
                isLoading={banUserMutation.isPending}
              >
                <Ban className="w-4 h-4 mr-2" />
                封禁用户
              </Button>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setSelectedAlert(null)}>
            关闭
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
