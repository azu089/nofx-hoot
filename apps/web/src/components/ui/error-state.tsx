'use client';

import { AlertCircle, RefreshCw, WifiOff } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  type?: 'error' | 'network' | 'empty';
}

export function ErrorState({
  title = '加载失败',
  message = '请稍后重试',
  onRetry,
  type = 'error',
}: ErrorStateProps) {
  const icons = {
    error: <AlertCircle size={48} className="text-danger" />,
    network: <WifiOff size={48} className="text-warning" />,
    empty: <AlertCircle size={48} className="text-text-tertiary" />,
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-bg-tertiary flex items-center justify-center mb-4">
        {icons[type]}
      </div>
      <h3 className="text-lg font-medium text-text-primary mb-2">{title}</h3>
      <p className="text-sm text-text-secondary mb-6 max-w-xs">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-secondary transition-colors"
        >
          <RefreshCw size={16} />
          <span>重试</span>
        </button>
      )}
    </div>
  );
}

export function NetworkError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      type="network"
      title="网络连接失败"
      message="请检查网络连接后重试"
      onRetry={onRetry}
    />
  );
}

export function LoadError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      type="error"
      title="加载失败"
      message="数据加载出错，请稍后重试"
      onRetry={onRetry}
    />
  );
}
