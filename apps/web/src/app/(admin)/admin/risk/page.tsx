'use client';

import { useState, useCallback } from 'react';
import {
  Shield,
  AlertOctagon,
  Activity,
  CheckCircle,
  Clock,
  Power,
  Users,
  Zap,
  FileText,
  Search,
  ToggleLeft,
  ToggleRight,
  Plus,
  Trash2,
  Edit2,
  X,
  Loader2,
  Ban,
  TrendingDown,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AdminPageHeader,
  AdminSkeleton,
  AdminErrorState,
  AdminTable,
  AdminPagination,
  AdminStatCard,
  AdminStatusBadge,
  AdminTabs,
  AdminConfirmDialog,
  type AdminColumn,
} from '@/components/admin/shared';
import {
  useAdminApi,
  useAdminList,
  useAdminMutation,
} from '@/hooks/useAdminApi';
import { adminApi } from '@/lib/admin-auth';

// ─── 类型定义 ───────────────────────────────────────────────

interface RiskOverview {
  openPositions: number;
  todayClosedPositions: number;
  totalExposure: string;
  lossPositions: number;
  stopLossCount: number;
  blackSwanCount: number;
}

interface RiskEvent {
  id: string;
  userId: string;
  username?: string;
  exchange: string;
  symbol: string;
  side: string;
  entryPrice: string;
  exitPrice?: string;
  amount: string;
  pnl?: string;
  closeReason: string;
  closedAt?: string;
}

interface KillSwitchStatus {
  globalEnabled: boolean;
  strategies: { id: string; name: string; enabled: boolean }[];
}

interface KillSwitchLog {
  id: string;
  action: string;
  target: string;
  operator: string;
  createdAt: string;
}

interface UserSearchResult {
  id: string;
  email: string;
  nickname?: string;
  signalEnabled: boolean;
}

interface RiskRule {
  id: string;
  name: string;
  type: string;
  threshold: string;
  action: string;
  isEnabled: boolean;
  createdAt: string;
}

// ─── 子组件：风控总览 Tab ────────────────────────────────────

function RiskOverviewTab() {
  const { data: overview, loading: ovLoading, error: ovError, refetch: ovRefetch } =
    useAdminApi<RiskOverview>('/admin/risk/overview');

  const {
    items: events,
    total,
    page,
    totalPages,
    loading: evLoading,
    error: evError,
    setPage,
    refetch: evRefetch,
  } = useAdminList<RiskEvent>('/admin/risk/events', { defaultLimit: 15 });

  const closeReasonMap: Record<string, { label: string; color: string }> = {
    stop_loss:        { label: '止损', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
    black_swan:       { label: '黑天鹅', color: 'bg-red-600/20 text-red-300 border-red-600/30' },
    daily_loss_limit: { label: '日亏限', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
    take_profit:      { label: '止盈', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
    manual:           { label: '手动', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  };

  const columns: AdminColumn<RiskEvent>[] = [
    {
      key: 'symbol', title: '交易对',
      render: (row) => <span className="font-mono text-cyan-400 text-xs">{row.symbol}</span>,
    },
    {
      key: 'side', title: '方向', align: 'center', width: '70px',
      render: (row) => (
        <span className={`text-xs px-1.5 py-0.5 rounded ${row.side === 'long' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
          {row.side === 'long' ? '多' : '空'}
        </span>
      ),
    },
    {
      key: 'closeReason', title: '触发原因', align: 'center',
      render: (row) => <AdminStatusBadge status={row.closeReason} map={closeReasonMap} />,
    },
    {
      key: 'pnl', title: 'PnL', align: 'right',
      render: (row) => {
        const n = parseFloat(row.pnl || '0');
        return (
          <span className={`font-mono text-sm font-semibold ${n >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {n >= 0 ? '+' : ''}{n.toFixed(2)}
          </span>
        );
      },
    },
    {
      key: 'username', title: '用户', width: '160px',
      render: (row) => <span className="text-sm text-[#9090A0]">{row.username ?? row.userId.slice(0, 10)}...</span>,
    },
    {
      key: 'closedAt', title: '时间', width: '150px',
      render: (row) => (
        <span className="text-xs text-[#9090A0]">
          {row.closedAt ? new Date(row.closedAt).toLocaleString('zh-CN') : '-'}
        </span>
      ),
    },
  ];

  if (ovLoading && !overview) return <AdminSkeleton mode="grid" count={6} cols={3} />;
  if (ovError) return <AdminErrorState message={ovError} onRetry={ovRefetch} />;

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <AdminStatCard title="当前持仓数" value={overview?.openPositions ?? 0} icon={Activity} color="bg-cyan-500/20 text-cyan-400" />
        <AdminStatCard title="今日平仓" value={overview?.todayClosedPositions ?? 0} icon={Clock} color="bg-blue-500/20 text-blue-400" />
        <AdminStatCard title="今日亏损仓位" value={overview?.lossPositions ?? 0} icon={TrendingDown} color="bg-red-500/20 text-red-400" />
        <AdminStatCard title="总风险敞口" value={`$${parseFloat(overview?.totalExposure ?? '0').toLocaleString('en-US', { maximumFractionDigits: 0 })}`} icon={AlertOctagon} color="bg-yellow-500/20 text-yellow-400" />
        <AdminStatCard title="今日止损次数" value={overview?.stopLossCount ?? 0} icon={Shield} color="bg-orange-500/20 text-orange-400" />
        <AdminStatCard title="今日黑天鹅" value={overview?.blackSwanCount ?? 0} icon={AlertOctagon} color="bg-red-600/20 text-red-300" />
      </div>

      {/* 风控事件列表 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4 space-y-4">
        <h2 className="text-sm font-medium text-white">风控触发记录（止损/黑天鹅/日亏限）</h2>
        {evError ? (
          <AdminErrorState message={evError} onRetry={evRefetch} />
        ) : (
          <>
            <AdminTable<RiskEvent> columns={columns} data={events} rowKey="id" loading={evLoading} />
            <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── 子组件：风控规则 Tab ────────────────────────────────────

function RiskRulesTab() {
  const { data: rules, loading, error, refetch } = useAdminApi<RiskRule[]>('/admin/risk/rules');
  const { mutate, loading: mutLoading } = useAdminMutation({ onSuccess: refetch });

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RiskRule | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', type: 'drawdown', threshold: '', action: 'alert', isEnabled: true,
  });
  const [submitting, setSubmitting] = useState(false);

  const RULE_TYPES = [
    { value: 'drawdown', label: '最大回撤' },
    { value: 'daily_loss', label: '日亏损限额' },
    { value: 'position_size', label: '单仓最大持仓' },
    { value: 'leverage', label: '最大杠杆' },
    { value: 'concentration', label: '集中度限制' },
  ];

  const RULE_ACTIONS = [
    { value: 'alert', label: '仅告警' },
    { value: 'pause', label: '暂停策略' },
    { value: 'close_all', label: '平所有仓' },
    { value: 'reduce', label: '减仓50%' },
  ];

  const inputCls = 'w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white placeholder-[#9090A0] focus:outline-none focus:border-cyan-500/50';

  const handleSave = async () => {
    if (!form.name || !form.threshold) { toast.error('请填写规则名称和阈值'); return; }
    setSubmitting(true);
    try {
      if (editTarget) {
        await adminApi.put(`/admin/risk/rules/${editTarget.id}`, form);
        toast.success('风控规则已更新');
        setEditTarget(null);
      } else {
        await adminApi.post('/admin/risk/rules', form);
        toast.success('风控规则已创建');
        setCreateOpen(false);
      }
      setForm({ name: '', type: 'drawdown', threshold: '', action: 'alert', isEnabled: true });
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (rule: RiskRule) => {
    await mutate(`/admin/risk/rules/${rule.id}`, 'put', { ...rule, isEnabled: !rule.isEnabled });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await mutate(`/admin/risk/rules/${deleteId}`, 'delete');
    setDeleteId(null);
  };

  const rulesList = Array.isArray(rules) ? rules : [];

  if (loading && !rulesList.length) return <AdminSkeleton mode="table" count={5} />;
  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  const FormPanel = ({ onCancel }: { onCancel: () => void }) => (
    <div className="bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl p-5 space-y-3">
      <h3 className="text-sm font-medium text-white mb-2">{editTarget ? '编辑规则' : '新建规则'}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs text-[#9090A0] mb-1">规则名称</label>
          <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例：最大回撤10%" />
        </div>
        <div>
          <label className="block text-xs text-[#9090A0] mb-1">规则类型</label>
          <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {RULE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[#9090A0] mb-1">触发阈值</label>
          <input className={inputCls} value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} placeholder="例：0.10 (10%)" />
        </div>
        <div>
          <label className="block text-xs text-[#9090A0] mb-1">触发动作</label>
          <select className={inputCls} value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
            {RULE_ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 pt-4">
          <input type="checkbox" id="isEnabled" checked={form.isEnabled} onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })} className="w-4 h-4" />
          <label htmlFor="isEnabled" className="text-xs text-[#9090A0]">立即启用</label>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={onCancel} className="flex-1 px-4 py-2 text-sm text-[#9090A0] bg-[#1E1E2E] hover:bg-[#2A2A3A] rounded-lg transition-colors">取消</button>
        <button onClick={handleSave} disabled={submitting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-lg transition-colors disabled:opacity-50">
          {submitting && <Loader2 size={14} className="animate-spin" />}保存
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => { setCreateOpen(true); setEditTarget(null); setForm({ name: '', type: 'drawdown', threshold: '', action: 'alert', isEnabled: true }); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm rounded-lg border border-cyan-500/20 transition-colors"
        >
          <Plus size={14} />新建规则
        </button>
      </div>

      {createOpen && <FormPanel onCancel={() => setCreateOpen(false)} />}

      {rulesList.length === 0 && !createOpen ? (
        <div className="text-center text-[#9090A0] text-sm py-12">
          <Settings size={32} className="mx-auto mb-3 opacity-30" />
          <p>暂无风控规则</p>
          <p className="text-xs mt-1">点击「新建规则」添加第一条风控规则</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rulesList.map((rule) => (
            <div key={rule.id}>
              {editTarget?.id === rule.id ? (
                <FormPanel onCancel={() => setEditTarget(null)} />
              ) : (
                <div className="flex items-center justify-between px-4 py-3 bg-[#12121A] rounded-lg border border-[#1E1E2E]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${rule.isEnabled ? 'bg-green-400' : 'bg-[#4A4A5A]'}`} />
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium">{rule.name}</p>
                      <p className="text-xs text-[#9090A0] mt-0.5">
                        类型: {RULE_TYPES.find((t) => t.value === rule.type)?.label ?? rule.type}
                        {' · '}阈值: {rule.threshold}
                        {' · '}动作: {RULE_ACTIONS.find((a) => a.value === rule.action)?.label ?? rule.action}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <button
                      onClick={() => handleToggle(rule)}
                      disabled={mutLoading}
                      className={`relative w-10 h-5 rounded-full transition-colors duration-200 disabled:opacity-50 ${rule.isEnabled ? 'bg-cyan-500' : 'bg-[#1E1E2E]'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${rule.isEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                    <button
                      onClick={() => { setEditTarget(rule); setForm({ name: rule.name, type: rule.type, threshold: rule.threshold, action: rule.action, isEnabled: rule.isEnabled }); setCreateOpen(false); }}
                      className="p-1.5 text-[#9090A0] hover:text-cyan-400 hover:bg-cyan-500/10 rounded transition-colors"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteId(rule.id)}
                      className="p-1.5 text-[#9090A0] hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AdminConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="删除风控规则"
        description="删除后无法恢复，确认删除此规则？"
        confirmText="删除"
        variant="danger"
        loading={mutLoading}
      />
    </div>
  );
}

// ─── 子组件：信号开关 Tab ────────────────────────────────────

function KillSwitchTab() {
  const { data: ksStatus, loading: ksLoading, error: ksError, refetch: ksRefetch } =
    useAdminApi<KillSwitchStatus>('/admin/signals/kill-switch');

  const {
    items: logs,
    total: logsTotal,
    page: logsPage,
    totalPages: logsTotalPages,
    loading: logsLoading,
    setPage: setLogsPage,
  } = useAdminList<KillSwitchLog>('/admin/signals/kill-switch/logs', { defaultLimit: 10 });

  const { mutate, loading: mutating } = useAdminMutation({ onSuccess: () => ksRefetch() });

  const [userKeyword, setUserKeyword] = useState('');
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [userSearching, setUserSearching] = useState(false);
  const [globalConfirm, setGlobalConfirm] = useState(false);
  const [strategyToggles, setStrategyToggles] = useState<Record<string, boolean>>({});

  const globalEnabled = ksStatus?.globalEnabled ?? false;
  const strategies = ksStatus?.strategies ?? [];

  const handleGlobalToggle = useCallback(async () => {
    setGlobalConfirm(false);
    await mutate('/admin/signals/kill-switch/global', 'post', { enabled: !globalEnabled });
  }, [mutate, globalEnabled]);

  const handleStrategyToggle = useCallback(async (id: string, current: boolean) => {
    setStrategyToggles((prev) => ({ ...prev, [id]: !current }));
    const result = await mutate(`/admin/signals/kill-switch/strategy/${id}`, 'post', { enabled: !current });
    if (!result) setStrategyToggles((prev) => ({ ...prev, [id]: current }));
  }, [mutate]);

  const handleUserSearch = useCallback(async () => {
    if (!userKeyword.trim()) return;
    setUserSearching(true);
    try {
      const res = await adminApi.get<{ users: UserSearchResult[] }>(
        `/admin/signals/kill-switch/users/search?keyword=${encodeURIComponent(userKeyword.trim())}`
      );
      setUserResults(res.data?.users ?? []);
    } catch {
      toast.error('搜索失败');
    } finally {
      setUserSearching(false);
    }
  }, [userKeyword]);

  const handleUserToggle = useCallback(async (userId: string, current: boolean) => {
    await mutate(`/admin/signals/kill-switch/user/${userId}`, 'post', { enabled: !current });
    setUserResults((prev) => prev.map((u) => (u.id === userId ? { ...u, signalEnabled: !current } : u)));
  }, [mutate]);

  const logColumns: AdminColumn<KillSwitchLog>[] = [
    { key: 'action', title: '操作类型', width: '120px', render: (row) => <span className="text-white text-sm">{row.action}</span> },
    { key: 'target', title: '目标', render: (row) => <span className="text-[#9090A0] text-sm">{row.target}</span> },
    { key: 'operator', title: '操作人', width: '160px', render: (row) => <span className="text-[#9090A0] text-sm">{row.operator}</span> },
    { key: 'createdAt', title: '时间', width: '150px', render: (row) => <span className="text-xs text-[#9090A0]">{new Date(row.createdAt).toLocaleString('zh-CN')}</span> },
  ];

  if (ksLoading && !ksStatus) return <AdminSkeleton mode="detail" count={5} />;
  if (ksError) return <AdminErrorState message={ksError} onRetry={ksRefetch} />;

  return (
    <div className="space-y-6">
      {/* 全局开关 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">全局信号开关</h2>
            <p className="text-sm text-[#9090A0]">关闭后将停止所有策略的信号发送</p>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${globalEnabled ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
              <Power size={14} />
              {globalEnabled ? '信号运行中' : '信号已停止'}
            </div>
            <button
              onClick={() => setGlobalConfirm(true)}
              disabled={mutating}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 border ${globalEnabled ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20' : 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/20'}`}
            >
              {globalEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
              {globalEnabled ? '紧急关闭' : '开启信号'}
            </button>
          </div>
        </div>
      </div>

      {/* 策略级开关 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">策略信号开关</h2>
          <span className="text-xs text-[#9090A0]">共 {strategies.length} 个策略</span>
        </div>
        {strategies.length === 0 ? (
          <p className="text-sm text-[#9090A0] py-4 text-center">暂无策略数据</p>
        ) : (
          <div className="space-y-2">
            {strategies.map((s) => {
              const enabled = strategyToggles[s.id] ?? s.enabled;
              return (
                <div key={s.id} className="flex items-center justify-between px-4 py-3 bg-[#0A0A0F] rounded-lg border border-[#1E1E2E]">
                  <div className="flex items-center gap-3">
                    <Zap size={14} className="text-cyan-400" />
                    <span className="text-sm text-white">{s.name}</span>
                    <span className="text-xs text-[#9090A0] font-mono">{s.id.slice(0, 8)}</span>
                  </div>
                  <button
                    onClick={() => handleStrategyToggle(s.id, enabled)}
                    disabled={mutating}
                    className={`relative w-10 h-5 rounded-full transition-colors duration-200 disabled:opacity-50 ${enabled ? 'bg-cyan-500' : 'bg-[#1E1E2E]'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 用户级开关 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-medium text-white">用户信号开关</h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9090A0]" />
            <input
              type="text"
              value={userKeyword}
              onChange={(e) => setUserKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUserSearch()}
              placeholder="输入邮箱或用户名搜索..."
              className="w-full pl-9 pr-4 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white placeholder-[#9090A0] focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <button onClick={handleUserSearch} disabled={userSearching} className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm rounded-lg border border-cyan-500/20 transition-colors disabled:opacity-50">
            {userSearching ? '搜索中...' : '搜索'}
          </button>
        </div>
        {userResults.length > 0 && (
          <div className="space-y-2">
            {userResults.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-4 py-3 bg-[#0A0A0F] rounded-lg border border-[#1E1E2E]">
                <div className="flex items-center gap-3">
                  <Users size={14} className="text-[#9090A0]" />
                  <div>
                    <span className="text-sm text-white">{u.nickname ?? u.email}</span>
                    <span className="text-xs text-[#9090A0] ml-2">{u.email}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleUserToggle(u.id, u.signalEnabled)}
                  disabled={mutating}
                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 disabled:opacity-50 ${u.signalEnabled ? 'bg-cyan-500' : 'bg-[#1E1E2E]'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${u.signalEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 操作日志 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-[#9090A0]" />
          <h2 className="text-sm font-medium text-white">操作日志</h2>
        </div>
        <AdminTable<KillSwitchLog> columns={logColumns} data={logs} rowKey="id" loading={logsLoading} />
        <AdminPagination page={logsPage} totalPages={logsTotalPages} total={logsTotal} onPageChange={setLogsPage} />
      </div>

      <AdminConfirmDialog
        open={globalConfirm}
        onClose={() => setGlobalConfirm(false)}
        onConfirm={handleGlobalToggle}
        title={globalEnabled ? '确认关闭全局信号？' : '确认开启全局信号？'}
        description={globalEnabled ? '关闭后所有用户的策略信号将立即停止发送，请谨慎操作。' : '开启后将恢复所有已启用策略的信号发送。'}
        confirmText={globalEnabled ? '立即关闭' : '立即开启'}
        variant={globalEnabled ? 'danger' : 'default'}
        loading={mutating}
      />
    </div>
  );
}

// ─── 主页面 ─────────────────────────────────────────────────

const TABS = [
  { key: 'overview', label: '风控总览', icon: Activity },
  { key: 'rules', label: '风控规则', icon: Settings },
  { key: 'killswitch', label: '信号开关', icon: Power },
];

export default function AdminRiskPage() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader title="风控管理" icon={Shield} subtitle="风控事件监控、规则配置与信号控制" />
      <AdminTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      {activeTab === 'overview' && <RiskOverviewTab />}
      {activeTab === 'rules' && <RiskRulesTab />}
      {activeTab === 'killswitch' && <KillSwitchTab />}
    </div>
  );
}
