'use client';

import { useState, useEffect } from 'react';

interface Commission {
  id: string;
  userId: string;
  userEmail: string;
  sourceType: string;
  baseAmount: string;
  commissionRate: string;
  commissionAmount: string;
  status: string;
  createdAt: string;
}

export default function AgentCommissionsPage() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetchCommissions = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/agents/commissions?page=${page}&limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.code === 0) {
          setCommissions(data.data.items || []);
          setTotal(data.data.total || 0);
        }
      } catch (error) {
        console.error('获取佣金明细失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCommissions();
  }, [page]);

  const maskEmail = (email: string) => {
    const [name, domain] = email.split('@');
    if (name.length <= 3) return `${name[0]}***@${domain}`;
    return `${name.slice(0, 3)}***@${domain}`;
  };

  const getSourceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      gas_fee: '燃油费',
      subscription: '订阅费',
      staking: '质押收益',
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { label: string; color: string }> = {
      pending: { label: '待结算', color: 'var(--warning)' },
      settled: { label: '已结算', color: 'var(--success)' },
      withdrawn: { label: '已提现', color: 'var(--text-tertiary)' },
    };
    return labels[status] || { label: status, color: 'var(--text-tertiary)' };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">佣金明细</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            共 {total} 条佣金记录
          </p>
        </div>
      </div>

      {/* 佣金列表 */}
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-[var(--text-secondary)]">加载中...</div>
        ) : commissions.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-4">💰</div>
            <div className="text-[var(--text-secondary)]">暂无佣金记录</div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--bg-tertiary)]">
                    <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-secondary)]">时间</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-secondary)]">来源用户</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-[var(--text-secondary)]">类型</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-[var(--text-secondary)]">基数</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-[var(--text-secondary)]">比例</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-[var(--text-secondary)]">佣金</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-[var(--text-secondary)]">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((commission) => {
                    const statusInfo = getStatusLabel(commission.status);
                    return (
                      <tr key={commission.id} className="border-t border-[var(--border-primary)]">
                        <td className="px-4 py-3 text-sm text-[var(--text-tertiary)]">
                          {new Date(commission.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--text-primary)]">
                          {maskEmail(commission.userEmail)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-1 text-xs bg-[var(--bg-tertiary)] rounded">
                            {getSourceTypeLabel(commission.sourceType)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-[var(--text-primary)]">
                          ${parseFloat(commission.baseAmount).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-[var(--text-secondary)]">
                          {(parseFloat(commission.commissionRate) * 100).toFixed(0)}%
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-[var(--success)]">
                          +${parseFloat(commission.commissionAmount).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className="px-2 py-1 text-xs rounded-full"
                            style={{
                              backgroundColor: `${statusInfo.color}20`,
                              color: statusInfo.color,
                            }}
                          >
                            {statusInfo.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
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
