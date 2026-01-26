'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { tradingApi, instancesApi, strategiesApi } from '@/lib/api';
import { PositionCard } from '@/components/features/trading';
import { TradingHeroCard } from '@/components/features/trading/TradingHeroCard';
import {
  TrendingUp,
  Clock,
  ChevronRight,
  Server,
  RefreshCw,
  Download,
  Trash2,
} from 'lucide-react';
import type { Position } from '@/components/features/trading/PositionCard';
import { Button } from '@/components/ui';

// Tab 类型 - 扁平化：交易日志和系统日志分开
type TabType = 'positions' | 'history' | 'tradingLogs' | 'vpsLogs';

interface HistoryTrade {
  id: string;
  pair: string;
  side: string;
  amount: string;
  entry_price: string;
  exit_price: string;
  leverage?: number;
  pnl: string;
  pnl_percentage?: string;
  fee: string;
  gas_fee?: string;
  executed_at: string;
  closed_at?: string;

  // 兼容旧字段
  price?: string;
}

/**
 * 交易页面 V2 - 移动端原生设计
 * 参考 Binance/OKX 移动端设计
 * - 极简顶部工具栏（无标题）
 * - 单一大卡片（账户总览）
 * - 统一图标 Tab（持仓/历史/日志）
 * - 持仓卡片支持展开 + AI 解读
 */
export default function TradingPage() {
  const router = useRouter();

  // Tab 状态
  const [activeTab, setActiveTab] = useState<TabType>('positions');

  // 数据状态
  const [positions, setPositions] = useState<Position[]>([]);
  const [historyTrades, setHistoryTrades] = useState<HistoryTrade[]>([]);
  const [runningInstanceId, setRunningInstanceId] = useState<string | null>(null);
  const [runningStrategyName, setRunningStrategyName] = useState<string>('');
  const [loading, setLoading] = useState(true);


  // 获取数据
  const fetchData = async () => {
    try {
      const [instancesRes, positionsRes, historyRes] = await Promise.all([
        instancesApi.list().catch(() => ({ data: [] })),
        tradingApi.getPositions().catch(() => ({ code: 0, data: [] })),
        tradingApi.getTrades({ limit: 10 }).catch(() => ({ code: 0, data: { trades: [] } })),
      ]);

      // 获取第一个运行中的实例 ID 和策略名称
      const allInstances = Array.isArray(instancesRes.data) ? instancesRes.data : [];
      const runningInstances = allInstances.filter((i: any) =>
        i.status === 'running' || i.status === 'active'
      );

      // 设置运行中的实例（如果有）
      if (runningInstances.length > 0) {
        const instance = runningInstances[0] as any;
        setRunningInstanceId(instance?.id || null);
        setRunningStrategyName(instance?.strategy_name || instance?.name || '未命名策略');
      } else {
        setRunningInstanceId(null);
        setRunningStrategyName('');
      }

      // 设置持仓数据（映射字段）
      const positionsData = Array.isArray(positionsRes.data) ? positionsRes.data : [];
      const mappedPositions: Position[] = positionsData.map((pos: any) => ({
        trade_id: pos.trade_id || pos.id,
        pair: pos.pair || pos.symbol,
        is_open: true,
        open_rate: pos.open_rate || parseFloat(pos.entry_price) || 0,
        close_rate: null,
        amount: pos.amount || parseFloat(pos.size) || 0,
        stake_amount: pos.stake_amount || 0,
        close_profit: null,
        close_profit_abs: pos.unrealized_pnl ? parseFloat(pos.unrealized_pnl) : 0,
        open_date: pos.open_date || new Date().toISOString(),
        close_date: null,
        current_rate: pos.current_rate || parseFloat(pos.current_price) || pos.open_rate || 0,
        leverage: pos.leverage || 1,
        stoploss: pos.stoploss,
        stop_loss_pct: pos.stop_loss_pct,
        take_profit_pct: pos.take_profit_pct,
        min_rate: pos.min_rate,
        max_rate: pos.max_rate,
      }));

      // 设置真实持仓数据（空数组时显示空状态）
      setPositions(mappedPositions);

      // 设置历史交易数据
      const historyData = historyRes.data?.trades || [];

      // 映射 API 数据到 HistoryTrade 类型
      // 注意：后端返回的字段名与前端期望的不同
      // 后端: symbol, quantity, opened_at, entry_price, exit_price
      // 前端: pair, amount, executed_at, entry_price, exit_price
      const mappedHistory: HistoryTrade[] = historyData.map((trade: any) => ({
        id: trade.id,
        pair: trade.pair || trade.symbol || 'UNKNOWN',
        side: trade.side || 'buy',
        amount: trade.amount || trade.quantity || '0',
        entry_price: trade.entry_price || trade.open_rate || trade.price || '0',
        exit_price: trade.exit_price || trade.close_rate || trade.close_price || '0',
        leverage: trade.leverage || 1,
        pnl: trade.pnl || trade.profit_abs || '0',
        pnl_percentage: trade.pnl_percentage || trade.profit_pct || null,
        fee: trade.fee || trade.gas_fee || '0',
        gas_fee: trade.gas_fee || null,
        executed_at: trade.executed_at || trade.opened_at || trade.open_date || '',
        closed_at: trade.closed_at || trade.close_date || null,
      }));
      setHistoryTrades(mappedHistory);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // 平仓操作
  const handleClosePosition = async (tradeId: number) => {
    try {
      await tradingApi.forceExit(tradeId.toString());
      await fetchData();
    } catch (error) {
      throw error;
    }
  };


  // 加载状态
  if (loading) {
    return (
      <div className="space-y-4 pb-20">
        {/* 骨架屏 */}
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-bg-tertiary rounded-xl" />
          <div className="h-64 bg-bg-tertiary rounded-xl" />
          <div className="h-48 bg-bg-tertiary rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary pb-24">
      {/* 账户总览区域 - 纯黑背景 */}
      <TradingHeroCard />

      {/* Tab 切换栏 - 4 Tab 扁平化设计 */}
      <div className="flex items-center justify-around lg:border-b lg:border-border-primary/30">
        <TabButton
          active={activeTab === 'positions'}
          onClick={() => setActiveTab('positions')}
          label="持仓"
          badge={positions.length > 0 ? positions.length : undefined}
        />
        <TabButton
          active={activeTab === 'history'}
          onClick={() => setActiveTab('history')}
          label="历史"
        />
        <TabButton
          active={activeTab === 'tradingLogs'}
          onClick={() => setActiveTab('tradingLogs')}
          label="交易日志"
          showDot={!!runningInstanceId}
        />
        <TabButton
          active={activeTab === 'vpsLogs'}
          onClick={() => setActiveTab('vpsLogs')}
          label="系统日志"
        />
      </div>

      {/* Tab 内容区 - 纯黑背景 */}
      <div className="min-h-[200px]">
        {/* 持仓 Tab */}
        {activeTab === 'positions' && (
          <PositionsTab positions={positions} />
        )}

        {/* 历史 Tab */}
        {activeTab === 'history' && (
          <HistoryTab
            trades={historyTrades}
            onViewAll={() => router.push('/trading/history')}
          />
        )}

        {/* 交易日志 Tab */}
        {activeTab === 'tradingLogs' && (
          <TradingLogsTab instanceId={runningInstanceId} />
        )}

        {/* 系统日志 Tab */}
        {activeTab === 'vpsLogs' && (
          <VpsLogsTab instanceId={runningInstanceId} />
        )}
      </div>

    </div>
  );
}

// Tab 按钮组件（纯文字设计）
interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
  showDot?: boolean;
}

function TabButton({ active, onClick, label, badge, showDot }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-3 relative transition-colors ${
        active ? 'text-brand-primary' : 'text-text-tertiary'
      }`}
    >
      <div className="relative flex items-center gap-2">
        {/* 文字标题 */}
        <span className="text-sm font-medium">{label}</span>

        {/* Badge 数字 */}
        {badge !== undefined && badge > 0 && (
          <span className="px-1.5 py-0.5 text-xs rounded-full bg-brand-primary text-white font-medium">
            {badge}
          </span>
        )}

        {/* WebSocket 连接状态点 */}
        {showDot && (
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
        )}
      </div>

      {/* 底部激活指示器 - 仅桌面端显示 */}
      {active && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary hidden lg:block" />
      )}
    </button>
  );
}

// 持仓 Tab 组件
interface PositionsTabProps {
  positions: Position[];
}

function PositionsTab({ positions }: PositionsTabProps) {
  if (positions.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <div className="w-16 h-16 mx-auto mb-4 bg-bg-tertiary rounded-full flex items-center justify-center">
          <TrendingUp className="w-8 h-8 text-text-tertiary" />
        </div>
        <p className="text-text-secondary font-medium mb-2">暂无持仓</p>
        <button
          onClick={() => window.location.href = '/strategies'}
          className="text-brand-primary text-sm hover:underline"
        >
          启动策略 →
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* 持仓列表 - 斑马纹背景 */}
      <div>
        {positions.map((position, index) => (
          <PositionCard
            key={position.trade_id}
            position={position}
            zebra={index % 2 === 1}
          />
        ))}
      </div>
    </div>
  );
}

// 历史 Tab 组件
interface HistoryTabProps {
  trades: HistoryTrade[];
  onViewAll: () => void;
}

function HistoryTab({ trades, onViewAll }: HistoryTabProps) {
  if (trades.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <div className="w-16 h-16 mx-auto mb-4 bg-bg-tertiary rounded-full flex items-center justify-center">
          <Clock className="w-8 h-8 text-text-tertiary" />
        </div>
        <p className="text-text-secondary font-medium mb-2">暂无历史记录</p>
        <button
          onClick={() => window.location.href = '/strategies'}
          className="text-brand-primary text-sm hover:underline"
        >
          查看策略市场 →
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* 历史记录列表 - 纯黑背景 */}
      <div>
      {trades.map((trade, index) => {
        const pnl = parseFloat(trade.pnl || '0');
        const isProfit = pnl >= 0;
        const amount = parseFloat(trade.amount || '0');
        const entryPrice = parseFloat(trade.entry_price || trade.price || '0');
        const exitPrice = parseFloat(trade.exit_price || '0');
        const pnlPercentage = trade.pnl_percentage ? parseFloat(trade.pnl_percentage) : null;
        const fee = parseFloat(trade.fee || '0');
        const gasFee = trade.gas_fee ? parseFloat(trade.gas_fee) : 0;
        const leverage = trade.leverage || 1;

        // 安全的日期格式化
        const formatDateTime = (dateString: string) => {
          try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
              return '时间未知';
            }
            return date.toLocaleString('zh-CN', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            });
          } catch {
            return '时间未知';
          }
        };

        const isZebra = index % 2 === 1;

        return (
          <div
            key={trade.id}
            className={`px-4 py-4 space-y-3 ${isZebra ? 'bg-bg-secondary' : ''}`}
          >
            {/* Row 1: 交易对 + 方向标签 + 杠杆 + 盈亏(金额+百分比) */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-base">{trade.pair}</span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    trade.side.toLowerCase() === 'buy'
                      ? 'bg-success/20 text-success'
                      : 'bg-danger/20 text-danger'
                  }`}
                >
                  {trade.side.toLowerCase() === 'buy' ? '多' : '空'}
                </span>
                {leverage > 1 && (
                  <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-warning/20 text-warning">
                    {leverage}x
                  </span>
                )}
              </div>
              <div className="text-right">
                <p className={`font-bold text-lg ${isProfit ? 'text-success' : 'text-danger'}`}>
                  {isProfit ? '+' : ''}${Math.abs(pnl).toFixed(2)}
                </p>
                {pnlPercentage !== null && (
                  <p className={`text-xs ${isProfit ? 'text-success' : 'text-danger'}`}>
                    {isProfit ? '+' : ''}{pnlPercentage.toFixed(2)}%
                  </p>
                )}
              </div>
            </div>

            {/* Row 2: 开仓价 → 平仓价 */}
            <div className="flex items-center justify-between bg-bg-secondary lg:bg-bg-tertiary/30 rounded-lg p-2.5">
              <div className="flex-1">
                <p className="text-text-tertiary text-xs mb-0.5">开仓价</p>
                <p className="text-text-primary font-mono text-sm">
                  ${isNaN(entryPrice) ? '0.00' : entryPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="px-3 text-text-tertiary">
                →
              </div>
              <div className="flex-1 text-right">
                <p className="text-text-tertiary text-xs mb-0.5">平仓价</p>
                <p className={`font-mono text-sm ${isProfit ? 'text-success' : 'text-danger'}`}>
                  ${isNaN(exitPrice) ? '0.00' : exitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Row 3: 数量 + 手续费 + 燃油费 */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-text-tertiary mb-0.5">数量</p>
                <p className="text-text-primary font-mono">
                  {isNaN(amount) || amount === 0 ? '0' : amount < 0.0001 ? amount.toExponential(2) : amount.toFixed(8).replace(/\.?0+$/, '')}
                </p>
              </div>
              <div>
                <p className="text-text-tertiary mb-0.5">手续费</p>
                <p className="text-text-primary font-mono">
                  ${isNaN(fee) ? '0.00' : fee.toFixed(2)}
                </p>
              </div>
              {gasFee > 0 && (
                <div>
                  <p className="text-text-tertiary mb-0.5">燃油费</p>
                  <p className="text-warning font-mono">
                    ${gasFee.toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            {/* Row 4: 开仓时间 + 平仓时间 */}
            <div className="flex items-center justify-between text-xs text-text-tertiary pt-1">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>开仓: {formatDateTime(trade.executed_at)}</span>
              </div>
              {trade.closed_at && (
                <span>平仓: {formatDateTime(trade.closed_at)}</span>
              )}
            </div>
          </div>
        );
      })}
      </div>

      {/* 查看全部按钮 */}
      <div className="px-4 py-4">
        <button
          onClick={onViewAll}
          className="w-full flex items-center justify-center gap-2 py-3 text-text-secondary hover:text-text-primary text-sm transition-colors"
        >
          查看全部历史
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// 交易日志 Tab 组件
interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

interface TradingLogsTabProps {
  instanceId: string | null;
}

function TradingLogsTab({ instanceId }: TradingLogsTabProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!instanceId) return;
    setLoading(true);
    try {
      const res = await strategiesApi.getTradingLogs(100);
      if (res.code === 0 && res.data) {
        const rawLogs = res.data.logs || [];
        // 兼容两种格式：对象数组和字符串数组
        const parsedLogs: LogEntry[] = rawLogs.map((log: { id?: string; timestamp?: string; level?: string; message?: string } | string, index: number) => {
          if (typeof log === 'object' && log !== null) {
            // 对象格式（新版 API）
            return {
              id: log.id || `log-${Date.now()}-${index}`,
              timestamp: log.timestamp || new Date().toISOString(),
              level: ((log.level || 'info').toLowerCase() as LogEntry['level']),
              message: log.message || '',
            };
          } else {
            // 字符串格式（兼容旧版）
            const logStr = String(log);
            const match = logStr.match(/\[(.*?)\]\s*(\w+)\s*-?\s*(.*)/);
            return {
              id: `log-${Date.now()}-${index}`,
              timestamp: match?.[1] || new Date().toISOString(),
              level: (match?.[2]?.toLowerCase() as LogEntry['level']) || 'info',
              message: match?.[3] || logStr,
            };
          }
        });
        setLogs(parsedLogs);
        setNotice(res.data.notice || null);
      }
    } catch (error) {
      console.error('获取交易日志失败:', error);
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const handleClear = () => setLogs([]);

  const handleDownload = () => {
    const content = logs
      .map((log) => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`)
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading-log-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLevelStyle = (level: string) => {
    switch (level) {
      case 'error': return 'text-danger-400';
      case 'warn': return 'text-warning';
      case 'debug': return 'text-text-tertiary';
      default: return 'text-text-primary';
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error': return 'bg-danger-500/20 text-danger-400';
      case 'warn': return 'bg-warning/20 text-warning';
      case 'debug': return 'bg-bg-tertiary text-text-tertiary';
      default: return 'bg-primary-500/20 text-primary-400';
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString('zh-CN');
    } catch {
      return timestamp;
    }
  };

  if (!instanceId) {
    return (
      <div className="text-center py-16 px-4">
        <div className="w-16 h-16 mx-auto mb-4 bg-bg-tertiary rounded-full flex items-center justify-center">
          <TrendingUp className="w-8 h-8 text-text-tertiary" />
        </div>
        <p className="text-text-secondary font-medium mb-2">暂无运行中的实例</p>
        <button
          onClick={() => window.location.href = '/strategies'}
          className="text-brand-primary text-sm hover:underline"
        >
          启动策略 →
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-text-tertiary text-sm">
          {logs.length} 条日志
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClear}>
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 提示信息 */}
      {notice && (
        <div className="mb-3 px-3 py-2 bg-warning/10 border border-warning/30 rounded-lg text-warning text-sm">
          {notice}
        </div>
      )}

      {/* 日志列表 */}
      <div className="h-[400px] overflow-y-auto font-mono text-sm space-y-1">
        {logs.length === 0 ? (
          <div className="text-center py-8 text-text-tertiary">
            {loading ? '加载中...' : '暂无日志'}
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2">
              <span className="text-text-disabled flex-shrink-0">
                [{formatTime(log.timestamp)}]
              </span>
              <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${getLevelBadge(log.level)}`}>
                {log.level.toUpperCase()}
              </span>
              <span className={getLevelStyle(log.level)}>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// 系统日志 Tab 组件
interface VpsLogsTabProps {
  instanceId: string | null;
}

function VpsLogsTab({ instanceId }: VpsLogsTabProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!instanceId) return;
    setLoading(true);
    try {
      const res = await strategiesApi.getVpsLogs(100);
      if (res.code === 0 && res.data?.logs) {
        const parsedLogs: LogEntry[] = res.data.logs.map((log: any, index: number) => ({
          id: `vps-${Date.now()}-${index}`,
          timestamp: log.timestamp || new Date().toISOString(),
          level: (log.level as LogEntry['level']) || 'info',
          message: log.message || '',
        }));
        setLogs(parsedLogs);
      }
    } catch (error) {
      console.error('获取系统日志失败:', error);
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const handleClear = () => setLogs([]);

  const handleDownload = () => {
    const content = logs
      .map((log) => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`)
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vps-log-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLevelStyle = (level: string) => {
    switch (level) {
      case 'error': return 'text-danger-400';
      case 'warn': return 'text-warning';
      case 'debug': return 'text-text-tertiary';
      default: return 'text-text-primary';
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error': return 'bg-danger-500/20 text-danger-400';
      case 'warn': return 'bg-warning/20 text-warning';
      case 'debug': return 'bg-bg-tertiary text-text-tertiary';
      default: return 'bg-primary-500/20 text-primary-400';
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString('zh-CN');
    } catch {
      return timestamp;
    }
  };

  if (!instanceId) {
    return (
      <div className="text-center py-16 px-4">
        <div className="w-16 h-16 mx-auto mb-4 bg-bg-tertiary rounded-full flex items-center justify-center">
          <Server className="w-8 h-8 text-text-tertiary" />
        </div>
        <p className="text-text-secondary font-medium mb-2">暂无运行中的实例</p>
        <button
          onClick={() => window.location.href = '/instances'}
          className="text-brand-primary text-sm hover:underline"
        >
          查看实例 →
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-text-tertiary text-sm">
          {logs.length} 条日志
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClear}>
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 日志列表 */}
      <div className="h-[400px] overflow-y-auto font-mono text-sm space-y-1">
        {logs.length === 0 ? (
          <div className="text-center py-8 text-text-tertiary">
            {loading ? '加载中...' : '暂无日志'}
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2">
              <span className="text-text-disabled flex-shrink-0">
                [{formatTime(log.timestamp)}]
              </span>
              <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${getLevelBadge(log.level)}`}>
                {log.level.toUpperCase()}
              </span>
              <span className={getLevelStyle(log.level)}>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
