'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AlertTriangle, XCircle, X } from 'lucide-react';
// 直接从源文件导入，避免 barrel export 导致的客户端模块解析问题
import { Button } from '@/components/ui/button';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { instancesApi } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * PanicButton - 紧急按钮悬浮组件
 *
 * 功能：
 * - 固定悬浮在页面右下角（移动端底部导航上方）
 * - 点击后弹出确认对话框
 * - 确认后停止所有策略并平仓所有持仓
 *
 * 显示条件：
 * - 在 /trading、/dashboard、/instances 页面显示
 * - 其他页面隐藏
 */

interface PanicButtonProps {
  /** 当前运行中的策略实例 ID 列表 */
  runningInstanceIds?: string[];
  /** 当前持仓数量 */
  openTradesCount?: number;
  /** 紧急操作完成回调 */
  onPanicComplete?: () => void;
}

export function PanicButton({
  runningInstanceIds = [],
  openTradesCount = 0,
  onPanicComplete,
}: PanicButtonProps) {
  const pathname = usePathname();

  // 所有 useState 必须在条件返回之前调用
  const [isExpanded, setIsExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // 只在特定页面显示
  const showPages = ['/trading', '/dashboard', '/instances'];
  const shouldShow = showPages.some(
    (page) => pathname === page || pathname.startsWith(`${page}/`)
  );

  // 不显示时返回 null，但 hooks 已经调用过了
  if (!shouldShow) return null;

  // 执行紧急停止
  const handlePanic = async () => {
    setLoading(true);
    setResult(null);

    try {
      let stoppedCount = 0;
      let exitedCount = 0;

      // 停止所有运行中的实例
      for (const instanceId of runningInstanceIds) {
        try {
          // 先强制平仓
          await instancesApi.forceExit(instanceId);
          exitedCount++;

          // 再停止策略
          await instancesApi.stop(instanceId);
          stoppedCount++;
        } catch (error) {
          console.error(`Failed to stop instance ${instanceId}:`, error);
        }
      }

      setResult({
        success: true,
        message: `已停止 ${stoppedCount} 个策略，平仓 ${exitedCount} 个实例`,
      });

      onPanicComplete?.();
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : '操作失败',
      });
    } finally {
      setLoading(false);
    }
  };

  const hasActiveTrading = runningInstanceIds.length > 0 || openTradesCount > 0;

  return (
    <>
      {/* 悬浮按钮 */}
      <div
        className={cn(
          'fixed right-4 z-40 transition-all duration-300',
          // 移动端在底部导航上方，桌面端在右下角
          'bottom-20 lg:bottom-6'
        )}
      >
        {/* 展开状态 */}
        {isExpanded && (
          <div className="mb-2 p-3 bg-bg-secondary/95 backdrop-blur-lg rounded-xl border border-danger/30 shadow-lg animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-primary">
                紧急控制
              </span>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-bg-tertiary rounded"
              >
                <X className="w-4 h-4 text-text-tertiary" />
              </button>
            </div>
            <div className="space-y-2 text-xs text-text-secondary mb-3">
              <p>• 运行中策略: {runningInstanceIds.length} 个</p>
              <p>• 当前持仓: {openTradesCount} 个</p>
            </div>
            <Button
              variant="danger"
              size="sm"
              className="w-full bg-danger hover:bg-danger/90"
              onClick={() => {
                setIsExpanded(false);
                setDialogOpen(true);
              }}
              disabled={!hasActiveTrading}
            >
              <XCircle className="w-4 h-4 mr-2" />
              一键停止 & 平仓
            </Button>
          </div>
        )}

        {/* 主按钮 */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'flex items-center justify-center rounded-full shadow-lg transition-all duration-300',
            'hover:scale-105 active:scale-95',
            hasActiveTrading
              ? 'w-14 h-14 bg-danger hover:bg-danger/90 animate-pulse'
              : 'w-12 h-12 bg-bg-secondary/90 border border-border-primary hover:border-danger/50'
          )}
        >
          <AlertTriangle
            className={cn(
              'transition-colors',
              hasActiveTrading
                ? 'w-6 h-6 text-white'
                : 'w-5 h-5 text-text-tertiary'
            )}
          />
        </button>

        {/* 活跃指示器 */}
        {hasActiveTrading && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-danger rounded-full flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">
              {runningInstanceIds.length}
            </span>
          </div>
        )}
      </div>

      {/* 确认对话框 */}
      <Dialog
        open={dialogOpen}
        onClose={() => !loading && setDialogOpen(false)}
        title="紧急停止 & 全部平仓"
        description="此操作将立即停止所有策略并平仓所有持仓"
      >
        <div className="space-y-4">
          {/* 警告信息 */}
          <div className="flex items-start gap-3 p-4 bg-danger/10 border border-danger/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="text-text-primary font-medium mb-1">风险提示</p>
              <ul className="text-text-secondary space-y-1">
                <li>• 将停止 {runningInstanceIds.length} 个运行中的策略</li>
                <li>• 将平仓 {openTradesCount} 个持仓</li>
                <li>• 可能以市价成交，存在滑点风险</li>
                <li>• 操作不可撤销，请谨慎确认</li>
              </ul>
            </div>
          </div>

          {/* 操作结果 */}
          {result && (
            <div
              className={cn(
                'p-3 rounded-lg text-sm',
                result.success
                  ? 'bg-success/10 text-success'
                  : 'bg-danger/10 text-danger'
              )}
            >
              {result.message}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setDialogOpen(false)}
            disabled={loading}
          >
            取消
          </Button>
          <Button
            variant="danger"
            onClick={handlePanic}
            isLoading={loading}
            className="bg-danger hover:bg-danger/90"
          >
            <XCircle className="w-4 h-4 mr-2" />
            确认紧急停止
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
