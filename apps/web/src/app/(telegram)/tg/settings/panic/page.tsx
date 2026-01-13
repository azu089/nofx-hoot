'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { tradingApi } from '@/lib/api';
import {
  ArrowLeft,
  AlertTriangle,
  Power,
  XCircle,
  Shield,
} from 'lucide-react';

export default function TgPanicPage() {
  const router = useRouter();
  const { haptic } = useTelegramContext();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const handlePanicButton = async () => {
    if (!isConfirming) {
      haptic('impact_heavy');
      setIsConfirming(true);
      return;
    }

    setIsExecuting(true);
    haptic('impact_heavy');
    try {
      await tradingApi.forceExitAll();
      haptic('notification_success');
      alert('紧急停止已执行，所有策略已停止');
      setIsConfirming(false);
    } catch (error: any) {
      haptic('notification_error');
      alert(error?.message || '执行失败，请重试');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCancel = () => {
    haptic('selection');
    setIsConfirming(false);
  };

  return (
    <div className="space-y-4 pb-24">
      {/* 顶部 */}
      <button
        onClick={() => { haptic('selection'); router.back(); }}
        className="flex items-center gap-2 text-text-secondary"
      >
        <ArrowLeft size={20} />
        <span className="text-lg font-medium text-white">紧急按钮</span>
      </button>

      {/* 警告提示 */}
      <div className="bg-danger/10 border border-danger/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-danger mb-1">危险操作</p>
            <p className="text-text-secondary text-sm">
              紧急按钮将立即停止您所有正在运行的策略实例。此操作不可撤销，请谨慎使用。
            </p>
          </div>
        </div>
      </div>

      {/* 说明 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <h3 className="text-white font-medium mb-3 flex items-center gap-2">
          <Power className="w-4 h-4 text-danger" />
          一键停止所有策略
        </h3>
        <div className="text-text-secondary text-sm space-y-2">
          <p>点击紧急按钮后，系统将执行以下操作：</p>
          <ul className="space-y-1 ml-4">
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-text-tertiary" />
              立即停止所有正在运行的策略实例
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-text-tertiary" />
              取消所有未成交的挂单
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-text-tertiary" />
              保持当前持仓不变（不会自动平仓）
            </li>
          </ul>
        </div>
      </div>

      {/* 保护提示 */}
      <div className="bg-brand-primary/10 border border-brand-primary/30 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-brand-primary" />
          <div>
            <p className="text-white text-sm font-medium">需要二次确认</p>
            <p className="text-text-tertiary text-xs">
              为防止误操作，需要点击两次才能执行
            </p>
          </div>
        </div>
      </div>

      {/* 按钮区域 */}
      <div className="fixed bottom-20 left-0 right-0 px-4 safe-area-bottom">
        {isConfirming ? (
          <div className="space-y-3">
            <div className="p-4 bg-danger/20 border border-danger/30 rounded-xl">
              <p className="text-danger font-medium text-center text-sm">
                确定要停止所有策略吗？此操作不可撤销！
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                disabled={isExecuting}
                className="flex-1 py-3 bg-bg-secondary border border-border-primary rounded-xl text-white font-medium disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handlePanicButton}
                disabled={isExecuting}
                className="flex-1 py-3 bg-danger text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                {isExecuting ? '执行中...' : '确认停止'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handlePanicButton}
            className="w-full py-4 bg-danger text-white rounded-xl font-medium flex items-center justify-center gap-2"
          >
            <Power className="w-5 h-5" />
            紧急停止所有策略
          </button>
        )}
      </div>
    </div>
  );
}
