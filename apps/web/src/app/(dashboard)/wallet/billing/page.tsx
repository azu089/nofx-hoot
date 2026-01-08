'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button, MobileHeader } from '@/components/ui';
import { billingApi } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import {
  Receipt,
  Download,
  Filter,
  ArrowDownToLine,
  ArrowUpFromLine,
  Server,
  Fuel,
  Gift,
} from 'lucide-react';

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
  vpsExpense: string;
  gasFeeExpense: string;
}

export default function BillingPage() {
  const router = useRouter();
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
      setStats(statsRes.data);
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
        return <Server className="w-4 h-4 text-brand-primary" />;
      case 'gas_fee':
        return <Fuel className="w-4 h-4 text-warning" />;
      case 'bonus':
      case 'referral':
        return <Gift className="w-4 h-4 text-success" />;
      case 'token_purchase':
      case 'token_sale':
        return <Receipt className="w-4 h-4 text-purple-400" />;
      case 'staking':
      case 'unstaking':
        return <Server className="w-4 h-4 text-blue-400" />;
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
        <MobileHeader title="账单明细" />
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-bg-tertiary rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <MobileHeader
        title="账单明细"
        rightAction={
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            导出
          </Button>
        }
      />

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-text-secondary text-sm mb-1">总收入</p>
              <p className="text-success text-2xl font-bold">
                +{formatCurrency(stats.totalIncome)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-text-secondary text-sm mb-1">总支出</p>
              <p className="text-danger text-2xl font-bold">
                -{formatCurrency(stats.totalExpense)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-text-secondary text-sm mb-1">会员订阅</p>
              <p className="text-white text-2xl font-bold">
                {formatCurrency(stats.vpsExpense)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-text-secondary text-sm mb-1">燃油费（点卡）</p>
              <p className="text-white text-2xl font-bold">
                {formatCurrency(stats.gasFeeExpense)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 筛选 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-text-secondary" />
            <span className="text-text-secondary text-sm">类型:</span>
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(0);
              }}
              className="bg-bg-tertiary border border-border-secondary rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
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
        </CardContent>
      </Card>

      {/* 账单列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-brand-primary" />
            账单记录 ({total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-12 text-text-secondary">
              <Receipt className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>暂无账单记录</p>
            </div>
          ) : (
            <>
              {/* 表头 */}
              <div className="hidden md:grid grid-cols-5 gap-4 p-4 bg-bg-tertiary/30 rounded-lg mb-3 text-sm text-text-secondary">
                <div>时间</div>
                <div>类型</div>
                <div className="text-right">金额</div>
                <div className="text-right">余额</div>
                <div>描述</div>
              </div>

              {/* 数据行 */}
              <div className="space-y-2">
                {logs.map((log) => {
                  const income = isIncome(log.type);

                  return (
                    <div
                      key={log.id}
                      className="grid grid-cols-1 md:grid-cols-5 gap-2 md:gap-4 p-4 bg-bg-tertiary/20 hover:bg-bg-tertiary/40 rounded-lg transition-colors"
                    >
                      <div className="text-text-secondary text-sm">
                        {formatDateTime(log.created_at)}
                      </div>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(log.type)}
                        <span className="text-white">{getTypeName(log.type)}</span>
                      </div>
                      <div
                        className={`text-right font-medium ${
                          income ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {income ? '+' : '-'}
                        {formatCurrency(log.amount)}
                      </div>
                      <div className="text-text-secondary text-right">
                        {formatCurrency(log.balance_after)}
                      </div>
                      <div className="text-text-tertiary text-sm truncate">
                        {log.description}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                  >
                    上一页
                  </Button>
                  <span className="text-text-secondary text-sm">
                    第 {page + 1} / {totalPages} 页
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page === totalPages - 1}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
