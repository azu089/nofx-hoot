'use client';

import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AssetHeroCardProps {
  totalAssets?: number;
  todayPnL?: number;
  todayPnLPercent?: number;
  pointBalance?: number;
  tokenBalance?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

/**
 * 资产英雄卡片 - 高保真 v0 设计
 * 华尔街风格暗黑主题，玻璃效果 + 光晕动画
 */
export function AssetHeroCard({
  totalAssets = 0,
  todayPnL = 0,
  todayPnLPercent = 0,
  pointBalance = 0,
  tokenBalance = 0,
  onRefresh,
  isRefreshing = false,
}: AssetHeroCardProps) {
  const router = useRouter();
  const isProfitable = todayPnL >= 0;

  return (
    <div className="relative w-full overflow-hidden rounded-xl p-5 bg-bg-secondary">
      {/* 光球脉动效果 */}
      <div className="pointer-events-none absolute -top-20 right-0 h-40 w-40 animate-pulse rounded-full opacity-30 blur-3xl bg-brand-primary" />

      {/* 内容层 */}
      <div className="relative z-10">
        {/* 头部：总资产 + 刷新按钮 */}
        <div className="mb-6 flex items-start justify-between">
          <div
            className="cursor-pointer"
            onClick={() => router.push('/wallet')}
          >
            <p className="mb-1 text-sm text-text-secondary">
              总资产 (USD)
            </p>
            <h1 className="font-mono text-5xl font-bold tracking-tight text-white">
              ${totalAssets.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </h1>
          </div>
          <button
            onClick={onRefresh}
            className="rounded-md p-2 transition-all hover:bg-white/5 active:scale-95 text-text-secondary"
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 今日盈亏 */}
        <div
          className="mb-5 flex items-center gap-2 cursor-pointer"
          onClick={() => router.push('/trading')}
        >
          <span className="text-sm text-text-secondary">今日盈亏:</span>
          <div className="flex items-center gap-1.5">
            {isProfitable ? (
              <TrendingUp className="h-4 w-4 text-success" />
            ) : (
              <TrendingDown className="h-4 w-4 text-danger" />
            )}
            <span
              className={`font-mono text-lg font-semibold ${
                isProfitable ? 'text-success' : 'text-danger'
              }`}
            >
              {isProfitable ? '+' : ''}$
              {Math.abs(todayPnL).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span
              className={`font-mono text-base font-medium ${
                isProfitable ? 'text-success' : 'text-danger'
              }`}
            >
              ({isProfitable ? '+' : ''}
              {todayPnLPercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* 分隔线 */}
        <div className="mb-4 h-px w-full bg-border-primary" />

        {/* 余额网格：点卡 + 代币 */}
        <div className="grid grid-cols-2 gap-4">
          {/* 点卡余额 */}
          <div
            className="rounded-lg p-3 bg-bg-tertiary cursor-pointer hover:bg-bg-tertiary/80 transition-colors"
            onClick={() => router.push('/ecosystem/points')}
          >
            <p className="mb-1 text-xs text-text-secondary">点卡余额</p>
            <p className="font-mono text-xl font-semibold text-warning">
              {pointBalance.toLocaleString('en-US')}
            </p>
          </div>

          {/* 代币余额 */}
          <div
            className="rounded-lg p-3 bg-bg-tertiary cursor-pointer hover:bg-bg-tertiary/80 transition-colors"
            onClick={() => router.push('/ecosystem/token')}
          >
            <p className="mb-1 text-xs text-text-secondary">代币余额</p>
            <p className="font-mono text-xl font-semibold text-purple-400">
              {tokenBalance.toLocaleString('en-US', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AssetHeroCard;
