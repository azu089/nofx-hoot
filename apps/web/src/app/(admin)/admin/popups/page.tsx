'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquareWarning,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Clock,
  Loader2,
  Users,
  Target,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

type Popup = {
  id: string;
  title: string;
  content: string;
  type: string;
  targetAudience: string;
  priority: number;
  imageUrl: string | null;
  actionUrl: string | null;
  actionLabel: string | null;
  isActive: boolean;
  startAt: string | null;
  endAt: string | null;
  showOnce: boolean;
  createdAt: string;
  readCount: number;
};

const typeLabels: Record<string, { label: string; color: string }> = {
  info: { label: '通知', color: 'bg-brand-primary' },
  warning: { label: '警告', color: 'bg-warning' },
  success: { label: '成功', color: 'bg-success' },
  promo: { label: '促销', color: 'bg-purple-500' },
};

const audienceLabels: Record<string, string> = {
  all: '全部用户',
  vip: 'VIP 用户',
  new: '新用户',
  inactive: '不活跃用户',
};

export default function PopupsPage() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editPopup, setEditPopup] = useState<Popup | null>(null);
  const [deletePopup, setDeletePopup] = useState<Popup | null>(null);

  // 表单状态
  const [form, setForm] = useState({
    title: '',
    content: '',
    type: 'info',
    targetAudience: 'all',
    priority: 0,
    imageUrl: '',
    actionUrl: '',
    actionLabel: '',
    startAt: '',
    endAt: '',
    showOnce: false,
  });

  const { data: popupsRes, isLoading } = useQuery({
    queryKey: ['admin', 'popups'],
    queryFn: () => adminApi.getPopups(),
  });
  const popupsData = popupsRes?.data;

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof adminApi.createPopup>[0]) => adminApi.createPopup(data),
    onSuccess: () => {
      toast.success('弹窗创建成功');
      queryClient.invalidateQueries({ queryKey: ['admin', 'popups'] });
      handleCloseDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || '创建失败');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof adminApi.updatePopup>[1] }) =>
      adminApi.updatePopup(id, data),
    onSuccess: () => {
      toast.success('弹窗更新成功');
      queryClient.invalidateQueries({ queryKey: ['admin', 'popups'] });
      handleCloseDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || '更新失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deletePopup(id),
    onSuccess: () => {
      toast.success('弹窗已删除');
      queryClient.invalidateQueries({ queryKey: ['admin', 'popups'] });
      setDeletePopup(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || '删除失败');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.updatePopup(id, { isActive }),
    onSuccess: () => {
      toast.success('状态已更新');
      queryClient.invalidateQueries({ queryKey: ['admin', 'popups'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || '更新失败');
    },
  });

  const handleOpenCreate = () => {
    setEditPopup(null);
    setForm({
      title: '',
      content: '',
      type: 'info',
      targetAudience: 'all',
      priority: 0,
      imageUrl: '',
      actionUrl: '',
      actionLabel: '',
      startAt: '',
      endAt: '',
      showOnce: false,
    });
    setShowDialog(true);
  };

  const handleOpenEdit = (popup: Popup) => {
    setEditPopup(popup);
    setForm({
      title: popup.title,
      content: popup.content,
      type: popup.type,
      targetAudience: popup.targetAudience,
      priority: popup.priority,
      imageUrl: popup.imageUrl || '',
      actionUrl: popup.actionUrl || '',
      actionLabel: popup.actionLabel || '',
      startAt: popup.startAt ? new Date(popup.startAt).toISOString().slice(0, 16) : '',
      endAt: popup.endAt ? new Date(popup.endAt).toISOString().slice(0, 16) : '',
      showOnce: popup.showOnce,
    });
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditPopup(null);
  };

  const handleSubmit = () => {
    if (!form.title.trim()) {
      toast.error('请输入标题');
      return;
    }
    if (!form.content.trim()) {
      toast.error('请输入内容');
      return;
    }

    const data: Parameters<typeof adminApi.createPopup>[0] = {
      title: form.title,
      content: form.content,
      type: form.type,
      targetAudience: form.targetAudience,
      priority: form.priority,
      showOnce: form.showOnce,
    };

    if (form.imageUrl) data.imageUrl = form.imageUrl;
    if (form.actionUrl) data.actionUrl = form.actionUrl;
    if (form.actionLabel) data.actionLabel = form.actionLabel;
    if (form.startAt) data.startAt = form.startAt;
    if (form.endAt) data.endAt = form.endAt;

    if (editPopup) {
      updateMutation.mutate({ id: editPopup.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquareWarning className="w-7 h-7 text-warning" />
            弹窗公告
          </h1>
          <p className="text-text-secondary mt-1">创建和管理用户端弹窗通知</p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="w-4 h-4 mr-2" />
          创建弹窗
        </Button>
      </div>

      {/* 弹窗列表 */}
      <div className="grid gap-4">
        {isLoading ? (
          <Card className="p-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
          </Card>
        ) : popupsData?.data?.length === 0 ? (
          <Card className="p-12 text-center text-text-secondary">
            暂无弹窗公告
          </Card>
        ) : (
          popupsData?.data?.map((popup: Popup) => (
            <Card key={popup.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-2 h-2 rounded-full ${typeLabels[popup.type]?.color}`} />
                    <h3 className="text-lg font-semibold text-white">{popup.title}</h3>
                    <Badge variant={popup.isActive ? 'success' : 'secondary'}>
                      {popup.isActive ? '启用' : '禁用'}
                    </Badge>
                    <Badge variant="info">{typeLabels[popup.type]?.label}</Badge>
                  </div>

                  <p className="text-text-secondary mb-4 line-clamp-2">{popup.content}</p>

                  <div className="flex items-center gap-6 text-sm text-text-secondary">
                    <div className="flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      {audienceLabels[popup.targetAudience]}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {popup.readCount} 次阅读
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDate(popup.startAt)} - {formatDate(popup.endAt)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleMutation.mutate({ id: popup.id, isActive: !popup.isActive })}
                  >
                    {popup.isActive ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEdit(popup)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletePopup(popup)}
                    className="text-danger hover:text-danger hover:bg-danger/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* 创建/编辑对话框 */}
      <Dialog
        open={showDialog}
        onClose={handleCloseDialog}
        title={editPopup ? '编辑弹窗' : '创建弹窗'}
        className="max-w-2xl"
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-text-secondary">标题 *</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="弹窗标题"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-text-secondary">类型</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none focus:border-brand-primary"
              >
                <option value="info">通知</option>
                <option value="warning">警告</option>
                <option value="success">成功</option>
                <option value="promo">促销</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-text-secondary">内容 *</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="弹窗内容..."
              rows={4}
              className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-secondary focus:outline-none focus:border-brand-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-text-secondary">目标用户</label>
              <select
                value={form.targetAudience}
                onChange={(e) => setForm({ ...form, targetAudience: e.target.value as any })}
                className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none focus:border-brand-primary"
              >
                <option value="all">全部用户</option>
                <option value="vip">VIP 用户</option>
                <option value="new">新用户</option>
                <option value="inactive">不活跃用户</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-text-secondary">优先级</label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-text-secondary">图片 URL（可选）</label>
            <Input
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="https://example.com/image.png"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-text-secondary">按钮链接（可选）</label>
              <Input
                value={form.actionUrl}
                onChange={(e) => setForm({ ...form, actionUrl: e.target.value })}
                placeholder="/dashboard"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-text-secondary">按钮文字</label>
              <Input
                value={form.actionLabel}
                onChange={(e) => setForm({ ...form, actionLabel: e.target.value })}
                placeholder="立即查看"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-text-secondary">开始时间</label>
              <Input
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-text-secondary">结束时间</label>
              <Input
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => setForm({ ...form, endAt: e.target.value })}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.showOnce}
              onChange={(e) => setForm({ ...form, showOnce: e.target.checked })}
              className="w-4 h-4 rounded border-border-primary text-brand-primary focus:ring-[#3772FF]"
            />
            <span className="text-white">每用户只显示一次</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCloseDialog}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={createMutation.isPending || updateMutation.isPending}
          >
            {editPopup ? '保存' : '创建'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog
        open={!!deletePopup}
        onClose={() => setDeletePopup(null)}
        title="确认删除"
      >
        <div className="space-y-4">
          <p className="text-text-secondary">
            确定要删除弹窗 <span className="text-white">{deletePopup?.title}</span> 吗？
          </p>
          <div className="p-3 bg-danger/10 rounded-lg">
            <p className="text-sm text-danger">
              此操作不可撤销
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setDeletePopup(null)}>
            取消
          </Button>
          <Button
            variant="danger"
            onClick={() => deletePopup && deleteMutation.mutate(deletePopup.id)}
            isLoading={deleteMutation.isPending}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            确认删除
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
