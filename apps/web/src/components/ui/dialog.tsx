'use client';

import { forwardRef, HTMLAttributes, ReactNode, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from './button';

export interface DialogProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
}

const Dialog = forwardRef<HTMLDivElement, DialogProps>(
  ({ className, open, onClose, title, description, children, ...props }, ref) => {
    // 按 ESC 关闭 - useEffect 必须在条件渲染之前调用
    useEffect(() => {
      if (!open) return;

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      document.addEventListener('keydown', handleEscape);
      // 禁止背景滚动
      document.body.style.overflow = 'hidden';

      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = '';
      };
    }, [open, onClose]);

    if (!open) return null;

    return (
      <div className="fixed inset-0 z-modal flex items-start justify-center p-4 pt-16 md:pt-20">
        {/* 遮罩层 */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* 对话框 */}
        <div
          ref={ref}
          className={cn(
            'relative bg-bg-secondary rounded-xl shadow-2xl max-w-md w-full overflow-hidden',
            'border border-border-primary',
            'max-h-[85vh] md:max-h-[80vh] flex flex-col', // 移动端 85vh，桌面端 80vh
            className
          )}
          {...props}
        >
          {/* 头部 - 固定不滚动 */}
          {(title || description) && (
            <div className="px-6 py-4 border-b border-border-primary flex-shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  {title && (
                    <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
                  )}
                  {description && (
                    <p className="mt-1 text-sm text-text-secondary">{description}</p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="ml-4 text-text-tertiary hover:text-text-primary transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* 内容 - 可滚动区域 */}
          <div className="px-6 py-4 overflow-y-auto flex-1">{children}</div>
        </div>
      </div>
    );
  }
);

Dialog.displayName = 'Dialog';

// Dialog Footer 子组件
export interface DialogFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const DialogFooter = forwardRef<HTMLDivElement, DialogFooterProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-end gap-3 px-6 py-3 border-t border-border-primary flex-shrink-0',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

DialogFooter.displayName = 'DialogFooter';

export { Dialog, DialogFooter };
