'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Download, FileText, DollarSign, TrendingUp, Calendar, RefreshCw } from 'lucide-react';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'trades' | 'revenue'>('trades');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [billingType, setBillingType] = useState('');

  // 获取交易报表
  const { data: tradeReport, isLoading: tradesLoading, refetch: refetchTrades } = useQuery({
    queryKey: ['admin-trade-report', startDate, endDate],
    queryFn: async () => {
      const res = await adminApi.getTradeReport({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      return res.data;
    },
    enabled: activeTab === 'trades',
  });

  // 获取收入报表
  const { data: revenueReport, isLoading: revenueLoading, refetch: refetchRevenue } = useQuery({
    queryKey: ['admin-revenue-report', startDate, endDate, billingType],
    queryFn: async () => {
      const res = await adminApi.getRevenueReport({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        billingType: billingType || undefined,
      });
      return res.data;
    },
    enabled: activeTab === 'revenue',
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const exportToCSV = (data: Record<string, unknown>[], filename: string) => {
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          // 处理包含逗号或引号的字段
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleExportTrades = () => {
    if (tradeReport?.trades) {
      const exportData = tradeReport.trades.map((t) => ({
        '用户邮箱': t.userEmail,
        '交易对': t.symbol,
        '方向': t.side === 'buy' ? '买入' : '卖出',
        '数量': t.quantity,
        '价格': t.price,
        '费用': t.fee,
        '盈亏': t.pnl,
        '时间': formatDate(t.createdAt),
      }));
      exportToCSV(exportData, 'trade_report');
    }
  };

  const handleExportRevenue = () => {
    if (revenueReport?.records) {
      const exportData = revenueReport.records.map((r) => ({
        '用户邮箱': r.userEmail,
        '类型': r.type,
        '金额': r.amount,
        '描述': r.description,
        '时间': formatDate(r.createdAt),
      }));
      exportToCSV(exportData, 'revenue_report');
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">报表导出</h1>
          <p className="text-text-secondary">查看和导出交易、收入报表数据</p>
        </div>
      </div>

      {/* Tab 切换 */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex gap-2">
            <Button
              variant={activeTab === 'trades' ? 'primary' : 'outline'}
              onClick={() => setActiveTab('trades')}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              交易报表
            </Button>
            <Button
              variant={activeTab === 'revenue' ? 'primary' : 'outline'}
              onClick={() => setActiveTab('revenue')}
            >
              <DollarSign className="w-4 h-4 mr-2" />
              收入报表
            </Button>
          </div>

          {/* 日期筛选 */}
          <div className="flex gap-2 items-center ml-auto">
            <Calendar className="w-4 h-4 text-text-tertiary" />
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-40"
              placeholder="开始日期"
            />
            <span className="text-text-tertiary">至</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-40"
              placeholder="结束日期"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
            >
              清除
            </Button>
          </div>
        </div>

        {/* 收入类型筛选（仅收入报表显示） */}
        {activeTab === 'revenue' && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-border-primary">
            <span className="text-sm text-text-secondary self-center">类型:</span>
            <Button
              variant={billingType === '' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setBillingType('')}
            >
              全部
            </Button>
            <Button
              variant={billingType === 'subscription' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setBillingType('subscription')}
            >
              订阅费
            </Button>
            <Button
              variant={billingType === 'gas_fee' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setBillingType('gas_fee')}
            >
              燃油费
            </Button>
            <Button
              variant={billingType === 'vps_fee' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setBillingType('vps_fee')}
            >
              VPS费
            </Button>
            <Button
              variant={billingType === 'deposit' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setBillingType('deposit')}
            >
              充值
            </Button>
          </div>
        )}
      </Card>

      {/* 交易报表 */}
      {activeTab === 'trades' && (
        <>
          {/* 统计卡片 */}
          {tradesLoading ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
            </div>
          ) : tradeReport && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-brand-primary/10">
                    <FileText className="w-5 h-5 text-brand-primary" />
                  </div>
                  <div>
                    <div className="text-sm text-text-secondary">交易笔数</div>
                    <div className="text-xl font-bold text-text-primary">{tradeReport.stats.totalTrades}</div>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-success/10">
                    <TrendingUp className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <div className="text-sm text-text-secondary">总交易量</div>
                    <div className="text-xl font-bold text-success">
                      {tradeReport.stats.totalVolume.toFixed(2)}
                    </div>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-warning/10">
                    <DollarSign className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <div className="text-sm text-text-secondary">总手续费</div>
                    <div className="text-xl font-bold text-warning">
                      {tradeReport.stats.totalFees.toFixed(4)}
                    </div>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${tradeReport.stats.totalPnl >= 0 ? 'bg-success/10' : 'bg-danger/10'}`}>
                    <TrendingUp className={`w-5 h-5 ${tradeReport.stats.totalPnl >= 0 ? 'text-success' : 'text-danger'}`} />
                  </div>
                  <div>
                    <div className="text-sm text-text-secondary">总盈亏</div>
                    <div className={`text-xl font-bold ${tradeReport.stats.totalPnl >= 0 ? 'text-success' : 'text-danger'}`}>
                      {tradeReport.stats.totalPnl >= 0 ? '+' : ''}{tradeReport.stats.totalPnl.toFixed(2)}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* 交易列表 */}
          <Card className="overflow-hidden">
            <div className="px-6 py-4 border-b border-border-primary flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">交易记录</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => refetchTrades()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  刷新
                </Button>
                <Button
                  size="sm"
                  onClick={handleExportTrades}
                  disabled={!tradeReport?.trades?.length}
                >
                  <Download className="w-4 h-4 mr-2" />
                  导出 CSV
                </Button>
              </div>
            </div>
            {tradesLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-bg-tertiary">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">用户</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">交易对</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">方向</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">数量</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">价格</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">费用</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">盈亏</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-primary">
                    {tradeReport?.trades?.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-text-secondary">
                          暂无交易记录
                        </td>
                      </tr>
                    ) : (
                      tradeReport?.trades?.slice(0, 100).map((trade) => (
                        <tr key={trade.id} className="hover:bg-bg-tertiary/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-text-primary">{trade.userEmail}</div>
                          </td>
                          <td className="px-6 py-4 text-text-primary font-mono">{trade.symbol}</td>
                          <td className="px-6 py-4">
                            <Badge variant={trade.side === 'buy' ? 'success' : 'danger'} outline>
                              {trade.side === 'buy' ? '买入' : '卖出'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 font-mono text-text-primary">
                            {parseFloat(trade.quantity).toFixed(4)}
                          </td>
                          <td className="px-6 py-4 font-mono text-text-primary">
                            {parseFloat(trade.price).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 font-mono text-text-secondary">
                            {parseFloat(trade.fee).toFixed(6)}
                          </td>
                          <td className={`px-6 py-4 font-mono font-bold ${parseFloat(trade.pnl) >= 0 ? 'text-success' : 'text-danger'}`}>
                            {parseFloat(trade.pnl) >= 0 ? '+' : ''}{parseFloat(trade.pnl).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm text-text-secondary">
                            {formatDate(trade.createdAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                {tradeReport?.trades && tradeReport.trades.length > 100 && (
                  <div className="px-6 py-3 text-center text-sm text-text-tertiary border-t border-border-primary">
                    显示前 100 条记录，共 {tradeReport.trades.length} 条。导出 CSV 可获取全部数据。
                  </div>
                )}
              </div>
            )}
          </Card>
        </>
      )}

      {/* 收入报表 */}
      {activeTab === 'revenue' && (
        <>
          {/* 统计卡片 */}
          {revenueLoading ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
            </div>
          ) : revenueReport && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-success/10">
                    <DollarSign className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <div className="text-sm text-text-secondary">总收入</div>
                    <div className="text-xl font-bold text-success">
                      {revenueReport.stats.totalRevenue.toFixed(2)} USDT
                    </div>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-brand-primary/10">
                    <FileText className="w-5 h-5 text-brand-primary" />
                  </div>
                  <div>
                    <div className="text-sm text-text-secondary">记录数</div>
                    <div className="text-xl font-bold text-text-primary">{revenueReport.stats.totalRecords}</div>
                  </div>
                </div>
              </Card>
              <Card className="p-4 col-span-2">
                <div className="space-y-2">
                  <div className="text-sm text-text-secondary">收入构成</div>
                  {revenueReport.stats.byType.map((item) => (
                    <div key={item.type} className="flex items-center justify-between text-sm">
                      <span className="text-text-tertiary">{item.type}</span>
                      <span className="text-text-primary font-medium font-mono">
                        {parseFloat(item.amount).toFixed(2)} USDT
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* 收入列表 */}
          <Card className="overflow-hidden">
            <div className="px-6 py-4 border-b border-border-primary flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">收入记录</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => refetchRevenue()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  刷新
                </Button>
                <Button
                  size="sm"
                  onClick={handleExportRevenue}
                  disabled={!revenueReport?.records?.length}
                >
                  <Download className="w-4 h-4 mr-2" />
                  导出 CSV
                </Button>
              </div>
            </div>
            {revenueLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-bg-tertiary">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">用户</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">类型</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">金额</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">描述</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-primary">
                    {revenueReport?.records?.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-text-secondary">
                          暂无收入记录
                        </td>
                      </tr>
                    ) : (
                      revenueReport?.records?.slice(0, 100).map((record) => (
                        <tr key={record.id} className="hover:bg-bg-tertiary/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-text-primary">{record.userEmail}</div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="secondary" outline>{record.type}</Badge>
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-success">
                            +{parseFloat(record.amount).toFixed(2)} USDT
                          </td>
                          <td className="px-6 py-4 text-text-secondary max-w-[200px] truncate" title={record.description}>
                            {record.description || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-text-secondary">
                            {formatDate(record.createdAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                {revenueReport?.records && revenueReport.records.length > 100 && (
                  <div className="px-6 py-3 text-center text-sm text-text-tertiary border-t border-border-primary">
                    显示前 100 条记录，共 {revenueReport.records.length} 条。导出 CSV 可获取全部数据。
                  </div>
                )}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
