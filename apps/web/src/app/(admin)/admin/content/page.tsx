'use client';

import { useState, useCallback } from 'react';
import {
  FileText,
  Megaphone,
  AlignLeft,
  HelpCircle,
  Scale,
  Languages,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Loader2,
  ArrowUp,
  ArrowDown,
  SendHorizonal,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AdminPageHeader,
  AdminSkeleton,
  AdminErrorState,
  AdminTable,
  AdminPagination,
  AdminSearchBar,
  AdminConfirmDialog,
  AdminTabs,
  AdminStatusBadge,
  AdminEmptyState,
  type AdminColumn,
} from '@/components/admin/shared';
import {
  useAdminApi,
  useAdminMutation,
  useAdminList,
} from '@/hooks/useAdminApi';
import { adminApi } from '@/lib/admin-auth';

// ─── 类型定义 ───────────────────────────────────────────────────

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: string;
  priority: number;
  status: string;
  createdAt: string;
}

interface Marquee {
  id: string;
  content: string;
  order: number;
  status: string;
  createdAt: string;
}

interface MarqueeConfig {
  speed: number;
  pause: number;
  duration: number;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  createdAt: string;
}

interface LegalDoc {
  id: string;
  title: string;
  content: string;
  type: string;
  updatedAt: string;
}

interface TranslateStatus {
  enabled: boolean;
  provider: string;
  totalTranslated: number;
}

// ─── 通用内容表单弹窗 ────────────────────────────────────────────

function ContentFormDialog<T extends { id?: string }>({
  open,
  onClose,
  title,
  fields,
  initial,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  fields: Array<{
    key: string;
    label: string;
    type?: 'text' | 'textarea' | 'select' | 'number';
    options?: Array<{ value: string; label: string }>;
    placeholder?: string;
  }>;
  initial: Record<string, string>;
  onSubmit: (form: Record<string, string>) => Promise<void>;
  loading: boolean;
}) {
  const [form, setForm] = useState<Record<string, string>>(initial);

  const handleSubmit = async () => {
    await onSubmit(form);
  };

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-white mb-4">{title}</h3>
        <div className="space-y-3">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="text-xs text-[#9090A0] mb-1 block">{field.label}</label>
              {field.type === 'textarea' ? (
                <textarea
                  value={form[field.key] ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  rows={4}
                  className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white placeholder-[#9090A0] focus:outline-none focus:border-cyan-500/50 resize-none"
                />
              ) : field.type === 'select' ? (
                <select
                  value={form[field.key] ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50"
                >
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type ?? 'text'}
                  value={form[field.key] ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white placeholder-[#9090A0] focus:outline-none focus:border-cyan-500/50"
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm text-[#9090A0] bg-[#1E1E2E] hover:bg-[#2A2A3A] rounded-lg transition-colors">取消</button>
          <button onClick={handleSubmit} disabled={loading} className="flex items-center gap-2 px-4 py-2 text-sm bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-lg transition-colors disabled:opacity-50">
            {loading && <Loader2 size={14} className="animate-spin" />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: 公告管理 ───────────────────────────────────────────────

function AnnouncementsTab() {
  const { items, total, page, totalPages, loading, error, setPage, setFilter, refetch } =
    useAdminList<Announcement>('/admin/content/announcements');
  const { mutate: doMutate, loading: actionLoading } = useAdminMutation({ onSuccess: refetch });

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Announcement | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);

  const handleSubmit = useCallback(async (form: Record<string, string>) => {
    if (editTarget) {
      await doMutate(`/admin/content/announcements/${editTarget.id}`, 'put', { title: form.title, content: form.content, type: form.type, priority: Number(form.priority) });
    } else {
      await doMutate('/admin/content/announcements', 'post', { title: form.title, content: form.content, type: form.type, priority: Number(form.priority) });
    }
    setShowForm(false);
    setEditTarget(undefined);
  }, [editTarget, doMutate]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await doMutate(`/admin/content/announcements/${deleteTarget.id}`, 'delete');
    setDeleteTarget(null);
  }, [deleteTarget, doMutate]);

  const handleRetranslate = useCallback(async (id: string) => {
    try {
      await adminApi.post(`/admin/content/announcements/${id}/retranslate`, {});
      toast.success('已触发重新翻译');
    } catch {
      toast.error('触发翻译失败');
    }
  }, []);

  const handleBatchStatus = useCallback(async (status: string) => {
    const ids = items.map((i) => i.id);
    if (!ids.length) { toast.error('当前无数据'); return; }
    await doMutate('/admin/content/announcements/batch-status', 'post', { ids, status });
  }, [items, doMutate]);

  const ANNOUNCEMENT_FORM_FIELDS = [
    { key: 'title', label: '标题', placeholder: '请输入公告标题' },
    { key: 'content', label: '内容', type: 'textarea' as const, placeholder: '请输入公告内容' },
    { key: 'type', label: '类型', type: 'select' as const, options: [{ value: 'notice', label: '通知' }, { value: 'warning', label: '警告' }, { value: 'update', label: '更新' }] },
    { key: 'priority', label: '优先级', type: 'number' as const, placeholder: '数字越大优先级越高' },
  ];

  const columns: AdminColumn<Announcement>[] = [
    { key: 'title', title: '标题', render: (r) => <span className="text-white font-medium line-clamp-1">{r.title}</span> },
    {
      key: 'type', title: '类型', align: 'center',
      render: (r) => {
        const TYPE_MAP: Record<string, string> = { notice: '通知', warning: '警告', update: '更新' };
        const TYPE_COLOR: Record<string, string> = { notice: 'bg-blue-500/10 text-blue-400', warning: 'bg-yellow-500/10 text-yellow-400', update: 'bg-cyan-500/10 text-cyan-400' };
        return <span className={`px-2 py-0.5 text-xs rounded-full ${TYPE_COLOR[r.type] ?? 'bg-[#1E1E2E] text-[#9090A0]'}`}>{TYPE_MAP[r.type] ?? r.type}</span>;
      },
    },
    { key: 'status', title: '状态', align: 'center', render: (r) => <AdminStatusBadge status={r.status} map={{ active: { label: '启用', color: 'bg-green-500/10 text-green-400 border-green-500/20' }, inactive: { label: '停用', color: 'bg-[#9090A0]/10 text-[#9090A0] border-[#9090A0]/20' } }} /> },
    { key: 'createdAt', title: '创建时间', align: 'center', render: (r) => <span className="text-[#9090A0] text-xs">{new Date(r.createdAt).toLocaleDateString('zh-CN')}</span> },
    {
      key: 'actions', title: '操作', align: 'center', width: '160px',
      render: (r) => (
        <div className="flex items-center justify-center gap-1">
          <button onClick={() => { setEditTarget(r); setShowForm(true); }} className="p-1.5 hover:bg-[#1E1E2E] rounded text-[#9090A0] hover:text-cyan-400 transition-colors" title="编辑"><Edit2 size={13} /></button>
          <button onClick={() => handleRetranslate(r.id)} className="p-1.5 hover:bg-[#1E1E2E] rounded text-[#9090A0] hover:text-purple-400 transition-colors" title="重新翻译"><Languages size={13} /></button>
          <button onClick={() => setDeleteTarget(r)} className="p-1.5 hover:bg-[#1E1E2E] rounded text-[#9090A0] hover:text-red-400 transition-colors" title="删除"><Trash2 size={13} /></button>
        </div>
      ),
    },
  ];

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <select onChange={(e) => setFilter('status', e.target.value)} className="px-3 py-2 bg-[#12121A] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none">
          <option value="">全部状态</option>
          <option value="active">启用</option>
          <option value="inactive">停用</option>
        </select>
        <div className="flex gap-2">
          <button onClick={() => handleBatchStatus('inactive')} className="px-3 py-2 text-xs bg-[#1E1E2E] hover:bg-[#2A2A3A] text-[#9090A0] hover:text-white rounded-lg transition-colors">批量停用</button>
          <button onClick={() => { setEditTarget(undefined); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm border border-cyan-500/20 rounded-lg transition-colors">
            <Plus size={14} />
            新增公告
          </button>
        </div>
      </div>

      <AdminTable<Announcement> columns={columns} data={items} rowKey="id" loading={loading} />
      <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      <ContentFormDialog
        open={showForm}
        onClose={() => { setShowForm(false); setEditTarget(undefined); }}
        title={editTarget ? '编辑公告' : '新增公告'}
        fields={ANNOUNCEMENT_FORM_FIELDS}
        initial={editTarget ? { title: editTarget.title, content: editTarget.content, type: editTarget.type, priority: String(editTarget.priority) } : { title: '', content: '', type: 'notice', priority: '0' }}
        onSubmit={handleSubmit}
        loading={actionLoading}
      />

      <AdminConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="删除公告"
        description={`确认删除公告「${deleteTarget?.title}」？此操作不可撤销。`}
        confirmText="确认删除"
        variant="danger"
        loading={actionLoading}
      />
    </div>
  );
}

// ─── Tab: 跑马灯 ─────────────────────────────────────────────────

function MarqueesTab() {
  const { items, total, page, totalPages, loading, error, setPage, refetch } =
    useAdminList<Marquee>('/admin/content/marquees');
  const { data: config, refetch: refetchConfig } = useAdminApi<MarqueeConfig>('/admin/content/marquees/config');
  const { mutate: doMutate, loading: actionLoading } = useAdminMutation({ onSuccess: refetch });

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Marquee | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Marquee | null>(null);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [configForm, setConfigForm] = useState({ speed: '', pause: '', duration: '' });
  const { mutate: saveConfig, loading: configSaving } = useAdminMutation({ onSuccess: refetchConfig });

  const openConfigEdit = () => {
    if (!config) return;
    setConfigForm({ speed: String(config.speed), pause: String(config.pause), duration: String(config.duration) });
    setShowConfigForm(true);
  };

  const handleReorder = useCallback(async (id: string, direction: 'up' | 'down') => {
    try {
      await adminApi.post(`/admin/content/marquees/${id}/reorder`, { direction });
      refetch();
    } catch {
      toast.error('排序失败');
    }
  }, [refetch]);

  const handleToggle = useCallback(async (marquee: Marquee) => {
    const newStatus = marquee.status === 'active' ? 'inactive' : 'active';
    await doMutate(`/admin/content/marquees/${marquee.id}`, 'put', { status: newStatus });
  }, [doMutate]);

  const handleRetranslate = useCallback(async (id: string) => {
    try {
      await adminApi.post(`/admin/content/marquees/${id}/retranslate`, {});
      toast.success('已触发重新翻译');
    } catch {
      toast.error('触发翻译失败');
    }
  }, []);

  const handleSubmit = useCallback(async (form: Record<string, string>) => {
    if (editTarget) {
      await doMutate(`/admin/content/marquees/${editTarget.id}`, 'put', { content: form.content, order: Number(form.order) });
    } else {
      await doMutate('/admin/content/marquees', 'post', { content: form.content, order: Number(form.order) });
    }
    setShowForm(false);
    setEditTarget(undefined);
  }, [editTarget, doMutate]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await doMutate(`/admin/content/marquees/${deleteTarget.id}`, 'delete');
    setDeleteTarget(null);
  }, [deleteTarget, doMutate]);

  const columns: AdminColumn<Marquee>[] = [
    { key: 'content', title: '内容', render: (r) => <span className="text-white text-sm line-clamp-1">{r.content}</span> },
    { key: 'order', title: '排序', align: 'center', width: '80px', render: (r) => <span className="text-[#9090A0]">{r.order}</span> },
    { key: 'status', title: '状态', align: 'center', render: (r) => <AdminStatusBadge status={r.status} map={{ active: { label: '启用', color: 'bg-green-500/10 text-green-400 border-green-500/20' }, inactive: { label: '停用', color: 'bg-[#9090A0]/10 text-[#9090A0] border-[#9090A0]/20' } }} /> },
    {
      key: 'actions', title: '操作', align: 'center', width: '180px',
      render: (r) => (
        <div className="flex items-center justify-center gap-1">
          <button onClick={() => handleReorder(r.id, 'up')} className="p-1.5 hover:bg-[#1E1E2E] rounded text-[#9090A0] hover:text-white transition-colors" title="上移"><ArrowUp size={13} /></button>
          <button onClick={() => handleReorder(r.id, 'down')} className="p-1.5 hover:bg-[#1E1E2E] rounded text-[#9090A0] hover:text-white transition-colors" title="下移"><ArrowDown size={13} /></button>
          <button onClick={() => handleToggle(r)} className={`p-1.5 hover:bg-[#1E1E2E] rounded transition-colors ${r.status === 'active' ? 'text-green-400' : 'text-[#9090A0]'}`} title="切换状态">
            {r.status === 'active' ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
          </button>
          <button onClick={() => { setEditTarget(r); setShowForm(true); }} className="p-1.5 hover:bg-[#1E1E2E] rounded text-[#9090A0] hover:text-cyan-400 transition-colors" title="编辑"><Edit2 size={13} /></button>
          <button onClick={() => handleRetranslate(r.id)} className="p-1.5 hover:bg-[#1E1E2E] rounded text-[#9090A0] hover:text-purple-400 transition-colors" title="重新翻译"><Languages size={13} /></button>
          <button onClick={() => setDeleteTarget(r)} className="p-1.5 hover:bg-[#1E1E2E] rounded text-[#9090A0] hover:text-red-400 transition-colors" title="删除"><Trash2 size={13} /></button>
        </div>
      ),
    },
  ];

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      {/* 全局配置卡片 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-white">全局配置</h4>
          <button onClick={openConfigEdit} className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
            <Edit2 size={11} /> 编辑
          </button>
        </div>
        {config ? (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: '滚动速度 (px/s)', value: config.speed },
              { label: '暂停时长 (ms)', value: config.pause },
              { label: '显示时长 (s)', value: config.duration },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-xs text-[#9090A0]">{item.label}</p>
                <p className="text-white font-mono mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#9090A0]">加载中...</p>
        )}
      </div>

      <div className="flex justify-end">
        <button onClick={() => { setEditTarget(undefined); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm border border-cyan-500/20 rounded-lg transition-colors">
          <Plus size={14} />
          新增跑马灯
        </button>
      </div>

      <AdminTable<Marquee> columns={columns} data={items} rowKey="id" loading={loading} />
      <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      {/* 编辑跑马灯 */}
      <ContentFormDialog
        open={showForm}
        onClose={() => { setShowForm(false); setEditTarget(undefined); }}
        title={editTarget ? '编辑跑马灯' : '新增跑马灯'}
        fields={[
          { key: 'content', label: '内容', type: 'textarea', placeholder: '请输入跑马灯内容' },
          { key: 'order', label: '排序', type: 'number', placeholder: '数字越小越靠前' },
        ]}
        initial={editTarget ? { content: editTarget.content, order: String(editTarget.order) } : { content: '', order: '0' }}
        onSubmit={handleSubmit}
        loading={actionLoading}
      />

      {/* 编辑全局配置弹窗 */}
      {showConfigForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowConfigForm(false)}>
          <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-white mb-4">编辑全局配置</h3>
            <div className="space-y-3">
              {[
                { key: 'speed', label: '滚动速度 (px/s)' },
                { key: 'pause', label: '暂停时长 (ms)' },
                { key: 'duration', label: '显示时长 (s)' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs text-[#9090A0] mb-1 block">{label}</label>
                  <input type="number" value={configForm[key as keyof typeof configForm]} onChange={(e) => setConfigForm((p) => ({ ...p, [key]: e.target.value }))} className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50" />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowConfigForm(false)} disabled={configSaving} className="px-4 py-2 text-sm text-[#9090A0] bg-[#1E1E2E] hover:bg-[#2A2A3A] rounded-lg transition-colors">取消</button>
              <button
                onClick={async () => {
                  await saveConfig('/admin/content/marquees/config', 'put', {
                    speed: Number(configForm.speed),
                    pause: Number(configForm.pause),
                    duration: Number(configForm.duration),
                  });
                  setShowConfigForm(false);
                }}
                disabled={configSaving}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-lg transition-colors disabled:opacity-50"
              >
                {configSaving && <Loader2 size={14} className="animate-spin" />}
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="删除跑马灯"
        description={`确认删除该条跑马灯内容？`}
        confirmText="确认删除"
        variant="danger"
        loading={actionLoading}
      />
    </div>
  );
}

// ─── Tab: FAQ ────────────────────────────────────────────────────

function FAQTab() {
  const { items, total, page, totalPages, loading, error, setPage, setFilter, refetch } =
    useAdminList<FAQ>('/admin/content/faq');
  const { mutate: doMutate, loading: actionLoading } = useAdminMutation({ onSuccess: refetch });

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<FAQ | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<FAQ | null>(null);

  const handleSubmit = useCallback(async (form: Record<string, string>) => {
    if (editTarget) {
      await doMutate(`/admin/content/faq/${editTarget.id}`, 'put', { question: form.question, answer: form.answer, category: form.category, order: Number(form.order) });
    } else {
      await doMutate('/admin/content/faq', 'post', { question: form.question, answer: form.answer, category: form.category, order: Number(form.order) });
    }
    setShowForm(false);
    setEditTarget(undefined);
  }, [editTarget, doMutate]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await doMutate(`/admin/content/faq/${deleteTarget.id}`, 'delete');
    setDeleteTarget(null);
  }, [deleteTarget, doMutate]);

  const handleReorder = useCallback(async (id: string, direction: 'up' | 'down') => {
    try {
      await adminApi.post(`/admin/content/faq/${id}/reorder`, { direction });
      refetch();
    } catch {
      toast.error('排序失败');
    }
  }, [refetch]);

  const handleRetranslate = useCallback(async (id: string) => {
    try {
      await adminApi.post(`/admin/content/faq/${id}/retranslate`, {});
      toast.success('已触发重新翻译');
    } catch {
      toast.error('触发翻译失败');
    }
  }, []);

  const FAQ_FORM_FIELDS = [
    { key: 'question', label: '问题', placeholder: '请输入问题' },
    { key: 'answer', label: '答案', type: 'textarea' as const, placeholder: '请输入详细答案' },
    { key: 'category', label: '分类', placeholder: '例如：账户、交易、充值' },
    { key: 'order', label: '排序', type: 'number' as const, placeholder: '数字越小越靠前' },
  ];

  const columns: AdminColumn<FAQ>[] = [
    { key: 'question', title: '问题', render: (r) => <span className="text-white text-sm line-clamp-1">{r.question}</span> },
    { key: 'category', title: '分类', align: 'center', render: (r) => <span className="px-2 py-0.5 bg-[#1E1E2E] text-[#9090A0] text-xs rounded-full">{r.category || '-'}</span> },
    { key: 'order', title: '排序', align: 'center', width: '80px', render: (r) => <span className="text-[#9090A0]">{r.order}</span> },
    {
      key: 'actions', title: '操作', align: 'center', width: '180px',
      render: (r) => (
        <div className="flex items-center justify-center gap-1">
          <button onClick={() => handleReorder(r.id, 'up')} className="p-1.5 hover:bg-[#1E1E2E] rounded text-[#9090A0] hover:text-white transition-colors" title="上移"><ArrowUp size={13} /></button>
          <button onClick={() => handleReorder(r.id, 'down')} className="p-1.5 hover:bg-[#1E1E2E] rounded text-[#9090A0] hover:text-white transition-colors" title="下移"><ArrowDown size={13} /></button>
          <button onClick={() => { setEditTarget(r); setShowForm(true); }} className="p-1.5 hover:bg-[#1E1E2E] rounded text-[#9090A0] hover:text-cyan-400 transition-colors" title="编辑"><Edit2 size={13} /></button>
          <button onClick={() => handleRetranslate(r.id)} className="p-1.5 hover:bg-[#1E1E2E] rounded text-[#9090A0] hover:text-purple-400 transition-colors" title="重新翻译"><Languages size={13} /></button>
          <button onClick={() => setDeleteTarget(r)} className="p-1.5 hover:bg-[#1E1E2E] rounded text-[#9090A0] hover:text-red-400 transition-colors" title="删除"><Trash2 size={13} /></button>
        </div>
      ),
    },
  ];

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <select onChange={(e) => setFilter('category', e.target.value)} className="px-3 py-2 bg-[#12121A] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none">
          <option value="">全部分类</option>
          <option value="账户">账户</option>
          <option value="交易">交易</option>
          <option value="充值">充值</option>
          <option value="提现">提现</option>
        </select>
        <button onClick={() => { setEditTarget(undefined); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm border border-cyan-500/20 rounded-lg transition-colors">
          <Plus size={14} />
          新增 FAQ
        </button>
      </div>

      <AdminTable<FAQ> columns={columns} data={items} rowKey="id" loading={loading} />
      <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      <ContentFormDialog
        open={showForm}
        onClose={() => { setShowForm(false); setEditTarget(undefined); }}
        title={editTarget ? '编辑 FAQ' : '新增 FAQ'}
        fields={FAQ_FORM_FIELDS}
        initial={editTarget ? { question: editTarget.question, answer: editTarget.answer, category: editTarget.category, order: String(editTarget.order) } : { question: '', answer: '', category: '', order: '0' }}
        onSubmit={handleSubmit}
        loading={actionLoading}
      />

      <AdminConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="删除 FAQ"
        description={`确认删除「${deleteTarget?.question}」？`}
        confirmText="确认删除"
        variant="danger"
        loading={actionLoading}
      />
    </div>
  );
}

// ─── Tab: 法律文档 ───────────────────────────────────────────────

function LegalTab() {
  const { items, total, page, totalPages, loading, error, setPage, refetch } =
    useAdminList<LegalDoc>('/admin/content/legal');
  const { mutate: doMutate, loading: actionLoading } = useAdminMutation({ onSuccess: refetch });

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<LegalDoc | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<LegalDoc | null>(null);

  const handleSubmit = useCallback(async (form: Record<string, string>) => {
    if (editTarget) {
      await doMutate(`/admin/content/legal/${editTarget.id}`, 'put', { title: form.title, content: form.content, type: form.type });
    } else {
      await doMutate('/admin/content/legal', 'post', { title: form.title, content: form.content, type: form.type });
    }
    setShowForm(false);
    setEditTarget(undefined);
  }, [editTarget, doMutate]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await doMutate(`/admin/content/legal/${deleteTarget.id}`, 'delete');
    setDeleteTarget(null);
  }, [deleteTarget, doMutate]);

  const handleRetranslate = useCallback(async (id: string) => {
    try {
      await adminApi.post(`/admin/content/legal/${id}/retranslate`, {});
      toast.success('已触发重新翻译');
    } catch {
      toast.error('触发翻译失败');
    }
  }, []);

  const LEGAL_TYPES: Record<string, string> = { privacy: '隐私政策', terms: '使用条款', risk: '风险披露', aml: '反洗钱政策' };

  const columns: AdminColumn<LegalDoc>[] = [
    { key: 'title', title: '标题', render: (r) => <span className="text-white font-medium">{r.title}</span> },
    { key: 'type', title: '类型', align: 'center', render: (r) => <span className="px-2 py-0.5 bg-[#1E1E2E] text-[#9090A0] text-xs rounded-full">{LEGAL_TYPES[r.type] ?? r.type}</span> },
    { key: 'updatedAt', title: '更新时间', align: 'center', render: (r) => <span className="text-[#9090A0] text-xs">{new Date(r.updatedAt).toLocaleDateString('zh-CN')}</span> },
    {
      key: 'actions', title: '操作', align: 'center', width: '140px',
      render: (r) => (
        <div className="flex items-center justify-center gap-1">
          <button onClick={() => { setEditTarget(r); setShowForm(true); }} className="p-1.5 hover:bg-[#1E1E2E] rounded text-[#9090A0] hover:text-cyan-400 transition-colors" title="编辑"><Edit2 size={13} /></button>
          <button onClick={() => handleRetranslate(r.id)} className="p-1.5 hover:bg-[#1E1E2E] rounded text-[#9090A0] hover:text-purple-400 transition-colors" title="重新翻译"><Languages size={13} /></button>
          <button onClick={() => setDeleteTarget(r)} className="p-1.5 hover:bg-[#1E1E2E] rounded text-[#9090A0] hover:text-red-400 transition-colors" title="删除"><Trash2 size={13} /></button>
        </div>
      ),
    },
  ];

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setEditTarget(undefined); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm border border-cyan-500/20 rounded-lg transition-colors">
          <Plus size={14} />
          新增文档
        </button>
      </div>

      <AdminTable<LegalDoc> columns={columns} data={items} rowKey="id" loading={loading} />
      <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      <ContentFormDialog
        open={showForm}
        onClose={() => { setShowForm(false); setEditTarget(undefined); }}
        title={editTarget ? '编辑法律文档' : '新增法律文档'}
        fields={[
          { key: 'title', label: '标题', placeholder: '请输入文档标题' },
          { key: 'type', label: '类型', type: 'select', options: Object.entries(LEGAL_TYPES).map(([v, l]) => ({ value: v, label: l })) },
          { key: 'content', label: '内容 (Markdown)', type: 'textarea', placeholder: '支持 Markdown 格式' },
        ]}
        initial={editTarget ? { title: editTarget.title, content: editTarget.content, type: editTarget.type } : { title: '', content: '', type: 'privacy' }}
        onSubmit={handleSubmit}
        loading={actionLoading}
      />

      <AdminConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="删除法律文档"
        description={`确认删除「${deleteTarget?.title}」？`}
        confirmText="确认删除"
        variant="danger"
        loading={actionLoading}
      />
    </div>
  );
}

// ─── Tab: 翻译服务 ───────────────────────────────────────────────

function TranslateTab() {
  const { data: status, loading, error, refetch } = useAdminApi<TranslateStatus>('/admin/content/translate-status');
  const { data: enabledData, refetch: refetchEnabled } = useAdminApi<{ enabled: boolean }>('/admin/content/translate-enabled');
  const { mutate: doMutate, loading: toggling } = useAdminMutation({ onSuccess: () => { refetch(); refetchEnabled(); } });

  const [previewInput, setPreviewInput] = useState('');
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handleToggle = useCallback(async () => {
    const newEnabled = !(enabledData?.enabled ?? false);
    await doMutate('/admin/content/translate-enabled', 'put', { enabled: newEnabled });
  }, [enabledData, doMutate]);

  const handlePreview = useCallback(async () => {
    if (!previewInput.trim()) { toast.error('请输入测试内容'); return; }
    setPreviewLoading(true);
    try {
      const res = await adminApi.post<{ result: string }>('/admin/content/translate-preview', { text: previewInput });
      setPreviewResult(res.data.result);
    } catch {
      toast.error('翻译预览失败');
    } finally {
      setPreviewLoading(false);
    }
  }, [previewInput]);

  if (loading) return <AdminSkeleton mode="detail" count={4} />;
  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  const isEnabled = enabledData?.enabled ?? false;

  return (
    <div className="space-y-5">
      {/* 服务状态卡 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-white">翻译服务状态</h4>
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors disabled:opacity-50 ${
              isEnabled
                ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
                : 'bg-[#1E1E2E] text-[#9090A0] border-[#1E1E2E] hover:bg-[#2A2A3A] hover:text-white'
            }`}
          >
            {toggling ? <Loader2 size={14} className="animate-spin" /> : isEnabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
            {isEnabled ? '已启用' : '已停用'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-[#9090A0] mb-1">翻译提供商</p>
            <p className="text-white font-medium">{status?.provider ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs text-[#9090A0] mb-1">已翻译条目</p>
            <p className="text-white font-mono">{(status?.totalTranslated ?? 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-[#9090A0] mb-1">服务状态</p>
            <AdminStatusBadge status={isEnabled ? 'running' : 'stopped'} />
          </div>
        </div>
      </div>

      {/* 翻译预览测试 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5">
        <h4 className="text-sm font-semibold text-white mb-4">翻译预览测试</h4>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[#9090A0] mb-1 block">测试内容</label>
            <div className="flex gap-2">
              <input
                value={previewInput}
                onChange={(e) => setPreviewInput(e.target.value)}
                placeholder="输入要翻译的中文内容..."
                onKeyDown={(e) => { if (e.key === 'Enter') handlePreview(); }}
                className="flex-1 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white placeholder-[#9090A0] focus:outline-none focus:border-cyan-500/50"
              />
              <button
                onClick={handlePreview}
                disabled={previewLoading || !isEnabled}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm border border-cyan-500/20 rounded-lg transition-colors disabled:opacity-50"
                title={!isEnabled ? '请先启用翻译服务' : undefined}
              >
                {previewLoading ? <Loader2 size={14} className="animate-spin" /> : <SendHorizonal size={14} />}
                测试翻译
              </button>
            </div>
          </div>

          {previewResult !== null && (
            <div>
              <label className="text-xs text-[#9090A0] mb-1 block">翻译结果（EN）</label>
              <div className="px-3 py-2 bg-[#0A0A0F] border border-cyan-500/20 rounded-lg text-sm text-cyan-300 min-h-[40px]">
                {previewResult}
              </div>
            </div>
          )}
        </div>

        {!isEnabled && (
          <p className="mt-3 text-xs text-yellow-400">翻译服务未启用，测试翻译功能不可用</p>
        )}
      </div>
    </div>
  );
}

// ─── 主页面 ──────────────────────────────────────────────────────

const TABS = [
  { key: 'announcements', label: '公告管理', icon: Megaphone },
  { key: 'marquees', label: '跑马灯', icon: AlignLeft },
  { key: 'faq', label: 'FAQ', icon: HelpCircle },
  { key: 'legal', label: '法律文档', icon: Scale },
  { key: 'translate', label: '翻译服务', icon: Languages },
];

export default function AdminContentPage() {
  const [activeTab, setActiveTab] = useState('announcements');

  return (
    <div className="p-6 space-y-5">
      <AdminPageHeader
        title="内容管理"
        icon={FileText}
        subtitle="管理平台公告、跑马灯、FAQ、法律文档与翻译服务"
      />

      <AdminTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      <div>
        {activeTab === 'announcements' && <AnnouncementsTab />}
        {activeTab === 'marquees' && <MarqueesTab />}
        {activeTab === 'faq' && <FAQTab />}
        {activeTab === 'legal' && <LegalTab />}
        {activeTab === 'translate' && <TranslateTab />}
      </div>
    </div>
  );
}
