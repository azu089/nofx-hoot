'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertOctagon,
  Power,
  Server,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

export default function AdminKillSwitchPage() {
  const queryClient = useQueryClient();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [reason, setReason] = useState('');

  // 获取 Kill Switch 状态
  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'kill-switch', 'status'],
    queryFn: async () => {
      const response = await adminApi.getKillSwitchStatus();
      return response.data;
    },
    refetchInterval: 30000, // 每 30 秒刷新
  });

  // 激活 Kill Switch
  const activateMutation = useMutation({
    mutationFn: (reason: string) => adminApi.activateKillSwitch(reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'kill-switch'] });
      setShowConfirmDialog(false);
      setReason('');
    },
  });

  const handleActivate = () => {
    if (!reason.trim()) return;
    activateMutation.mutate(reason);
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-danger/10 rounded-xl flex items-center justify-center">
            <AlertOctagon className="w-6 h-6 text-danger" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">紧急开关</h1>
            <p className="text-text-secondary mt-1">紧急停止所有运行中的 VPS 实例</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-bg-tertiary text-white rounded-lg hover:bg-bg-tertiary flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          刷新状态
        </button>
      </div>

      {/* 警告提示 */}
      <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
        <div>
          <p className="text-danger font-medium">危险操作警告</p>
          <p className="text-danger/80 text-sm mt-1">
            紧急开关将立即停止所有运行中的 VPS 实例。此操作无法撤销，请仅在紧急情况下使用。
          </p>
        </div>
      </div>

      {/* 当前状态 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">总实例</p>
              <p className="text-xl font-bold text-white">
                {isLoading ? '-' : status?.totalInstances || 0}
              </p>
            </div>
            <Server className="w-8 h-8 text-brand-primary" />
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">运行中</p>
              <p className="text-xl font-bold text-success">
                {isLoading ? '-' : status?.runningInstances || 0}
              </p>
            </div>
            <Power className="w-8 h-8 text-success" />
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">已停止</p>
              <p className="text-xl font-bold text-text-secondary">
                {isLoading ? '-' : status?.stoppedInstances || 0}
              </p>
            </div>
            <Power className="w-8 h-8 text-text-secondary" />
          </div>
        </div>
      </div>

      {/* 紧急停机按钮 */}
      <div className="glass-card p-4">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-danger/10 rounded-full flex items-center justify-center mb-4">
            <AlertOctagon className="w-10 h-10 text-danger" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">紧急停机</h2>
          <p className="text-text-secondary mb-6 max-w-md">
            点击下方按钮将立即停止所有运行中的 VPS 实例。此操作用于紧急安全事件时保护用户资产。
          </p>
          <button
            onClick={() => setShowConfirmDialog(true)}
            disabled={(status?.runningInstances || 0) === 0}
            className="px-8 py-4 bg-danger text-white rounded-xl hover:bg-danger/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg flex items-center gap-3"
          >
            <Power className="w-6 h-6" />
            立即停止所有 VPS
          </button>
          {(status?.runningInstances || 0) === 0 && (
            <p className="text-text-secondary text-sm mt-3">当前没有运行中的实例</p>
          )}
        </div>
      </div>

      {/* 最近触发记录 */}
      <div className="glass-card">
        <div className="p-4 border-b border-border-primary">
          <h2 className="text-lg font-semibold text-white">最近触发记录</h2>
        </div>
        <div className="p-4">
          {status?.lastActivatedAt ? (
            <div className="flex items-start gap-4 p-4 bg-danger/10 rounded-lg border border-danger/20">
              <div className="w-10 h-10 bg-danger/10 rounded-lg flex items-center justify-center shrink-0">
                <AlertOctagon className="w-5 h-5 text-danger" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-medium">紧急停机已触发</span>
                  <span className="text-xs text-text-secondary flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(status.lastActivatedAt).toLocaleString('zh-CN')}
                  </span>
                </div>
                <p className="text-text-secondary text-sm">
                  操作者: {status.lastActivatedBy || '未知'}
                </p>
                {status.lastReason && (
                  <p className="text-danger/80 text-sm mt-2">
                    原因: {status.lastReason}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-text-secondary">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>暂无紧急操作记录</p>
              <p className="text-sm mt-1">系统运行正常</p>
            </div>
          )}
        </div>
      </div>

      {/* 确认弹窗 */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-secondary rounded-xl p-6 w-full max-w-md border border-border-primary">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-danger/10 rounded-lg flex items-center justify-center">
                <AlertOctagon className="w-5 h-5 text-danger" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">确认紧急停机</h3>
                <p className="text-danger text-sm">
                  将停止 {status?.runningInstances || 0} 个运行中的实例
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-text-secondary text-sm mb-2">
                操作原因 <span className="text-danger">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-secondary focus:outline-none focus:border-brand-primary min-h-[100px]"
                placeholder="请输入紧急停机的原因（必填）..."
              />
            </div>

            <p className="text-text-secondary text-sm mb-4">
              此操作将立即停止所有运行中的 VPS 实例，所有正在进行的交易将被中断。请确认此操作是必要的。
            </p>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  setReason('');
                }}
                className="flex-1 px-4 py-2 bg-bg-tertiary text-white rounded-lg hover:bg-bg-tertiary"
              >
                取消
              </button>
              <button
                onClick={handleActivate}
                disabled={!reason.trim() || activateMutation.isPending}
                className="flex-1 px-4 py-2 bg-danger text-white rounded-lg hover:bg-danger/90 disabled:opacity-50"
              >
                {activateMutation.isPending ? '执行中...' : '确认停机'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
