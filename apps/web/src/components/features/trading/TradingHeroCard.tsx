'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { billingApi, tradingApi, instancesApi } from '@/lib/api';
import { MiniPnLChart } from '@/components/charts/PnLChart';
import type { DateRange } from 'react-day-picker';
import {
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  AlertCircle,
  RefreshCw,
  Play,
  Square,
  Settings,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { StrategyQuickControlSheet } from './StrategyQuickControlSheet';

interface TodayPnLData {
  todayPnl: string;
  todayProfit: string;
  todayLoss: string;
  todayTrades: number;
  todayWinRate: string;
  todayGasFee: string;
}

interface MonthlyPnLData {
  monthlyPnl: string;
  monthlyTrades: number;
  monthlyWinRate: string;
}

interface CurveData {
  curve: Array<{ date: string; pnl: string; cumulativePnl: string }>;
  totalPnl: string;
}

interface BotInstance {
  id: string;
  status: 'running' | 'stopped';
  strategyName: string;
  startedAt: string;
  positionCount: number;
}

interface TradingHeroCardProps {
  /** 自定义类名 */
  className?: string;
  /** 曲线数据天数 */
  chartDays?: number;
}

/**
 * 交易账户总览卡片（All-in-One Card）
 * 参考 Binance/OKX 移动端设计
 * - 三栏布局：累计盈亏 | 今日盈亏 | 当月盈亏
 * - 内嵌 7 天收益曲线
 * - 统计数据一行显示
 * - 快捷操作按钮
 */
export function TradingHeroCard({
  className = '',
  chartDays = 7,
}: TradingHeroCardProps) {
  const router = useRouter();
  const [todayData, setTodayData] = useState<TodayPnLData | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyPnLData | null>(null);
  const [curveData, setCurveData] = useState<CurveData | null>(null);
  const [botInstance, setBotInstance] = useState<BotInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 新增状态：账户类型和日期筛选
  const [accountType, setAccountType] = useState<'spot' | 'futures'>('spot');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'custom'>('7d');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();

  // 计算实际查询天数
  const getDays = () => {
    if (dateRange === 'custom') {
      if (!customDateRange?.from || !customDateRange?.to) {
        // 如果选择了自定义但未选择完整日期范围,默认使用7天
        return 7;
      }
      const days = Math.ceil(
        (customDateRange.to.getTime() - customDateRange.from.getTime()) / (1000 * 60 * 60 * 24)
      );
      // 确保天数为正数且合理
      return Math.max(1, Math.min(days, 365));
    }
    return parseInt(dateRange); // 7, 30, 90
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const days = getDays();
      const [todayRes, monthlyRes, curveRes, instanceRes] = await Promise.all([
        billingApi.getTodayPnL(),
        billingApi.getMonthlyPnL().catch(() => ({ code: 0, data: { monthlyPnl: '0', monthlyTrades: 0, monthlyWinRate: '0' } })),
        billingApi.getPnLCurve(days),
        instancesApi.list().catch(() => ({ data: [] })),
      ]);

      if (todayRes.code === 0) {
        setTodayData(todayRes.data);
      }

      if (monthlyRes.code === 0) {
        setMonthlyData(monthlyRes.data);
      }

      if (curveRes.code === 0) {
        setCurveData(curveRes.data);
      }

      // 获取第一个运行中的实例
      const allInstances = Array.isArray(instanceRes.data) ? instanceRes.data : [];
      const runningInstances = allInstances.filter((i: any) =>
        i.status === 'running' || i.status === 'active'
      );
      if (runningInstances.length > 0) {
        const instance = runningInstances[0];
        setBotInstance({
          id: instance.id,
          status: 'running',
          strategyName: (instance as any).strategy_name || '量化策略',
          startedAt: (instance as any).created_at || new Date().toISOString(),
          positionCount: 0,
        });
      } else {
        setBotInstance(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 如果选择了自定义日期但还没选择完整日期范围,不触发请求
    if (dateRange === 'custom' && (!customDateRange?.from || !customDateRange?.to)) {
      return;
    }
    fetchData();
  }, [accountType, dateRange, customDateRange]);

  // 累计盈亏
  const totalPnL = parseFloat(curveData?.totalPnl || '0');
  const totalProfitable = totalPnL >= 0;

  // 今日盈亏
  const todayPnL = parseFloat(todayData?.todayPnl || '0');
  const todayProfitable = todayPnL >= 0;

  // 计算百分比变化
  const getChangePercent = () => {
    if (!curveData?.curve || curveData.curve.length < 2) return 0;
    const latest = parseFloat(curveData.curve[curveData.curve.length - 1]?.cumulativePnl || '0');
    const previous = parseFloat(curveData.curve[curveData.curve.length - 2]?.cumulativePnl || '0');
    if (previous === 0) return 0;
    return ((latest - previous) / Math.abs(previous)) * 100;
  };

  // 提取曲线数据
  const chartValues = curveData?.curve?.map((d) => parseFloat(d.cumulativePnl) || 0) || [];

  // 格式化货币
  const formatCurrency = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1000000) {
      return `${(value / 1000000).toFixed(2)}M`;
    }
    if (abs >= 1000) {
      return `${(value / 1000).toFixed(2)}K`;
    }
    return value.toFixed(2);
  };

  // 计算运行时长
  const getRunningTime = () => {
    if (!botInstance?.startedAt) return '--';
    const start = new Date(botInstance.startedAt).getTime();
    const now = Date.now();
    const diff = now - start;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return `${hours}h`;
  };

  // 停止机器人
  const handleStopBot = async () => {
    if (!botInstance) return;
    alert('停止功能即将上线，敬请期待');
    // TODO: 实现停止功能
    // try {
    //   await instancesApi.stop(botInstance.id);
    //   await fetchData();
    // } catch (err) {
    //   alert('停止失败：' + (err instanceof Error ? err.message : '未知错误'));
    // }
  };

  // 策略配置
  const handleStrategyConfig = () => {
    if (botInstance) {
      router.push(`/strategies/${botInstance.id}/config`);
    } else {
      router.push('/strategies');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center gap-3 py-8">
          <AlertCircle className="w-8 h-8 text-danger" />
          <p className="text-text-secondary text-sm">{error}</p>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 text-brand-primary text-sm hover:underline"
          >
            <RefreshCw className="w-4 h-4" />
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 卡片头部：账户类型 + 日期筛选 */}
      <div className="px-4 pt-4 pb-3 border-b border-border-primary/50">
        <div className="flex items-center justify-between gap-3">
          {/* 左侧：账户类型 Tab */}
          <div className="flex items-center gap-1 bg-bg-primary/50 rounded-lg p-1">
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                accountType === 'spot'
                  ? 'bg-brand-primary text-white'
                  : 'text-text-tertiary hover:text-text-primary'
              }`}
              onClick={() => setAccountType('spot')}
            >
              现货
            </button>
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                accountType === 'futures'
                  ? 'bg-brand-primary text-white'
                  : 'text-text-tertiary hover:text-text-primary'
              }`}
              onClick={() => setAccountType('futures')}
            >
              合约
            </button>
          </div>

          {/* 右侧：日期筛选 */}
          <div className="flex items-center gap-2">
            <select
              className="bg-bg-tertiary hover:bg-bg-tertiary/70 rounded-lg px-3 py-2 text-xs text-text-primary border border-border-primary hover:border-brand-primary focus:border-brand-primary outline-none transition-colors"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
            >
              <option value="7d">7天</option>
              <option value="30d">30天</option>
              <option value="90d">90天</option>
              <option value="custom">自定义</option>
            </select>

            {/* 自定义日期范围选择器 */}
            {dateRange === 'custom' && (
              <DateRangePicker
                value={customDateRange}
                onChange={setCustomDateRange}
                placeholder="选择范围"
              />
            )}
          </div>
        </div>
      </div>

      {/* 卡片主体 */}
      <div className="p-6">

        {/* 三栏布局 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* 累计盈亏 */}
          <div className="text-center">
            <p className="text-text-tertiary text-xs mb-2">累计盈亏</p>
            <p
              className={`text-2xl font-bold tracking-tight ${
                totalProfitable ? 'text-success' : 'text-danger'
              }`}
            >
              {totalProfitable ? '+' : ''}${formatCurrency(Math.abs(totalPnL))}
            </p>
            {curveData?.curve && curveData.curve.length >= 2 && (
              <p className="text-text-tertiary text-xs mt-1">
                {Math.abs(getChangePercent()).toFixed(1)}% 变化
              </p>
            )}
          </div>

          {/* 今日盈亏 */}
          <div className="text-center">
            <p className="text-text-tertiary text-xs mb-2">今日盈亏</p>
            <p
              className={`text-2xl font-bold tracking-tight ${
                todayProfitable ? 'text-success' : 'text-danger'
              }`}
            >
              {todayProfitable ? '+' : ''}${formatCurrency(todayPnL)}
            </p>
            <p className="text-text-tertiary text-xs mt-1">
              {todayData ? `${(parseFloat(todayData.todayWinRate) * 100).toFixed(0)}% 胜率` : '--'}
            </p>
          </div>

          {/* 当月盈亏 */}
          <div className="text-center">
            <p className="text-text-tertiary text-xs mb-2">当月盈亏</p>
            <p
              className={`text-2xl font-bold tracking-tight ${
                parseFloat(monthlyData?.monthlyPnl || '0') >= 0 ? 'text-success' : 'text-danger'
              }`}
            >
              {parseFloat(monthlyData?.monthlyPnl || '0') >= 0 ? '+' : ''}${formatCurrency(parseFloat(monthlyData?.monthlyPnl || '0'))}
            </p>
            <p className="text-text-tertiary text-xs mt-1">
              {monthlyData ? `${monthlyData.monthlyTrades}笔` : '--'}
            </p>
          </div>
        </div>

        {/* 迷你曲线 */}
        <div className="mb-4">
          {chartValues.length > 0 ? (
            <MiniPnLChart data={chartValues} positive={totalProfitable} height={60} />
          ) : (
            <div className="h-[60px] flex items-center justify-center border border-dashed border-border-primary rounded">
              <p className="text-text-tertiary text-xs">暂无曲线数据</p>
            </div>
          )}
        </div>

        {/* 统计数据一行 */}
        {todayData && (
          <p className="text-text-tertiary text-xs text-center mb-4">
            交易 {todayData.todayTrades}笔 · 胜率{' '}
            {(parseFloat(todayData.todayWinRate) * 100).toFixed(0)}% · 燃油费 $
            {parseFloat(todayData.todayGasFee).toFixed(2)}
          </p>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-3">
          {botInstance?.status === 'running' ? (
            <Button
              variant="danger"
              size="sm"
              className="flex-1"
              onClick={handleStopBot}
            >
              <Square className="w-4 h-4 mr-2" />
              停止机器人
            </Button>
          ) : (
            <StrategyQuickControlSheet />
          )}
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleStrategyConfig}
          >
            <Settings className="w-4 h-4 mr-2" />
            策略配置
          </Button>
        </div>
      </div>
    </>
  );
}
