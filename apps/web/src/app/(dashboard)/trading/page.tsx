'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dialog, DialogFooter } from '@/components/ui';
import { tradingApi, instancesApi } from '@/lib/api';
import { TradingLog, PositionCard } from '@/components/features/trading';
import { TradingHeroCard } from '@/components/features/trading/TradingHeroCard';
import {
  TrendingUp,
  AlertTriangle,
  XCircle,
  ChevronRight,
  Clock,
} from 'lucide-react';
import type { Position } from '@/components/features/trading/PositionCard';

// Tab 类型
type TabType = 'positions' | 'history' | 'logs';

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

  // 紧急平仓对话框
  const [emergencyDialogOpen, setEmergencyDialogOpen] = useState(false);
  const [emergencyLoading, setEmergencyLoading] = useState(false);

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

      // 映射 API 数据到 HistoryTrade 类型（空数组时显示空状态）
      const mappedHistory: HistoryTrade[] = historyData.map((trade: any) => ({
        ...trade,
        entry_price: trade.entry_price || trade.price || '0',
        exit_price: trade.exit_price || trade.close_price || '0',
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

  // 紧急平仓全部
  const handleEmergencyExit = async () => {
    setEmergencyLoading(true);
    try {
      await tradingApi.forceExitAll();
      await fetchData();
      setEmergencyDialogOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : '紧急平仓失败');
    } finally {
      setEmergencyLoading(false);
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

      {/* Tab 切换栏 - 移动端无边框 */}
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
          active={activeTab === 'logs'}
          onClick={() => setActiveTab('logs')}
          label="日志"
          showDot={!!runningInstanceId}
        />
      </div>

      {/* Tab 内容区 - 纯黑背景 */}
      <div className="min-h-[200px]">
        {/* 持仓 Tab */}
        {activeTab === 'positions' && (
          <PositionsTab
            positions={positions}
            onEmergencyExit={() => setEmergencyDialogOpen(true)}
          />
        )}

        {/* 历史 Tab */}
        {activeTab === 'history' && (
          <HistoryTab
            trades={historyTrades}
            onViewAll={() => router.push('/trading/history')}
          />
        )}

        {/* 日志 Tab */}
        {activeTab === 'logs' && (
          <div className="p-4">
            <TradingLog
              instanceId={runningInstanceId}
              isConnected={!!runningInstanceId}
              maxHeight={400}
            />
          </div>
        )}
      </div>

      {/* 紧急平仓确认对话框 */}
      <Dialog
        open={emergencyDialogOpen}
        onClose={() => setEmergencyDialogOpen(false)}
        title="紧急控制"
        description="停止策略并平仓所有持仓"
      >
        <div className="space-y-4">
          {/* 运行中的策略信息 */}
          {runningInstanceId && (
            <div className="p-3 bg-bg-tertiary rounded-lg border border-border-primary">
              <div className="flex items-center justify-between mb-2">
                <p className="text-text-tertiary text-xs">运行中实例</p>
                <span className="px-2 py-0.5 text-xs bg-success/20 text-success rounded">
                  运行中
                </span>
              </div>
              <p className="text-text-primary font-medium">{runningStrategyName}</p>
            </div>
          )}

          {/* 持仓统计 */}
          <div className="p-3 bg-bg-tertiary rounded-lg border border-border-primary">
            <p className="text-text-tertiary text-xs mb-2">持仓中订单</p>
            <p className="text-text-primary font-medium text-lg">{positions.length} 个</p>
          </div>

          {/* 风险提示 */}
          <div className="flex items-start gap-3 p-4 bg-danger/10 border border-danger/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="text-text-primary font-medium mb-1">风险提示</p>
              <ul className="text-text-secondary space-y-1">
                <li>• 立即停止运行中的策略</li>
                <li>• 市价平仓所有 {positions.length} 个持仓</li>
                <li>• 可能存在滑点风险</li>
                <li>• 操作不可撤销</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setEmergencyDialogOpen(false)}
            disabled={emergencyLoading}
          >
            取消
          </Button>
          <Button
            variant="danger"
            onClick={handleEmergencyExit}
            isLoading={emergencyLoading}
          >
            <XCircle className="w-4 h-4 mr-2" />
            一键停止 & 平仓
          </Button>
        </DialogFooter>
      </Dialog>
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
  onEmergencyExit: () => void;
}

function PositionsTab({ positions, onEmergencyExit }: PositionsTabProps) {
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
      {/* 紧急平仓按钮 - 悬浮在右上角 */}
      <div className="flex justify-end px-4 py-3">
        <button
          onClick={onEmergencyExit}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-danger/10 text-danger text-sm rounded-full hover:bg-danger/20 transition-colors"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          紧急全部平仓
        </button>
      </div>

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
                  {isNaN(amount) ? '0.0000' : amount.toFixed(4)}
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
