'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Receipt, Filter, Download, Search, ChevronLeft, ChevronRight } from 'lucide-react';

type RecordType = 'all' | 'deposit' | 'withdrawal' | 'subscription' | 'gas_fee' | 'card_purchase' | 'card_deduct' | 'commission' | 'dividend' | 'points_add' | 'points_deduct' | 'token_add' | 'token_release' | 'exchange';

interface TransactionRecord {
  id: string;
  userId: string;
  userEmail: string;
  type: string;
  amount: string;
  balance_after: string;
  currency: string;
  description: string;
  reference_id: string;
  created_at: string;
}

interface RecordsResponse {
  records: TransactionRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const RECORD_TYPES: { value: RecordType; label: string; color: string }[] = [
  { value: 'all', label: '全部', color: 'text-text-secondary' },
  { value: 'deposit', label: '充值', color: 'text-success' },
  { value: 'withdrawal', label: '提现', color: 'text-danger' },
  { value: 'subscription', label: '订阅费', color: 'text-brand-primary' },
  { value: 'gas_fee', label: 'Gas费', color: 'text-warning' },
  { value: 'card_purchase', label: '点卡购买', color: 'text-info' },
  { value: 'card_deduct', label: '点卡扣除', color: 'text-danger' },
  { value: 'commission', label: '返佣', color: 'text-success' },
  { value: 'dividend', label: '分红', color: 'text-success' },
  { value: 'points_add', label: '积分获得', color: 'text-success' },
  { value: 'points_deduct', label: '积分扣除', color: 'text-danger' },
  { value: 'token_add', label: '代币获得', color: 'text-success' },
  { value: 'token_release', label: '代币释放', color: 'text-brand-primary' },
  { value: 'exchange', label: '兑换', color: 'text-info' },
];

export default function RecordsPage() {
  const [type, setType] = useState<RecordType>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['finance-records', type, search, page, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('pageSize', '20');
      if (type !== 'all') params.append('type', type);
      if (search) params.append('search', search);
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);

      const res = await api.get(`/admin/finance/records?${params.toString()}`);
      return res.data as RecordsResponse;
    },
  });

  const getTypeColor = (recordType: string) => {
    const found = RECORD_TYPES.find((t) => t.value === recordType);
    return found?.color || 'text-text-secondary';
  };

  const getTypeLabel = (recordType: string) => {
    const found = RECORD_TYPES.find((t) => t.value === recordType);
    return found?.label || recordType;
  };

  const formatAmount = (amount: string, recordType: string) => {
    const num = Number(amount);
    const isPositive = ['deposit', 'commission', 'dividend', 'points_add', 'token_add', 'token_release'].includes(recordType);
    const prefix = isPositive ? '+' : num < 0 ? '' : '-';
    return `${prefix}${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`;
  };

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (type !== 'all') params.append('type', type);
    if (search) params.append('search', search);
    if (dateRange.start) params.append('startDate', dateRange.start);
    if (dateRange.end) params.append('endDate', dateRange.end);
    params.append('format', 'csv');

    window.open(`/api/admin/finance/records/export?${params.toString()}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center">
            <Receipt className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">交易明细</h1>
            <p className="text-sm text-text-secondary">
              查看全网所有交易记录：充提、点卡、积分、代币、分红等
            </p>
          </div>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-bg-secondary text-text-primary rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          导出 CSV
        </button>
      </div>

      {/* 筛选条件 */}
      <div className="bg-bg-secondary rounded-xl p-4 border border-border-primary">
        <div className="flex flex-wrap items-center gap-4">
          {/* 类型筛选 */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-secondary" />
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as RecordType);
                setPage(1);
              }}
              className="bg-bg-tertiary text-white rounded-lg px-3 py-2 border border-border-primary focus:border-brand-primary focus:outline-none text-sm"
            >
              {RECORD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* 搜索 */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Search className="w-4 h-4 text-text-secondary" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="搜索用户邮箱或 ID..."
              className="flex-1 bg-bg-tertiary text-white rounded-lg px-3 py-2 border border-border-primary focus:border-brand-primary focus:outline-none text-sm"
            />
          </div>

          {/* 日期范围 */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => {
                setDateRange({ ...dateRange, start: e.target.value });
                setPage(1);
              }}
              className="bg-bg-tertiary text-white rounded-lg px-3 py-2 border border-border-primary focus:border-brand-primary focus:outline-none text-sm"
            />
            <span className="text-text-secondary">至</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => {
                setDateRange({ ...dateRange, end: e.target.value });
                setPage(1);
              }}
              className="bg-bg-tertiary text-white rounded-lg px-3 py-2 border border-border-primary focus:border-brand-primary focus:outline-none text-sm"
            />
          </div>
        </div>
      </div>

      {/* 记录列表 */}
      <div className="bg-bg-secondary rounded-xl border border-border-primary">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-danger">加载失败，请刷新重试</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-text-secondary text-sm border-b border-border-primary">
                    <th className="text-left p-4">时间</th>
                    <th className="text-left p-4">用户</th>
                    <th className="text-left p-4">类型</th>
                    <th className="text-right p-4">金额</th>
                    <th className="text-left p-4">币种</th>
                    <th className="text-right p-4">余额</th>
                    <th className="text-left p-4">说明</th>
                    <th className="text-left p-4">关联 ID</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.records?.map((record) => (
                    <tr
                      key={record.id}
                      className="border-b border-border-primary hover:bg-bg-tertiary"
                    >
                      <td className="p-4 text-text-secondary text-sm">
                        {new Date(record.created_at).toLocaleString('zh-CN')}
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="text-white text-sm">{record.userEmail}</p>
                          <p className="text-text-tertiary text-xs">{record.userId.slice(0, 8)}...</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium bg-bg-tertiary ${getTypeColor(
                            record.type
                          )}`}
                        >
                          {getTypeLabel(record.type)}
                        </span>
                      </td>
                      <td className={`p-4 text-right font-medium ${
                        ['deposit', 'commission', 'dividend', 'points_add', 'token_add', 'token_release'].includes(record.type)
                          ? 'text-success'
                          : 'text-danger'
                      }`}>
                        {formatAmount(record.amount, record.type)}
                      </td>
                      <td className="p-4 text-text-secondary text-sm">{record.currency}</td>
                      <td className="p-4 text-right text-white text-sm">
                        {Number(record.balance_after).toLocaleString('en-US', { maximumFractionDigits: 8 })}
                      </td>
                      <td className="p-4 text-text-secondary text-sm max-w-[200px] truncate">
                        {record.description || '-'}
                      </td>
                      <td className="p-4 text-text-tertiary text-xs font-mono">
                        {record.reference_id ? record.reference_id.slice(0, 12) + '...' : '-'}
                      </td>
                    </tr>
                  ))}
                  {(!data?.records || data.records.length === 0) && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-text-secondary">
                        暂无交易记录
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-border-primary">
                <p className="text-text-secondary text-sm">
                  共 {data.total} 条记录，第 {data.page}/{data.totalPages} 页
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 bg-bg-tertiary rounded-lg hover:bg-bg-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4 text-white" />
                  </button>
                  <span className="text-white text-sm px-4">{page}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                    disabled={page === data.totalPages}
                    className="p-2 bg-bg-tertiary rounded-lg hover:bg-bg-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
