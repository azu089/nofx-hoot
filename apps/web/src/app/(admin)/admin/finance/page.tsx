'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Download,
  PieChart,
  BarChart3,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

export default function AdminFinancePage() {
  const [period, setPeriod] = useState('month');

  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'finance', 'stats', period],
    queryFn: () => adminApi.getFinanceStats(period),
  });
  const stats = statsRes?.data;

  const { data: transactionsRes } = useQuery({
    queryKey: ['admin', 'finance', 'transactions'],
    queryFn: () => adminApi.getFinanceTransactions(1),
  });
  const transactions = transactionsRes?.data;

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      deposit: '充值',
      withdrawal: '提现',
      subscription: '订阅',
      gas_fee: 'Gas 手续费',
      commission: '代理佣金',
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      deposit: 'text-success',
      withdrawal: 'text-danger',
      subscription: 'text-brand-primary',
      gas_fee: 'text-warning',
      commission: 'text-purple-500',
    };
    return colors[type] || 'text-white';
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">财务审计</h1>
          <p className="text-text-secondary mt-1">平台收支报表与财务分析</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white"
          >
            <option value="today">今日</option>
            <option value="week">本周</option>
            <option value="month">本月</option>
            <option value="year">本年</option>
          </select>
          <button className="px-4 py-2 bg-brand-primary text-white rounded-lg flex items-center gap-2 hover:bg-brand-secondary">
            <Download className="w-5 h-5" />
            导出报表
          </button>
        </div>
      </div>

      {/* 核心指标 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">总收入</p>
              <p className="text-2xl font-bold text-white mt-1">
                ${statsLoading ? '-' : stats?.totalRevenue}
              </p>
            </div>
            <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-success" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <ArrowUpRight className="w-4 h-4 text-success" />
            <span className="text-success">+{stats?.growthRate}%</span>
            <span className="text-text-secondary">较上月</span>
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">总支出</p>
              <p className="text-2xl font-bold text-white mt-1">
                ${statsLoading ? '-' : stats?.totalExpense}
              </p>
            </div>
            <div className="w-12 h-12 bg-danger/10 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-danger" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-text-secondary">含提现、佣金、运营成本</span>
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">净利润</p>
              <p className="text-2xl font-bold text-success mt-1">
                ${statsLoading ? '-' : stats?.netProfit}
              </p>
            </div>
            <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-warning" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-text-secondary">利润率: 63%</span>
          </div>
        </div>
      </div>

      {/* 收入分配和明细 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 收入分配 */}
        <div className="glass-card">
          <div className="p-4 border-b border-border-primary flex items-center gap-2">
            <PieChart className="w-5 h-5 text-brand-primary" />
            <h2 className="text-lg font-semibold text-white">收入分配</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-brand-primary" />
                <span className="text-white">运营 (40%)</span>
              </div>
              <span className="text-white font-medium">${stats?.revenueDistribution.operations}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-success" />
                <span className="text-white">回购 (40%)</span>
              </div>
              <span className="text-white font-medium">${stats?.revenueDistribution.buyback}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-warning" />
                <span className="text-white">储备 (20%)</span>
              </div>
              <span className="text-white font-medium">${stats?.revenueDistribution.reserve}</span>
            </div>
          </div>
        </div>

        {/* 收入构成 */}
        <div className="glass-card">
          <div className="p-4 border-b border-border-primary flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-success" />
            <h2 className="text-lg font-semibold text-white">收入构成</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-text-secondary">订阅收入</span>
                <span className="text-white">${stats?.breakdown.subscription}</span>
              </div>
              <div className="w-full h-2 bg-border-primary rounded-full overflow-hidden">
                <div className="h-full bg-brand-primary rounded-full" style={{ width: '40%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-text-secondary">Gas 手续费</span>
                <span className="text-white">${stats?.breakdown.gasFee}</span>
              </div>
              <div className="w-full h-2 bg-border-primary rounded-full overflow-hidden">
                <div className="h-full bg-success rounded-full" style={{ width: '25%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-text-secondary">充值</span>
                <span className="text-white">${stats?.breakdown.deposit}</span>
              </div>
              <div className="w-full h-2 bg-border-primary rounded-full overflow-hidden">
                <div className="h-full bg-warning rounded-full" style={{ width: '20%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 最近交易 */}
      <div className="glass-card">
        <div className="p-4 border-b border-border-primary flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">最近交易</h2>
          <a href="/admin/finance/withdrawals" className="text-brand-primary text-sm hover:underline">
            查看全部
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-primary">
                <th className="px-6 py-3 text-left text-sm font-medium text-text-secondary">类型</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-text-secondary">金额</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-text-secondary">用户</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-text-secondary">时间</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-text-secondary">状态</th>
              </tr>
            </thead>
            <tbody>
              {transactions?.data.map((tx) => (
                <tr key={tx.id} className="border-b border-border-primary hover:bg-bg-tertiary">
                  <td className="px-6 py-4">
                    <span className={`text-sm ${getTypeColor(tx.type)}`}>
                      {getTypeLabel(tx.type)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`font-medium ${
                      tx.amount.startsWith('+') ? 'text-success' : 'text-danger'
                    }`}>
                      {tx.amount} USDT
                    </span>
                  </td>
                  <td className="px-6 py-4 text-white text-sm">{tx.user}</td>
                  <td className="px-6 py-4 text-text-secondary text-sm">{tx.time}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      tx.status === 'completed'
                        ? 'bg-success/10 text-success'
                        : 'bg-warning/10 text-warning'
                    }`}>
                      {tx.status === 'completed' ? '已完成' : '处理中'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
