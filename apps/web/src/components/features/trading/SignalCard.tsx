'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Target,
  Shield,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// 交易信号类型
export type SignalType = 'buy' | 'sell' | 'close' | 'alert';
export type SignalStrength = 'strong' | 'medium' | 'weak';
export type SignalStatus = 'active' | 'triggered' | 'expired' | 'cancelled';

// 信号数据结构
export interface TradingSignal {
  id: string;
  type: SignalType;
  symbol: string;
  price: number;
  targetPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  strength: SignalStrength;
  status: SignalStatus;
  strategy: string;
  reason: string;
  indicators?: {
    name: string;
    value: string;
    signal: 'bullish' | 'bearish' | 'neutral';
  }[];
  timestamp: string;
  expiresAt?: string;
}

// 信号卡片属性
interface SignalCardProps {
  signal: TradingSignal;
  onExecute?: (signal: TradingSignal) => void;
  onDismiss?: (signal: TradingSignal) => void;
  compact?: boolean;
}

// 信号类型配置
const SIGNAL_CONFIG = {
  buy: {
    icon: TrendingUp,
    label: '买入',
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/30',
  },
  sell: {
    icon: TrendingDown,
    label: '卖出',
    color: 'text-danger',
    bg: 'bg-danger/10',
    border: 'border-danger/30',
  },
  close: {
    icon: Target,
    label: '平仓',
    color: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/30',
  },
  alert: {
    icon: AlertTriangle,
    label: '警报',
    color: 'text-brand-primary',
    bg: 'bg-brand-primary/10',
    border: 'border-brand-primary/30',
  },
};

// 信号强度配置
const STRENGTH_CONFIG = {
  strong: { label: '强', color: 'bg-success text-white' },
  medium: { label: '中', color: 'bg-warning text-black' },
  weak: { label: '弱', color: 'bg-text-tertiary text-white' },
};

// 状态配置
const STATUS_CONFIG = {
  active: { label: '活跃', color: 'bg-success/20 text-success' },
  triggered: { label: '已触发', color: 'bg-brand-primary/20 text-brand-primary' },
  expired: { label: '已过期', color: 'bg-text-tertiary/20 text-text-tertiary' },
  cancelled: { label: '已取消', color: 'bg-danger/20 text-danger' },
};

export function SignalCard({
  signal,
  onExecute,
  onDismiss,
  compact = false,
}: SignalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = SIGNAL_CONFIG[signal.type];
  const strengthConfig = STRENGTH_CONFIG[signal.strength];
  const statusConfig = STATUS_CONFIG[signal.status];
  const Icon = config.icon;

  // 格式化价格
  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  // 格式化时间
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // 计算剩余时间
  const getRemainingTime = () => {
    if (!signal.expiresAt) return null;
    const remaining = new Date(signal.expiresAt).getTime() - Date.now();
    if (remaining <= 0) return '已过期';
    const minutes = Math.floor(remaining / 60000);
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    return `${hours}小时${minutes % 60}分`;
  };

  // 紧凑模式
  if (compact) {
    return (
      <div
        className={`flex items-center gap-3 p-3 rounded-md border ${config.bg} ${config.border}`}
      >
        <Icon className={`w-5 h-5 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-text-primary">{signal.symbol}</span>
            <Badge className={strengthConfig.color}>{strengthConfig.label}</Badge>
          </div>
          <p className="text-sm text-text-secondary truncate">
            {config.label} @ ${formatPrice(signal.price)}
          </p>
        </div>
        <span className="text-xs text-text-tertiary">{formatTime(signal.timestamp)}</span>
      </div>
    );
  }

  return (
    <Card className={`overflow-hidden border ${config.border}`}>
      {/* 头部 */}
      <div className={`p-4 ${config.bg}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-md ${config.bg}`}>
              <Icon className={`w-6 h-6 ${config.color}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-text-primary">
                  {signal.symbol}
                </span>
                <Badge className={strengthConfig.color}>{strengthConfig.label}</Badge>
                <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
              </div>
              <p className="text-sm text-text-secondary">{signal.strategy}</p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-xl font-bold ${config.color}`}>
              {config.label}
            </p>
            <p className="text-sm text-text-secondary">
              @ ${formatPrice(signal.price)}
            </p>
          </div>
        </div>
      </div>

      {/* 主体内容 */}
      <div className="p-4 space-y-4">
        {/* 价格目标 */}
        <div className="grid grid-cols-3 gap-4">
          {signal.targetPrice && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-text-tertiary mb-1">
                <Target className="w-4 h-4" />
                <span className="text-xs">目标价</span>
              </div>
              <p className="font-medium text-success">${formatPrice(signal.targetPrice)}</p>
            </div>
          )}
          {signal.stopLoss && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-text-tertiary mb-1">
                <Shield className="w-4 h-4" />
                <span className="text-xs">止损价</span>
              </div>
              <p className="font-medium text-danger">${formatPrice(signal.stopLoss)}</p>
            </div>
          )}
          {signal.takeProfit && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-text-tertiary mb-1">
                <Zap className="w-4 h-4" />
                <span className="text-xs">止盈价</span>
              </div>
              <p className="font-medium text-success">${formatPrice(signal.takeProfit)}</p>
            </div>
          )}
        </div>

        {/* 信号原因 */}
        <div className="p-3 bg-bg-tertiary rounded-md">
          <p className="text-sm text-text-secondary">{signal.reason}</p>
        </div>

        {/* 展开/收起指标详情 */}
        {signal.indicators && signal.indicators.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-sm text-brand-primary hover:text-brand-secondary"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              技术指标详情
            </button>

            {expanded && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {signal.indicators.map((indicator, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-bg-tertiary rounded-sm"
                  >
                    <span className="text-sm text-text-secondary">{indicator.name}</span>
                    <span
                      className={`text-sm font-medium ${
                        indicator.signal === 'bullish'
                          ? 'text-success'
                          : indicator.signal === 'bearish'
                          ? 'text-danger'
                          : 'text-text-primary'
                      }`}
                    >
                      {indicator.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 时间信息 */}
        <div className="flex items-center justify-between text-xs text-text-tertiary">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>生成于 {formatTime(signal.timestamp)}</span>
          </div>
          {getRemainingTime() && (
            <span className={signal.status === 'expired' ? 'text-danger' : ''}>
              {getRemainingTime()}
            </span>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      {signal.status === 'active' && (onExecute || onDismiss) && (
        <div className="flex border-t border-border-primary">
          {onDismiss && (
            <button
              onClick={() => onDismiss(signal)}
              className="flex-1 py-3 text-sm text-text-secondary hover:bg-bg-tertiary transition-colors"
            >
              忽略
            </button>
          )}
          {onExecute && (
            <button
              onClick={() => onExecute(signal)}
              className={`flex-1 py-3 text-sm font-medium ${config.color} hover:bg-bg-tertiary transition-colors border-l border-border-primary`}
            >
              执行{config.label}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

// 信号列表组件
interface SignalListProps {
  signals: TradingSignal[];
  onExecute?: (signal: TradingSignal) => void;
  onDismiss?: (signal: TradingSignal) => void;
  emptyMessage?: string;
}

export function SignalList({
  signals,
  onExecute,
  onDismiss,
  emptyMessage = '暂无交易信号',
}: SignalListProps) {
  if (signals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
        <Zap className="w-12 h-12 mb-4 opacity-50" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {signals.map((signal) => (
        <SignalCard
          key={signal.id}
          signal={signal}
          onExecute={onExecute}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}

// 信号摘要组件（用于仪表盘）
export function SignalSummary({ signals }: { signals: TradingSignal[] }) {
  const activeSignals = signals.filter((s) => s.status === 'active');
  const buySignals = activeSignals.filter((s) => s.type === 'buy').length;
  const sellSignals = activeSignals.filter((s) => s.type === 'sell').length;

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-success" />
        <span className="text-sm text-text-secondary">
          <span className="font-medium text-success">{buySignals}</span> 买入
        </span>
      </div>
      <div className="flex items-center gap-2">
        <TrendingDown className="w-4 h-4 text-danger" />
        <span className="text-sm text-text-secondary">
          <span className="font-medium text-danger">{sellSignals}</span> 卖出
        </span>
      </div>
    </div>
  );
}

export default SignalCard;
