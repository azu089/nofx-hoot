'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { aiApi } from '@/lib/api';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  Activity,
  Zap,
} from 'lucide-react';

// AI 解读数据类型
interface TradeInsight {
  trigger: string;      // 触发条件
  trend: string;        // 趋势判断
  action: string;       // 执行动作
  explanation: string;  // 人话解读
  sentiment: 'bullish' | 'bearish' | 'neutral';
}

export interface Position {
  trade_id: number;
  pair: string;
  is_open: boolean;
  open_rate: number;
  close_rate: number | null;
  amount: number;
  stake_amount: number;
  close_profit: number | null;
  close_profit_abs: number | null;
  open_date: string;
  close_date: string | null;
  current_rate?: number;
  leverage?: number;
  stoploss?: number;
  stop_loss_pct?: number;
  take_profit_pct?: number;
  min_rate?: number;
  max_rate?: number;
}

interface PositionCardProps {
  position: Position;
  disabled?: boolean;
  zebra?: boolean;
}

// 格式化价格
function formatPrice(price: number): string {
  if (price >= 1000) return price.toFixed(2);
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
}

// 格式化持仓时长 (极简版: 3h, 2d 5h)
function formatHoldingTime(openDate: string): string {
  const now = Date.now();
  const start = new Date(openDate).getTime();
  const diff = now - start;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}

/**
 * 持仓卡片组件 V2 - 简洁版
 * 参考 Binance/OKX 设计理念：
 * - 默认只显示核心信息（交易对、盈亏、价格、简单操作）
 * - 展开后显示详细信息（止损、最高最低价、开仓时间等）
 */
export function PositionCard({ position, disabled, zebra }: PositionCardProps) {
  const [expanded, setExpanded] = useState(false);
  // AI 解读状态
  const [insight, setInsight] = useState<TradeInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightExpanded, setInsightExpanded] = useState(false);
  const [insightError, setInsightError] = useState(false);

  // 计算盈亏
  const currentRate = position.current_rate || position.open_rate;
  const unrealizedPnl = position.close_profit_abs || 0;
  const unrealizedPnlPercent = (position.close_profit || 0) * 100;
  const isProfit = unrealizedPnl >= 0;

  // 计算价格变化
  const priceChange = currentRate - position.open_rate;
  const priceChangePercent = (priceChange / position.open_rate) * 100;

  // 持仓时长
  const holdingTime = formatHoldingTime(position.open_date);

  // 止损价格
  const stoplossPrice = position.stoploss
    ? position.open_rate * (1 + position.stoploss)
    : position.stop_loss_pct
    ? position.open_rate * (1 + position.stop_loss_pct / 100)
    : null;

  // 止盈价格
  const takeProfitPrice = position.take_profit_pct
    ? position.open_rate * (1 + position.take_profit_pct / 100)
    : null;

  // 距离止损的百分比
  const distanceToStoploss = stoplossPrice
    ? ((currentRate - stoplossPrice) / currentRate) * 100
    : null;

  // 距离止盈的百分比
  const distanceToTakeProfit = takeProfitPrice
    ? ((takeProfitPrice - currentRate) / currentRate) * 100
    : null;

  // 最高/最低价
  const hasMinMax = position.min_rate !== undefined && position.max_rate !== undefined;

  // 获取 AI 解读
  const fetchInsight = async () => {
    if (insight) {
      setInsightExpanded(!insightExpanded);
      return;
    }

    if (insightError) {
      setInsightExpanded(!insightExpanded);
      return;
    }

    setInsightLoading(true);
    setInsightError(false);

    try {
      const res = await aiApi.interpretTrade({
        pair: position.pair,
        side: 'buy', // 目前只支持做多
        amount: position.amount.toString(),
        price: position.open_rate.toString(),
        pnl: unrealizedPnl.toString(),
        executed_at: position.open_date,
      });
      setInsight(res.data);
      setInsightExpanded(true);
    } catch {
      // API 失败时设置错误状态，显示友好提示
      setInsightError(true);
      setInsightExpanded(true);
    } finally {
      setInsightLoading(false);
    }
  };

  return (
    <div className={zebra ? 'bg-[#000000]' : ''}>
      {/* 默认简洁视图 */}
      <div className="px-4 py-4">
        {/* 第一行：交易对 + 标签 + 盈亏 */}
        <div className="flex items-start justify-between mb-2.5">
          {/* 左侧：交易对 + 标签 */}
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-text-primary">{position.pair}</h3>
            <span className="px-1.5 py-0.5 text-xs font-medium bg-success/20 text-success rounded">
              做多
            </span>
            {position.leverage && position.leverage > 1 && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-warning/20 text-warning rounded">
                {position.leverage}x
              </span>
            )}
          </div>

          {/* 右侧：盈亏金额 */}
          <div className="text-right">
            <p className={`text-2xl font-bold leading-tight ${isProfit ? 'text-success' : 'text-danger'}`}>
              {isProfit ? '+' : ''}{unrealizedPnl.toFixed(2)}
            </p>
            <p className={`text-xs mt-0.5 ${isProfit ? 'text-success' : 'text-danger'}`}>
              {isProfit ? '+' : ''}{unrealizedPnlPercent.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* 第二行：价格信息（开仓价 → 当前价） */}
        <div className="flex items-center justify-between mb-3 text-sm">
          {/* 开仓价 */}
          <div>
            <p className="text-text-tertiary text-xs mb-0.5">开仓</p>
            <p className="text-text-primary font-mono leading-tight">{formatPrice(position.open_rate)}</p>
          </div>

          {/* 箭头 */}
          <div className="px-3 text-text-tertiary">→</div>

          {/* 当前价 */}
          <div>
            <p className="text-text-tertiary text-xs mb-0.5">当前</p>
            <p className={`font-mono font-medium leading-tight ${isProfit ? 'text-success' : 'text-danger'}`}>
              {formatPrice(currentRate)}
            </p>
          </div>

          {/* 持仓时长 */}
          <div className="ml-auto flex items-center gap-1.5 text-text-tertiary">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-xs">{holdingTime}</span>
          </div>
        </div>

        {/* 第三行：操作按钮 */}
        <div className="flex items-center gap-2">
          {/* AI 解读按钮 */}
          <button
            onClick={fetchInsight}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gradient-to-r from-brand-primary/10 to-brand-secondary/10 hover:from-brand-primary/20 hover:to-brand-secondary/20 rounded-lg text-sm font-medium text-brand-primary transition-all"
          >
            {insightLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{insightLoading ? 'AI 分析中...' : 'AI 解读'}</span>
          </button>

          {/* 展开详情按钮 */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-4 py-2 text-sm text-text-tertiary hover:text-text-primary bg-bg-tertiary/50 hover:bg-bg-tertiary rounded-lg transition-colors"
          >
            {expanded ? '收起' : '详情'}
          </button>
        </div>
      </div>

      {/* 展开详情区域 - 两行布局 */}
      {expanded && (
        <div className="px-4 pb-3 pt-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="space-y-2">
            {/* 第一行：持仓 | 价值 | 本金 | 止损 | 止盈 */}
            <div className="flex items-center gap-3 text-xs text-text-secondary flex-wrap">
              <span>持仓 {position.amount.toFixed(4)}</span>
              <span className="text-text-tertiary">|</span>
              <span>价值 ${(position.amount * currentRate).toFixed(2)}</span>
              <span className="text-text-tertiary">|</span>
              <span>本金 ${position.stake_amount.toFixed(2)}</span>
              {stoplossPrice && (
                <>
                  <span className="text-text-tertiary">|</span>
                  <span className="text-danger">止损 {formatPrice(stoplossPrice)}</span>
                </>
              )}
              {takeProfitPrice && (
                <>
                  <span className="text-text-tertiary">|</span>
                  <span className="text-success">止盈 {formatPrice(takeProfitPrice)}</span>
                </>
              )}
            </div>

            {/* 第二行：最高 / 最低 */}
            {hasMinMax && position.max_rate && position.min_rate && (
              <div className="flex items-center gap-3 text-xs text-text-secondary">
                <span className="text-success">最高 {formatPrice(position.max_rate)}</span>
                <span className="text-text-tertiary">/</span>
                <span className="text-danger">最低 {formatPrice(position.min_rate)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI 解读内容 - 独立区域 */}
      {insightExpanded && (
        <div className="px-4 pb-3 pt-2.5">
          {insightError ? (
            // API 失败时显示错误提示
            <div className="p-4 bg-bg-tertiary/50 rounded-xl border border-border-primary animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2.5 text-text-tertiary">
                <Sparkles className="w-4 h-4 flex-shrink-0" />
                <p className="text-sm">AI 解读暂时不可用，请稍后再试</p>
              </div>
            </div>
          ) : insight ? (
            // 成功时显示解读内容
            <div className="p-3 bg-gradient-to-br from-brand-primary/5 to-brand-secondary/5 rounded-xl lg:border lg:border-brand-primary/20 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
              {/* 人话解读 - 最重要 - 移动端无边框 */}
              <div className={`p-2.5 rounded-lg ${isProfit ? 'bg-success/10 lg:border lg:border-success/20' : 'bg-danger/10 lg:border lg:border-danger/20'}`}>
                <div className="flex items-start gap-2.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isProfit ? 'bg-success/20' : 'bg-danger/20'}`}>
                    {isProfit ? (
                      <TrendingUp className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-danger" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white mb-0.5">💡 智能投顾解读</p>
                    <p className={`text-sm leading-snug ${isProfit ? 'text-success' : 'text-danger'}`}>
                      {insight.explanation}
                    </p>
                  </div>
                </div>
              </div>

              {/* 技术详情 */}
              <div className="space-y-1.5 text-sm">
                {/* 触发条件 */}
                <div className="flex items-start gap-2">
                  <Activity className="w-3.5 h-3.5 text-brand-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-text-tertiary text-xs mb-0.5">触发信号</p>
                    <p className="text-text-secondary text-sm leading-snug">{insight.trigger}</p>
                  </div>
                </div>

                {/* 趋势判断 */}
                <div className="flex items-start gap-2">
                  <Zap className="w-3.5 h-3.5 text-brand-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-text-tertiary text-xs mb-0.5">趋势分析</p>
                    <p className="text-text-secondary text-sm leading-snug">{insight.trend}</p>
                  </div>
                </div>

                {/* 执行动作 */}
                <div className="flex items-start gap-2">
                  <Target className="w-3.5 h-3.5 text-brand-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-text-tertiary text-xs mb-0.5">执行操作</p>
                    <p className="text-text-secondary text-sm leading-snug">{insight.action}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
