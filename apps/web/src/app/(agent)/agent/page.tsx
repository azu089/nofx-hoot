'use client';

import { useState, useEffect } from 'react';

interface AgentOverview {
  code: string;
  name: string;
  level: number;
  commissionRate: number;
  totalUsers: number;
  totalCommission: string;
  pendingCommission: string;
  withdrawableCommission: string;
  thisMonthCommission: string;
  thisMonthUsers: number;
}

export default function AgentOverviewPage() {
  const [overview, setOverview] = useState<AgentOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/agents/overview', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.code === 0) {
          setOverview(data.data);
        }
      } catch (error) {
        console.error('获取代理商概览失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOverview();
  }, []);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-[var(--bg-tertiary)] rounded w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-[var(--bg-tertiary)] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">代理商概览</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            邀请码: <span className="font-mono text-[var(--brand-primary)]">{overview?.code}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] rounded-full text-sm">
            {overview?.level === 1 ? '一级代理' : `${overview?.level}级代理`}
          </span>
          <span className="px-3 py-1 bg-[var(--success)]/10 text-[var(--success)] rounded-full text-sm">
            佣金比例 {((overview?.commissionRate || 0) * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* 核心数据卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 总佣金 */}
        <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-[var(--text-secondary)]">累计佣金</span>
            <div className="w-10 h-10 bg-[var(--success)]/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)]">
            ${parseFloat(overview?.totalCommission || '0').toFixed(2)}
          </div>
          <div className="text-sm text-[var(--text-tertiary)] mt-1">USDT</div>
        </div>

        {/* 可提现 */}
        <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-[var(--text-secondary)]">可提现</span>
            <div className="w-10 h-10 bg-[var(--brand-primary)]/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-[var(--brand-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)]">
            ${parseFloat(overview?.withdrawableCommission || '0').toFixed(2)}
          </div>
          <div className="text-sm text-[var(--text-tertiary)] mt-1">USDT</div>
        </div>

        {/* 本月佣金 */}
        <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-[var(--text-secondary)]">本月佣金</span>
            <div className="w-10 h-10 bg-[var(--warning)]/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-[var(--warning)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)]">
            ${parseFloat(overview?.thisMonthCommission || '0').toFixed(2)}
          </div>
          <div className="text-sm text-[var(--text-tertiary)] mt-1">USDT</div>
        </div>

        {/* 下级用户数 */}
        <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-[var(--text-secondary)]">下级用户</span>
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)]">
            {overview?.totalUsers || 0}
          </div>
          <div className="text-sm text-[var(--text-tertiary)] mt-1">
            本月新增 +{overview?.thisMonthUsers || 0}
          </div>
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a
          href="/agent/promotion"
          className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)] hover:border-[var(--brand-primary)] transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[var(--brand-primary)]/10 rounded-xl flex items-center justify-center group-hover:bg-[var(--brand-primary)]/20 transition-colors">
              <svg className="w-6 h-6 text-[var(--brand-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <div>
              <div className="text-[var(--text-primary)] font-medium">推广工具</div>
              <div className="text-sm text-[var(--text-secondary)]">获取邀请链接和海报</div>
            </div>
          </div>
        </a>

        <a
          href="/agent/referrals"
          className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)] hover:border-[var(--brand-primary)] transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[var(--success)]/10 rounded-xl flex items-center justify-center group-hover:bg-[var(--success)]/20 transition-colors">
              <svg className="w-6 h-6 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <div className="text-[var(--text-primary)] font-medium">下级管理</div>
              <div className="text-sm text-[var(--text-secondary)]">查看下级用户列表</div>
            </div>
          </div>
        </a>

        <a
          href="/agent/withdraw"
          className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)] hover:border-[var(--brand-primary)] transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[var(--warning)]/10 rounded-xl flex items-center justify-center group-hover:bg-[var(--warning)]/20 transition-colors">
              <svg className="w-6 h-6 text-[var(--warning)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <div className="text-[var(--text-primary)] font-medium">申请提现</div>
              <div className="text-sm text-[var(--text-secondary)]">提取可用佣金</div>
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}
