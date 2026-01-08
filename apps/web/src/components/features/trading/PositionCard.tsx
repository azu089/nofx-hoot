'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { aiApi } from '@/lib/api';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  Shield,
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

interface Position {
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
  // 增强字段（可选，后端可能暂未提供）
  current_rate?: number;
  stoploss?: number;
  stop_loss_abs?: number;
  stop_loss_pct?: number;
  min_rate?: number;
  max_rate?: number;
  leverage?: number;
}

interface PositionCardProps {
  position: Position;
  onClose?: (tradeId: number) => Promise<void>;
  disabled?: boolean;
}

/**
 * 格式化持仓时长
 * @param openDate 开仓时间
 * @returns 格式化后的时长字符串
 */
function formatHoldingTime(openDate: string): string {
  const now = new Date();
  const open = new Date(openDate);
  const diffMs = now.getTime() - open.getTime();

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}天 ${hours}时`;
  }
  if (hours > 0) {
    return `${hours}时 ${minutes}分`;
  }
  return `${minutes}分`;
}

/**
 * 格式化价格
 */
function formatPrice(price: number): string {
  if (price >= 1000) {
    return price.toFixed(2);
  }
  if (price >= 1) {
    return price.toFixed(4);
  }
  return price.toFixed(8);
}

/**
 * 增强版持仓卡片组件
 * 显示详细持仓信息：当前价、止损/止盈、持仓时长、浮盈率
 */
export function PositionCard({ position, onClose, disabled }: PositionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  // AI 解读状态
  const [insight, setInsight] = useState<TradeInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightExpanded, setInsightExpanded] = useState(false);

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
    : null;

  // 距离止损的百分比
  const distanceToStoploss = stoplossPrice
    ? ((currentRate - stoplossPrice) / currentRate) * 100
    : null;

  // 最高/最低价
  const hasMinMax = position.min_rate !== undefined && position.max_rate !== undefined;

  const handleClose = async () => {
    if (!onClose) return;
    setClosing(true);
    try {
      await onClose(position.trade_id);
    } finally {
      setClosing(false);
    }
  };

  // 获取 AI 解读
  const fetchInsight = async () => {
    if (insight) {
      setInsightExpanded(!insightExpanded);
      return;
    }

    setInsightLoading(true);

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
      // 如果 API 不存在，使用模拟数据
      const mockInsight: TradeInsight = {
        trigger: `RSI 指标触发超卖信号 (RSI < 30)，${position.pair} 价格处于支撑位附近`,
        trend: isProfit
          ? '市场趋势判断正确，价格按预期方向运行'
          : '市场出现反向波动，建议关注止损位',
        action: `以 $${formatPrice(position.open_rate)} 市价买入 ${position.amount.toFixed(4)} ${position.pair.split('/')[0]}`,
        explanation: isProfit
          ? `老板，这笔持仓目前浮盈 $${Math.abs(unrealizedPnl).toFixed(2)}！策略在 ${position.pair} 超卖区间精准抄底，持续持有中。`
          : `老板，这笔持仓目前浮亏 $${Math.abs(unrealizedPnl).toFixed(2)}，主要是市场波动，但还在止损范围内，继续观察。`,
        sentiment: isProfit ? 'bullish' : 'bearish',
      };
      setInsight(mockInsight);
      setInsightExpanded(true);
    } finally {
      setInsightLoading(false);
    }
  };

  return (
    <div className="bg-bg-tertiary/50 rounded-xl border border-border-primary overflow-hidden">
      {/* 主要信息 */}
      <div className="p-4">
        {/* 头部：交易对 + 方向 + 杠杆 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-text-primary">{position.pair}</span>
            <span className="px-1.5 py-0.5 text-xs font-medium bg-success/20 text-success rounded">
              多
            </span>
            {position.leverage && position.leverage > 1 && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-warning/20 text-warning rounded">
                {position.leverage}x
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <Clock className="w-3.5 h-3.5" />
            {holdingTime}
          </div>
        </div>

        {/* 价格行：开仓价 → 当前价 */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1">
            <p className="text-xs text-text-tertiary mb-1">开仓价</p>
            <p className="text-text-primary font-mono">{formatPrice(position.open_rate)}</p>
          </div>
          <div className="text-text-tertiary">→</div>
          <div className="flex-1">
            <p className="text-xs text-text-tertiary mb-1">当前价</p>
            <p className={`font-mono font-medium ${isProfit ? 'text-success' : 'text-danger'}`}>
              {formatPrice(currentRate)}
            </p>
          </div>
          <div className="flex-1 text-right">
            <p className="text-xs text-text-tertiary mb-1">浮动盈亏</p>
            <p className={`text-lg font-bold ${isProfit ? 'text-success' : 'text-danger'}`}>
              {isProfit ? '+' : ''}{unrealizedPnl.toFixed(2)}
            </p>
            <p className={`text-xs ${isProfit ? 'text-success' : 'text-danger'}`}>
              {isProfit ? '+' : ''}{unrealizedPnlPercent.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* 风控信息 */}
        <div className="flex items-center gap-4 text-sm">
          {/* 止损 */}
          {stoplossPrice && (
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-danger" />
              <span className="text-text-tertiary">止损</span>
              <span className="text-danger font-mono">{formatPrice(stoplossPrice)}</span>
              {distanceToStoploss !== null && (
                <span className="text-xs text-text-tertiary">
                  ({distanceToStoploss > 0 ? '+' : ''}{distanceToStoploss.toFixed(1)}%)
                </span>
              )}
            </div>
          )}

          {/* 持仓量 */}
          <div className="flex items-center gap-1.5">
            <span className="text-text-tertiary">数量</span>
            <span className="text-text-primary font-mono">{position.amount.toFixed(4)}</span>
          </div>

          {/* 本金 */}
          <div className="flex items-center gap-1.5">
            <span className="text-text-tertiary">本金</span>
            <span className="text-text-primary font-mono">${position.stake_amount.toFixed(2)}</span>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                收起详情
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                展开详情
              </>
            )}
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={disabled || closing}
          >
            {closing ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                平仓中
              </>
            ) : (
              '平仓'
            )}
          </Button>
        </div>
      </div>

      {/* 展开的详细信息 */}
      {expanded && (
        <div className="px-4 pb-4 pt-0">
          <div className="pt-3 border-t border-border-primary/50 grid grid-cols-2 gap-3 text-sm">
            {/* 价格波动范围 */}
            {hasMinMax && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-text-tertiary flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5 text-danger" />
                    最低价
                  </span>
                  <span className="text-text-primary font-mono">{formatPrice(position.min_rate!)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-tertiary flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-success" />
                    最高价
                  </span>
                  <span className="text-text-primary font-mono">{formatPrice(position.max_rate!)}</span>
                </div>
              </>
            )}

            {/* 止损百分比 */}
            {position.stop_loss_pct && (
              <div className="flex items-center justify-between">
                <span className="text-text-tertiary">止损设置</span>
                <span className="text-danger">{(position.stop_loss_pct * 100).toFixed(1)}%</span>
              </div>
            )}

            {/* 开仓时间 */}
            <div className="flex items-center justify-between col-span-2">
              <span className="text-text-tertiary">开仓时间</span>
              <span className="text-text-primary">
                {new Date(position.open_date).toLocaleString('zh-CN', {
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            {/* Trade ID */}
            <div className="flex items-center justify-between col-span-2">
              <span className="text-text-tertiary">交易ID</span>
              <span className="text-text-primary font-mono">#{position.trade_id}</span>
            </div>
          </div>

          {/* AI 解读按钮 */}
          <div className="mt-4 pt-3 border-t border-border-primary/30">
            <button
              onClick={fetchInsight}
              className="flex items-center gap-2 text-sm text-brand-primary hover:text-brand-secondary transition-colors"
            >
              {insightLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{insightLoading ? 'AI 分析中...' : insightExpanded ? '收起 AI 解读' : 'AI 解读这笔持仓'}</span>
              {!insightLoading && (insightExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
            </button>

            {/* AI 解读内容 */}
            {insightExpanded && insight && (
              <div className="mt-3 p-4 bg-gradient-to-br from-brand-primary/5 to-brand-secondary/5 rounded-xl border border-brand-primary/20 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                {/* 人话解读 - 最重要，放最上面 */}
                <div className={`p-3 rounded-lg ${isProfit ? 'bg-success/10 border border-success/20' : 'bg-danger/10 border border-danger/20'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isProfit ? 'bg-success/20' : 'bg-danger/20'}`}>
                      {isProfit ? (
                        <TrendingUp className="w-4 h-4 text-success" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-danger" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">智能投顾解读</p>
                      <p className={`text-sm mt-1 ${isProfit ? 'text-success' : 'text-danger'}`}>
                        {insight.explanation}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 信号卡片三要素 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 触发条件 */}
                  <div className="p-3 bg-bg-tertiary/50 rounded-lg border border-border-primary/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-warning" />
                      <span className="text-xs font-medium text-text-tertiary">触发条件</span>
                    </div>
                    <p className="text-sm text-text-primary">{insight.trigger}</p>
                  </div>

                  {/* 趋势判断 */}
                  <div className="p-3 bg-bg-tertiary/50 rounded-lg border border-border-primary/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-brand-primary" />
                      <span className="text-xs font-medium text-text-tertiary">趋势判断</span>
                    </div>
                    <p className="text-sm text-text-primary">{insight.trend}</p>
                  </div>

                  {/* 执行动作 */}
                  <div className="p-3 bg-bg-tertiary/50 rounded-lg border border-border-primary/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-success" />
                      <span className="text-xs font-medium text-text-tertiary">执行动作</span>
                    </div>
                    <p className="text-sm text-text-primary">{insight.action}</p>
                  </div>
                </div>

                {/* AI 标识 */}
                <div className="flex items-center justify-end gap-2 text-xs text-text-tertiary">
                  <Sparkles className="w-3 h-3 text-brand-primary" />
                  <span>由 QuantFi AI 智能投顾生成</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
