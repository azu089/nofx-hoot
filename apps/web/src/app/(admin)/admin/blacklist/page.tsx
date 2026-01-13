'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldBan,
  Search,
  Plus,
  Trash2,
  User,
  Mail,
  Globe,
  Smartphone,
  Clock,
  Loader2,
  X,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

type BlacklistItem = {
  id: string;
  type: string;
  value: string;
  reason: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  createdBy: string | null;
};

const typeLabels: Record<string, { label: string; icon: typeof User }> = {
  user: { label: '用户', icon: User },
  email: { label: '邮箱', icon: Mail },
  ip: { label: 'IP', icon: Globe },
  device: { label: '设备', icon: Smartphone },
};

export default function BlacklistPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<BlacklistItem | null>(null);

  // 新增表单
  const [newType, setNewType] = useState<string>('ip');
  const [newValue, setNewValue] = useState('');
  const [newReason, setNewReason] = useState('');
  const [newExpiry, setNewExpiry] = useState('');

  const { data: blacklistRes, isLoading } = useQuery({
    queryKey: ['admin', 'blacklist', page, search, typeFilter],
    queryFn: () => adminApi.getBlacklist({ page, search, type: typeFilter === 'all' ? undefined : typeFilter }),
  });
  const blacklistData = blacklistRes?.data;

  const addMutation = useMutation({
    mutationFn: (data: { type: string; value: string; reason?: string; expiresAt?: string }) =>
      adminApi.addToBlacklist(data),
    onSuccess: () => {
      toast.success('添加成功');
      queryClient.invalidateQueries({ queryKey: ['admin', 'blacklist'] });
      handleCloseAddDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || '添加失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.removeFromBlacklist(id),
    onSuccess: () => {
      toast.success('已移除');
      queryClient.invalidateQueries({ queryKey: ['admin', 'blacklist'] });
      setDeleteItem(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || '移除失败');
    },
  });

  const handleCloseAddDialog = () => {
    setShowAddDialog(false);
    setNewType('ip');
    setNewValue('');
    setNewReason('');
    setNewExpiry('');
  };

  const handleAdd = () => {
    if (!newValue.trim()) {
      toast.error('请输入值');
      return;
    }
    addMutation.mutate({
      type: newType,
      value: newValue.trim(),
      reason: newReason.trim() || undefined,
      expiresAt: newExpiry || undefined,
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '永久';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldBan className="w-7 h-7 text-danger" />
            黑名单管理
          </h1>
          <p className="text-text-secondary mt-1">管理被封禁的用户、邮箱、IP、设备</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          添加黑名单
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(typeLabels).map(([type, { label, icon: Icon }]) => {
          const count = blacklistData?.stats?.[type] || 0;
          return (
            <Card key={type} className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-danger/10 rounded-lg flex items-center justify-center">
                  <Icon className="w-5 h-5 text-danger" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{count}</p>
                  <p className="text-sm text-text-secondary">{label}封禁</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
          <input
            type="text"
            placeholder="搜索值..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-secondary focus:outline-none focus:border-brand-primary"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none focus:border-brand-primary"
        >
          <option value="all">全部类型</option>
          <option value="user">用户</option>
          <option value="email">邮箱</option>
          <option value="ip">IP</option>
          <option value="device">设备</option>
        </select>
      </div>

      {/* 黑名单列表 */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-primary">
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">类型</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">值</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">原因</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">状态</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">过期时间</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">创建时间</th>
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
              ) : blacklistData?.data?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-text-secondary">
                    暂无数据
                  </td>
                </tr>
              ) : (
                blacklistData?.data?.map((item: BlacklistItem) => {
                  const TypeIcon = typeLabels[item.type]?.icon || User;
                  return (
                    <tr key={item.id} className="border-b border-border-primary hover:bg-bg-tertiary">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <TypeIcon className="w-4 h-4 text-text-secondary" />
                          <span className="text-white">{typeLabels[item.type]?.label}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-white font-mono">{item.value}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-text-secondary">{item.reason || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={item.isActive ? 'danger' : 'secondary'}>
                          {item.isActive ? '生效中' : '已失效'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-text-secondary flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatDate(item.expiresAt)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-text-secondary">
                          {new Date(item.createdAt).toLocaleString('zh-CN')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteItem(item)}
                          className="text-danger hover:text-danger hover:bg-danger/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className="px-6 py-4 border-t border-border-primary flex items-center justify-between">
          <p className="text-text-secondary text-sm">
            共 {blacklistData?.total || 0} 条记录
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
              {page} / {blacklistData?.totalPages || 1}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= (blacklistData?.totalPages || 1)}
              className="px-4 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      {/* 添加对话框 */}
      <Dialog open={showAddDialog} onClose={handleCloseAddDialog} title="添加黑名单">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">类型</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none focus:border-brand-primary"
            >
              <option value="user">用户 ID</option>
              <option value="email">邮箱</option>
              <option value="ip">IP 地址</option>
              <option value="device">设备指纹</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-text-secondary">值</label>
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder={
                newType === 'user' ? '用户 ID' :
                newType === 'email' ? '邮箱地址' :
                newType === 'ip' ? 'IP 地址（支持 CIDR）' :
                '设备指纹'
              }
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-text-secondary">封禁原因（可选）</label>
            <Input
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder="封禁原因"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-text-secondary">过期时间（可选，留空为永久）</label>
            <Input
              type="datetime-local"
              value={newExpiry}
              onChange={(e) => setNewExpiry(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCloseAddDialog}>
            取消
          </Button>
          <Button variant="danger" onClick={handleAdd} isLoading={addMutation.isPending}>
            <ShieldBan className="w-4 h-4 mr-2" />
            添加封禁
          </Button>
        </DialogFooter>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        title="确认移除"
      >
        <div className="space-y-4">
          <p className="text-text-secondary">
            确定要从黑名单中移除 <span className="text-white font-mono">{deleteItem?.value}</span> 吗？
          </p>
          <div className="p-3 bg-warning/10 rounded-lg">
            <p className="text-sm text-warning">
              移除后该{typeLabels[deleteItem?.type || 'user']?.label}将不再被封禁
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteItem(null)}>
            取消
          </Button>
          <Button
            variant="danger"
            onClick={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
            isLoading={deleteMutation.isPending}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            确认移除
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
