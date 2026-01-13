'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, Sparkles, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface PositionV2 {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  leverage: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  size: number;
  stopLoss?: number;
  takeProfit?: number;
  holdingTime?: string;
}

interface PositionCardV2Props {
  position: PositionV2;
  onClose?: (id: string) => void;
  onAiAnalysis?: (id: string) => void;
}

/**
 * 持仓卡片 V2 - 高保真设计
 * 专业交易界面风格，含止盈止损进度条
 */
export function PositionCardV2({
  position,
  onClose,
  onAiAnalysis,
}: PositionCardV2Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isProfitable = position.pnl >= 0;
  const isLong = position.side === 'long';

  // 计算止盈止损进度
  const calculateProgress = () => {
    if (!position.stopLoss || !position.takeProfit) return 50;
    const range = position.takeProfit - position.stopLoss;
    if (range === 0) return 50;
    const progress = ((position.currentPrice - position.stopLoss) / range) * 100;
    return Math.min(Math.max(progress, 0), 100);
  };

  const progress = calculateProgress();

  return (
    <div
      className="rounded-xl p-4 transition-all duration-300 hover:-translate-y-0.5
                 bg-bg-secondary border border-border-primary
                 hover:border-brand-primary/50 hover:shadow-[0_0_15px_rgba(55,114,255,0.1)]"
    >
      {/* 头部：交易对 + 方向标签 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-white">{position.symbol}</h3>
          <span
            className={`px-2 py-0.5 text-xs font-bold rounded ${
              isLong ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
            }`}
          >
            {isLong ? '多' : '空'} {position.leverage}x
          </span>
        </div>
        {isLong ? (
          <TrendingUp className="w-5 h-5 text-success" />
        ) : (
          <TrendingDown className="w-5 h-5 text-danger" />
        )}
      </div>

      {/* 盈亏展示 - 大字号 */}
      <div className="mb-3">
        <p
          className={`text-3xl font-bold font-mono mb-1 ${
            isProfitable ? 'text-success' : 'text-danger'
          }`}
        >
          {isProfitable ? '+' : ''}${Math.abs(position.pnl).toFixed(2)}
        </p>
        <p
          className={`text-sm font-mono ${
            isProfitable ? 'text-success' : 'text-danger'
          }`}
        >
          {isProfitable ? '+' : ''}{position.pnlPercent.toFixed(2)}%
        </p>
      </div>

      {/* 价格信息 */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-xs text-text-tertiary mb-1">开仓价</p>
          <p className="text-sm font-semibold font-mono text-white">
            ${position.entryPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-tertiary mb-1">当前价</p>
          <p className="text-sm font-semibold font-mono text-white">
            ${position.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* 止盈止损进度条 */}
      {position.stopLoss && position.takeProfit && (
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-danger">止损 ${position.stopLoss.toLocaleString()}</span>
            <span className="text-success">止盈 ${position.takeProfit.toLocaleString()}</span>
          </div>
          <div className="h-1.5 rounded-full bg-bg-tertiary relative overflow-hidden">
            <div
              className="absolute h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background: isProfitable ? '#00C087' : '#F23645',
                boxShadow: isProfitable
                  ? '0 0 10px rgba(0, 192, 135, 0.5)'
                  : '0 0 10px rgba(242, 54, 69, 0.5)',
              }}
            />
            {/* 当前位置指示器 */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 transition-all duration-300"
              style={{
                left: `${progress}%`,
                transform: `translate(-50%, -50%)`,
                borderColor: isProfitable ? '#00C087' : '#F23645',
              }}
            />
          </div>
        </div>
      )}

      {/* 展开/收起详情 */}
      <button
        className="w-full flex items-center justify-center gap-1 py-2 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <>
            收起详情 <ChevronUp className="w-3.5 h-3.5" />
          </>
        ) : (
          <>
            展开详情 <ChevronDown className="w-3.5 h-3.5" />
          </>
        )}
      </button>

      {/* 展开的详情 */}
      {isExpanded && (
        <div className="mt-2 pt-3 border-t border-border-primary space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-tertiary">持仓数量</span>
            <span className="text-white font-mono">{position.size}</span>
          </div>
          {position.holdingTime && (
            <div className="flex justify-between text-sm">
              <span className="text-text-tertiary">持仓时长</span>
              <span className="text-white">{position.holdingTime}</span>
            </div>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-9 text-xs font-medium bg-transparent border-brand-primary text-brand-primary
                     hover:bg-brand-primary/10 transition-all duration-200 hover:-translate-y-0.5"
          onClick={() => onAiAnalysis?.(position.id)}
        >
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          AI 解读
        </Button>
        <Button
          variant="danger"
          size="sm"
          className="flex-1 h-9 text-xs font-medium transition-all duration-200 hover:-translate-y-0.5"
          onClick={() => onClose?.(position.id)}
        >
          <X className="mr-1.5 h-3.5 w-3.5" />
          平仓
        </Button>
      </div>
    </div>
  );
}

export default PositionCardV2;
