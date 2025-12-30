'use client';

import { useState, useEffect } from 'react';

interface PerformanceData {
  date: string;
  commission: number;
  users: number;
}

export default function AgentPerformancePage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [data, setData] = useState<PerformanceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 模拟数据
    const mockData: PerformanceData[] = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      commission: Math.random() * 100,
      users: Math.floor(Math.random() * 5),
    })).reverse();

    setData(mockData);
    setIsLoading(false);
  }, [period]);

  const totalCommission = data.reduce((sum, d) => sum + d.commission, 0);
  const totalUsers = data.reduce((sum, d) => sum + d.users, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">业绩报表</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            查看您的推广业绩和返佣统计
          </p>
        </div>
        <div className="flex gap-2">
          {(['week', 'month', 'year'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                period === p
                  ? 'bg-[var(--brand-primary)] text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {p === 'week' ? '近7天' : p === 'month' ? '近30天' : '近1年'}
            </button>
          ))}
        </div>
      </div>

      {/* 汇总数据 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
          <div className="text-sm text-[var(--text-secondary)]">期间佣金</div>
          <div className="text-2xl font-bold text-[var(--success)] mt-2">
            ${totalCommission.toFixed(2)}
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
          <div className="text-sm text-[var(--text-secondary)]">新增用户</div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-2">
            {totalUsers}
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
          <div className="text-sm text-[var(--text-secondary)]">日均佣金</div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-2">
            ${(totalCommission / data.length || 0).toFixed(2)}
          </div>
        </div>
      </div>

      {/* 佣金曲线图 (简化版) */}
      <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
        <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">佣金趋势</h3>
        <div className="h-64 flex items-end gap-1">
          {data.slice(-30).map((d, i) => {
            const height = (d.commission / Math.max(...data.map(x => x.commission))) * 100;
            return (
              <div
                key={i}
                className="flex-1 bg-[var(--brand-primary)] rounded-t opacity-80 hover:opacity-100 transition-opacity"
                style={{ height: `${height}%`, minHeight: '4px' }}
                title={`${d.date}: $${d.commission.toFixed(2)}`}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-xs text-[var(--text-tertiary)]">
          <span>{data[0]?.date}</span>
          <span>{data[data.length - 1]?.date}</span>
        </div>
      </div>

      {/* 明细表格 */}
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border-primary)]">
          <h3 className="text-lg font-medium text-[var(--text-primary)]">每日明细</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--bg-tertiary)]">
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-secondary)]">日期</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-[var(--text-secondary)]">新增用户</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-[var(--text-secondary)]">佣金</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(-10).reverse().map((d, i) => (
                <tr key={i} className="border-t border-[var(--border-primary)]">
                  <td className="px-4 py-3 text-sm text-[var(--text-primary)]">{d.date}</td>
                  <td className="px-4 py-3 text-sm text-right text-[var(--text-primary)]">{d.users}</td>
                  <td className="px-4 py-3 text-sm text-right text-[var(--success)]">${d.commission.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
