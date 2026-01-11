'use client';

import { Fragment, ReactNode, useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  showCloseButton?: boolean;
  /** 外部链接按钮 */
  externalUrl?: string;
}

const Sheet = ({
  open,
  onClose,
  title,
  children,
  className,
  showCloseButton = true,
  externalUrl,
}: SheetProps) => {
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

  return (
    <Fragment>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet 内容 - 从底部滑入 */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 bg-bg-secondary border-t border-border-primary rounded-t-2xl shadow-lg',
          'animate-in slide-in-from-bottom duration-300',
          'max-h-[90vh] flex flex-col',
          className
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* 拖动指示条 */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-bg-tertiary rounded-full" />
        </div>

        {/* 头部 */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-border-primary">
          <div className="flex items-center gap-2">
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-text-tertiary hover:text-text-primary transition-colors p-1.5 rounded-md hover:bg-bg-tertiary"
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            {title && (
              <h2 className="text-sm font-medium text-text-primary truncate max-w-[60vw]">{title}</h2>
            )}
          </div>

          {/* 外部链接按钮 */}
          {externalUrl && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-brand-primary hover:text-brand-secondary transition-colors px-3 py-1.5 rounded-md hover:bg-bg-tertiary"
            >
              <span>浏览器打开</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </Fragment>
  );
};

Sheet.displayName = 'Sheet';

export { Sheet };
