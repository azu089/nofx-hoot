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
      <div className="fixed inset-0 z-modal flex items-center justify-center">
        {/* 遮罩层 */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* 对话框 */}
        <div
          ref={ref}
          className={cn(
            'relative bg-bg-secondary rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden',
            'border border-border-primary',
            className
          )}
          {...props}
        >
          {/* 头部 */}
          {(title || description) && (
            <div className="px-6 py-4 border-b border-border-primary">
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

          {/* 内容 */}
          <div className="px-6 py-4">{children}</div>
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
          'flex items-center justify-end gap-3 px-6 py-4 bg-bg-secondary/50 border-t border-border-primary',
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
