'use client';

import { useState, useEffect, useMemo } from 'react';
import { agentApi } from '@/lib/api';
import { Loader2, TrendingUp, Users, DollarSign } from 'lucide-react';

interface CommissionRecord {
  id: string;
  agent_id: string;
  user_id: string;
  user_email?: string;
  source_type: string;
  base_amount: string;
  commission_rate: string;
  commission_amount: string;
  status: string;
  settled_at?: string;
  created_at: string;
}

interface DailyPerformance {
  date: string;
  commission: number;
  users: Set<string>;
}

export default function AgentPerformancePage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const [stats, setStats] = useState<{
    totalUsers: number;
    totalCommission: string;
    pendingCommission: string;
    paidCommission: string;
    monthlyUsers: number;
    monthlyCommission: string;
    todayUsers: number;
    todayCommission: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // 并行获取统计和佣金明细
        const [statsRes, commissionsRes] = await Promise.all([
          agentApi.getStats(),
          agentApi.getCommissions({ limit: 500 }), // 获取足够多的记录用于图表
        ]);

        if (statsRes.code === 0 && statsRes.data) {
          setStats(statsRes.data);
        }

        if (commissionsRes.code === 0 && commissionsRes.data) {
          setCommissions(commissionsRes.data);
        }
      } catch (err) {
        console.error('获取业绩数据失败:', err);
        setError('获取数据失败，请稍后重试');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // 根据时间段筛选并按日期汇总数据
  const dailyData = useMemo(() => {
    const now = new Date();
    let daysCount = 30;
    if (period === 'week') daysCount = 7;
    if (period === 'year') daysCount = 365;

    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysCount);

    // 按日期分组
    const dailyMap = new Map<string, DailyPerformance>();

    // 初始化每一天
    for (let i = 0; i < daysCount; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      dailyMap.set(dateStr, { date: dateStr, commission: 0, users: new Set() });
    }

    // 填充真实数据
    commissions.forEach(c => {
      const date = c.created_at.split('T')[0];
      if (dailyMap.has(date)) {
        const day = dailyMap.get(date)!;
        day.commission += parseFloat(c.commission_amount);
        if (c.user_id) {
          day.users.add(c.user_id);
        }
      }
    });

    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [commissions, period]);

  const periodStats = useMemo(() => {
    const totalCommission = dailyData.reduce((sum, d) => sum + d.commission, 0);
    const uniqueUsers = new Set<string>();
    dailyData.forEach(d => d.users.forEach(u => uniqueUsers.add(u)));
    return {
      totalCommission,
      totalUsers: uniqueUsers.size,
      avgDaily: dailyData.length > 0 ? totalCommission / dailyData.length : 0,
    };
  }, [dailyData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-[var(--danger)]">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg hover:opacity-90"
        >
          重试
        </button>
      </div>
    );
  }

  const maxCommission = Math.max(...dailyData.map(d => d.commission), 1);

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
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <DollarSign className="w-4 h-4" />
            期间佣金
          </div>
          <div className="text-2xl font-bold text-[var(--success)] mt-2">
            ${periodStats.totalCommission.toFixed(2)}
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Users className="w-4 h-4" />
            活跃用户
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-2">
            {periodStats.totalUsers}
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <TrendingUp className="w-4 h-4" />
            日均佣金
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-2">
            ${periodStats.avgDaily.toFixed(2)}
          </div>
        </div>
      </div>

      {/* 佣金曲线图 */}
      <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
        <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">佣金趋势</h3>
        {dailyData.length > 0 ? (
          <>
            <div className="h-64 flex items-end gap-1">
              {dailyData.map((d, i) => {
                const height = (d.commission / maxCommission) * 100;
                return (
                  <div
                    key={i}
                    className="flex-1 bg-[var(--brand-primary)] rounded-t opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                    style={{ height: `${Math.max(height, 2)}%`, minHeight: '4px' }}
                    title={`${d.date}: $${d.commission.toFixed(2)}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-xs text-[var(--text-tertiary)]">
              <span>{dailyData[0]?.date}</span>
              <span>{dailyData[dailyData.length - 1]?.date}</span>
            </div>
          </>
        ) : (
          <div className="h-64 flex items-center justify-center text-[var(--text-secondary)]">
            暂无数据
          </div>
        )}
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
                <th className="px-4 py-3 text-right text-sm font-medium text-[var(--text-secondary)]">活跃用户</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-[var(--text-secondary)]">佣金</th>
              </tr>
            </thead>
            <tbody>
              {dailyData.length > 0 ? (
                dailyData.slice(-10).reverse().map((d, i) => (
                  <tr key={i} className="border-t border-[var(--border-primary)]">
                    <td className="px-4 py-3 text-sm text-[var(--text-primary)]">{d.date}</td>
                    <td className="px-4 py-3 text-sm text-right text-[var(--text-primary)]">{d.users.size}</td>
                    <td className="px-4 py-3 text-sm text-right text-[var(--success)]">${d.commission.toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                    暂无佣金记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
