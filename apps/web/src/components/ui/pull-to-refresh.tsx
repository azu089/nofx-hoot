'use client';

import { RefreshCw } from 'lucide-react';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold = 80,
}: PullToRefreshIndicatorProps) {
  if (pullDistance === 0 && !isRefreshing) return null;

  const progress = Math.min(pullDistance / threshold, 1);
  const shouldShow = pullDistance > 10 || isRefreshing;

  if (!shouldShow) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 flex items-center justify-center z-50 transition-transform"
      style={{
        transform: `translateY(${Math.min(pullDistance, threshold)}px)`,
      }}
    >
      <div
        className={`
          w-10 h-10 rounded-full bg-bg-secondary border border-border-primary
          flex items-center justify-center shadow-lg
          transition-all duration-200
          ${pullDistance >= threshold ? 'bg-brand-primary border-brand-primary' : ''}
        `}
      >
        <RefreshCw
          size={20}
          className={`
            transition-all duration-200
            ${isRefreshing ? 'animate-spin text-white' : ''}
            ${pullDistance >= threshold && !isRefreshing ? 'text-white' : 'text-text-tertiary'}
          `}
          style={{
            transform: isRefreshing ? undefined : `rotate(${progress * 180}deg)`,
          }}
        />
      </div>
    </div>
  );
}
