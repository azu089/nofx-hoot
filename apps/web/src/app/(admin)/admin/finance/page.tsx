'use client';

import { useState } from 'react';
import {
  DollarSign,
  CreditCard,
  Fuel,
  TrendingUp,
  BarChart3,
  Calendar,
  ArrowLeftRight,
  Receipt,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AdminPageHeader,
  AdminSkeleton,
  AdminErrorState,
  AdminTable,
  AdminPagination,
  AdminStatCard,
  AdminTabs,
  AdminStatusBadge,
  AdminColumn,
} from '@/components/admin/shared';
import { useAdminApi, useAdminList } from '@/hooks/useAdminApi';
import { adminApi } from '@/lib/admin-auth';

// ─────────────────────────── 类型 ───────────────────────────

/** 后端 getFinanceOverview() 实际返回的嵌套结构 */
interface FinanceOverviewRaw {
  summary: {
    totalRevenue: string;
    subscriptionRevenue: string;
    pointCardRevenue: string;
    gasFeeRevenue: string;
    pendingWithdraws: string;
  };
  subscription: { total: string; count: number; recentRecords: RevenueRecord[] };
  pointCard: { total: string; count: number; recentRecords: RevenueRecord[] };
  gasFee: { total: string; totalProfit: string; count: number; recentRecords: RevenueRecord[] };
}

interface RevenueRecord {
  id: string;
  userId?: string;
  amount: string;
  createdAt: string;
  [key: string]: unknown;
}

interface RevenueRow {
  id: string;
  userId: string;
  userEmail?: string;
  amount: string;
  date: string;
  description?: string;
}

interface BillingItem {
  id: string;
  uniqueOrderId?: string;
  username?: string;
  userEmail?: string;
  type: string;
  amount: string;
  status: string;
  remark?: string;
  createdAt: string;
}

interface TransactionItem {
  id: string;
  userEmail: string;
  type: string;
  amount: string;
  status: string;
  description?: string;
  createdAt: string;
}

interface TransactionStats {
  totalDeposit: string;
  totalWithdraw: string;
  totalCount: number;
  pendingCount: number;
}

interface TrendItem {
  date: string;
  revenue?: string;
  total?: string;    // 后端返回 total，兼容两种
  subscription?: string;
  pointCard?: string;
  gasFee?: string;
}

// ─────────────────────────── 工具 ───────────────────────────

const fmtUSD = (v: string | number) =>
  `$${parseFloat(String(v || '0')).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtPoint = (v: string | number) => {
  const n = parseFloat(String(v || '0'));
  return n === 0 ? '0' : n.toFixed(8).replace(/\.?0+$/, '');
};

const BILLING_TYPE_MAP: Record<string, { label: string; color: string }> = {
  subscription:  { label: '订阅',   color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  point_card:    { label: 'GAS',    color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  gas_fee:       { label: '燃油费', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  admin_adjust:  { label: '管理调整', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  referral:      { label: '返佣', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
};

const TX_TYPE_MAP: Record<string, { label: string; color: string }> = {
  deposit:      { label: '充值', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  withdraw:     { label: '提现', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  transfer:     { label: '转账', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  admin_adjust: { label: '管理', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  subscription: { label: '订阅', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  gas_fee:      { label: '燃油费', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  point_card:   { label: 'GAS', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
};

// ─────────────────────────── CSV 导出工具 ───────────────────────────

function exportCSV(filename: string, headers: string[], rows: string[][]) {
  const BOM = '\uFEFF';
  const content = BOM + [headers.join(','), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────── 日期范围筛选器 ───────────────────────────

function DateRangeFilter({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
}: {
  startDate: string;
  endDate: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}) {
  const setPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    onStartChange(start.toISOString().slice(0, 10));
    onEndChange(end.toISOString().slice(0, 10));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        {[
          { label: '近7天', days: 7 },
          { label: '近30天', days: 30 },
          { label: '近90天', days: 90 },
        ].map(({ label, days }) => (
          <button
            key={days}
            onClick={() => setPreset(days)}
            className="px-2.5 py-1 text-xs rounded-lg bg-[#1E1E2E] text-[#9090A0] hover:text-white hover:bg-[#2A2A3A] border border-[#1E1E2E] transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartChange(e.target.value)}
          className="px-2 py-1 bg-[#12121A] border border-[#1E1E2E] rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500/50"
        />
        <span className="text-[#9090A0] text-xs">至</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndChange(e.target.value)}
          className="px-2 py-1 bg-[#12121A] border border-[#1E1E2E] rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500/50"
        />
      </div>
    </div>
  );
}

// ─────────────────────────── 简易柱状图 ───────────────────────────

/** 从 TrendItem 取收入值（兼容 total / revenue 两种后端字段名） */
const getTrendVal = (d: TrendItem) => parseFloat(d.total || d.revenue || '0');

function SimpleBarChart({ data }: { data: TrendItem[] }) {
  if (!data.length) return <p className="py-8 text-center text-[#9090A0] text-sm">暂无数据</p>;
  const maxVal = Math.max(...data.map(getTrendVal), 1);
  return (
    <div className="flex items-end gap-1 h-40">
      {data.map((item, idx) => {
        const pct = (getTrendVal(item) / maxVal) * 100;
        return (
          <div key={idx} className="flex-1 flex flex-col items-center justify-end group">
            <div className="relative w-full">
              <div className="w-full bg-cyan-500/30 rounded-t hover:bg-cyan-500/60 transition-colors min-h-[2px]" style={{ height: `${Math.max(pct, 2)}%` }} />
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-[#2A2A3A] text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                {item.date}: {fmtUSD(String(getTrendVal(item)))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────── 收入总览 Tab ───────────────────────────

function OverviewTab() {
  const { data: raw, loading, error, refetch } = useAdminApi<FinanceOverviewRaw>('/admin/finance/overview');

  if (loading) return <AdminSkeleton mode="grid" count={4} cols={4} />;
  if (error)   return <AdminErrorState message={error} onRetry={refetch} />;
  if (!raw?.summary) return <AdminErrorState message="数据为空" onRetry={refetch} />;

  const s = raw.summary;

  const recordColumns: AdminColumn<RevenueRecord>[] = [
    { key: 'userId', title: '用户', render: (r) => <span className="text-[#9090A0] text-xs font-mono">{String(r.userId || r.userEmail || r.id).slice(0, 10)}...</span> },
    { key: 'amount', title: '金额', align: 'right', render: (r) => <span className="font-mono text-white">{fmtUSD(r.amount)}</span> },
    { key: 'createdAt', title: '日期', align: 'center', render: (r) => <span className="text-[#9090A0] text-xs">{new Date(r.createdAt).toLocaleDateString('zh-CN')}</span> },
  ];

  const subRecords = raw.subscription?.recentRecords ?? [];
  const pcRecords = raw.pointCard?.recentRecords ?? [];
  const gfRecords = raw.gasFee?.recentRecords ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard title="总收入"     value={fmtUSD(s.totalRevenue)}        icon={DollarSign} color="bg-green-500/20 text-green-400" sub={`待审提现 ${fmtUSD(s.pendingWithdraws)}`} />
        <AdminStatCard title="订阅收入"   value={fmtUSD(s.subscriptionRevenue)} icon={CreditCard}  color="bg-blue-500/20 text-blue-400" sub={`${raw.subscription?.count ?? 0} 笔`} />
        <AdminStatCard title="GAS 收入"   value={fmtUSD(s.pointCardRevenue)}    icon={TrendingUp}  color="bg-purple-500/20 text-purple-400" sub={`${raw.pointCard?.count ?? 0} 笔`} />
        <AdminStatCard title="燃油费收入" value={fmtUSD(s.gasFeeRevenue)}       icon={Fuel}        color="bg-orange-500/20 text-orange-400" sub={`${raw.gasFee?.count ?? 0} 笔`} />
      </div>
      {subRecords.length > 0 && (
        <div>
          <p className="text-sm font-medium text-white mb-2">订阅收入（近期）</p>
          <AdminTable<RevenueRecord> columns={recordColumns} data={subRecords} rowKey="id" />
        </div>
      )}
      {pcRecords.length > 0 && (
        <div>
          <p className="text-sm font-medium text-white mb-2">GAS 收入（近期）</p>
          <AdminTable<RevenueRecord> columns={recordColumns} data={pcRecords} rowKey="id" />
        </div>
      )}
      {gfRecords.length > 0 && (
        <div>
          <p className="text-sm font-medium text-white mb-2">燃油费收入（近期）</p>
          <AdminTable<RevenueRecord> columns={recordColumns} data={gfRecords} rowKey="id" />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── 账单记录 Tab ───────────────────────────

function BillingTab() {
  const {
    items, total, page, totalPages, loading, error,
    filters, setFilter, setPage, refetch,
  } = useAdminList<BillingItem>('/admin/billing');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '10000' });
      if (filters.type) params.set('type', filters.type);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await adminApi.get<{ items: BillingItem[]; total: number }>(`/admin/billing?${params}`);
      const data = res.data?.items ?? [];
      exportCSV(
        `billing_export_${new Date().toISOString().slice(0, 10)}.csv`,
        ['账单ID', '用户', '类型', '金额', '状态', '备注', '时间'],
        data.map((r) => [
          r.uniqueOrderId || r.id,
          r.userEmail || r.username || '-',
          BILLING_TYPE_MAP[r.type]?.label || r.type,
          r.type === 'gas_fee' ? fmtPoint(r.amount) : fmtUSD(r.amount),
          r.status,
          r.remark || '',
          new Date(r.createdAt).toLocaleString('zh-CN'),
        ])
      );
      toast.success(`已导出 ${data.length} 条记录`);
    } catch {
      toast.error('导出失败');
    } finally {
      setExporting(false);
    }
  };

  const columns: AdminColumn<BillingItem>[] = [
    {
      key: 'uniqueOrderId', title: '账单ID', width: '180px',
      render: (r) => {
        const id = r.uniqueOrderId || r.id;
        return <span className="text-xs font-mono text-[#9090A0] cursor-default" title={id}>{id.length > 20 ? id.slice(0, 20) + '…' : id}</span>;
      },
    },
    { key: 'user', title: '用户', render: (r) => <span className="text-[#9090A0] text-xs" title={r.username || r.userEmail || ''}>{r.username || r.userEmail || '-'}</span> },
    { key: 'type',   title: '类型',  align: 'center', render: (r) => <AdminStatusBadge status={r.type} map={BILLING_TYPE_MAP} /> },
    { key: 'amount', title: '金额',  align: 'right',  render: (r) => <span className="font-mono text-white">{r.type === 'gas_fee' ? `${fmtPoint(r.amount)} pt` : fmtUSD(r.amount)}</span> },
    { key: 'status', title: '状态',  align: 'center', render: (r) => <AdminStatusBadge status={r.status} /> },
    {
      key: 'remark', title: '备注',
      render: (r) => r.remark ? <span className="text-[#9090A0] text-xs cursor-default" title={r.remark}>{r.remark.length > 40 ? r.remark.slice(0, 40) + '…' : r.remark}</span> : <span className="text-[#505060] text-xs">-</span>,
    },
    { key: 'createdAt', title: '时间', align: 'center', render: (r) => <span className="text-[#9090A0] text-xs">{new Date(r.createdAt).toLocaleString('zh-CN')}</span> },
  ];

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      {/* 类型筛选 */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { value: '',             label: '全部' },
          { value: 'subscription', label: '订阅' },
          { value: 'point_card',   label: 'GAS' },
          { value: 'gas_fee',      label: '燃油费' },
          { value: 'admin_adjust', label: '管理调整' },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter('type', value)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              (filters.type ?? '') === value
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                : 'bg-[#1E1E2E] text-[#9090A0] border-[#1E1E2E] hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 日期范围 + 导出 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangeFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs rounded-lg border border-green-500/20 transition-colors disabled:opacity-50"
        >
          <Download size={13} />
          {exporting ? '导出中...' : '导出 CSV'}
        </button>
      </div>

      {loading && !items.length ? (
        <AdminSkeleton mode="table" count={8} />
      ) : (
        <>
          <AdminTable<BillingItem> columns={columns} data={items} rowKey="id" loading={loading} />
          <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

// ─────────────────────────── 交易流水 Tab ───────────────────────────

function TransactionsTab() {
  const {
    items, total, page, totalPages, loading, error,
    filters, setFilter, setPage, refetch,
  } = useAdminList<TransactionItem>('/admin/transactions');

  const { data: txStats } = useAdminApi<TransactionStats>('/admin/transactions/stats');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '10000' });
      if (filters.type) params.set('type', filters.type);
      if (filters.status) params.set('status', filters.status);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await adminApi.get<{ items: TransactionItem[]; total: number }>(`/admin/transactions?${params}`);
      const data = res.data?.items ?? [];
      exportCSV(
        `transactions_export_${new Date().toISOString().slice(0, 10)}.csv`,
        ['用户', '类型', '金额', '状态', '备注', '时间'],
        data.map((r) => [
          r.userEmail,
          TX_TYPE_MAP[r.type]?.label || r.type,
          fmtUSD(r.amount),
          r.status,
          r.description || '',
          new Date(r.createdAt).toLocaleString('zh-CN'),
        ])
      );
      toast.success(`已导出 ${data.length} 条记录`);
    } catch {
      toast.error('导出失败');
    } finally {
      setExporting(false);
    }
  };

  const columns: AdminColumn<TransactionItem>[] = [
    { key: 'userEmail', title: '用户',   render: (r) => <span className="text-[#9090A0] text-xs">{r.userEmail}</span> },
    { key: 'type',      title: '类型',   align: 'center', render: (r) => <AdminStatusBadge status={r.type} map={TX_TYPE_MAP} /> },
    { key: 'amount',    title: '金额',   align: 'right',  render: (r) => <span className={`font-mono ${parseFloat(r.amount) >= 0 ? 'text-white' : 'text-red-400'}`}>{fmtUSD(r.amount)}</span> },
    { key: 'status',    title: '状态',   align: 'center', render: (r) => <AdminStatusBadge status={r.status} /> },
    { key: 'description', title: '备注', render: (r) => <span className="text-[#9090A0] text-xs">{r.description || '-'}</span> },
    { key: 'createdAt', title: '时间',   align: 'center', render: (r) => <span className="text-[#9090A0] text-xs">{new Date(r.createdAt).toLocaleString('zh-CN')}</span> },
  ];

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      {/* 汇总卡片 */}
      {txStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <AdminStatCard title="总充值"   value={fmtUSD(txStats.totalDeposit)}   icon={TrendingUp} color="bg-green-500/20 text-green-400" />
          <AdminStatCard title="总提现"   value={fmtUSD(txStats.totalWithdraw)}  icon={DollarSign} color="bg-red-500/20 text-red-400" />
          <AdminStatCard title="总笔数"   value={txStats.totalCount}             icon={BarChart3}  color="bg-blue-500/20 text-blue-400" />
          <AdminStatCard title="待处理"   value={txStats.pendingCount}           icon={Calendar}   color="bg-yellow-500/20 text-yellow-400" />
        </div>
      )}

      {/* 类型/状态筛选 */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1 flex-wrap">
          {[
            { value: '',             label: '全部类型' },
            { value: 'deposit',      label: '充值' },
            { value: 'withdraw',     label: '提现' },
            { value: 'admin_adjust', label: '管理调整' },
            { value: 'subscription', label: '订阅' },
            { value: 'gas_fee',      label: '燃油费' },
            { value: 'point_card',   label: 'GAS充值' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter('type', value)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                (filters.type ?? '') === value
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                  : 'bg-[#1E1E2E] text-[#9090A0] border-[#1E1E2E] hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {[
            { value: '',          label: '全部状态' },
            { value: 'pending',   label: '待处理' },
            { value: 'completed', label: '已完成' },
            { value: 'failed',    label: '失败' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter('status', value)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                (filters.status ?? '') === value
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                  : 'bg-[#1E1E2E] text-[#9090A0] border-[#1E1E2E] hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 日期范围 + 导出 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangeFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs rounded-lg border border-green-500/20 transition-colors disabled:opacity-50"
        >
          <Download size={13} />
          {exporting ? '导出中...' : '导出 CSV'}
        </button>
      </div>

      {loading && !items.length ? (
        <AdminSkeleton mode="table" count={8} />
      ) : (
        <>
          <AdminTable<TransactionItem> columns={columns} data={items} rowKey="id" loading={loading} />
          <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

// ─────────────────────────── 收入趋势 Tab ───────────────────────────

function TrendTab() {
  const [period, setPeriod] = useState<'7' | '30' | '90'>('30');
  const { data: trend, loading, error, refetch } = useAdminApi<TrendItem[]>(`/admin/finance/trend?days=${period}`, { deps: [period] });

  if (loading) return <AdminSkeleton mode="grid" count={1} cols={1} />;
  if (error)   return <AdminErrorState message={error} onRetry={refetch} />;

  const trendData = Array.isArray(trend) ? trend : [];
  const totalRevenue = trendData.reduce((sum, d) => sum + getTrendVal(d), 0);

  return (
    <div className="space-y-4">
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-[#9090A0]" />
            <span className="text-sm font-medium text-white">收入趋势</span>
            <span className="text-xs text-[#9090A0] ml-1">合计 {fmtUSD(String(totalRevenue))}</span>
          </div>
          <div className="flex gap-1">
            {([['7', '7天'], ['30', '30天'], ['90', '90天']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setPeriod(val)}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${period === val ? 'bg-cyan-500/20 text-cyan-400' : 'text-[#9090A0] hover:text-white hover:bg-[#1E1E2E]'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <SimpleBarChart data={trendData} />
        {trendData.length > 1 && (
          <div className="flex justify-between mt-1 text-xs text-[#9090A0]">
            <span>{trendData[0].date}</span>
            <span>{trendData[trendData.length - 1].date}</span>
          </div>
        )}
      </div>
      {trendData.length > 0 && (
        <div>
          <p className="text-sm font-medium text-white mb-2">每日明细</p>
          <AdminTable<TrendItem>
            columns={[
              { key: 'date',    title: '日期', render: (r) => <span className="text-[#9090A0]">{r.date}</span> },
              { key: 'revenue', title: '收入', align: 'right', render: (r) => <span className="font-mono text-white">{fmtUSD(String(getTrendVal(r)))}</span> },
            ]}
            data={trendData}
            rowKey="date"
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── 主页面 ───────────────────────────

const TABS = [
  { key: 'overview',      label: '收入总览',   icon: DollarSign },
  { key: 'billing',       label: '账单记录',   icon: Receipt },
  { key: 'transactions',  label: '交易流水',   icon: ArrowLeftRight },
  { key: 'trend',         label: '收入趋势',   icon: BarChart3 },
];

export default function AdminFinancePage() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="p-6 space-y-4">
      <AdminPageHeader title="财务中心" icon={DollarSign} subtitle="收入总览、账单记录、交易流水、收入趋势" />
      <AdminTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      {activeTab === 'overview'     && <OverviewTab />}
      {activeTab === 'billing'      && <BillingTab />}
      {activeTab === 'transactions' && <TransactionsTab />}
      {activeTab === 'trend'        && <TrendTab />}
    </div>
  );
}
