'use client';

import { Fragment, ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const Modal = ({ open, onClose, title, children, size = 'md', className }: ModalProps) => {
  if (!open) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  // ESC 键关闭
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Fragment>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 弹窗内容 */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onKeyDown={handleKeyDown}
      >
        <div
          className={cn(
            'relative w-full bg-[#131722] border border-[#2B3139] rounded-xl shadow-2xl animate-in',
            sizes[size],
            className
          )}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {/* 头部 */}
          {title && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2B3139]">
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              <button
                onClick={onClose}
                className="text-[#848E9C] hover:text-white transition-colors p-1 rounded-lg hover:bg-[#1E222D]"
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* 无标题时的关闭按钮 */}
          {!title && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-[#848E9C] hover:text-white transition-colors p-1 rounded-lg hover:bg-[#1E222D] z-10"
              aria-label="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* 内容区 */}
          <div className={cn('px-6 py-4', !title && 'pt-12')}>{children}</div>
        </div>
      </div>
    </Fragment>
  );
};

Modal.displayName = 'Modal';

export { Modal };
