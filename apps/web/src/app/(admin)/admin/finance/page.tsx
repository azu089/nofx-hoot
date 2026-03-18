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
} from 'lucide-react';
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

// ─────────────────────────── 类型 ───────────────────────────

interface FinanceOverview {
  totalRevenue: string;
  subscriptionRevenue: string;
  pointCardRevenue: string;
  gasFeeRevenue: string;
  todayRevenue: string;
  weekRevenue: string;
  monthRevenue: string;
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
  revenue: string;
}

// ─────────────────────────── 工具 ───────────────────────────

const fmtUSD = (v: string | number) =>
  `$${parseFloat(String(v || '0')).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// GAS 金额：保留 8 位有效小数（去除末尾 0）
const fmtPoint = (v: string | number) => {
  const n = parseFloat(String(v || '0'));
  return n === 0 ? '0' : n.toFixed(8).replace(/\.?0+$/, '');
};

// 账单类型标签
const BILLING_TYPE_MAP: Record<string, { label: string; color: string }> = {
  subscription: { label: '订阅',   color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  point_card:   { label: 'GAS',    color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  gas_fee:      { label: '燃油费', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
};

// 交易类型标签
const TX_TYPE_MAP: Record<string, { label: string; color: string }> = {
  deposit:  { label: '充值', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  withdraw: { label: '提现', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  transfer: { label: '转账', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
};

// ─────────────────────────── 简易柱状图 ───────────────────────────

function SimpleBarChart({ data }: { data: TrendItem[] }) {
  if (!data.length)
    return <p className="py-8 text-center text-[#9090A0] text-sm">暂无数据</p>;

  const maxVal = Math.max(...data.map((d) => parseFloat(d.revenue || '0')), 1);

  return (
    <div className="flex items-end gap-1 h-40">
      {data.map((item, idx) => {
        const pct = (parseFloat(item.revenue || '0') / maxVal) * 100;
        return (
          <div key={idx} className="flex-1 flex flex-col items-center justify-end group">
            <div className="relative w-full">
              <div
                className="w-full bg-cyan-500/30 rounded-t hover:bg-cyan-500/60 transition-colors min-h-[2px]"
                style={{ height: `${Math.max(pct, 2)}%` }}
              />
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-[#2A2A3A] text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                {item.date}: {fmtUSD(item.revenue)}
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
  const { data: overview, loading, error, refetch } =
    useAdminApi<FinanceOverview>('/admin/finance/overview');

  const { data: subData } = useAdminApi<RevenueRow[]>('/admin/finance/subscription?days=30');
  const { data: pcData }  = useAdminApi<RevenueRow[]>('/admin/finance/point-card?days=30');
  const { data: gfData }  = useAdminApi<RevenueRow[]>('/admin/finance/gas-fee?days=30');

  if (loading) return <AdminSkeleton mode="grid" count={4} cols={4} />;
  if (error)   return <AdminErrorState message={error} onRetry={refetch} />;
  if (!overview) return <AdminErrorState message="数据为空" onRetry={refetch} />;

  const revenueColumns: AdminColumn<RevenueRow>[] = [
    { key: 'userEmail',    title: '用户',     render: (r) => <span className="text-[#9090A0] text-xs">{r.userEmail || r.userId}</span> },
    { key: 'amount',       title: '金额',     align: 'right', render: (r) => <span className="font-mono text-white">{fmtUSD(r.amount)}</span> },
    { key: 'date',         title: '日期',     align: 'center', render: (r) => <span className="text-[#9090A0] text-xs">{r.date}</span> },
    { key: 'description',  title: '盈利',     render: (r) => <span className="text-[#9090A0] text-xs font-mono">{r.description || '-'}</span> },
  ];

  // 燃油费明细专用列（GAS 精度）
  const gasFeeColumns: AdminColumn<RevenueRow>[] = [
    { key: 'userEmail',    title: '用户',     render: (r) => <span className="text-[#9090A0] text-xs">{r.userEmail || r.userId}</span> },
    { key: 'amount',       title: '扣费(pt)', align: 'right', render: (r) => <span className="font-mono text-white">{fmtPoint(r.amount)}</span> },
    { key: 'date',         title: '日期',     align: 'center', render: (r) => <span className="text-[#9090A0] text-xs">{r.date}</span> },
    { key: 'description',  title: '盈利',     render: (r) => <span className="text-[#9090A0] text-xs font-mono">{r.description || '-'}</span> },
  ];

  return (
    <div className="space-y-6">
      {/* 收入汇总卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard title="总收入"     value={fmtUSD(overview.totalRevenue)}        icon={DollarSign} color="bg-green-500/20 text-green-400" />
        <AdminStatCard title="订阅收入"   value={fmtUSD(overview.subscriptionRevenue)} icon={CreditCard}  color="bg-blue-500/20 text-blue-400" />
        <AdminStatCard title="GAS 收入"   value={fmtUSD(overview.pointCardRevenue)}    icon={TrendingUp}  color="bg-purple-500/20 text-purple-400" />
        <AdminStatCard title="燃油费收入" value={fmtUSD(overview.gasFeeRevenue)}       icon={Fuel}        color="bg-orange-500/20 text-orange-400" />
      </div>

      {/* 时间段汇总 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '今日', value: overview.todayRevenue },
          { label: '本周', value: overview.weekRevenue },
          { label: '本月', value: overview.monthRevenue },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4 text-center">
            <p className="text-xs text-[#9090A0] mb-1">{label}</p>
            <p className="text-lg font-bold text-white font-mono">{fmtUSD(value)}</p>
          </div>
        ))}
      </div>

      {/* 订阅收入明细 */}
      {Array.isArray(subData) && subData.length > 0 && (
        <div>
          <p className="text-sm font-medium text-white mb-2">订阅收入（近 30 天）</p>
          <AdminTable<RevenueRow> columns={revenueColumns} data={subData} rowKey="id" />
        </div>
      )}

      {/* GAS 收入明细 */}
      {Array.isArray(pcData) && pcData.length > 0 && (
        <div>
          <p className="text-sm font-medium text-white mb-2">GAS 收入（近 30 天）</p>
          <AdminTable<RevenueRow> columns={revenueColumns} data={pcData} rowKey="id" />
        </div>
      )}

      {/* 燃油费收入明细 */}
      {Array.isArray((gfData as any)?.recentRecords) && (gfData as any).recentRecords.length > 0 && (
        <div>
          <p className="text-sm font-medium text-white mb-2">燃油费收入（近 30 天）</p>
          <AdminTable<RevenueRow> columns={gasFeeColumns} data={(gfData as any).recentRecords} rowKey="id" />
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

  const columns: AdminColumn<BillingItem>[] = [
    {
      key: 'uniqueOrderId', title: '账单ID', width: '180px',
      render: (r) => {
        const id = r.uniqueOrderId || r.id;
        return (
          <span
            className="text-xs font-mono text-[#9090A0] cursor-default"
            title={id}
          >
            {id.length > 20 ? id.slice(0, 20) + '…' : id}
          </span>
        );
      },
    },
    {
      key: 'user', title: '用户',
      render: (r) => (
        <span className="text-[#9090A0] text-xs" title={r.username || r.userEmail || ''}>
          {r.username || r.userEmail || '-'}
        </span>
      ),
    },
    { key: 'type',   title: '类型',  align: 'center', render: (r) => <AdminStatusBadge status={r.type} map={BILLING_TYPE_MAP} /> },
    { key: 'amount', title: '金额',  align: 'right',  render: (r) => <span className="font-mono text-white">{r.type === 'gas_fee' ? `${fmtPoint(r.amount)} pt` : fmtUSD(r.amount)}</span> },
    { key: 'status', title: '状态',  align: 'center', render: (r) => <AdminStatusBadge status={r.status} /> },
    {
      key: 'remark', title: '备注',
      render: (r) => r.remark ? (
        <span className="text-[#9090A0] text-xs cursor-default" title={r.remark}>
          {r.remark.length > 40 ? r.remark.slice(0, 40) + '…' : r.remark}
        </span>
      ) : <span className="text-[#505060] text-xs">-</span>,
    },
    { key: 'createdAt', title: '时间', align: 'center', render: (r) => <span className="text-[#9090A0] text-xs">{new Date(r.createdAt).toLocaleString('zh-CN')}</span> },
  ];

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      {/* 类型筛选 */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { value: '',             label: '全部' },
          { value: 'subscription', label: '订阅' },
          { value: 'point_card',   label: 'GAS' },
          { value: 'gas_fee',      label: '燃油费' },
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

  const columns: AdminColumn<TransactionItem>[] = [
    { key: 'userEmail', title: '用户',   render: (r) => <span className="text-[#9090A0] text-xs">{r.userEmail}</span> },
    { key: 'type',      title: '类型',   align: 'center', render: (r) => <AdminStatusBadge status={r.type} map={TX_TYPE_MAP} /> },
    { key: 'amount',    title: '金额',   align: 'right',  render: (r) => <span className="font-mono text-white">{fmtUSD(r.amount)}</span> },
    { key: 'status',    title: '状态',   align: 'center', render: (r) => <AdminStatusBadge status={r.status} /> },
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
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1">
          {[
            { value: '',         label: '全部类型' },
            { value: 'deposit',  label: '充值' },
            { value: 'withdraw', label: '提现' },
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
            { value: '',           label: '全部状态' },
            { value: 'pending',    label: '待处理' },
            { value: 'completed',  label: '已完成' },
            { value: 'failed',     label: '失败' },
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

  const { data: trend, loading, error, refetch } =
    useAdminApi<TrendItem[]>(`/admin/finance/trend?days=${period}`, {
      deps: [period],
    });

  if (loading) return <AdminSkeleton mode="grid" count={1} cols={1} />;
  if (error)   return <AdminErrorState message={error} onRetry={refetch} />;

  const trendData = Array.isArray(trend) ? trend : [];
  const totalRevenue = trendData.reduce((sum, d) => sum + parseFloat(d.revenue || '0'), 0);

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
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  period === val
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-[#9090A0] hover:text-white hover:bg-[#1E1E2E]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <SimpleBarChart data={trendData} />

        {/* 日期标签（首尾） */}
        {trendData.length > 1 && (
          <div className="flex justify-between mt-1 text-xs text-[#9090A0]">
            <span>{trendData[0].date}</span>
            <span>{trendData[trendData.length - 1].date}</span>
          </div>
        )}
      </div>

      {/* 明细表格 */}
      {trendData.length > 0 && (
        <div>
          <p className="text-sm font-medium text-white mb-2">每日明细</p>
          <AdminTable<TrendItem>
            columns={[
              { key: 'date',    title: '日期', render: (r) => <span className="text-[#9090A0]">{r.date}</span> },
              { key: 'revenue', title: '收入', align: 'right', render: (r) => <span className="font-mono text-white">{fmtUSD(r.revenue)}</span> },
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
