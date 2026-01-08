'use client';

import { Fragment, ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  showCloseButton?: boolean;
  position?: 'center' | 'top';
}

const Modal = ({
  open,
  onClose,
  title,
  children,
  size = 'md',
  className,
  showCloseButton = true,
  position = 'center',
}: ModalProps) => {
  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // 禁止背景滚动
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[90vw] max-h-[90vh]',
  };

  return (
    <Fragment>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 弹窗内容 */}
      <div className={cn(
        "fixed inset-0 z-50 flex justify-center p-4 overflow-y-auto",
        position === 'center' ? 'items-center' : 'items-start pt-16'
      )}>
        <div
          className={cn(
            'relative w-full bg-bg-secondary border border-border-primary rounded-xl shadow-lg animate-in',
            sizes[size],
            className
          )}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {/* 头部 */}
          {title && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
              <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="text-text-tertiary hover:text-text-primary transition-colors p-1.5 rounded-md hover:bg-bg-tertiary"
                  aria-label="关闭"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          )}

          {/* 无标题时的关闭按钮 */}
          {!title && showCloseButton && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-text-tertiary hover:text-text-primary transition-colors p-1.5 rounded-md hover:bg-bg-tertiary z-10"
              aria-label="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* 内容区 */}
          <div className={cn('px-6 py-4', !title && showCloseButton && 'pt-12')}>{children}</div>
        </div>
      </div>
    </Fragment>
  );
};

Modal.displayName = 'Modal';

export { Modal };
