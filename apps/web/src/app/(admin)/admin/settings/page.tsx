'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Globe,
  Sliders,
  ShieldCheck,
  Monitor,
  Lock,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  Star,
  Cpu,
  HardDrive,
  Database,
  Clock,
  KeyRound,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AdminPageHeader,
  AdminSkeleton,
  AdminErrorState,
  AdminTable,
  AdminPagination,
  AdminStatCard,
  AdminSearchBar,
  AdminConfirmDialog,
  AdminTabs,
  AdminStatusBadge,
  AdminColumn,
} from '@/components/admin/shared';
import { useAdminApi, useAdminList, useAdminMutation } from '@/hooks/useAdminApi';
import { adminApi, useAdminAuth } from '@/lib/admin-auth';

// ─────────────────────────── 类型 ───────────────────────────

interface ExchangeStats {
  total: number;
  active: number;
  supported: number;
  comingSoon: number;
}

interface ExchangeItem {
  id: string;
  slug: string;
  name: string;
  logo: string;
  description: string;
  features: string[];
  affiliateUrl: string;
  status: string;   // supported | coming_soon
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ConfigHistoryItem {
  id: string;
  key: string;
  oldValue: string;
  newValue: string;
  operator: string;
  createdAt: string;
}

interface AdminItem {
  id: string;
  username: string;
  email: string;
  role: string;
  totpEnabled: boolean;
  lastLoginAt?: string | null;
  lastLoginIp?: string | null;
  createdAt: string;
}

interface MonitorData {
  cpu: number;
  memory: { used: number; total: number; percent: number };
  disk: { used: number; total: number; percent: number };
  dbConnections: number;
  redisConnected: boolean;
  uptime: number;
}

interface SecurityStatus {
  totpEnabled: boolean;
  lastPasswordChange: string | null;
}

// ─────────────────────────── Tab 1: 交易所管理 ───────────────────────────

function ExchangeFormDialog({
  exchange,
  onClose,
  onSaved,
}: {
  exchange?: ExchangeItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!exchange;
  const [form, setForm] = useState({
    slug: exchange?.slug ?? '',
    name: exchange?.name ?? '',
    logo: exchange?.logo ?? '',
    description: exchange?.description ?? '',
    features: exchange?.features?.join(', ') ?? '',
    affiliateUrl: exchange?.affiliateUrl ?? '',
    status: exchange?.status ?? 'supported',
    sortOrder: String(exchange?.sortOrder ?? 100),
    isActive: exchange?.isActive !== undefined ? exchange.isActive : true,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.slug.trim()) { toast.error('请填写 Slug'); return; }
    if (!form.name.trim()) { toast.error('请填写交易所名称'); return; }
    const features = form.features.split(',').map((f) => f.trim()).filter(Boolean);
    const payload = {
      slug: form.slug.trim(),
      name: form.name.trim(),
      logo: form.logo.trim(),
      description: form.description.trim(),
      features,
      affiliateUrl: form.affiliateUrl.trim(),
      status: form.status,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
    };
    setSubmitting(true);
    try {
      if (isEdit) {
        await adminApi.put(`/admin/exchanges/${exchange!.id}`, payload);
      } else {
        await adminApi.post('/admin/exchanges', payload);
      }
      toast.success(isEdit ? '更新成功' : '创建成功');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white placeholder-[#9090A0] focus:outline-none focus:border-cyan-500/50';

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E1E2E]">
          <h3 className="text-base font-semibold text-white">{isEdit ? '编辑交易所' : '新增交易所'}</h3>
          <button onClick={onClose} className="text-[#9090A0] hover:text-white transition-colors"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#9090A0] mb-1">Slug <span className="text-red-400">*</span></label>
              <input className={inputCls} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="binance" />
              <p className="text-xs text-[#9090A0] mt-1">唯一标识，如: binance, okx</p>
            </div>
            <div>
              <label className="block text-xs text-[#9090A0] mb-1">名称 <span className="text-red-400">*</span></label>
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="币安" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#9090A0] mb-1">Logo 地址</label>
            <input className={inputCls} value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} placeholder="https://example.com/logo.png" />
          </div>
          <div>
            <label className="block text-xs text-[#9090A0] mb-1">描述</label>
            <textarea className={`${inputCls} resize-none h-16`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="全球最大的加密货币交易所..." />
          </div>
          <div>
            <label className="block text-xs text-[#9090A0] mb-1">特性标签</label>
            <input className={inputCls} value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} placeholder="现货, 合约, 杠杆（逗号分隔）" />
          </div>
          <div>
            <label className="block text-xs text-[#9090A0] mb-1">推广链接</label>
            <input className={inputCls} value={form.affiliateUrl} onChange={(e) => setForm({ ...form, affiliateUrl: e.target.value })} placeholder="https://www.binance.com/register?ref=..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#9090A0] mb-1">状态</label>
              <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="supported">已上线</option>
                <option value="coming_soon">即将上线</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#9090A0] mb-1">排序（越小越靠前）</label>
              <input type="number" className={inputCls} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} min="0" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-[#9090A0]">是否启用</label>
            <button type="button" onClick={() => setForm({ ...form, isActive: !form.isActive })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.isActive ? 'bg-cyan-500' : 'bg-[#1E1E2E]'}`}>
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${form.isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-xs text-white">{form.isActive ? '显示' : '隐藏'}</span>
          </div>
        </div>
        <div className="flex gap-2 px-6 pb-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm text-[#9090A0] bg-[#1E1E2E] hover:bg-[#2A2A3A] rounded-lg transition-colors">取消</button>
          <button onClick={handleSubmit} disabled={submitting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-lg transition-colors disabled:opacity-50">
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? '保存' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExchangeTab() {
  const { data: stats, loading: statsLoading } = useAdminApi<ExchangeStats>('/admin/exchanges/stats');
  const { items, total, page, totalPages, loading, error, search, setPage, setSearch, refetch } =
    useAdminList<ExchangeItem>('/admin/exchanges');
  const { mutate, loading: mutLoading } = useAdminMutation({ onSuccess: refetch });

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ExchangeItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExchangeItem | null>(null);
  const [detailTarget, setDetailTarget] = useState<ExchangeItem | null>(null);

  const statusMap = {
    supported: { label: '已上线', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
    coming_soon: { label: '即将上线', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  };

  const columns: AdminColumn<ExchangeItem>[] = [
    {
      key: 'name', title: '名称 / Slug',
      render: (row) => (
        <div>
          <div className="font-medium text-white">{row.name}</div>
          <div className="text-xs text-[#9090A0] font-mono">{row.slug}</div>
        </div>
      ),
    },
    {
      key: 'description', title: '描述',
      render: (row) => <span className="text-sm text-[#9090A0] line-clamp-1">{row.description || '—'}</span>,
    },
    {
      key: 'features', title: '特性',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {(row.features ?? []).slice(0, 3).map((f) => (
            <span key={f} className="px-1.5 py-0.5 bg-[#1E1E2E] text-[#9090A0] text-xs rounded-full">{f}</span>
          ))}
          {(row.features ?? []).length > 3 && <span className="text-xs text-[#9090A0]">+{row.features.length - 3}</span>}
        </div>
      ),
    },
    { key: 'status', title: '状态', align: 'center', width: '110px', render: (row) => <AdminStatusBadge status={row.status} map={statusMap} /> },
    { key: 'sortOrder', title: '排序', align: 'center', width: '60px', render: (row) => <span className="text-sm text-[#9090A0]">{row.sortOrder}</span> },
    { key: 'isActive', title: '启用', align: 'center', width: '60px', render: (row) => <span className={`text-xs ${row.isActive ? 'text-green-400' : 'text-[#9090A0]'}`}>{row.isActive ? '是' : '否'}</span> },
    {
      key: 'actions', title: '操作', align: 'center', width: '100px',
      render: (row) => (
        <div className="flex items-center justify-center gap-1">
          <button onClick={() => setDetailTarget(row)} className="p-1.5 rounded hover:bg-[#1E1E2E] text-[#9090A0] hover:text-white transition-colors" title="详情"><Eye size={14} /></button>
          <button onClick={() => { setEditTarget(row); setFormOpen(true); }} className="p-1.5 rounded hover:bg-[#1E1E2E] text-[#9090A0] hover:text-cyan-400 transition-colors" title="编辑"><Pencil size={14} /></button>
          <button onClick={() => setDeleteTarget(row)} className="p-1.5 rounded hover:bg-red-500/10 text-[#9090A0] hover:text-red-400 transition-colors" title="删除"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ];

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      {statsLoading ? <AdminSkeleton mode="grid" count={4} cols={4} /> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <AdminStatCard title="总交易所" value={stats?.total ?? '-'} icon={Globe} color="bg-blue-500/20 text-blue-400" />
          <AdminStatCard title="已启用" value={stats?.active ?? '-'} icon={Star} color="bg-green-500/20 text-green-400" />
          <AdminStatCard title="已上线" value={stats?.supported ?? '-'} icon={Globe} color="bg-cyan-500/20 text-cyan-400" />
          <AdminStatCard title="即将上线" value={stats?.comingSoon ?? '-'} icon={Clock} color="bg-yellow-500/20 text-yellow-400" />
        </div>
      )}

      {/* 搜索 + 新增 */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <AdminSearchBar value={search} onChange={setSearch} onSearch={refetch} placeholder="搜索交易所名称..." />
        </div>
        <button onClick={() => { setEditTarget(null); setFormOpen(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm rounded-lg border border-cyan-500/20 transition-colors whitespace-nowrap">
          <Plus size={14} />新增
        </button>
      </div>

      {loading && !items.length ? <AdminSkeleton mode="table" count={6} /> : (
        <>
          <AdminTable<ExchangeItem> columns={columns} data={items} rowKey="id" loading={loading} />
          <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </>
      )}

      {/* 表单弹窗 */}
      {formOpen && <ExchangeFormDialog exchange={editTarget} onClose={() => { setFormOpen(false); setEditTarget(null); }} onSaved={refetch} />}

      {/* 详情弹窗 */}
      {detailTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setDetailTarget(null)}>
          <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E1E2E]">
              <h3 className="text-base font-semibold text-white">交易所详情</h3>
              <button onClick={() => setDetailTarget(null)} className="text-[#9090A0] hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-2 text-sm">
              {[
                ['Slug', detailTarget.slug],
                ['名称', detailTarget.name],
                ['状态', detailTarget.status === 'supported' ? '已上线' : '即将上线'],
                ['排序', String(detailTarget.sortOrder)],
                ['启用', detailTarget.isActive ? '是' : '否'],
                ['推广链接', detailTarget.affiliateUrl || '—'],
                ['创建时间', new Date(detailTarget.createdAt).toLocaleString('zh-CN')],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3"><span className="w-20 text-[#9090A0] shrink-0">{k}</span><span className="text-white break-all">{v}</span></div>
              ))}
              {detailTarget.description && (
                <div className="flex gap-3"><span className="w-20 text-[#9090A0] shrink-0">描述</span><span className="text-white">{detailTarget.description}</span></div>
              )}
              {(detailTarget.features ?? []).length > 0 && (
                <div className="flex gap-3 flex-wrap pt-1">
                  <span className="w-20 text-[#9090A0] shrink-0">特性</span>
                  <div className="flex flex-wrap gap-1">
                    {detailTarget.features.map((f) => <span key={f} className="px-1.5 py-0.5 bg-[#1E1E2E] text-[#9090A0] text-xs rounded-full">{f}</span>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 删除确认 */}
      <AdminConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { if (deleteTarget) { await mutate(`/admin/exchanges/${deleteTarget.id}`, 'delete'); setDeleteTarget(null); } }}
        title="删除交易所"
        description={`确认删除「${deleteTarget?.name}」？此操作不可撤销。`}
        confirmText="删除"
        variant="danger"
        loading={mutLoading}
      />
    </div>
  );
}

// ─────────────────────────── Tab 2: 系统配置 ───────────────────────────

function ConfigTab() {
  const { items, total, page, totalPages, loading, error, refetch } =
    useAdminList<ConfigHistoryItem>('/admin/config-history', { defaultLimit: 15 });

  const [configKey, setConfigKey] = useState('');
  const [configValue, setConfigValue] = useState('');
  const [queryResult, setQueryResult] = useState<string | null>(null);
  const [querying, setQuerying] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleQuery = async () => {
    if (!configKey.trim()) { toast.error('请输入配置项 Key'); return; }
    setQuerying(true);
    try {
      const res = await adminApi.get<{ value: string }>(`/admin/config/${configKey.trim()}`);
      setQueryResult(String(res.data?.value ?? '(空)'));
      setConfigValue(String(res.data?.value ?? ''));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '查询失败');
      setQueryResult(null);
    } finally {
      setQuerying(false);
    }
  };

  const handleSave = async () => {
    if (!configKey.trim()) { toast.error('请输入配置项 Key'); return; }
    setSaving(true);
    try {
      await adminApi.put(`/admin/config/${configKey.trim()}`, { value: configValue });
      toast.success('配置已更新');
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const historyColumns: AdminColumn<ConfigHistoryItem>[] = [
    { key: 'key', title: '配置项', render: (row) => <span className="font-mono text-cyan-400 text-xs">{row.key}</span> },
    {
      key: 'oldValue', title: '旧值',
      render: (row) => {
        const v = row.oldValue || '-';
        return (
          <span className="text-[#9090A0] text-xs font-mono cursor-default" title={v}>
            {v.length > 30 ? v.slice(0, 30) + '…' : v}
          </span>
        );
      },
    },
    {
      key: 'newValue', title: '新值',
      render: (row) => {
        const v = row.newValue || '';
        return (
          <span className="text-white text-xs font-mono cursor-default" title={v}>
            {v.length > 30 ? v.slice(0, 30) + '…' : v}
          </span>
        );
      },
    },
    { key: 'operator', title: '操作人', render: (row) => <span className="text-[#9090A0] text-xs">{row.operator}</span> },
    { key: 'createdAt', title: '时间', align: 'right', render: (row) => <span className="text-[#9090A0] text-xs">{new Date(row.createdAt).toLocaleString('zh-CN')}</span> },
  ];

  const inputCls = 'w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white placeholder-[#9090A0] focus:outline-none focus:border-cyan-500/50';

  return (
    <div className="space-y-6">
      {/* 单项配置查询与设置 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5 space-y-4">
        <p className="text-sm font-medium text-white">配置项读写</p>
        <div className="flex gap-2">
          <input className={`flex-1 ${inputCls}`} value={configKey} onChange={(e) => setConfigKey(e.target.value)} placeholder="配置 Key，例如 platform.fee_rate" onKeyDown={(e) => e.key === 'Enter' && handleQuery()} />
          <button onClick={handleQuery} disabled={querying} className="flex items-center gap-1.5 px-4 py-2 bg-[#1E1E2E] hover:bg-[#2A2A3A] text-[#9090A0] hover:text-white text-sm rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap">
            {querying ? <Loader2 size={14} className="animate-spin" /> : null}查询
          </button>
        </div>
        {queryResult !== null && (
          <div className="space-y-2">
            <p className="text-xs text-[#9090A0]">当前值: <span className="text-white font-mono">{queryResult}</span></p>
            <div className="flex gap-2">
              <input className={`flex-1 ${inputCls}`} value={configValue} onChange={(e) => setConfigValue(e.target.value)} placeholder="新值" />
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm rounded-lg border border-cyan-500/20 transition-colors disabled:opacity-50 whitespace-nowrap">
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}保存
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 变更历史 */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-white">变更历史</p>
        {error ? <AdminErrorState message={error} onRetry={refetch} /> : loading && !items.length ? (
          <AdminSkeleton mode="table" count={6} />
        ) : (
          <>
            <AdminTable<ConfigHistoryItem> columns={historyColumns} data={items} rowKey="id" loading={loading} />
            <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={() => {}} />
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── Tab 3: 管理员管理 ───────────────────────────

function AdminsTab() {
  const { items, total, page, totalPages, loading, error, refetch } =
    useAdminList<AdminItem>('/admin/auth/admins');
  const { mutate, loading: mutLoading } = useAdminMutation({ onSuccess: refetch });

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'admin' });
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetTarget, setResetTarget] = useState<AdminItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleCreate = async () => {
    if (!form.username || !form.email || !form.password) { toast.error('请填写所有必填字段'); return; }
    setSubmitting(true);
    try {
      await adminApi.post('/admin/auth/admins', form);
      toast.success('管理员创建成功');
      setCreateOpen(false);
      setForm({ username: '', email: '', password: '', role: 'admin' });
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || !newPassword.trim()) { toast.error('请输入新密码'); return; }
    setResetLoading(true);
    try {
      await adminApi.post(`/admin/auth/admins/${resetTarget.id}/reset-password`, { newPassword: newPassword.trim() });
      toast.success('密码重置成功');
      setResetTarget(null);
      setNewPassword('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '重置失败');
    } finally {
      setResetLoading(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white placeholder-[#9090A0] focus:outline-none focus:border-cyan-500/50';

  const columns: AdminColumn<AdminItem>[] = [
    { key: 'username', title: '用户名', render: (row) => <span className="font-medium text-white">{row.username}</span> },
    { key: 'email', title: '邮箱', render: (row) => <span className="text-[#9090A0] text-sm">{row.email}</span> },
    { key: 'role', title: '角色', align: 'center', render: (row) => <AdminStatusBadge status={row.role} map={{ admin: { label: '管理员', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' }, super_admin: { label: '超级管理员', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' } }} /> },
    { key: 'totp', title: '两步验证', align: 'center', render: (row) => <AdminStatusBadge status={row.totpEnabled ? 'enabled' : 'disabled'} map={{ enabled: { label: '已启用', color: 'bg-green-500/10 text-green-400 border-green-500/20' }, disabled: { label: '未启用', color: 'bg-[#9090A0]/10 text-[#9090A0] border-[#9090A0]/20' } }} /> },
    {
      key: 'lastLogin', title: '最后登录', width: '160px',
      render: (row) => (
        <div>
          <div className="text-xs text-[#9090A0]">
            {row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '从未登录'}
          </div>
          {row.lastLoginIp && <div className="text-xs text-[#4A4A5A] font-mono">{row.lastLoginIp}</div>}
        </div>
      ),
    },
    { key: 'createdAt', title: '创建时间', align: 'right', width: '100px', render: (row) => <span className="text-[#9090A0] text-xs">{new Date(row.createdAt).toLocaleDateString('zh-CN')}</span> },
    {
      key: 'actions', title: '操作', align: 'center', width: '90px',
      render: (row) => (
        <button
          onClick={() => { setResetTarget(row); setNewPassword(''); }}
          className="flex items-center gap-1 px-2 py-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs rounded border border-orange-500/20 transition-colors"
        >
          <KeyRound size={10} />重置密码
        </button>
      ),
    },
  ];

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm rounded-lg border border-cyan-500/20 transition-colors">
          <Plus size={14} />新增管理员
        </button>
      </div>

      {loading && !items.length ? <AdminSkeleton mode="table" count={5} /> : (
        <>
          <AdminTable<AdminItem> columns={columns} data={items} rowKey="id" loading={loading} />
          <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={() => {}} />
        </>
      )}

      {/* 新增弹窗 */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setCreateOpen(false)}>
          <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E1E2E]">
              <h3 className="text-base font-semibold text-white">新增管理员</h3>
              <button onClick={() => setCreateOpen(false)} className="text-[#9090A0] hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-3">
              <div><label className="block text-xs text-[#9090A0] mb-1">用户名</label><input className={inputCls} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="admin_username" /></div>
              <div><label className="block text-xs text-[#9090A0] mb-1">邮箱</label><input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="admin@hoot.ai" /></div>
              <div>
                <label className="block text-xs text-[#9090A0] mb-1">密码</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} className={`${inputCls} pr-10`} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="至少 8 位" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9090A0] hover:text-white transition-colors">{showPwd ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#9090A0] mb-1">角色</label>
                <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="admin">管理员</option>
                  <option value="super_admin">超级管理员</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 px-6 pb-6">
              <button onClick={() => setCreateOpen(false)} className="flex-1 px-4 py-2 text-sm text-[#9090A0] bg-[#1E1E2E] hover:bg-[#2A2A3A] rounded-lg transition-colors">取消</button>
              <button onClick={handleCreate} disabled={submitting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-lg transition-colors disabled:opacity-50">
                {submitting && <Loader2 size={14} className="animate-spin" />}创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 重置密码弹窗 */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setResetTarget(null)}>
          <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E1E2E]">
              <h3 className="text-base font-semibold text-white">重置管理员密码</h3>
              <button onClick={() => setResetTarget(null)} className="text-[#9090A0] hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-[#9090A0]">为 <span className="text-white font-medium">{resetTarget.username}</span> 重置密码</p>
              <div>
                <label className="block text-xs text-[#9090A0] mb-1">新密码</label>
                <input
                  type="password"
                  className={inputCls}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="至少 8 位"
                />
              </div>
            </div>
            <div className="flex gap-2 px-6 pb-6">
              <button onClick={() => setResetTarget(null)} className="flex-1 px-4 py-2 text-sm text-[#9090A0] bg-[#1E1E2E] hover:bg-[#2A2A3A] rounded-lg transition-colors">取消</button>
              <button onClick={handleResetPassword} disabled={resetLoading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 rounded-lg transition-colors disabled:opacity-50">
                {resetLoading && <Loader2 size={14} className="animate-spin" />}确认重置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Tab 4: 系统监控 ───────────────────────────

function MonitorTab() {
  const { data, loading, error, refetch } = useAdminApi<MonitorData>('/admin/monitor');
  const [rawOpen, setRawOpen] = useState(false);

  // 自动刷新 30s
  useEffect(() => {
    const id = setInterval(refetch, 30_000);
    return () => clearInterval(id);
  }, [refetch]);

  const fmtUptime = (s: number) => {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${d}天 ${h}小时 ${m}分`;
  };

  const fmtMB = (mb: number) => mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;

  if (loading && !data) return <AdminSkeleton mode="grid" count={6} cols={3} />;
  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  const cards = [
    { title: 'CPU 使用率', value: `${data?.cpu ?? 0}%`, icon: Cpu, color: 'bg-blue-500/20 text-blue-400', sub: '实时' },
    { title: '内存使用', value: data ? `${fmtMB(data.memory.used)} / ${fmtMB(data.memory.total)}` : '-', icon: HardDrive, color: 'bg-purple-500/20 text-purple-400', sub: data ? `${data.memory.percent}%` : '' },
    { title: '磁盘使用', value: data ? `${fmtMB(data.disk.used)} / ${fmtMB(data.disk.total)}` : '-', icon: HardDrive, color: 'bg-yellow-500/20 text-yellow-400', sub: data ? `${data.disk.percent}%` : '' },
    { title: '数据库连接', value: data?.dbConnections ?? '-', icon: Database, color: 'bg-green-500/20 text-green-400', sub: '活跃连接数' },
    { title: 'Redis 连接', value: data?.redisConnected ? '正常' : '断开', icon: Database, color: data?.redisConnected ? 'bg-cyan-500/20 text-cyan-400' : 'bg-red-500/20 text-red-400', sub: '' },
    { title: '进程运行时间', value: data ? fmtUptime(data.uptime) : '-', icon: Clock, color: 'bg-orange-500/20 text-orange-400', sub: '' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={refetch} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E1E2E] hover:bg-[#2A2A3A] text-sm text-[#9090A0] hover:text-white rounded-lg transition-colors">
          <RefreshCw size={14} />刷新 (自动 30s)
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => <AdminStatCard key={c.title} title={c.title} value={c.value} sub={c.sub} icon={c.icon} color={c.color} />)}
      </div>
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl overflow-hidden">
        <button onClick={() => setRawOpen(!rawOpen)} className="w-full flex items-center justify-between px-5 py-3 text-sm text-[#9090A0] hover:text-white transition-colors">
          <span>原始数据 (JSON)</span>
          {rawOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {rawOpen && (
          <pre className="px-5 pb-5 text-xs text-[#9090A0] overflow-auto max-h-64">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── Tab 5: 安全设置 ───────────────────────────

function SecurityTab() {
  const { data: security, loading, error, refetch } = useAdminApi<SecurityStatus>('/admin/auth/security');

  // 修改密码
  const [pwdForm, setPwdForm] = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  // TOTP 启用流程
  const [totpQr, setTotpQr] = useState<{ qrCode: string; secret: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);

  // TOTP 关闭流程
  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePwd, setDisablePwd] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!pwdForm.oldPassword || !pwdForm.newPassword) { toast.error('请填写所有密码字段'); return; }
    if (pwdForm.newPassword !== pwdForm.confirm) { toast.error('两次新密码不一致'); return; }
    if (pwdForm.newPassword.length < 8) { toast.error('新密码至少 8 位'); return; }
    setPwdLoading(true);
    try {
      await adminApi.put('/admin/auth/password', { oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword });
      toast.success('密码修改成功');
      setPwdForm({ oldPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '修改失败');
    } finally {
      setPwdLoading(false);
    }
  };

  const handleGenerateTotp = async () => {
    setTotpLoading(true);
    try {
      const res = await adminApi.post<{ qrCode: string; secret: string }>('/admin/auth/totp/generate');
      setTotpQr(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '生成失败');
    } finally {
      setTotpLoading(false);
    }
  };

  const handleEnableTotp = async () => {
    if (!totpCode || totpCode.length !== 6) { toast.error('请输入 6 位验证码'); return; }
    setTotpLoading(true);
    try {
      await adminApi.post('/admin/auth/totp/enable', { code: totpCode });
      toast.success('两步验证已启用');
      setTotpQr(null);
      setTotpCode('');
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '验证失败');
    } finally {
      setTotpLoading(false);
    }
  };

  const handleDisableTotp = async () => {
    if (!disablePwd) { toast.error('请输入当前密码'); return; }
    setDisableLoading(true);
    try {
      await adminApi.post('/admin/auth/totp/disable', { password: disablePwd });
      toast.success('两步验证已关闭');
      setDisableOpen(false);
      setDisablePwd('');
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setDisableLoading(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white placeholder-[#9090A0] focus:outline-none focus:border-cyan-500/50';

  if (loading) return <AdminSkeleton mode="detail" count={4} />;
  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6 max-w-xl">
      {/* 安全状态概览 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5 space-y-3">
        <p className="text-sm font-medium text-white">安全状态</p>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#9090A0]">两步验证 (TOTP)</span>
          <AdminStatusBadge status={security?.totpEnabled ? 'enabled' : 'disabled'} map={{ enabled: { label: '已启用', color: 'bg-green-500/10 text-green-400 border-green-500/20' }, disabled: { label: '未启用', color: 'bg-[#9090A0]/10 text-[#9090A0] border-[#9090A0]/20' } }} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#9090A0]">最后修改密码</span>
          <span className="text-white">{security?.lastPasswordChange ? new Date(security.lastPasswordChange).toLocaleDateString('zh-CN') : '从未修改'}</span>
        </div>
      </div>

      {/* 修改密码 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5 space-y-4">
        <p className="text-sm font-medium text-white">修改密码</p>
        <div className="space-y-3">
          {[
            { label: '当前密码', key: 'oldPassword', placeholder: '当前密码' },
            { label: '新密码', key: 'newPassword', placeholder: '至少 8 位' },
            { label: '确认新密码', key: 'confirm', placeholder: '再次输入新密码' },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="block text-xs text-[#9090A0] mb-1">{label}</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className={`${inputCls} pr-10`}
                  value={pwdForm[key as keyof typeof pwdForm]}
                  onChange={(e) => setPwdForm({ ...pwdForm, [key]: e.target.value })}
                  placeholder={placeholder}
                />
                {key === 'oldPassword' && (
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9090A0] hover:text-white transition-colors">
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button onClick={handleChangePassword} disabled={pwdLoading} className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm rounded-lg border border-cyan-500/20 transition-colors disabled:opacity-50">
          {pwdLoading && <Loader2 size={14} className="animate-spin" />}保存新密码
        </button>
      </div>

      {/* TOTP 管理 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5 space-y-4">
        <p className="text-sm font-medium text-white">两步验证 (TOTP)</p>

        {security?.totpEnabled ? (
          <div className="space-y-3">
            <p className="text-sm text-[#9090A0]">两步验证当前已启用，关闭后登录将不再需要验证码。</p>
            <button onClick={() => setDisableOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm rounded-lg border border-red-500/20 transition-colors">
              <ShieldCheck size={14} />关闭两步验证
            </button>
          </div>
        ) : totpQr ? (
          <div className="space-y-4">
            <p className="text-sm text-[#9090A0]">使用 Google Authenticator 等应用扫描二维码，然后输入 6 位验证码完成绑定。</p>
            <div className="bg-white rounded-lg p-3 w-40 h-40 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={totpQr.qrCode} alt="TOTP 二维码" className="w-full h-full object-contain" />
            </div>
            <div className="text-xs text-[#9090A0]">
              手动输入密钥: <span className="font-mono text-white tracking-widest">{totpQr.secret}</span>
            </div>
            <div className="flex gap-2">
              <input className={`flex-1 ${inputCls} tracking-widest`} value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} />
              <button onClick={handleEnableTotp} disabled={totpLoading} className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm rounded-lg border border-cyan-500/20 transition-colors disabled:opacity-50 whitespace-nowrap">
                {totpLoading && <Loader2 size={14} className="animate-spin" />}绑定
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[#9090A0]">启用两步验证后，登录时需额外输入验证码，提升账号安全性。</p>
            <button onClick={handleGenerateTotp} disabled={totpLoading} className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm rounded-lg border border-cyan-500/20 transition-colors disabled:opacity-50">
              {totpLoading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              启用两步验证
            </button>
          </div>
        )}
      </div>

      {/* 关闭 TOTP 确认弹窗 */}
      {disableOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setDisableOpen(false)}>
          <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E1E2E]">
              <h3 className="text-base font-semibold text-white">关闭两步验证</h3>
              <button onClick={() => setDisableOpen(false)} className="text-[#9090A0] hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-[#9090A0]">关闭后登录将不再需要验证码，请输入当前密码确认。</p>
              <input type="password" className={inputCls} value={disablePwd} onChange={(e) => setDisablePwd(e.target.value)} placeholder="当前密码" />
            </div>
            <div className="flex gap-2 px-6 pb-6">
              <button onClick={() => setDisableOpen(false)} className="flex-1 px-4 py-2 text-sm text-[#9090A0] bg-[#1E1E2E] hover:bg-[#2A2A3A] rounded-lg transition-colors">取消</button>
              <button onClick={handleDisableTotp} disabled={disableLoading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors disabled:opacity-50">
                {disableLoading && <Loader2 size={14} className="animate-spin" />}确认关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── 主页面 ───────────────────────────

const TABS = [
  { key: 'exchanges', label: '交易所管理', icon: Globe },
  { key: 'config', label: '系统配置', icon: Sliders },
  { key: 'admins', label: '管理员管理', icon: ShieldCheck },
  { key: 'monitor', label: '系统监控', icon: Monitor },
  { key: 'security', label: '安全设置', icon: Lock },
];

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState('exchanges');

  return (
    <div className="p-6 space-y-4">
      <AdminPageHeader title="系统设置" icon={Settings} subtitle="交易所、配置、管理员、监控与安全" />
      <AdminTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      <div className="pt-2">
        {activeTab === 'exchanges' && <ExchangeTab />}
        {activeTab === 'config' && <ConfigTab />}
        {activeTab === 'admins' && <AdminsTab />}
        {activeTab === 'monitor' && <MonitorTab />}
        {activeTab === 'security' && <SecurityTab />}
      </div>
    </div>
  );
}
