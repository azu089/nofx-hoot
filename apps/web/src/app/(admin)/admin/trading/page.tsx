'use client';

import { useState } from 'react';
import {
  TrendingUp,
  Settings,
  BarChart3,
  Activity,
  Radio,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  Unlock,
  Play,
  Pause,
  ShieldAlert,
  Loader2,
  Eye,
} from 'lucide-react';
import {
  AdminPageHeader,
  AdminSkeleton,
  AdminErrorState,
  AdminTable,
  AdminColumn,
  AdminPagination,
  AdminStatCard,
  AdminSearchBar,
  AdminConfirmDialog,
  AdminTabs,
  AdminStatusBadge,
} from '@/components/admin/shared';
import {
  useAdminApi,
  useAdminMutation,
  useAdminList,
} from '@/hooks/useAdminApi';

// ─── 类型定义 ───────────────────────────────────────────────

interface TradingConfig {
  maxPositionSize: number;
  defaultLeverage: number;
  maxDailyOrders: number;
  riskLimitPercent: number;
  [key: string]: unknown;
}

interface MarketStatus {
  symbol: string;
  status: string;
  suspendedAt: string;
  reason: string;
}

interface CircuitBreaker {
  name: string;
  status: 'open' | 'closed' | 'half-open';
  trippedAt?: string;
  description: string;
}

interface Strategy {
  id: string;
  name: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  status: 'active' | 'inactive';
  createdAt: string;
}

interface Position {
  id: string;
  userId: string;
  userEmail: string;
  exchange: string;
  symbol: string;
  side: 'long' | 'short';
  qty: number;
  entryPrice: number;
  pnl: number;
  pnlPercent: number;
  status: string;
  openedAt: string;
}

interface PositionStats {
  total: number;
  open: number;
  closed: number;
  totalPnl: number;
}

interface Order {
  id: string;
  userId: string;
  userEmail: string;
  exchange: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: string;
  qty: number;
  price: number;
  status: string;
  createdAt: string;
}

interface OrderStats {
  total: number;
  pending: number;
  filled: number;
  cancelled: number;
}

interface Signal {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  side: 'buy' | 'sell';
  signalType: string;
  status: string;
  createdAt: string;
}

interface SignalStats {
  total: number;
  pending: number;
  executed: number;
  failed: number;
}

interface StrategyRunStatus {
  strategyId: string;
  strategyName: string;
  isRunning: boolean;
  lastRun?: string;
}

// ─── 辅助组件 ───────────────────────────────────────────────

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 bg-[#12121A] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ActionBtn({
  onClick,
  children,
  variant = 'default',
  loading,
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'default' | 'danger' | 'success';
  loading?: boolean;
}) {
  const styles = {
    default: 'bg-[#1E1E2E] hover:bg-[#2A2A3A] text-[#9090A0] hover:text-white',
    danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-400',
    success: 'bg-green-500/10 hover:bg-green-500/20 text-green-400',
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors disabled:opacity-50 ${styles[variant]}`}
    >
      {loading && <Loader2 size={12} className="animate-spin" />}
      {children}
    </button>
  );
}

// ─── Tab 1: 交易配置 ─────────────────────────────────────────

function TradingConfigTab() {
  const { data: config, loading, error, refetch } = useAdminApi<TradingConfig>('/admin/trading/config');
  const { data: marketList, loading: mlLoading, refetch: refetchMarket } = useAdminApi<{ items: MarketStatus[] }>('/admin/trading/market-status');
  const { data: breakerList, loading: blLoading, refetch: refetchBreaker } = useAdminApi<{ items: CircuitBreaker[] }>('/admin/trading/circuit-breaker');
  const { mutate, loading: mutLoading } = useAdminMutation();

  const [editMode, setEditMode] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [suspendDialog, setSuspendDialog] = useState(false);
  const [suspendSymbol, setSuspendSymbol] = useState('');
  const [suspendReason, setSuspendReason] = useState('');

  if (loading) return <AdminSkeleton mode="detail" count={6} />;
  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  const configEntries = config
    ? Object.entries(config).filter(([k]) => typeof config[k] !== 'object')
    : [];

  const handleEditStart = () => {
    if (!config) return;
    const vals: Record<string, string> = {};
    configEntries.forEach(([k, v]) => { vals[k] = String(v); });
    setEditValues(vals);
    setEditMode(true);
  };

  const handleSaveConfig = async () => {
    const body: Record<string, unknown> = {};
    Object.entries(editValues).forEach(([k, v]) => {
      body[k] = isNaN(Number(v)) ? v : Number(v);
    });
    await mutate('/admin/trading/config', 'put', body);
    setEditMode(false);
    refetch();
  };

  const handleResume = async (symbol: string) => {
    await mutate('/admin/trading/market-status/resume', 'post', { symbol });
    refetchMarket();
  };

  const handleSuspend = async () => {
    if (!suspendSymbol.trim()) return;
    await mutate('/admin/trading/market-status/suspend', 'post', {
      symbol: suspendSymbol,
      reason: suspendReason,
    });
    setSuspendDialog(false);
    setSuspendSymbol('');
    setSuspendReason('');
    refetchMarket();
  };

  const handleBreakerReset = async (name: string) => {
    await mutate(`/admin/trading/circuit-breaker/${name}/reset`, 'post', {});
    refetchBreaker();
  };

  const handleBreakerForceOpen = async (name: string) => {
    await mutate(`/admin/trading/circuit-breaker/${name}/force-open`, 'post', {});
    refetchBreaker();
  };

  const handleClearCache = async () => {
    await mutate('/admin/trading/config/clear-cache', 'post', {});
  };

  return (
    <div className="space-y-6">
      {/* 平台配置 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-white">平台交易配置</h3>
          <div className="flex items-center gap-2">
            <ActionBtn onClick={handleClearCache} loading={mutLoading}>
              <RotateCcw size={12} /> 清除缓存
            </ActionBtn>
            {editMode ? (
              <>
                <ActionBtn onClick={() => setEditMode(false)}>取消</ActionBtn>
                <ActionBtn onClick={handleSaveConfig} loading={mutLoading} variant="success">
                  保存
                </ActionBtn>
              </>
            ) : (
              <ActionBtn onClick={handleEditStart}>
                <Edit2 size={12} /> 编辑
              </ActionBtn>
            )}
          </div>
        </div>
        <div className="space-y-2">
          {configEntries.length === 0 && (
            <p className="text-sm text-[#9090A0]">暂无配置数据</p>
          )}
          {configEntries.map(([key, value]) => (
            <div key={key} className="flex items-center gap-4 py-2 border-b border-[#1E1E2E] last:border-0">
              <span className="text-xs text-[#9090A0] w-48 shrink-0 font-mono">{key}</span>
              {editMode ? (
                <input
                  value={editValues[key] ?? ''}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="flex-1 px-2 py-1 bg-[#0A0A0F] border border-[#1E1E2E] rounded text-sm text-white focus:outline-none focus:border-cyan-500/50"
                />
              ) : (
                <span className="text-sm text-white">{String(value)}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 市场状态 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-white">交易对暂停列表</h3>
          <ActionBtn onClick={() => setSuspendDialog(true)} variant="danger">
            <Pause size={12} /> 暂停交易对
          </ActionBtn>
        </div>
        {mlLoading ? (
          <AdminSkeleton mode="table" count={3} />
        ) : (
          <AdminTable<MarketStatus>
            columns={[
              { key: 'symbol', title: '交易对', render: (r) => <span className="font-mono text-cyan-400">{r.symbol}</span> },
              { key: 'status', title: '状态', render: (r) => <AdminStatusBadge status={r.status} /> },
              { key: 'suspendedAt', title: '暂停时间', render: (r) => new Date(r.suspendedAt).toLocaleString('zh-CN') },
              { key: 'reason', title: '原因', render: (r) => <span className="text-[#9090A0] text-xs">{r.reason}</span> },
              {
                key: 'action', title: '操作', align: 'center',
                render: (r) => (
                  <ActionBtn onClick={() => handleResume(r.symbol)} loading={mutLoading} variant="success">
                    <Play size={12} /> 恢复
                  </ActionBtn>
                ),
              },
            ]}
            data={marketList?.items ?? []}
            rowKey="symbol"
            loading={mlLoading}
          />
        )}
      </div>

      {/* 熔断器 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5">
        <h3 className="text-sm font-medium text-white mb-4">熔断器状态</h3>
        {blLoading ? (
          <AdminSkeleton mode="table" count={3} />
        ) : (
          <div className="space-y-3">
            {(breakerList?.items ?? []).map((cb) => (
              <div key={cb.name} className="flex items-center justify-between p-3 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg">
                <div className="flex items-center gap-3">
                  <ShieldAlert size={16} className={cb.status === 'open' ? 'text-red-400' : 'text-green-400'} />
                  <div>
                    <p className="text-sm text-white font-mono">{cb.name}</p>
                    <p className="text-xs text-[#9090A0]">{cb.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <AdminStatusBadge
                    status={cb.status}
                    map={{
                      open: { label: '已触发', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
                      closed: { label: '正常', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
                      'half-open': { label: '半开', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
                    }}
                  />
                  <ActionBtn onClick={() => handleBreakerReset(cb.name)} loading={mutLoading}>
                    <RotateCcw size={12} /> 重置
                  </ActionBtn>
                  <ActionBtn onClick={() => handleBreakerForceOpen(cb.name)} loading={mutLoading} variant="danger">
                    <Unlock size={12} /> 强制打开
                  </ActionBtn>
                </div>
              </div>
            ))}
            {(breakerList?.items ?? []).length === 0 && (
              <p className="text-sm text-[#9090A0] text-center py-4">暂无熔断器数据</p>
            )}
          </div>
        )}
      </div>

      {/* 暂停交易对对话框 */}
      {suspendDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSuspendDialog(false)}>
          <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-white mb-4">暂停交易对</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#9090A0] mb-1 block">交易对（如 BTC/USDT）</label>
                <input
                  value={suspendSymbol}
                  onChange={(e) => setSuspendSymbol(e.target.value)}
                  placeholder="BTC/USDT"
                  className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white placeholder-[#9090A0] focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-[#9090A0] mb-1 block">暂停原因</label>
                <input
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="风控触发..."
                  className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white placeholder-[#9090A0] focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <ActionBtn onClick={() => setSuspendDialog(false)}>取消</ActionBtn>
              <ActionBtn onClick={handleSuspend} loading={mutLoading} variant="danger">
                <Pause size={12} /> 确认暂停
              </ActionBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: 策略管理 ─────────────────────────────────────────

function StrategyManagementTab() {
  const { items, total, page, totalPages, loading, error, search, setSearch, setPage, refetch } = useAdminList<Strategy>('/admin/strategies');
  const { mutate, loading: mutLoading } = useAdminMutation({ onSuccess: () => refetch() });

  const [createDialog, setCreateDialog] = useState(false);
  const [editStrategy, setEditStrategy] = useState<Strategy | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', riskLevel: 'medium' });

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  const handleCreate = async () => {
    await mutate('/admin/strategies', 'post', form);
    setCreateDialog(false);
    setForm({ name: '', description: '', riskLevel: 'medium' });
  };

  const handleEdit = async () => {
    if (!editStrategy) return;
    await mutate(`/admin/strategies/${editStrategy.id}`, 'put', form);
    setEditStrategy(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await mutate(`/admin/strategies/${deleteId}`, 'delete');
    setDeleteId(null);
  };

  const openEdit = (s: Strategy) => {
    setForm({ name: s.name, description: s.description, riskLevel: s.riskLevel });
    setEditStrategy(s);
  };

  const RISK_MAP = {
    low: { label: '低风险', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
    medium: { label: '中风险', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
    high: { label: '高风险', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  };

  const columns: AdminColumn<Strategy>[] = [
    { key: 'name', title: '名称', render: (r) => <span className="font-medium text-white">{r.name}</span> },
    { key: 'description', title: '描述', render: (r) => <span className="text-[#9090A0] text-xs">{r.description}</span> },
    { key: 'riskLevel', title: '风险等级', align: 'center', render: (r) => <AdminStatusBadge status={r.riskLevel} map={RISK_MAP} /> },
    { key: 'status', title: '状态', align: 'center', render: (r) => <AdminStatusBadge status={r.status} /> },
    { key: 'createdAt', title: '创建时间', render: (r) => new Date(r.createdAt).toLocaleDateString('zh-CN') },
    {
      key: 'actions', title: '操作', align: 'center',
      render: (r) => (
        <div className="flex items-center justify-center gap-1">
          <ActionBtn onClick={() => openEdit(r)}><Edit2 size={12} /> 编辑</ActionBtn>
          <ActionBtn onClick={() => setDeleteId(r.id)} variant="danger"><Trash2 size={12} /> 删除</ActionBtn>
        </div>
      ),
    },
  ];

  const formDialog = (title: string, onConfirm: () => void, onClose: () => void) => (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-white mb-4">{title}</h3>
        <div className="space-y-3">
          {(['name', 'description'] as const).map((field) => (
            <div key={field}>
              <label className="text-xs text-[#9090A0] mb-1 block">{field === 'name' ? '策略名称' : '描述'}</label>
              <input
                value={form[field]}
                onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
                className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white placeholder-[#9090A0] focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          ))}
          <div>
            <label className="text-xs text-[#9090A0] mb-1 block">风险等级</label>
            <FilterSelect
              value={form.riskLevel}
              onChange={(v) => setForm((p) => ({ ...p, riskLevel: v }))}
              options={[{ value: 'low', label: '低风险' }, { value: 'medium', label: '中风险' }, { value: 'high', label: '高风险' }]}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <ActionBtn onClick={onClose}>取消</ActionBtn>
          <ActionBtn onClick={onConfirm} loading={mutLoading} variant="success">确认</ActionBtn>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <AdminSearchBar
          value={search}
          onChange={setSearch}
          onSearch={() => {}}
          placeholder="搜索策略名称..."
        />
        <button
          onClick={() => { setForm({ name: '', description: '', riskLevel: 'medium' }); setCreateDialog(true); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm rounded-lg border border-cyan-500/20 transition-colors ml-2 shrink-0"
        >
          <Plus size={14} /> 新建策略
        </button>
      </div>
      <AdminTable<Strategy> columns={columns} data={items} rowKey="id" loading={loading} />
      <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
      {createDialog && formDialog('新建策略', handleCreate, () => setCreateDialog(false))}
      {editStrategy && formDialog('编辑策略', handleEdit, () => setEditStrategy(null))}
      <AdminConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="确认删除策略"
        description="此操作不可逆，策略关联的订阅将失效。"
        confirmText="删除"
        variant="danger"
        loading={mutLoading}
      />
    </div>
  );
}

// ─── Tab 3: 持仓监控 ─────────────────────────────────────────

function PositionMonitorTab() {
  const { data: stats } = useAdminApi<PositionStats>('/admin/positions/stats');
  const { items, total, page, totalPages, loading, error, search, setSearch, setPage, setFilter, filters, refetch } =
    useAdminList<Position>('/admin/positions');

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  const columns: AdminColumn<Position>[] = [
    { key: 'user', title: '用户', render: (r) => <span className="text-xs text-[#9090A0]">{r.userEmail}</span> },
    { key: 'exchange', title: '交易所', render: (r) => <span className="text-xs font-mono text-[#9090A0]">{r.exchange}</span> },
    { key: 'symbol', title: '交易对', render: (r) => <span className="font-mono text-cyan-400 text-xs">{r.symbol}</span> },
    {
      key: 'side', title: '方向', align: 'center',
      render: (r) => (
        <span className={`text-xs font-medium ${r.side === 'long' ? 'text-green-400' : 'text-red-400'}`}>
          {r.side === 'long' ? '做多' : '做空'}
        </span>
      ),
    },
    { key: 'qty', title: '数量', align: 'right', render: (r) => <span className="text-sm">{r.qty}</span> },
    { key: 'entryPrice', title: '入场价', align: 'right', render: (r) => <span className="text-sm">${r.entryPrice?.toLocaleString()}</span> },
    {
      key: 'pnl', title: '当前盈亏', align: 'right',
      render: (r) => (
        <span className={`text-sm font-medium ${r.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {r.pnl >= 0 ? '+' : ''}{r.pnl?.toFixed(2)} ({r.pnlPercent?.toFixed(1)}%)
        </span>
      ),
    },
    { key: 'status', title: '状态', align: 'center', render: (r) => <AdminStatusBadge status={r.status} /> },
    { key: 'openedAt', title: '开仓时间', render: (r) => new Date(r.openedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) },
  ];

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <AdminStatCard title="总持仓" value={stats.total} icon={Activity} color="bg-cyan-500/10 text-cyan-400" />
          <AdminStatCard title="持仓中" value={stats.open} icon={TrendingUp} color="bg-blue-500/10 text-blue-400" />
          <AdminStatCard title="已平仓" value={stats.closed} icon={BarChart3} color="bg-[#9090A0]/10 text-[#9090A0]" />
          <AdminStatCard
            title="总盈亏"
            value={`${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl?.toFixed(2)}`}
            icon={TrendingUp}
            color={stats.totalPnl >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}
          />
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <AdminSearchBar value={search} onChange={setSearch} onSearch={() => {}} placeholder="搜索用户/交易对..." />
        <FilterSelect
          value={filters.status ?? ''}
          onChange={(v) => setFilter('status', v)}
          options={[{ value: '', label: '全部状态' }, { value: 'open', label: '持仓中' }, { value: 'closed', label: '已平仓' }]}
        />
        <FilterSelect
          value={filters.exchange ?? ''}
          onChange={(v) => setFilter('exchange', v)}
          options={[{ value: '', label: '全部交易所' }, { value: 'binance', label: 'Binance' }, { value: 'okx', label: 'OKX' }]}
        />
      </div>
      <AdminTable<Position> columns={columns} data={items} rowKey="id" loading={loading} />
      <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </div>
  );
}

// ─── Tab 4: 订单监控 ─────────────────────────────────────────

function OrderMonitorTab() {
  const { data: stats } = useAdminApi<OrderStats>('/admin/orders/stats');
  const { items, total, page, totalPages, loading, error, search, setSearch, setPage, setFilter, filters, refetch } =
    useAdminList<Order>('/admin/orders');

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  const columns: AdminColumn<Order>[] = [
    { key: 'user', title: '用户', render: (r) => <span className="text-xs text-[#9090A0]">{r.userEmail}</span> },
    { key: 'exchange', title: '交易所', render: (r) => <span className="text-xs font-mono text-[#9090A0]">{r.exchange}</span> },
    { key: 'symbol', title: '交易对', render: (r) => <span className="font-mono text-cyan-400 text-xs">{r.symbol}</span> },
    {
      key: 'side', title: '方向', align: 'center',
      render: (r) => (
        <span className={`text-xs font-medium ${r.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
          {r.side === 'buy' ? '买入' : '卖出'}
        </span>
      ),
    },
    { key: 'type', title: '类型', align: 'center', render: (r) => <span className="text-xs text-[#9090A0]">{r.type}</span> },
    { key: 'qty', title: '数量', align: 'right', render: (r) => <span className="text-sm">{r.qty}</span> },
    { key: 'price', title: '价格', align: 'right', render: (r) => <span className="text-sm">${r.price?.toLocaleString()}</span> },
    { key: 'status', title: '状态', align: 'center', render: (r) => <AdminStatusBadge status={r.status} /> },
    { key: 'createdAt', title: '时间', render: (r) => new Date(r.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) },
  ];

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <AdminStatCard title="总订单" value={stats.total} icon={BarChart3} color="bg-cyan-500/10 text-cyan-400" />
          <AdminStatCard title="待成交" value={stats.pending} icon={Activity} color="bg-yellow-500/10 text-yellow-400" />
          <AdminStatCard title="已成交" value={stats.filled} icon={TrendingUp} color="bg-green-500/10 text-green-400" />
          <AdminStatCard title="已撤销" value={stats.cancelled} icon={BarChart3} color="bg-[#9090A0]/10 text-[#9090A0]" />
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <AdminSearchBar value={search} onChange={setSearch} onSearch={() => {}} placeholder="搜索用户/交易对..." />
        <FilterSelect
          value={filters.status ?? ''}
          onChange={(v) => setFilter('status', v)}
          options={[{ value: '', label: '全部状态' }, { value: 'pending', label: '待成交' }, { value: 'filled', label: '已成交' }, { value: 'cancelled', label: '已撤销' }]}
        />
        <FilterSelect
          value={filters.exchange ?? ''}
          onChange={(v) => setFilter('exchange', v)}
          options={[{ value: '', label: '全部交易所' }, { value: 'binance', label: 'Binance' }, { value: 'okx', label: 'OKX' }]}
        />
      </div>
      <AdminTable<Order> columns={columns} data={items} rowKey="id" loading={loading} />
      <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </div>
  );
}

// ─── Tab 5: 信号监控 ─────────────────────────────────────────

function SignalMonitorTab() {
  const { data: stats } = useAdminApi<SignalStats>('/admin/signals/stats');
  const { data: runStatus } = useAdminApi<{ items: StrategyRunStatus[] }>('/admin/signals/strategy-status');
  const { items, total, page, totalPages, loading, error, search, setSearch, setPage, setFilter, filters, refetch } =
    useAdminList<Signal>('/admin/signals');

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  const columns: AdminColumn<Signal>[] = [
    { key: 'strategy', title: '策略', render: (r) => <span className="text-sm text-white">{r.strategyName}</span> },
    { key: 'symbol', title: '交易对', render: (r) => <span className="font-mono text-cyan-400 text-xs">{r.symbol}</span> },
    {
      key: 'side', title: '方向', align: 'center',
      render: (r) => (
        <span className={`text-xs font-medium ${r.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
          {r.side === 'buy' ? '买入' : '卖出'}
        </span>
      ),
    },
    { key: 'signalType', title: '信号类型', align: 'center', render: (r) => <span className="text-xs text-[#9090A0]">{r.signalType}</span> },
    { key: 'status', title: '状态', align: 'center', render: (r) => <AdminStatusBadge status={r.status} /> },
    { key: 'createdAt', title: '时间', render: (r) => new Date(r.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) },
  ];

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <AdminStatCard title="总信号" value={stats.total} icon={Radio} color="bg-cyan-500/10 text-cyan-400" />
          <AdminStatCard title="待处理" value={stats.pending} icon={Activity} color="bg-yellow-500/10 text-yellow-400" />
          <AdminStatCard title="已执行" value={stats.executed} icon={TrendingUp} color="bg-green-500/10 text-green-400" />
          <AdminStatCard title="失败" value={stats.failed} icon={ShieldAlert} color="bg-red-500/10 text-red-400" />
        </div>
      )}
      {(runStatus?.items ?? []).length > 0 && (
        <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4">
          <h3 className="text-xs font-medium text-[#9090A0] mb-3">策略运行状态</h3>
          <div className="flex flex-wrap gap-2">
            {runStatus!.items.map((s) => (
              <div key={s.strategyId} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg">
                <span className={`w-2 h-2 rounded-full ${s.isRunning ? 'bg-green-400' : 'bg-[#9090A0]'}`} />
                <span className="text-xs text-white">{s.strategyName}</span>
                {s.lastRun && (
                  <span className="text-xs text-[#9090A0]">
                    {new Date(s.lastRun).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <AdminSearchBar value={search} onChange={setSearch} onSearch={() => {}} placeholder="搜索策略/交易对..." />
        <FilterSelect
          value={filters.status ?? ''}
          onChange={(v) => setFilter('status', v)}
          options={[{ value: '', label: '全部状态' }, { value: 'pending', label: '待处理' }, { value: 'executed', label: '已执行' }, { value: 'failed', label: '失败' }]}
        />
      </div>
      <AdminTable<Signal> columns={columns} data={items} rowKey="id" loading={loading} />
      <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </div>
  );
}

// ─── 主页面 ──────────────────────────────────────────────────

const TABS = [
  { key: 'config', label: '交易配置', icon: Settings },
  { key: 'strategies', label: '策略管理', icon: BarChart3 },
  { key: 'positions', label: '持仓监控', icon: Activity },
  { key: 'orders', label: '订单监控', icon: TrendingUp },
  { key: 'signals', label: '信号监控', icon: Radio },
];

export default function AdminTradingPage() {
  const [activeTab, setActiveTab] = useState('config');

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader
        title="交易管理"
        icon={TrendingUp}
        subtitle="管理交易配置、策略、持仓、订单与信号"
      />
      <AdminTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      <div>
        {activeTab === 'config' && <TradingConfigTab />}
        {activeTab === 'strategies' && <StrategyManagementTab />}
        {activeTab === 'positions' && <PositionMonitorTab />}
        {activeTab === 'orders' && <OrderMonitorTab />}
        {activeTab === 'signals' && <SignalMonitorTab />}
      </div>
    </div>
  );
}
