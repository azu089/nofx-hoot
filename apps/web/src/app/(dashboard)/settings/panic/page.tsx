'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, MobileHeader } from '@/components/ui';
import { AlertTriangle, Power, Shield, XCircle } from 'lucide-react';
import { tradingApi } from '@/lib/api';
import { toast } from 'sonner';

export default function PanicButtonPage() {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const handlePanicButton = async () => {
    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }

    setIsExecuting(true);
    try {
      // 停止所有策略实例并强制平仓
      await tradingApi.forceExitAll();
      toast.success('紧急停止已执行，所有策略已停止');
      setIsConfirming(false);
    } catch (error: any) {
      toast.error(error?.message || '执行失败，请重试');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCancel = () => {
    setIsConfirming(false);
  };

  return (
    <div className="space-y-6">
      <MobileHeader title="紧急按钮" />

      {/* 警告提示 */}
      <Card className="border-danger/30 bg-danger/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-danger mb-1">危险操作</p>
              <p className="text-text-secondary">
                紧急按钮将立即停止您所有正在运行的策略实例。此操作不可撤销，请谨慎使用。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 紧急按钮卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className="w-5 h-5 text-danger" />
            一键停止所有策略
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-text-secondary text-sm space-y-2">
            <p>点击紧急按钮后，系统将执行以下操作：</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>立即停止所有正在运行的策略实例</li>
              <li>取消所有未成交的挂单</li>
              <li>保持当前持仓不变（不会自动平仓）</li>
            </ul>
          </div>

          {isConfirming ? (
            <div className="space-y-4">
              <div className="p-4 bg-danger/10 border border-danger/30 rounded-lg">
                <p className="text-danger font-medium text-center">
                  确定要停止所有策略吗？此操作不可撤销！
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleCancel}
                  disabled={isExecuting}
                >
                  取消
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={handlePanicButton}
                  isLoading={isExecuting}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  确认停止
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="lg"
              className="w-full bg-danger hover:bg-danger/90 text-white py-6 text-lg"
              onClick={handlePanicButton}
            >
              <Power className="w-6 h-6 mr-2" />
              紧急停止
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 安全提示 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-brand-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm text-text-secondary">
              <p className="font-medium text-brand-primary mb-1">安全建议</p>
              <ul className="space-y-1">
                <li>建议在市场剧烈波动时使用此功能</li>
                <li>停止策略后，请检查您的持仓情况</li>
                <li>如需平仓，请到交易所手动操作</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
