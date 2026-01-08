'use client';

import { Dialog, DialogFooter } from '@/components/ui';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
} from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

/**
 * 交易信号详情类型
 * 包含 Freqtrade 返回的 buy_tag 和 sell_reason 字段
 */
export interface TradeSignal {
  id: string;
  pair: string;
  side: 'buy' | 'sell';
  // 价格信息
  open_rate: number;
  close_rate?: number;
  current_rate?: number;
  // 数量和金额
  amount: number;
  stake_amount?: number;
  // 盈亏
  profit?: number;
  profit_percent?: number;
  // 时间
  open_time: number;
  close_time?: number;
  // Freqtrade 信号详情
  buy_tag?: string;       // 买入触发条件标签
  sell_reason?: string;   // 卖出原因
  // 策略信息
  strategy?: string;
  timeframe?: string;
  leverage?: number;
  // 止损信息
  stop_loss?: number;
  stop_loss_pct?: number;
  initial_stop_loss?: number;
  // 状态
  is_open?: boolean;
}

interface TradeSignalCardProps {
  trade: TradeSignal;
  open: boolean;
  onClose: () => void;
}

/**
 * 买卖点信号详情卡片
 * 展示交易触发原因、执行详情、盈亏结果
 */
export function TradeSignalCard({ trade, open, onClose }: TradeSignalCardProps) {
  const isProfit = (trade.profit || 0) >= 0;
  const profitPercent = ((trade.profit_percent || 0) * 100).toFixed(2);
  const isBuy = trade.side === 'buy';
  const isOpen = trade.is_open ?? !trade.close_time;

  // 解析触发条件显示
  const getTriggerDisplay = () => {
    if (trade.buy_tag) {
      // 常见的 Freqtrade buy_tag 格式解析
      const tag = trade.buy_tag;

      // 尝试解析常见格式
      if (tag.includes('rsi')) return { icon: TrendingDown, text: 'RSI 超卖信号', color: 'text-success' };
      if (tag.includes('macd')) return { icon: TrendingUp, text: 'MACD 金叉信号', color: 'text-success' };
      if (tag.includes('ema') || tag.includes('sma')) return { icon: TrendingUp, text: '均线交叉信号', color: 'text-success' };
      if (tag.includes('bb') || tag.includes('bollinger')) return { icon: Target, text: '布林带突破', color: 'text-success' };
      if (tag.includes('volume')) return { icon: TrendingUp, text: '放量突破', color: 'text-success' };

      return { icon: Info, text: tag, color: 'text-brand-primary' };
    }

    if (trade.sell_reason) {
      const reason = trade.sell_reason;

      // Freqtrade 常见 sell_reason
      if (reason === 'roi') return { icon: CheckCircle, text: '达到止盈目标 (ROI)', color: 'text-success' };
      if (reason === 'stop_loss') return { icon: XCircle, text: '触发止损', color: 'text-danger' };
      if (reason === 'trailing_stop_loss') return { icon: AlertTriangle, text: '移动止损触发', color: 'text-warning' };
      if (reason === 'sell_signal') return { icon: TrendingDown, text: '策略卖出信号', color: 'text-warning' };
      if (reason === 'force_sell') return { icon: XCircle, text: '强制平仓', color: 'text-danger' };
      if (reason === 'emergency_sell') return { icon: AlertTriangle, text: '紧急平仓', color: 'text-danger' };

      return { icon: Info, text: reason, color: 'text-text-secondary' };
    }

    return { icon: Info, text: '策略信号', color: 'text-text-secondary' };
  };

  const trigger = getTriggerDisplay();
  const TriggerIcon = trigger.icon;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${trade.pair} ${isBuy ? '买入' : '卖出'}信号`}
      description={isOpen ? '交易进行中' : '交易已完成'}
    >
      <div className="space-y-4">
        {/* 触发条件 */}
        <div className="bg-bg-tertiary rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TriggerIcon className={`w-5 h-5 ${trigger.color}`} />
            <p className="text-sm text-text-secondary">触发条件</p>
          </div>
          <p className={`text-lg font-medium ${trigger.color}`}>{trigger.text}</p>
          {trade.strategy && (
            <p className="text-xs text-text-tertiary mt-1">
              策略: {trade.strategy} · {trade.timeframe || '5m'}
            </p>
          )}
        </div>

        {/* 执行详情 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-bg-tertiary/50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="w-4 h-4 text-text-tertiary" />
              <p className="text-xs text-text-tertiary">开仓价格</p>
            </div>
            <p className="text-white font-medium">${trade.open_rate.toLocaleString(undefined, { maximumFractionDigits: 8 })}</p>
          </div>

          <div className="bg-bg-tertiary/50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="w-4 h-4 text-text-tertiary" />
              <p className="text-xs text-text-tertiary">{isOpen ? '当前价格' : '平仓价格'}</p>
            </div>
            <p className="text-white font-medium">
              ${(trade.close_rate || trade.current_rate || 0).toLocaleString(undefined, { maximumFractionDigits: 8 })}
            </p>
          </div>

          <div className="bg-bg-tertiary/50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-4 h-4 text-text-tertiary" />
              <p className="text-xs text-text-tertiary">开仓时间</p>
            </div>
            <p className="text-white text-sm">{formatDateTime(new Date(trade.open_time * 1000).toISOString())}</p>
          </div>

          <div className="bg-bg-tertiary/50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-4 h-4 text-text-tertiary" />
              <p className="text-xs text-text-tertiary">{isOpen ? '持仓时长' : '平仓时间'}</p>
            </div>
            <p className="text-white text-sm">
              {isOpen
                ? formatHoldDuration(trade.open_time)
                : trade.close_time
                  ? formatDateTime(new Date(trade.close_time * 1000).toISOString())
                  : '-'
              }
            </p>
          </div>
        </div>

        {/* 交易规模 */}
        <div className="flex items-center justify-between p-3 bg-bg-tertiary/50 rounded-lg">
          <div>
            <p className="text-xs text-text-tertiary">交易数量</p>
            <p className="text-white font-medium">{trade.amount}</p>
          </div>
          {trade.stake_amount && (
            <div className="text-right">
              <p className="text-xs text-text-tertiary">投入金额</p>
              <p className="text-white font-medium">${trade.stake_amount.toLocaleString()}</p>
            </div>
          )}
          {trade.leverage && trade.leverage > 1 && (
            <div className="text-right">
              <p className="text-xs text-text-tertiary">杠杆</p>
              <p className="text-warning font-medium">{trade.leverage}x</p>
            </div>
          )}
        </div>

        {/* 止损信息 */}
        {trade.stop_loss && (
          <div className="flex items-center justify-between p-3 border border-danger/30 bg-danger/5 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-danger" />
              <p className="text-sm text-text-secondary">止损价格</p>
            </div>
            <div className="text-right">
              <p className="text-danger font-medium">${trade.stop_loss.toLocaleString(undefined, { maximumFractionDigits: 8 })}</p>
              {trade.stop_loss_pct && (
                <p className="text-xs text-danger/70">{(trade.stop_loss_pct * 100).toFixed(1)}%</p>
              )}
            </div>
          </div>
        )}

        {/* 盈亏结果 */}
        {(trade.profit !== undefined || isOpen) && (
          <div className={`rounded-lg p-4 ${
            isOpen
              ? 'bg-brand-primary/10 border border-brand-primary/30'
              : isProfit
                ? 'bg-success/10 border border-success/30'
                : 'bg-danger/10 border border-danger/30'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-text-secondary mb-1">{isOpen ? '浮动盈亏' : '最终盈亏'}</p>
                <p className={`text-2xl font-bold ${
                  isOpen
                    ? 'text-brand-primary'
                    : isProfit
                      ? 'text-success'
                      : 'text-danger'
                }`}>
                  {isProfit ? '+' : ''}{(trade.profit || 0).toFixed(2)} USDT
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-text-secondary mb-1">收益率</p>
                <p className={`text-xl font-bold ${
                  isOpen
                    ? 'text-brand-primary'
                    : isProfit
                      ? 'text-success'
                      : 'text-danger'
                }`}>
                  {isProfit ? '+' : ''}{profitPercent}%
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          关闭
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

/**
 * 格式化持仓时长
 */
function formatHoldDuration(openTime: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - openTime;

  if (diff < 60) return `${diff}秒`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时 ${Math.floor((diff % 3600) / 60)}分`;
  return `${Math.floor(diff / 86400)}天 ${Math.floor((diff % 86400) / 3600)}小时`;
}

export default TradeSignalCard;
