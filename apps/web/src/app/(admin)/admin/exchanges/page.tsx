'use client';

import { useState } from 'react';
import {
  Globe,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  X,
  Save,
  Loader2,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import {
  AdminPageHeader,
  AdminSkeleton,
  AdminErrorState,
  AdminEmptyState,
  AdminConfirmDialog,
} from '@/components/admin/shared';
import { useAdminApi } from '@/hooks/useAdminApi';
import { adminApi } from '@/lib/admin-auth';
import { toast } from 'sonner';

interface Exchange {
  id: string;
  slug: string;
  name: string;
  logo: string;
  description: string;
  features: string[];
  affiliateUrl: string;
  status: 'supported' | 'coming_soon';
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

interface ExchangeStats {
  total: number;
  active: number;
  supported: number;
  comingSoon: number;
}

const EMPTY_FORM = {
  slug: '', name: '', logo: '', description: '',
  features: '' as string, affiliateUrl: '',
  status: 'supported' as 'supported' | 'coming_soon',
  sortOrder: 0, isActive: true,
};

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
      className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-[#2A2A3A] text-[#5E5E6E] hover:text-cyan-400 transition-colors shrink-0" title="复制">
      {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
    </button>
  );
}

export default function AdminExchangesPage() {
  const { data: list, loading, error, refetch } = useAdminApi<{ items: Exchange[]; total: number }>('/admin/exchanges?limit=50');
  const { data: stats, refetch: refetchStats } = useAdminApi<ExchangeStats>('/admin/exchanges/stats');

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const items = list?.items ?? [];

  const openCreate = () => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (ex: Exchange) => {
    setEditId(ex.id);
    setForm({
      slug: ex.slug, name: ex.name, logo: ex.logo, description: ex.description,
      features: ex.features.join(', '), affiliateUrl: ex.affiliateUrl,
      status: ex.status, sortOrder: ex.sortOrder, isActive: ex.isActive,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.slug || !form.name) { toast.error('Slug 和名称必填'); return; }
    setSaving(true);
    try {
      const payload = { ...form, features: form.features.split(',').map(s => s.trim()).filter(Boolean) };
      if (editId) {
        await adminApi.put(`/admin/exchanges/${editId}`, payload);
        toast.success('交易所已更新');
      } else {
        await adminApi.post('/admin/exchanges', payload);
        toast.success('交易所已创建');
      }
      setShowForm(false);
      refetch(); refetchStats();
    } catch (err) { toast.error(err instanceof Error ? err.message : '保存失败'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await adminApi.delete(`/admin/exchanges/${deleteId}`);
      toast.success('已删除');
      setDeleteId(null);
      refetch(); refetchStats();
    } catch (err) { toast.error(err instanceof Error ? err.message : '删除失败'); }
    finally { setDeleting(false); }
  };

  const handleToggle = async (ex: Exchange) => {
    try {
      await adminApi.put(`/admin/exchanges/${ex.id}`, { isActive: !ex.isActive });
      toast.success(ex.isActive ? '已隐藏' : '已启用');
      refetch(); refetchStats();
    } catch (err) { toast.error(err instanceof Error ? err.message : '操作失败'); }
  };

  const refreshAll = () => { refetch(); refetchStats(); };

  const inputCls = 'w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white placeholder-[#5E5E6E] focus:outline-none focus:border-cyan-500/50';

  return (
    <div className="p-6 space-y-5">
      <AdminPageHeader
        title="交易所管理"
        icon={Globe}
        subtitle="管理前端展示的交易所推荐列表与邀请链接"
        onRefresh={refreshAll}
        actions={
          <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 transition-colors">
            <Plus size={14} />新增交易所
          </button>
        }
      />

      {/* 统计 */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: '总计', value: stats.total, cls: 'text-white' },
            { label: '已启用', value: stats.active, cls: 'text-green-400' },
            { label: '已上线', value: stats.supported, cls: 'text-cyan-400' },
            { label: '即将上线', value: stats.comingSoon, cls: 'text-yellow-400' },
          ].map(s => (
            <div key={s.label} className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4 text-center">
              <p className="text-xs text-[#9090A0]">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.cls}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* 列表 */}
      {loading ? <AdminSkeleton mode="table" count={5} /> :
        error ? <AdminErrorState message={error} onRetry={refetch} /> :
        items.length === 0 ? <AdminEmptyState icon={Globe} title="暂无交易所" /> : (
        <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1E1E2E]">
                <th className="text-left py-3 px-4 text-xs text-[#9090A0] font-medium">交易所</th>
                <th className="text-left py-3 px-4 text-xs text-[#9090A0] font-medium">Slug</th>
                <th className="text-left py-3 px-4 text-xs text-[#9090A0] font-medium">邀请链接</th>
                <th className="text-center py-3 px-4 text-xs text-[#9090A0] font-medium">状态</th>
                <th className="text-center py-3 px-4 text-xs text-[#9090A0] font-medium">排序</th>
                <th className="text-center py-3 px-4 text-xs text-[#9090A0] font-medium">启用</th>
                <th className="text-center py-3 px-4 text-xs text-[#9090A0] font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E1E2E]">
              {items.map(ex => (
                <tr key={ex.id} className="hover:bg-[#1A1A24] transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {ex.logo && <img src={ex.logo} alt="" className="w-6 h-6 rounded" />}
                      <span className="text-white text-xs font-medium">{ex.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4"><span className="text-[#9090A0] text-xs font-mono">{ex.slug}</span></td>
                  <td className="py-3 px-4">
                    {ex.affiliateUrl ? (
                      <span className="inline-flex items-center gap-1 max-w-[200px]">
                        <span className="text-[#9090A0] text-[10px] font-mono truncate">{ex.affiliateUrl}</span>
                        <CopyBtn text={ex.affiliateUrl} />
                        <a href={ex.affiliateUrl} target="_blank" rel="noopener noreferrer" className="text-[#5E5E6E] hover:text-cyan-400 transition-colors shrink-0">
                          <ExternalLink size={10} />
                        </a>
                      </span>
                    ) : <span className="text-[#4A4A5A] text-xs">未配置</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${ex.status === 'supported' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                      {ex.status === 'supported' ? '已上线' : '即将上线'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center"><span className="text-[#9090A0] text-xs">{ex.sortOrder}</span></td>
                  <td className="py-3 px-4 text-center">
                    <button onClick={() => handleToggle(ex)}
                      className={`w-9 h-5 rounded-full transition-colors relative ${ex.isActive ? 'bg-green-500' : 'bg-[#2A2A3A]'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${ex.isActive ? 'left-[18px]' : 'left-0.5'}`} />
                    </button>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(ex)} className="p-1.5 rounded hover:bg-[#2A2A3A] text-[#9090A0] hover:text-cyan-400 transition-colors"><Pencil size={12} /></button>
                      <button onClick={() => setDeleteId(ex.id)} className="p-1.5 rounded hover:bg-[#2A2A3A] text-[#9090A0] hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 新增/编辑弹窗 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[#1E1E2E]">
              <h3 className="text-sm font-semibold text-white">{editId ? '编辑交易所' : '新增交易所'}</h3>
              <button onClick={() => setShowForm(false)} className="text-[#9090A0] hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#9090A0] mb-1">Slug *</label>
                  <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="binance" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-[#9090A0] mb-1">名称 *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="币安" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#9090A0] mb-1">Logo URL</label>
                <input value={form.logo} onChange={e => setForm({ ...form, logo: e.target.value })} placeholder="https://..." className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-[#9090A0] mb-1">邀请链接</label>
                <input value={form.affiliateUrl} onChange={e => setForm({ ...form, affiliateUrl: e.target.value })} placeholder="https://..." className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-[#9090A0] mb-1">描述</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-[#9090A0] mb-1">特性标签（逗号分隔）</label>
                <input value={form.features} onChange={e => setForm({ ...form, features: e.target.value })} placeholder="现货交易, 合约交易, 杠杆" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#9090A0] mb-1">状态</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })}
                    className={inputCls}>
                    <option value="supported">已上线</option>
                    <option value="coming_soon">即将上线</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#9090A0] mb-1">排序（越小越靠前）</label>
                  <input type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} className={inputCls} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#9090A0]">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
                启用（前端可见）
              </label>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-[#1E1E2E]">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-xs rounded-lg border border-[#2A2A3A] text-[#9090A0] hover:text-white transition-colors">取消</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 transition-colors disabled:opacity-50">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}保存
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="删除交易所" description="确认删除该交易所？此操作不可撤销。" confirmText="删除" variant="danger" loading={deleting} />
    </div>
  );
}
