'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Lock,
  Unlock,
  TrendingUp,
  Users,
  Gift,
  Clock,
  RefreshCw,
  DollarSign,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

interface Stake {
  id: string;
  userId: string;
  userEmail: string;
  type: string;
  amount: string;
  lockDays: number;
  status: string;
  weight: number;
  startDate: string;
  endDate: string;
  createdAt: string;
}

interface StakesData {
  data: Stake[];
  total: number;
}

export default function AdminStakingPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showDividendModal, setShowDividendModal] = useState(false);
  const [dividendAmount, setDividendAmount] = useState('');
  const [dividendNote, setDividendNote] = useState('');

  // 获取质押统计
  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'staking', 'stats'],
    queryFn: () => adminApi.getStakingStats(),
  });
  const stats = statsRes?.data;

  // 获取质押列表
  const { data: stakesRes, isLoading: stakesLoading, refetch } = useQuery({
    queryKey: ['admin', 'staking', 'list', page, typeFilter, statusFilter],
    queryFn: () => adminApi.getStakingList({
      page,
      limit: 20,
      type: typeFilter || undefined,
      status: statusFilter || undefined,
    }),
  });
  const stakesData = stakesRes?.data as StakesData | undefined;
  const stakes = stakesData?.data || [];
  const totalStakes = stakesData?.total || 0;

  // 分红操作
  const dividendMutation = useMutation({
    mutationFn: (data: { totalAmount: string; note?: string }) =>
      adminApi.distributeDividends(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'staking'] });
      setShowDividendModal(false);
      setDividendAmount('');
      setDividendNote('');
      alert(`分红发放成功！\n发放金额: ${res.data?.distributed}\n受益人数: ${res.data?.recipientCount}`);
    },
    onError: (error: Error) => {
      alert(`分红失败: ${error.message}`);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="px-2 py-1 bg-[#00C087]/10 text-[#00C087] rounded text-xs flex items-center gap-1">
            <Lock className="w-3 h-3" />
            进行中
          </span>
        );
      case 'completed':
        return (
          <span className="px-2 py-1 bg-[#3772FF]/10 text-[#3772FF] rounded text-xs flex items-center gap-1">
            <Unlock className="w-3 h-3" />
            已完成
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2 py-1 bg-[#F23645]/10 text-[#F23645] rounded text-xs flex items-center gap-1">
            已取消
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-[#848E9C]/10 text-[#848E9C] rounded text-xs">
            {status}
          </span>
        );
    }
  };

  const getTypeBadge = (type: string) => {
    return type === 'A' ? (
      <span className="px-2 py-1 bg-[#3772FF]/10 text-[#3772FF] rounded text-xs font-medium">
        A 类
      </span>
    ) : (
      <span className="px-2 py-1 bg-[#F7931A]/10 text-[#F7931A] rounded text-xs font-medium">
        B 类
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">质押管理</h1>
          <p className="text-[#848E9C] mt-1">查看质押统计，管理分红发放</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-[#1E222D] text-white rounded-lg hover:bg-[#2B3139] flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
          <button
            onClick={() => setShowDividendModal(true)}
            className="px-4 py-2 bg-[#F7931A] text-white rounded-lg hover:bg-[#E08310] flex items-center gap-2"
          >
            <Gift className="w-4 h-4" />
            发放分红
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          <div className="col-span-4 text-center py-8 text-[#848E9C]">加载中...</div>
        ) : stats && (
          <>
            <div className="bg-[#131722] rounded-xl p-4 border border-[#2B3139]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#848E9C] text-sm">总质押金额</p>
                  <p className="text-xl font-bold text-[#00C087]">
                    ${parseFloat(stats.totalStaked || '0').toLocaleString()}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-[#00C087]" />
              </div>
            </div>
            <div className="bg-[#131722] rounded-xl p-4 border border-[#2B3139]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#848E9C] text-sm">A 类质押</p>
                  <p className="text-xl font-bold text-[#3772FF]">
                    ${parseFloat(stats.typeAStaked || '0').toLocaleString()}
                  </p>
                </div>
                <Lock className="w-8 h-8 text-[#3772FF]" />
              </div>
            </div>
            <div className="bg-[#131722] rounded-xl p-4 border border-[#2B3139]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#848E9C] text-sm">B 类质押</p>
                  <p className="text-xl font-bold text-[#F7931A]">
                    ${parseFloat(stats.typeBStaked || '0').toLocaleString()}
                  </p>
                </div>
                <Lock className="w-8 h-8 text-[#F7931A]" />
              </div>
            </div>
            <div className="bg-[#131722] rounded-xl p-4 border border-[#2B3139]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#848E9C] text-sm">质押人数</p>
                  <p className="text-xl font-bold text-white">{stats.totalStakers || 0}</p>
                </div>
                <Users className="w-8 h-8 text-[#848E9C]" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* 分红信息 */}
      {stats && (
        <div className="bg-[#131722] rounded-xl p-4 border border-[#2B3139]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#F7931A]/10 rounded-lg">
                <Gift className="w-6 h-6 text-[#F7931A]" />
              </div>
              <div>
                <p className="text-[#848E9C] text-sm">待发放分红</p>
                <p className="text-lg font-bold text-[#F7931A]">
                  ${parseFloat(stats.pendingDividends || '0').toLocaleString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[#848E9C] text-sm">上次发放时间</p>
              <p className="text-white">
                {stats.lastDistributedAt ? formatDate(stats.lastDistributedAt) : '暂无'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 筛选 */}
      <div className="flex gap-4">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="px-4 py-3 bg-[#1E222D] border border-[#2B3139] rounded-lg text-white"
        >
          <option value="">全部类型</option>
          <option value="A">A 类</option>
          <option value="B">B 类</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-3 bg-[#1E222D] border border-[#2B3139] rounded-lg text-white"
        >
          <option value="">全部状态</option>
          <option value="active">进行中</option>
          <option value="completed">已完成</option>
          <option value="cancelled">已取消</option>
        </select>
      </div>

      {/* 质押列表 */}
      <div className="bg-[#131722] rounded-xl border border-[#2B3139] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2B3139]">
          <h2 className="text-lg font-semibold text-white">质押记录</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2B3139]">
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">用户</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">类型</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-[#848E9C]">金额</th>
                <th className="px-6 py-4 text-center text-sm font-medium text-[#848E9C]">锁定期</th>
                <th className="px-6 py-4 text-center text-sm font-medium text-[#848E9C]">权重</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">状态</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">到期日</th>
              </tr>
            </thead>
            <tbody>
              {stakesLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[#848E9C]">
                    加载中...
                  </td>
                </tr>
              ) : stakes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[#848E9C]">
                    暂无质押记录
                  </td>
                </tr>
              ) : (
                stakes.map((stake) => (
                  <tr key={stake.id} className="border-b border-[#2B3139] hover:bg-[#1E222D]">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-white text-sm">{stake.userEmail}</p>
                        <p className="text-[#848E9C] text-xs">{stake.userId.slice(0, 8)}...</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getTypeBadge(stake.type)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-white font-medium">
                        ${parseFloat(stake.amount).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-[#848E9C]">
                      {stake.lockDays} 天
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-[#F7931A] font-medium">{stake.weight}x</span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(stake.status)}
                    </td>
                    <td className="px-6 py-4 text-[#848E9C] text-sm">
                      {formatDate(stake.endDate)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalStakes > 20 && (
          <div className="flex justify-center gap-2 px-6 py-4 border-t border-[#2B3139]">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="px-4 py-2 bg-[#1E222D] text-white rounded-lg hover:bg-[#2B3139] disabled:opacity-50"
            >
              上一页
            </button>
            <span className="flex items-center px-4 text-[#848E9C]">
              第 {page} 页
            </span>
            <button
              disabled={stakes.length < 20}
              onClick={() => setPage(page + 1)}
              className="px-4 py-2 bg-[#1E222D] text-white rounded-lg hover:bg-[#2B3139] disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        )}
      </div>

      {/* 分红弹窗 */}
      {showDividendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#131722] rounded-xl p-6 w-full max-w-md border border-[#2B3139]">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Gift className="w-5 h-5 text-[#F7931A]" />
              发放分红
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[#848E9C] text-sm mb-2">分红总金额 (USDT)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#848E9C]" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={dividendAmount}
                    onChange={(e) => setDividendAmount(e.target.value)}
                    placeholder="请输入分红金额"
                    className="w-full pl-10 pr-4 py-3 bg-[#1E222D] border border-[#2B3139] rounded-lg text-white placeholder-[#5E6673] focus:outline-none focus:border-[#F7931A]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[#848E9C] text-sm mb-2">备注（可选）</label>
                <textarea
                  value={dividendNote}
                  onChange={(e) => setDividendNote(e.target.value)}
                  placeholder="例如：第 X 周分红"
                  rows={2}
                  className="w-full px-4 py-3 bg-[#1E222D] border border-[#2B3139] rounded-lg text-white placeholder-[#5E6673] focus:outline-none focus:border-[#F7931A] resize-none"
                />
              </div>
              <div className="p-3 bg-[#1E222D] rounded-lg border border-[#2B3139]">
                <p className="text-sm text-[#848E9C]">
                  <Clock className="w-4 h-4 inline mr-1" />
                  分红将按照质押权重比例分配给所有活跃质押用户
                </p>
              </div>
            </div>
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => {
                  setShowDividendModal(false);
                  setDividendAmount('');
                  setDividendNote('');
                }}
                disabled={dividendMutation.isPending}
                className="flex-1 px-4 py-2 bg-[#1E222D] text-white rounded-lg hover:bg-[#2B3139] disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (!dividendAmount || parseFloat(dividendAmount) <= 0) {
                    alert('请输入有效金额');
                    return;
                  }
                  if (confirm(`确定发放 $${dividendAmount} 分红吗？此操作不可撤销。`)) {
                    dividendMutation.mutate({
                      totalAmount: dividendAmount,
                      note: dividendNote || undefined,
                    });
                  }
                }}
                disabled={!dividendAmount || dividendMutation.isPending}
                className="flex-1 px-4 py-2 bg-[#F7931A] text-white rounded-lg hover:bg-[#E08310] disabled:opacity-50"
              >
                {dividendMutation.isPending ? '处理中...' : '确认发放'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
