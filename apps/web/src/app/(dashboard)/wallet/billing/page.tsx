'use client';

import { useEffect, useState } from 'react';
import { billingApi } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import {
  Receipt,
  Download,
  Filter,
  ArrowDownToLine,
  ArrowUpFromLine,
  Crown,
  CreditCard,
  Gift,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { MobileHeader } from '@/components/ui';

interface BillingLog {
  id: string;
  type: string;
  amount: string;
  balance_after: string;
  description: string;
  created_at: string;
}

interface BillingStats {
  totalIncome: string;
  totalExpense: string;
  subscriptionExpense: string;
  cardExpense: string;
}

export default function BillingPage() {
  const [logs, setLogs] = useState<BillingLog[]>([]);
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchData = async () => {
    try {
      const [logsRes, statsRes] = await Promise.all([
        billingApi.getLogs({
          type: filter === 'all' ? undefined : filter,
          limit,
          offset: page * limit,
        }),
        billingApi.getStats(),
      ]);

      setLogs(logsRes.data?.logs || []);
      setTotal(logsRes.data?.total || 0);
      // 兼容后端可能返回旧字段名的情况
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawStats = statsRes.data as any;
      if (rawStats) {
        setStats({
          totalIncome: rawStats.totalIncome || '0',
          totalExpense: rawStats.totalExpense || '0',
          subscriptionExpense: rawStats.subscriptionExpense || rawStats.vpsExpense || '0',
          cardExpense: rawStats.cardExpense || rawStats.gasFeeExpense || '0',
        });
      }
    } catch (error) {
      console.error('Failed to fetch billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filter, page]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownToLine className="w-4 h-4 text-success" />;
      case 'withdrawal':
        return <ArrowUpFromLine className="w-4 h-4 text-danger" />;
      case 'subscription':
        return <Crown className="w-4 h-4 text-brand-primary" />;
      case 'gas_fee':
        return <CreditCard className="w-4 h-4 text-warning" />;
      case 'bonus':
      case 'referral':
        return <Gift className="w-4 h-4 text-success" />;
      case 'token_purchase':
      case 'token_sale':
        return <Receipt className="w-4 h-4 text-purple-400" />;
      case 'staking':
      case 'unstaking':
        return <Crown className="w-4 h-4 text-blue-400" />;
      default:
        return <Receipt className="w-4 h-4 text-text-secondary" />;
    }
  };

  const getTypeName = (type: string) => {
    const map: Record<string, string> = {
      deposit: '充值',
      withdrawal: '提现',
      subscription: '会员订阅',
      gas_fee: '燃油费（点卡）',
      bonus: '奖励（积分）',
      referral: '邀请返佣（积分）',
      refund: '退款',
      token_purchase: '代币购买',
      token_sale: '代币出售',
      staking: '质押',
      unstaking: '解除质押',
    };
    return map[type] || type;
  };

  const isIncome = (type: string) => {
    return ['deposit', 'bonus', 'referral', 'refund'].includes(type);
  };

  const handleExport = () => {
    const content = logs
      .map(
        (log) =>
          `${formatDateTime(log.created_at)},${getTypeName(log.type)},${log.amount},${log.balance_after},${log.description}`
      )
      .join('\n');
    const header = '时间,类型,金额,余额,描述\n';
    const blob = new Blob([header + content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / limit);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-bg-tertiary rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-bg-primary">
      {/* ========== 收支统计 - 统一资产卡片 + 光球脉动 ========== */}
      <div className="mx-4 mt-4 mb-4 relative bg-bg-secondary rounded-2xl p-5 overflow-hidden lg:hidden">
        {/* 光球脉动效果 */}
        <div className="pointer-events-none absolute -top-20 right-0 h-40 w-40 animate-pulse rounded-full opacity-30 blur-3xl bg-brand-primary" />

        <div className="relative z-10">
          {/* 标题行 */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-text-secondary text-sm">收支概览</span>
          </div>

          {/* 主要数据 - 总收入 */}
          <div className="mb-4">
            <p className="text-text-tertiary text-xs mb-1">总收入</p>
            <p className="text-3xl font-bold font-mono text-success">
              +{formatCurrency(stats?.totalIncome || '0')}
            </p>
          </div>

          {/* 次要数据 - 三列布局 */}
          <div className="grid grid-cols-3 gap-4 pt-4">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown className="w-3.5 h-3.5 text-danger" />
                <span className="text-text-tertiary text-xs">总支出</span>
              </div>
              <p className="text-lg font-bold font-mono text-danger">
                -{parseFloat(stats?.totalExpense || '0').toFixed(2)}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Crown className="w-3.5 h-3.5 text-brand-primary" />
                <span className="text-text-tertiary text-xs">订阅费</span>
              </div>
              <p className="text-lg font-bold font-mono text-white">
                {parseFloat(stats?.subscriptionExpense || '0').toFixed(2)}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <CreditCard className="w-3.5 h-3.5 text-warning" />
                <span className="text-text-tertiary text-xs">点卡消耗</span>
              </div>
              <p className="text-lg font-bold font-mono text-white">
                {parseFloat(stats?.cardExpense || '0').toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 筛选栏 - 吸顶 */}
      <div className="sticky top-0 z-10 bg-bg-primary border-b border-border-primary">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Filter className="w-4 h-4 text-text-tertiary flex-shrink-0" />
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(0);
              }}
              className="bg-bg-tertiary border border-border-secondary rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary flex-1 min-w-0"
            >
              <option value="all">全部</option>
              <option value="deposit">充值</option>
              <option value="withdrawal">提现</option>
              <option value="subscription">会员订阅</option>
              <option value="gas_fee">燃油费（点卡）</option>
              <option value="bonus">奖励（积分）</option>
              <option value="referral">邀请返佣</option>
              <option value="token_purchase">代币购买</option>
              <option value="token_sale">代币出售</option>
            </select>
          </div>
          <button
            onClick={handleExport}
            className="p-2 text-text-tertiary hover:text-white transition-colors flex-shrink-0"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 账单列表 */}
      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
          <Receipt className="w-16 h-16 mb-4 opacity-30" />
          <p>暂无账单记录</p>
        </div>
      ) : (
        <>
          {/* 移动端列表 */}
          <div className="divide-y divide-border-primary/50 md:hidden">
            {logs.map((log) => {
              const income = isIncome(log.type);
              return (
                <div key={log.id} className="px-4 py-3 active:bg-bg-secondary transition-colors">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(log.type)}
                      <span className="text-white text-sm">{getTypeName(log.type)}</span>
                    </div>
                    <span className={`font-semibold ${income ? 'text-success' : 'text-danger'}`}>
                      {income ? '+' : '-'}{formatCurrency(log.amount)}
                    </span>
                  </div>
                  <div className="text-text-tertiary text-xs pl-6">
                    {formatDateTime(log.created_at)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 桌面端表格 */}
          <div className="hidden md:block px-4 py-2">
            <div className="grid grid-cols-5 gap-4 px-4 py-3 bg-bg-tertiary/30 rounded-lg mb-2 text-sm text-text-secondary">
              <div>时间</div>
              <div>类型</div>
              <div className="text-right">金额</div>
              <div className="text-right">余额</div>
              <div>描述</div>
            </div>
            <div className="divide-y divide-border-primary/30">
              {logs.map((log) => {
                const income = isIncome(log.type);
                return (
                  <div
                    key={log.id}
                    className="grid grid-cols-5 gap-4 px-4 py-3 hover:bg-bg-tertiary/20 transition-colors"
                  >
                    <div className="text-text-secondary text-sm">{formatDateTime(log.created_at)}</div>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(log.type)}
                      <span className="text-white">{getTypeName(log.type)}</span>
                    </div>
                    <div className={`text-right font-medium ${income ? 'text-success' : 'text-danger'}`}>
                      {income ? '+' : '-'}{formatCurrency(log.amount)}
                    </div>
                    <div className="text-text-secondary text-right">{formatCurrency(log.balance_after)}</div>
                    <div className="text-text-tertiary text-sm truncate">{log.description}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 py-4 border-t border-border-primary/50">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-4 py-2 text-sm text-text-secondary hover:text-white disabled:opacity-30"
              >
                上一页
              </button>
              <span className="text-text-tertiary text-sm">{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page === totalPages - 1}
                className="px-4 py-2 text-sm text-text-secondary hover:text-white disabled:opacity-30"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
