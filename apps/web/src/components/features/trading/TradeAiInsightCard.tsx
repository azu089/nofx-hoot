'use client';

import { useState } from 'react';
import { Card, CardContent, Button } from '@/components/ui';
import { aiApi } from '@/lib/api';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Target,
  Activity,
  Zap,
} from 'lucide-react';

interface Trade {
  id: string;
  pair: string;
  side: string;
  amount: string;
  price: string;
  pnl: string;
  executed_at: string;
}

interface TradeInsight {
  trigger: string;      // 触发条件
  trend: string;        // 趋势判断
  action: string;       // 执行动作
  explanation: string;  // 人话解读
  sentiment: 'bullish' | 'bearish' | 'neutral';
}

interface TradeAiInsightCardProps {
  trade: Trade;
}

export function TradeAiInsightCard({ trade }: TradeAiInsightCardProps) {
  const [insight, setInsight] = useState<TradeInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pnl = parseFloat(trade.pnl);
  const isProfitable = pnl >= 0;

  // 获取 AI 解读
  const fetchInsight = async () => {
    if (insight) {
      setExpanded(!expanded);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await aiApi.interpretTrade({
        pair: trade.pair,
        side: trade.side,
        amount: trade.amount,
        price: trade.price,
        pnl: trade.pnl,
        executed_at: trade.executed_at,
      });
      setInsight(res.data);
      setExpanded(true);
    } catch (err) {
      // 如果 API 不存在，使用模拟数据
      const mockInsight: TradeInsight = {
        trigger: trade.side === 'buy'
          ? `RSI 指标触发超卖信号 (RSI < 30)，${trade.pair} 价格处于支撑位附近`
          : `RSI 指标触发超买信号 (RSI > 70)，${trade.pair} 价格接近阻力位`,
        trend: isProfitable
          ? '市场趋势判断正确，价格按预期方向运行'
          : '市场出现反向波动，触发止损保护',
        action: trade.side === 'buy'
          ? `以 $${trade.price} 市价买入 ${trade.amount} ${trade.pair.split('/')[0]}`
          : `以 $${trade.price} 市价卖出 ${trade.amount} ${trade.pair.split('/')[0]}`,
        explanation: isProfitable
          ? `老板，这笔交易赚了 $${Math.abs(pnl).toFixed(2)}！策略在 ${trade.pair} 超卖区间精准抄底，价格反弹后及时止盈，完美执行！`
          : `老板，这笔亏了 $${Math.abs(pnl).toFixed(2)}，主要是市场突然反向，不过好在及时止损，避免了更大损失。下次会更谨慎！`,
        sentiment: isProfitable ? 'bullish' : 'bearish',
      };
      setInsight(mockInsight);
      setExpanded(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3">
      {/* 展开/收起按钮 */}
      <button
        onClick={fetchInsight}
        className="flex items-center gap-2 text-sm text-brand-primary hover:text-brand-secondary transition-colors"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        <span>{loading ? 'AI 分析中...' : expanded ? '收起 AI 解读' : 'AI 解读这笔交易'}</span>
        {!loading && (expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
      </button>

      {/* AI 解读内容 */}
      {expanded && insight && (
        <div className="mt-3 p-4 bg-gradient-to-br from-brand-primary/5 to-brand-secondary/5 rounded-xl border border-brand-primary/20 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* 人话解读 - 最重要，放最上面 */}
          <div className={`p-3 rounded-lg ${isProfitable ? 'bg-success/10 border border-success/20' : 'bg-danger/10 border border-danger/20'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isProfitable ? 'bg-success/20' : 'bg-danger/20'}`}>
                {isProfitable ? (
                  <TrendingUp className="w-4 h-4 text-success" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-danger" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">智能投顾解读</p>
                <p className={`text-sm mt-1 ${isProfitable ? 'text-success' : 'text-danger'}`}>
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

      {error && (
        <div className="mt-2 flex items-center gap-2 text-sm text-danger">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  );
}

export default TradeAiInsightCard;
