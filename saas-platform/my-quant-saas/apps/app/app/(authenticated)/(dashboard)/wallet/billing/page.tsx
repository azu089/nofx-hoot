'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { Button } from '@repo/design-system/components/ui/button';
import { Input } from '@repo/design-system/components/ui/input';
import {
  Receipt,
  TrendingUp,
  TrendingDown,
  Filter,
  Download,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { billingApi, BillingLog } from '@/lib/api';

const billingTypes = [
  { value: 'all', label: '全部类型' },
  { value: 'deposit', label: '充值' },
  { value: 'withdrawal', label: '提现' },
  { value: 'gas_fee', label: 'Gas 费' },
  { value: 'subscription', label: '策略订阅' },
  { value: 'staking_reward', label: '质押收益' },
  { value: 'referral_bonus', label: '推广返佣' },
];

export default function BillingPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [billingLogs, setBillingLogs] = useState<BillingLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBillingLogs();
  }, [typeFilter, page]);

  const fetchBillingLogs = async () => {
    setLoading(true);
    try {
      const res = await billingApi.getBillingLogs({
        page,
        limit: 20,
        type: typeFilter === 'all' ? undefined : typeFilter,
      });
      setBillingLogs(res.data.logs);
      setTotalLogs(res.data.total);
    } catch (error) {
      console.error('Failed to fetch billing logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = billingLogs.filter((record) => {
    const matchSearch = record.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSearch;
  });

  // 计算统计数据
  const stats = filteredRecords.reduce(
    (acc, log) => {
      const amount = parseFloat(log.amount);
      if (amount > 0) {
        acc.totalIncome += amount;
      } else {
        acc.totalExpense += Math.abs(amount);
      }
      return acc;
    },
    { totalIncome: 0, totalExpense: 0 }
  );
  const netChange = stats.totalIncome - stats.totalExpense;

  const getTypeLabel = (type: string) => {
    const found = billingTypes.find((t) => t.value === type);
    return found?.label || type;
  };

  const getTypeIcon = (amount: number) => {
    return amount >= 0 ? (
      <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
        <ArrowDownLeft className="w-4 h-4 text-green-500" />
      </div>
    ) : (
      <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
        <ArrowUpRight className="w-4 h-4 text-red-500" />
      </div>
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="w-7 h-7 text-primary" />
            账单明细
          </h1>
          <p className="text-muted-foreground">查看所有收支记录</p>
        </div>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          导出账单
        </Button>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">本月收入</p>
                <p className="text-xl font-bold text-green-500">+${stats.totalIncome.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">本月支出</p>
                <p className="text-xl font-bold text-red-500">-${stats.totalExpense.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                <Receipt className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">净变化</p>
                <p className={`text-xl font-bold ${netChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {netChange >= 0 ? '+' : ''}${netChange.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选器 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索账单..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 bg-muted border border-border rounded-lg"
            >
              {billingTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* 账单列表 */}
      <Card>
        <CardHeader>
          <CardTitle>交易记录</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>加载中...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>暂无账单记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRecords.map((record) => {
                const amount = parseFloat(record.amount);
                return (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getTypeIcon(amount)}
                      <div>
                        <p className="font-medium text-sm">{record.description}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="px-1.5 py-0.5 bg-muted rounded">
                            {getTypeLabel(record.billing_type)}
                          </span>
                          <span>{new Date(record.created_at).toLocaleString('zh-CN')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {amount >= 0 ? '+' : ''}${Math.abs(amount).toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 分页 */}
          {filteredRecords.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                共 {totalLogs} 条记录
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm">第 {page} 页</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filteredRecords.length < 20}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
