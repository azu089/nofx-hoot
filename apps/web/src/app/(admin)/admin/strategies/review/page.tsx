'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  Clock,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

interface Strategy {
  id: string;
  name: string;
  description: string | null;
  owner_type: string;
  uploader_id: string | null;
  review_status: string;
  auto_check_passed: boolean;
  auto_check_warnings: string[] | null;
  created_at: string;
  updated_at: string;
}

export default function StrategyReviewPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // 获取待审核策略列表
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'strategies', 'pending', page],
    queryFn: () => adminApi.getPendingStrategies({ page, limit: 20 }),
  });

  // 审核通过
  const approveMutation = useMutation({
    mutationFn: (id: string) => adminApi.approveStrategy(id),
    onSuccess: () => {
      toast.success('策略已通过审核并上架');
      setSelectedStrategy(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'strategies'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || '审核失败');
    },
  });

  // 拒绝策略
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminApi.rejectStrategy(id, reason),
    onSuccess: () => {
      toast.success('策略已拒绝');
      setSelectedStrategy(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'strategies'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || '拒绝失败');
    },
  });

  const strategies = data?.data?.strategies || [];
  const total = data?.data?.total || 0;
  const totalPages = data?.data?.totalPages || 1;

  // 错误状态
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="w-12 h-12 text-danger mb-4" />
        <p className="text-text-secondary mb-4">加载失败</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-brand-primary text-white rounded-lg flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">策略审核</h1>
          <p className="text-text-secondary mt-1">
            待审核策略：{total} 个 | 当前第 {page}/{totalPages} 页
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-bg-tertiary text-white rounded-lg flex items-center gap-2 hover:bg-bg-tertiary/80"
        >
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      {/* 待审核列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-text-secondary">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          加载中...
        </div>
      ) : strategies.length === 0 ? (
        <div className="glass-card p-4 text-center">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-success" />
          <p className="text-lg text-text-secondary">暂无待审核策略</p>
        </div>
      ) : (
        <div className="space-y-4">
          {strategies.map((strategy: Strategy) => (
            <div
              key={strategy.id}
              className={`bg-bg-secondary rounded-xl border p-6 ${
                strategy.review_status === 'flagged'
                  ? 'border-warning'
                  : 'border-border-primary'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-white">{strategy.name}</h3>
                    {strategy.review_status === 'flagged' ? (
                      <span className="px-2 py-1 bg-warning/20 text-warning border border-warning/50 rounded text-xs flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        需人工审核
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-brand-primary/20 text-brand-primary border border-brand-primary/50 rounded text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        待审核
                      </span>
                    )}
                    {strategy.auto_check_passed && (
                      <span className="px-2 py-1 bg-success/20 text-success border border-success/50 rounded text-xs">
                        ✓ 自动检测通过
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary mb-2">
                    {strategy.description || '无描述'}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    上传时间：{new Date(strategy.created_at).toLocaleString('zh-CN')}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedStrategy(strategy)}
                  className="px-4 py-2 bg-bg-tertiary text-white rounded-lg flex items-center gap-2 hover:bg-bg-tertiary/80 ml-4"
                >
                  <Eye className="w-4 h-4" />
                  审核
                </button>
              </div>

              {/* 自动检测警告 */}
              {strategy.auto_check_warnings && strategy.auto_check_warnings.length > 0 && (
                <div className="mt-4 bg-warning/10 border-l-4 border-warning px-4 py-3 rounded">
                  <p className="text-sm font-semibold text-warning mb-2">
                    ⚠️ 自动检测警告
                  </p>
                  <ul className="text-xs text-text-secondary space-y-1">
                    {strategy.auto_check_warnings.map((warning, index) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white disabled:opacity-50"
          >
            上一页
          </button>
          <span className="flex items-center px-4 text-text-secondary">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      )}

      {/* 审核弹窗 */}
      {selectedStrategy && (
        <div className="fixed inset-0 bg-bg-tertiary flex items-center justify-center z-50 p-4">
          <div className="bg-bg-secondary border border-border-primary rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border-primary flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                审核策略：{selectedStrategy.name}
              </h2>
              <button
                onClick={() => {
                  setSelectedStrategy(null);
                  setRejectReason('');
                }}
                className="text-text-secondary hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* 基本信息 */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-2">基本信息</h3>
                <div className="bg-bg-tertiary rounded-lg p-4 space-y-2 text-sm">
                  <p className="text-text-secondary">
                    <span className="text-text-tertiary">策略 ID：</span>
                    {selectedStrategy.id}
                  </p>
                  <p className="text-text-secondary">
                    <span className="text-text-tertiary">上传者 ID：</span>
                    {selectedStrategy.uploader_id || '系统'}
                  </p>
                  <p className="text-text-secondary">
                    <span className="text-text-tertiary">上传时间：</span>
                    {new Date(selectedStrategy.created_at).toLocaleString('zh-CN')}
                  </p>
                  <p className="text-text-secondary">
                    <span className="text-text-tertiary">描述：</span>
                    {selectedStrategy.description || '无'}
                  </p>
                </div>
              </div>

              {/* 自动检测结果 */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-2">自动检测结果</h3>
                {selectedStrategy.auto_check_passed ? (
                  <div className="bg-success/10 border-l-4 border-success px-4 py-3 rounded">
                    <p className="text-sm text-success">✓ 自动检测通过，无致命问题</p>
                  </div>
                ) : (
                  <div className="bg-danger/10 border-l-4 border-danger px-4 py-3 rounded">
                    <p className="text-sm text-danger">✕ 自动检测未通过，存在安全风险</p>
                  </div>
                )}

                {selectedStrategy.auto_check_warnings &&
                  selectedStrategy.auto_check_warnings.length > 0 && (
                    <div className="mt-3 bg-warning/10 border-l-4 border-warning px-4 py-3 rounded">
                      <p className="text-sm font-semibold text-warning mb-2">警告项：</p>
                      <ul className="text-xs text-text-secondary space-y-1">
                        {selectedStrategy.auto_check_warnings.map((warning, index) => (
                          <li key={index}>• {warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>

              {/* 拒绝原因输入 */}
              <div>
                <label className="text-sm font-semibold text-white block mb-2">
                  拒绝原因（拒绝时必填）
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="请填写拒绝原因"
                  className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-secondary focus:outline-none focus:border-brand-primary min-h-[100px]"
                  maxLength={500}
                />
                <p className="text-xs text-text-tertiary mt-1">
                  {rejectReason.length}/500 字符
                </p>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-3">
                <button
                  onClick={() => approveMutation.mutate(selectedStrategy.id)}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  className="flex-1 px-4 py-3 bg-success hover:bg-success/80 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  审核通过
                </button>
                <button
                  onClick={() => {
                    if (!rejectReason.trim()) {
                      toast.error('请填写拒绝原因');
                      return;
                    }
                    rejectMutation.mutate({ id: selectedStrategy.id, reason: rejectReason });
                  }}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  className="flex-1 px-4 py-3 bg-danger hover:bg-danger/80 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {rejectMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  拒绝策略
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
