'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertOctagon,
  Server,
  StopCircle,
  AlertTriangle,
  CheckCircle,
  Shield,
  Clock,
  Loader2,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

export default function AdminKillSwitchPage() {
  const [confirmAction, setConfirmAction] = useState<{
    type: string;
    action: 'activate' | 'deactivate';
    title: string;
  } | null>(null);
  const [reason, setReason] = useState('');

  // 获取 Kill Switch 状态
  const { data: statusData, isLoading, refetch } = useQuery({
    queryKey: ['kill-switch-status'],
    queryFn: async () => {
      const res = await adminApi.getKillSwitchStatus();
      return res.data;
    },
  });

  // 兼容旧格式的状态
  const status = {
    globalKillSwitch: statusData?.enabled || false,
    tradingHalted: false,
    withdrawalsHalted: false,
    depositsHalted: false,
  };

  const activateMutation = useMutation({
    mutationFn: ({ type, reason }: { type: string; reason: string }) =>
      adminApi.activateKillSwitch(type, reason),
    onSuccess: () => {
      setConfirmAction(null);
      setReason('');
      refetch(); // 重新获取状态
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (type: string) => adminApi.deactivateKillSwitch(type),
    onSuccess: () => {
      setConfirmAction(null);
      refetch(); // 重新获取状态
    },
  });

  const switches = [
    {
      type: 'global',
      title: '全局紧急停机',
      description: '停止所有服务，包括交易、充值、提现。仅用于重大安全事件。',
      icon: AlertOctagon,
      color: 'text-[#F23645]',
      bgColor: 'bg-[#F23645]/10',
      active: status.globalKillSwitch,
    },
    {
      type: 'trading',
      title: '暂停交易',
      description: '停止所有 VPS 实例的交易操作。用户资金安全,但无法执行交易。',
      icon: StopCircle,
      color: 'text-[#F7931A]',
      bgColor: 'bg-[#F7931A]/10',
      active: status.tradingHalted,
    },
    {
      type: 'withdrawals',
      title: '暂停提现',
      description: '暂停所有提现申请。用于防止资金异常流出。',
      icon: Shield,
      color: 'text-[#9945FF]',
      bgColor: 'bg-[#9945FF]/10',
      active: status.withdrawalsHalted,
    },
    {
      type: 'deposits',
      title: '暂停充值',
      description: '暂停接收新的充值。用于系统维护或升级期间。',
      icon: Server,
      color: 'text-[#3772FF]',
      bgColor: 'bg-[#3772FF]/10',
      active: status.depositsHalted,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-[#F23645]/10 rounded-xl flex items-center justify-center">
          <AlertOctagon className="w-6 h-6 text-[#F23645]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">紧急开关</h1>
          <p className="text-[#848E9C] mt-1">控制平台关键功能的紧急开关</p>
        </div>
      </div>

      {/* 实例统计 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[#3772FF]" />
        </div>
      ) : statusData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#131722] rounded-xl border border-[#2B3139] p-4">
            <p className="text-[#848E9C] text-sm">运行中实例</p>
            <p className="text-2xl font-bold text-[#00C087] mt-1">{statusData.runningInstances}</p>
          </div>
          <div className="bg-[#131722] rounded-xl border border-[#2B3139] p-4">
            <p className="text-[#848E9C] text-sm">已停止实例</p>
            <p className="text-2xl font-bold text-[#F23645] mt-1">{statusData.stoppedInstances}</p>
          </div>
          <div className="bg-[#131722] rounded-xl border border-[#2B3139] p-4">
            <p className="text-[#848E9C] text-sm">总实例数</p>
            <p className="text-2xl font-bold text-white mt-1">{statusData.totalInstances}</p>
          </div>
        </div>
      )}

      {/* 警告提示 */}
      <div className="bg-[#F23645]/10 border border-[#F23645]/20 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-[#F23645] shrink-0 mt-0.5" />
        <div>
          <p className="text-[#F23645] font-medium">谨慎操作</p>
          <p className="text-[#F23645]/80 text-sm mt-1">
            紧急开关会影响所有用户的正常使用。请仅在必要时使用，并记录操作原因。
          </p>
        </div>
      </div>

      {/* 开关列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {switches.map((sw) => {
          const Icon = sw.icon;
          return (
            <div
              key={sw.type}
              className={`bg-[#131722] rounded-xl border ${
                sw.active ? 'border-[#F23645]' : 'border-[#2B3139]'
              } p-6`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 ${sw.bgColor} rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${sw.color}`} />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">{sw.title}</h3>
                    <span className={`text-xs ${sw.active ? 'text-[#F23645]' : 'text-[#00C087]'}`}>
                      {sw.active ? '已激活' : '正常'}
                    </span>
                  </div>
                </div>
                <div className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${
                  sw.active ? 'bg-[#F23645]' : 'bg-[#2B3139]'
                }`}
                  onClick={() => {
                    setConfirmAction({
                      type: sw.type,
                      action: sw.active ? 'deactivate' : 'activate',
                      title: sw.title,
                    });
                  }}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    sw.active ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </div>
              </div>
              <p className="text-[#848E9C] text-sm">{sw.description}</p>
              {sw.active && statusData?.lastTriggered && (
                <div className="mt-4 pt-4 border-t border-[#2B3139]">
                  <p className="text-[#F23645] text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    激活于: {new Date(statusData.lastTriggered.triggeredAt).toLocaleString('zh-CN')}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 操作日志 */}
      <div className="bg-[#131722] rounded-xl border border-[#2B3139]">
        <div className="p-4 border-b border-[#2B3139]">
          <h2 className="text-lg font-semibold text-white">操作日志</h2>
        </div>
        <div className="p-4">
          <div className="text-center py-8 text-[#848E9C]">
            <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>暂无紧急操作记录</p>
          </div>
        </div>
      </div>

      {/* 确认弹窗 */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#131722] rounded-xl p-6 w-full max-w-md border border-[#2B3139]">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                confirmAction.action === 'activate' ? 'bg-[#F23645]/10' : 'bg-[#00C087]/10'
              }`}>
                {confirmAction.action === 'activate' ? (
                  <AlertOctagon className="w-5 h-5 text-[#F23645]" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-[#00C087]" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {confirmAction.action === 'activate' ? '激活' : '解除'} {confirmAction.title}
                </h3>
              </div>
            </div>

            {confirmAction.action === 'activate' && (
              <div className="mb-4">
                <label className="block text-[#848E9C] text-sm mb-2">操作原因</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-3 bg-[#1E222D] border border-[#2B3139] rounded-lg text-white placeholder-[#848E9C] focus:outline-none focus:border-[#3772FF] min-h-[100px]"
                  placeholder="请输入激活原因..."
                />
              </div>
            )}

            <p className="text-[#848E9C] text-sm mb-4">
              {confirmAction.action === 'activate'
                ? '此操作将立即生效，可能影响所有用户。确定要继续吗？'
                : '确定要解除此紧急开关吗？服务将恢复正常。'
              }
            </p>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setConfirmAction(null);
                  setReason('');
                }}
                className="flex-1 px-4 py-2 bg-[#1E222D] text-white rounded-lg hover:bg-[#2B3139]"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (confirmAction.action === 'activate') {
                    activateMutation.mutate({ type: confirmAction.type, reason });
                  } else {
                    deactivateMutation.mutate(confirmAction.type);
                  }
                }}
                disabled={confirmAction.action === 'activate' && !reason.trim()}
                className={`flex-1 px-4 py-2 rounded-lg disabled:opacity-50 ${
                  confirmAction.action === 'activate'
                    ? 'bg-[#F23645] text-white hover:bg-[#D02030]'
                    : 'bg-[#00C087] text-white hover:bg-[#00A070]'
                }`}
              >
                确认{confirmAction.action === 'activate' ? '激活' : '解除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
