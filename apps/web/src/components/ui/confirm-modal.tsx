'use client';

import { forwardRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Info, X } from 'lucide-react';
import { Button } from './button';

export interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  icon?: 'warning' | 'info' | 'none';
  className?: string;
}

/**
 * 确认弹窗组件
 *
 * @example
 * ```tsx
 * <ConfirmModal
 *   open={open}
 *   onOpenChange={setOpen}
 *   title="确认平仓？"
 *   description="此操作将关闭所有持仓，不可撤销"
 *   confirmText="确认平仓"
 *   cancelText="取消"
 *   variant="danger"
 *   loading={isLoading}
 *   onConfirm={handleConfirm}
 * />
 * ```
 */
export const ConfirmModal = forwardRef<HTMLDivElement, ConfirmModalProps>(
  (
    {
      open,
      onOpenChange,
      title,
      description,
      confirmText = '确认',
      cancelText = '取消',
      variant = 'default',
      loading = false,
      onConfirm,
      icon = 'warning',
      className,
    },
    ref
  ) => {
    // 按 ESC 关闭（仅在未加载状态）
    useEffect(() => {
      if (!open || loading) return;

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onOpenChange(false);
        }
      };

      document.addEventListener('keydown', handleEscape);
      // 禁止背景滚动
      document.body.style.overflow = 'hidden';

      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = '';
      };
    }, [open, loading, onOpenChange]);

    // 确认处理
    const handleConfirm = async () => {
      if (loading) return;

      try {
        await onConfirm();
        // 成功后关闭弹窗（由父组件控制是否关闭）
      } catch (error) {
        // 错误处理由父组件负责（通过 toast 提示）
        console.error('ConfirmModal: 确认操作失败', error);
      }
    };

    // 取消处理
    const handleCancel = () => {
      if (loading) return;
      onOpenChange(false);
    };

    if (!open) return null;

    // 图标映射
    const iconMap = {
      warning: AlertTriangle,
      info: Info,
      none: null,
    };

    const IconComponent = iconMap[icon];

    // 样式映射
    const iconStyles = {
      warning: 'text-warning bg-warning/10',
      info: 'text-brand-primary bg-brand-primary/10',
      none: '',
    };

    return (
      <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
        {/* 遮罩层 */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={handleCancel}
        />

        {/* 对话框 */}
        <div
          ref={ref}
          className={cn(
            'relative bg-bg-secondary rounded-xl shadow-2xl max-w-md w-full',
            'border border-border-primary',
            className
          )}
        >
          {/* 头部 */}
          <div className="px-6 py-4 border-b border-border-primary">
            <div className="flex items-start gap-4">
              {/* 图标 */}
              {IconComponent && (
                <div
                  className={cn(
                    'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
                    iconStyles[icon]
                  )}
                >
                  <IconComponent className="w-5 h-5" />
                </div>
              )}

              {/* 文字内容 */}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
                {description && (
                  <p className="mt-1 text-sm text-text-secondary">{description}</p>
                )}
              </div>

              {/* 关闭按钮 */}
              {!loading && (
                <button
                  onClick={handleCancel}
                  className="flex-shrink-0 text-text-tertiary hover:text-text-primary transition-colors"
                  aria-label="关闭"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* 底部按钮区 */}
          <div className="flex items-center justify-end gap-3 px-6 py-4">
            {/* 取消按钮 */}
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
              className="min-w-[80px]"
            >
              {cancelText}
            </Button>

            {/* 确认按钮 */}
            <Button
              variant={variant === 'danger' ? 'danger' : 'primary'}
              onClick={handleConfirm}
              disabled={loading}
              isLoading={loading}
              className="min-w-[80px]"
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

ConfirmModal.displayName = 'ConfirmModal';
