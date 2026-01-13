'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Smartphone,
  Search,
  LogOut,
  Monitor,
  Tablet,
  Clock,
  MapPin,
  Loader2,
  RefreshCw,
  Power,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

type Session = {
  id: string;
  userId: string;
  userEmail: string;
  deviceType: string | null;
  deviceName: string | null;
  ipAddress: string | null;
  location: string | null;
  lastActiveAt: string;
  createdAt: string;
  isExpired: boolean;
};

const deviceIcons: Record<string, typeof Smartphone> = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
};

export default function SessionsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [showRevokeAllDialog, setShowRevokeAllDialog] = useState(false);
  const [revokeAllUserId, setRevokeAllUserId] = useState<string | null>(null);

  const { data: sessionsRes, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'sessions', page, search, activeOnly],
    queryFn: () => adminApi.getSessions({ page, userId: search || undefined, activeOnly }),
  });
  const sessionsData = sessionsRes?.data;

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => adminApi.revokeSession(sessionId),
    onSuccess: () => {
      toast.success('会话已终止');
      queryClient.invalidateQueries({ queryKey: ['admin', 'sessions'] });
      setSelectedSession(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || '操作失败');
    },
  });

  const revokeAllMutation = useMutation({
    mutationFn: (userId: string) => adminApi.revokeAllSessions(userId),
    onSuccess: () => {
      toast.success('已终止所有会话');
      queryClient.invalidateQueries({ queryKey: ['admin', 'sessions'] });
      setShowRevokeAllDialog(false);
      setRevokeAllUserId(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || '操作失败');
    },
  });

  const getDeviceIcon = (deviceType: string | null) => {
    const Icon = deviceIcons[deviceType || 'desktop'] || Monitor;
    return <Icon className="w-5 h-5" />;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return date.toLocaleString('zh-CN');
  };

  const handleRevokeAll = (userId: string) => {
    setRevokeAllUserId(userId);
    setShowRevokeAllDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Smartphone className="w-7 h-7 text-brand-primary" />
            会话管理
          </h1>
          <p className="text-text-secondary mt-1">查看和管理用户登录会话，支持强制登出</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
              <Power className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{sessionsData?.stats?.activeSessions || 0}</p>
              <p className="text-sm text-text-secondary">活跃会话</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-brand-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{sessionsData?.stats?.mobileCount || 0}</p>
              <p className="text-sm text-text-secondary">移动端</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center">
              <Monitor className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{sessionsData?.stats?.desktopCount || 0}</p>
              <p className="text-sm text-text-secondary">桌面端</p>
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
            placeholder="搜索用户 ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-secondary focus:outline-none focus:border-brand-primary"
          />
        </div>
        <label className="flex items-center gap-2 px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="w-4 h-4 rounded border-border-primary text-brand-primary focus:ring-[#3772FF]"
          />
          <span className="text-white">仅显示活跃会话</span>
        </label>
      </div>

      {/* 会话列表 */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-primary">
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">用户</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">设备</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">IP / 位置</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">状态</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">最后活跃</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-text-secondary">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-secondary">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      加载中...
                    </div>
                  </td>
                </tr>
              ) : sessionsData?.data?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-secondary">
                    暂无数据
                  </td>
                </tr>
              ) : (
                sessionsData?.data?.map((session: Session) => (
                  <tr key={session.id} className="border-b border-border-primary hover:bg-bg-tertiary">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-white font-medium">{session.userEmail}</p>
                        <p className="text-text-secondary text-xs">{session.userId.slice(0, 8)}...</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getDeviceIcon(session.deviceType)}
                        <span className="text-white">{session.deviceName || session.deviceType || '未知'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-text-secondary" />
                        <div>
                          <p className="text-white font-mono text-sm">{session.ipAddress || '-'}</p>
                          <p className="text-text-secondary text-xs">{session.location || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={session.isExpired ? 'secondary' : 'success'}>
                        {session.isExpired ? '已过期' : '活跃'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-text-secondary flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatTime(session.lastActiveAt)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSession(session)}
                          className="text-danger hover:text-danger hover:bg-danger/10"
                          disabled={session.isExpired}
                        >
                          <LogOut className="w-4 h-4 mr-1" />
                          终止
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokeAll(session.userId)}
                          className="text-warning hover:text-warning hover:bg-warning/10"
                        >
                          全部终止
                        </Button>
                      </div>
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
            共 {sessionsData?.total || 0} 条记录
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
              {page} / {sessionsData?.totalPages || 1}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= (sessionsData?.totalPages || 1)}
              className="px-4 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      {/* 终止会话确认对话框 */}
      <Dialog
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        title="确认终止会话"
      >
        <div className="space-y-4">
          <p className="text-text-secondary">
            确定要终止用户 <span className="text-white">{selectedSession?.userEmail}</span> 的此会话吗？
          </p>
          <Card className="p-4 bg-bg-tertiary">
            <div className="flex items-center gap-3">
              {getDeviceIcon(selectedSession?.deviceType || null)}
              <div>
                <p className="text-white">{selectedSession?.deviceName || '未知设备'}</p>
                <p className="text-text-secondary text-sm">{selectedSession?.ipAddress} · {selectedSession?.location}</p>
              </div>
            </div>
          </Card>
          <div className="p-3 bg-warning/10 rounded-lg">
            <p className="text-sm text-warning">
              终止后该用户需要重新登录
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setSelectedSession(null)}>
            取消
          </Button>
          <Button
            variant="danger"
            onClick={() => selectedSession && revokeMutation.mutate(selectedSession.id)}
            isLoading={revokeMutation.isPending}
          >
            <LogOut className="w-4 h-4 mr-2" />
            确认终止
          </Button>
        </DialogFooter>
      </Dialog>

      {/* 终止所有会话确认对话框 */}
      <Dialog
        open={showRevokeAllDialog}
        onClose={() => setShowRevokeAllDialog(false)}
        title="终止所有会话"
      >
        <div className="space-y-4">
          <p className="text-text-secondary">
            确定要终止该用户的所有会话吗？这将强制用户在所有设备上登出。
          </p>
          <div className="p-3 bg-danger/10 rounded-lg">
            <p className="text-sm text-danger">
              此操作不可撤销，用户需要在所有设备上重新登录
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowRevokeAllDialog(false)}>
            取消
          </Button>
          <Button
            variant="danger"
            onClick={() => revokeAllUserId && revokeAllMutation.mutate(revokeAllUserId)}
            isLoading={revokeAllMutation.isPending}
          >
            <Power className="w-4 h-4 mr-2" />
            终止所有会话
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
