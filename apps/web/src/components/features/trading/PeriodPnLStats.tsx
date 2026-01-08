'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { tradingApi } from '@/lib/api';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  ArrowUp,
  ArrowDown,
  Loader2,
  AlertCircle,
} from 'lucide-react';

type PeriodType = 'today' | 'week' | 'month' | 'custom';

interface PeriodStats {
  period: string;
  start_date: string;
  end_date: string;
  total_trades: number;
  win_trades: number;
  loss_trades: number;
  win_rate: string;
  total_pnl: string;
  total_profit: string;
  total_loss: string;
  best_trade: string;
  worst_trade: string;
  avg_pnl_per_trade: string;
  total_gas_fee: string;
}

interface PeriodPnLStatsProps {
  /** 是否显示完整统计卡片，默认 true */
  showFullCard?: boolean;
  /** 是否在头部显示标题，默认 true */
  showHeader?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * 按时间段盈亏统计组件
 * 支持今日/本周/本月/自定义时间段查询
 */
export function PeriodPnLStats({
  showFullCard = true,
  showHeader = true,
  className = '',
}: PeriodPnLStatsProps) {
  const [period, setPeriod] = useState<PeriodType>('today');
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 自定义日期（备用）
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const fetchStats = async (selectedPeriod: PeriodType, startDate?: string, endDate?: string) => {
    setLoading(true);
    setError(null);

    try {
      const params: {
        period: PeriodType;
        start_date?: string;
        end_date?: string;
      } = { period: selectedPeriod };

      if (selectedPeriod === 'custom' && startDate && endDate) {
        params.start_date = startDate;
        params.end_date = endDate;
      }

      const res = await tradingApi.getStatsByPeriod(params);
      if (res.code === 0 && res.data) {
        setStats(res.data);
      } else {
        setError(res.message || '获取统计数据失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats(period);
  }, [period]);

  const handlePeriodChange = (newPeriod: PeriodType) => {
    if (newPeriod === 'custom') {
      setShowCustomPicker(true);
    } else {
      setShowCustomPicker(false);
      setPeriod(newPeriod);
    }
  };

  const handleCustomDateConfirm = () => {
    if (customStartDate && customEndDate) {
      setPeriod('custom');
      fetchStats('custom', customStartDate, customEndDate);
      setShowCustomPicker(false);
    }
  };

  // 格式化盈亏数字
  const formatPnL = (value: string) => {
    const num = parseFloat(value);
    const formatted = Math.abs(num).toFixed(2);
    if (num >= 0) {
      return `+$${formatted}`;
    }
    return `-$${formatted}`;
  };

  // 格式化百分比
  const formatPercent = (value: string) => {
    const num = parseFloat(value) * 100;
    return `${num.toFixed(1)}%`;
  };

  const periodLabels: Record<PeriodType, string> = {
    today: '今日',
    week: '本周',
    month: '本月',
    custom: '自定义',
  };

  const content = (
    <>
      {/* 时间段选择器 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(['today', 'week', 'month', 'custom'] as PeriodType[]).map((p) => (
          <button
            key={p}
            onClick={() => handlePeriodChange(p)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              period === p
                ? 'bg-brand-primary text-white'
                : 'bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/80'
            }`}
          >
            {periodLabels[p]}
          </button>
        ))}

        {/* 自定义日期选择器 */}
        {showCustomPicker && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2 py-1 text-sm bg-bg-tertiary border border-border-primary rounded-lg text-text-primary"
            />
            <span className="text-text-tertiary">至</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2 py-1 text-sm bg-bg-tertiary border border-border-primary rounded-lg text-text-primary"
            />
            <Button size="sm" onClick={handleCustomDateConfirm}>
              确认
            </Button>
          </div>
        )}
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
        </div>
      )}

      {/* 错误状态 */}
      {error && !loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-text-secondary">
          <AlertCircle className="w-5 h-5 text-danger" />
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => fetchStats(period)}>
            重试
          </Button>
        </div>
      )}

      {/* 统计数据 */}
      {stats && !loading && !error && (
        <div className="space-y-4">
          {/* 主要盈亏指标 */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {/* 总盈亏 */}
            <div className="p-4 bg-bg-tertiary/50 rounded-xl">
              <div className="flex items-center gap-2 text-text-secondary text-sm mb-2">
                {parseFloat(stats.total_pnl) >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-success" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-danger" />
                )}
                总盈亏
              </div>
              <p
                className={`text-2xl font-bold ${
                  parseFloat(stats.total_pnl) >= 0 ? 'text-success' : 'text-danger'
                }`}
              >
                {formatPnL(stats.total_pnl)}
              </p>
            </div>

            {/* 胜率 */}
            <div className="p-4 bg-bg-tertiary/50 rounded-xl">
              <div className="flex items-center gap-2 text-text-secondary text-sm mb-2">
                <BarChart3 className="w-4 h-4 text-brand-primary" />
                胜率
              </div>
              <p className="text-2xl font-bold text-text-primary">
                {formatPercent(stats.win_rate)}
              </p>
              <p className="text-xs text-text-tertiary mt-1">
                {stats.win_trades}胜 / {stats.loss_trades}负
              </p>
            </div>

            {/* 交易次数 */}
            <div className="p-4 bg-bg-tertiary/50 rounded-xl">
              <div className="flex items-center gap-2 text-text-secondary text-sm mb-2">
                <Calendar className="w-4 h-4 text-warning" />
                交易次数
              </div>
              <p className="text-2xl font-bold text-text-primary">{stats.total_trades}</p>
              <p className="text-xs text-text-tertiary mt-1">
                {stats.start_date} ~ {stats.end_date}
              </p>
            </div>
          </div>

          {/* 详细统计 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 总盈利 */}
            <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
              <p className="text-xs text-success mb-1 flex items-center gap-1">
                <ArrowUp className="w-3 h-3" />
                总盈利
              </p>
              <p className="text-lg font-bold text-success">
                +${parseFloat(stats.total_profit).toFixed(2)}
              </p>
            </div>

            {/* 总亏损 */}
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg">
              <p className="text-xs text-danger mb-1 flex items-center gap-1">
                <ArrowDown className="w-3 h-3" />
                总亏损
              </p>
              <p className="text-lg font-bold text-danger">
                ${parseFloat(stats.total_loss).toFixed(2)}
              </p>
            </div>

            {/* 最佳交易 */}
            <div className="p-3 bg-bg-tertiary/50 rounded-lg">
              <p className="text-xs text-text-secondary mb-1">最佳交易</p>
              <p className="text-lg font-bold text-success">
                +${parseFloat(stats.best_trade).toFixed(2)}
              </p>
            </div>

            {/* 最差交易 */}
            <div className="p-3 bg-bg-tertiary/50 rounded-lg">
              <p className="text-xs text-text-secondary mb-1">最差交易</p>
              <p className="text-lg font-bold text-danger">
                ${parseFloat(stats.worst_trade).toFixed(2)}
              </p>
            </div>
          </div>

          {/* 底部统计 */}
          <div className="flex items-center justify-between text-sm text-text-tertiary pt-2 border-t border-border-primary/30">
            <span>
              平均每笔: <span className="text-text-secondary">${parseFloat(stats.avg_pnl_per_trade).toFixed(2)}</span>
            </span>
            <span>
              燃油费: <span className="text-text-secondary">${parseFloat(stats.total_gas_fee).toFixed(2)}</span>
            </span>
          </div>
        </div>
      )}
    </>
  );

  if (!showFullCard) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-brand-primary" />
            盈利统计
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={showHeader ? '' : 'pt-4'}>{content}</CardContent>
    </Card>
  );
}
