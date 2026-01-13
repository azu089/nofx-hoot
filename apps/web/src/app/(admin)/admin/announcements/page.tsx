'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Megaphone,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Clock,
  CheckCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

export default function AdminAnnouncementsPage() {
  const queryClient = useQueryClient();
  const [showEditor, setShowEditor] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'info',
  });

  const { data: announcementsRes, isLoading } = useQuery({
    queryKey: ['admin', 'announcements'],
    queryFn: () => adminApi.getAnnouncements(),
  });
  const announcements = announcementsRes?.data;

  const createMutation = useMutation({
    mutationFn: (data: { title: string; content: string; type: string }) =>
      adminApi.createAnnouncement(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
      setShowEditor(false);
      setFormData({ title: '', content: '', type: 'info' });
      alert('公告发布成功');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string; content?: string; type?: string; status?: string } }) =>
      adminApi.updateAnnouncement(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
      setShowEditor(false);
      setEditingAnnouncement(null);
      alert('公告更新成功');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
      alert('公告删除成功');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: adminApi.toggleAnnouncementStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
    },
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-brand-primary" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'warning':
        return <span className="px-2 py-1 bg-warning/10 text-warning rounded text-xs">警告</span>;
      case 'success':
        return <span className="px-2 py-1 bg-success/10 text-success rounded text-xs">喜讯</span>;
      case 'info':
      default:
        return <span className="px-2 py-1 bg-brand-primary/10 text-brand-primary rounded text-xs">通知</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">公告管理</h1>
          <p className="text-text-secondary mt-1">发布和管理平台公告</p>
        </div>
        <button
          onClick={() => {
            setEditingAnnouncement(null);
            setShowEditor(true);
          }}
          className="px-4 py-2 bg-brand-primary text-white rounded-lg flex items-center gap-2 hover:bg-brand-secondary"
        >
          <Plus className="w-5 h-5" />
          发布公告
        </button>
      </div>

      {/* 公告列表 */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-12 text-text-secondary">加载中...</div>
        ) : !announcements?.data || announcements.data.length === 0 ? (
          <div className="text-center py-12 text-text-secondary">暂无公告</div>
        ) : (
          announcements.data.map((announcement) => (
            <div
              key={announcement.id}
              className="glass-card p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-bg-tertiary rounded-lg flex items-center justify-center shrink-0">
                    {getTypeIcon(announcement.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-white font-medium">{announcement.title}</h3>
                      {getTypeBadge(announcement.type)}
                      <span className={`px-2 py-1 rounded text-xs ${
                        announcement.status === 'published'
                          ? 'bg-success/10 text-success'
                          : 'bg-text-secondary/10 text-text-secondary'
                      }`}>
                        {announcement.status === 'published' ? '已发布' : '草稿'}
                      </span>
                    </div>
                    <p className="text-text-secondary text-sm line-clamp-2">
                      {announcement.content}
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-text-secondary">
                      {announcement.publishedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {announcement.publishedAt}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        {announcement.views} 次阅读
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleMutation.mutate(announcement.id)}
                    className="p-2 hover:bg-bg-tertiary rounded-lg"
                    title={announcement.status === 'published' ? '取消发布' : '发布'}
                  >
                    {announcement.status === 'published' ? (
                      <EyeOff className="w-5 h-5 text-text-secondary" />
                    ) : (
                      <Megaphone className="w-5 h-5 text-success" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setEditingAnnouncement(announcement);
                      setFormData({
                        title: announcement.title,
                        content: announcement.content,
                        type: announcement.type,
                      });
                      setShowEditor(true);
                    }}
                    className="p-2 hover:bg-bg-tertiary rounded-lg"
                    title="编辑"
                  >
                    <Edit className="w-5 h-5 text-brand-primary" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('确定删除此公告吗？')) {
                        deleteMutation.mutate(announcement.id);
                      }
                    }}
                    className="p-2 hover:bg-bg-tertiary rounded-lg"
                    title="删除"
                  >
                    <Trash2 className="w-5 h-5 text-danger" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 编辑弹窗 */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-secondary rounded-xl p-6 w-full max-w-2xl border border-border-primary">
            <h3 className="text-lg font-semibold text-white mb-4">
              {editingAnnouncement ? '编辑公告' : '发布公告'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-text-secondary text-sm mb-2">标题</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-secondary focus:outline-none focus:border-brand-primary"
                  placeholder="输入公告标题"
                />
              </div>
              <div>
                <label className="block text-text-secondary text-sm mb-2">类型</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none focus:border-brand-primary"
                >
                  <option value="info">通知</option>
                  <option value="warning">警告</option>
                  <option value="success">喜讯</option>
                </select>
              </div>
              <div>
                <label className="block text-text-secondary text-sm mb-2">内容</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-secondary focus:outline-none focus:border-brand-primary min-h-[150px]"
                  placeholder="输入公告内容"
                />
              </div>
            </div>
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => {
                  setShowEditor(false);
                  setFormData({ title: '', content: '', type: 'info' });
                  setEditingAnnouncement(null);
                }}
                className="flex-1 px-4 py-2 bg-bg-tertiary text-white rounded-lg hover:bg-bg-tertiary"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (!formData.title || !formData.content) {
                    alert('请填写完整信息');
                    return;
                  }
                  if (editingAnnouncement) {
                    updateMutation.mutate({ id: editingAnnouncement.id, data: formData });
                  } else {
                    createMutation.mutate(formData);
                  }
                }}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary disabled:opacity-50"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? '处理中...'
                  : editingAnnouncement
                  ? '保存'
                  : '发布'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
