'use client';

import { useState, useEffect } from 'react';

interface Referral {
  id: string;
  email: string;
  status: string;
  vipLevel: number;
  totalContribution: string;
  createdAt: string;
}

export default function AgentReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetchReferrals = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/agents/referrals?page=${page}&limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.code === 0) {
          setReferrals(data.data.items || []);
          setTotal(data.data.total || 0);
        }
      } catch (error) {
        console.error('获取下级列表失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReferrals();
  }, [page]);

  const maskEmail = (email: string) => {
    const [name, domain] = email.split('@');
    if (name.length <= 3) return `${name[0]}***@${domain}`;
    return `${name.slice(0, 3)}***@${domain}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">下级管理</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            共 {total} 位下级用户
          </p>
        </div>
      </div>

      {/* 用户列表 */}
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-[var(--text-secondary)]">加载中...</div>
        ) : referrals.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-4">👥</div>
            <div className="text-[var(--text-secondary)]">暂无下级用户</div>
            <div className="text-sm text-[var(--text-tertiary)] mt-2">
              分享您的邀请链接，开始推广吧
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--bg-tertiary)]">
                    <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-secondary)]">用户</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-[var(--text-secondary)]">VIP等级</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-[var(--text-secondary)]">状态</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-[var(--text-secondary)]">贡献佣金</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-[var(--text-secondary)]">注册时间</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((referral) => (
                    <tr key={referral.id} className="border-t border-[var(--border-primary)]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center text-sm font-medium text-[var(--text-primary)]">
                            {referral.email[0].toUpperCase()}
                          </div>
                          <span className="text-sm text-[var(--text-primary)]">{maskEmail(referral.email)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          referral.vipLevel > 0
                            ? 'bg-[var(--warning)]/10 text-[var(--warning)]'
                            : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
                        }`}>
                          {referral.vipLevel > 0 ? `VIP${referral.vipLevel}` : '普通'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          referral.status === 'active'
                            ? 'bg-[var(--success)]/10 text-[var(--success)]'
                            : 'bg-[var(--danger)]/10 text-[var(--danger)]'
                        }`}>
                          {referral.status === 'active' ? '活跃' : '停用'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-[var(--success)]">
                        ${parseFloat(referral.totalContribution).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-[var(--text-tertiary)]">
                        {new Date(referral.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {total > 10 && (
              <div className="flex items-center justify-between p-4 border-t border-[var(--border-primary)]">
                <div className="text-sm text-[var(--text-tertiary)]">
                  第 {page} 页，共 {Math.ceil(total / 10)} 页
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm bg-[var(--bg-tertiary)] rounded disabled:opacity-50"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page * 10 >= total}
                    className="px-3 py-1 text-sm bg-[var(--bg-tertiary)] rounded disabled:opacity-50"
                  >
                    下一页
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
