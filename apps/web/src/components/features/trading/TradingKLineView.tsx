'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { KLineChart, KLineDataPoint, TradeMarker } from '@/components/charts';
import { Button } from '@/components/ui/button';
import { RefreshCw, Maximize2, X, Info } from 'lucide-react';
import type { UTCTimestamp } from 'lightweight-charts';
import { klineApi } from '@/lib/api';
import { TradeSignalCard, type TradeSignal } from './TradeSignalCard';

// 交易记录类型（扩展支持 Freqtrade 信号详情）
export interface TradeRecord {
  id: string;
  pair: string;
  side: 'buy' | 'sell';
  open_time: number;      // Unix timestamp
  close_time?: number;    // Unix timestamp
  open_rate: number;
  close_rate?: number;
  current_rate?: number;  // 当前价格（持仓中）
  amount: number;
  stake_amount?: number;  // 投入金额
  profit?: number;
  profit_percent?: number;
  is_open?: boolean;
  // Freqtrade 信号详情
  buy_tag?: string;       // 买入触发条件标签
  sell_reason?: string;   // 卖出原因
  strategy?: string;      // 策略名称
  timeframe?: string;     // K线周期
  leverage?: number;      // 杠杆倍数
  stop_loss?: number;     // 止损价格
  stop_loss_pct?: number; // 止损百分比
}

// 组件属性
interface TradingKLineViewProps {
  symbol: string;
  trades?: TradeRecord[];
  /** 图表高度，默认响应式：移动端 280px，平板 350px，桌面 400px */
  height?: number;
  showControls?: boolean;
  onTradeClick?: (trade: TradeRecord) => void;
  className?: string;
}

// 模拟 K 线数据生成（实际应从 API 获取）
function generateMockKlineData(days: number = 30): KLineDataPoint[] {
  const data: KLineDataPoint[] = [];
  const now = Math.floor(Date.now() / 1000);
  const hourInSeconds = 3600;
  let price = 42000 + Math.random() * 2000; // BTC 基准价

  for (let i = days * 24; i >= 0; i--) {
    const time = (now - i * hourInSeconds) as UTCTimestamp;
    const volatility = 0.002 + Math.random() * 0.008; // 0.2% - 1% 波动
    const direction = Math.random() > 0.48 ? 1 : -1; // 略微偏多

    const open = price;
    const change = price * volatility * direction;
    const close = price + change;
    const high = Math.max(open, close) * (1 + Math.random() * 0.003);
    const low = Math.min(open, close) * (1 - Math.random() * 0.003);
    const volume = 100 + Math.random() * 500;

    data.push({
      time,
      open,
      high,
      low,
      close,
      volume,
    });

    price = close;
  }

  return data;
}

export function TradingKLineView({
  symbol,
  trades = [],
  height: propHeight,
  showControls = true,
  onTradeClick,
  className = '',
}: TradingKLineViewProps) {
  const [klineData, setKlineData] = useState<KLineDataPoint[]>([]);
  const [timeframe, setTimeframe] = useState('1h');
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<TradeRecord | null>(null);

  // 响应式高度：移动端 280px，平板 350px，桌面 400px
  const [responsiveHeight, setResponsiveHeight] = useState(propHeight || 400);

  useEffect(() => {
    if (propHeight) {
      setResponsiveHeight(propHeight);
      return;
    }

    const updateHeight = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setResponsiveHeight(280); // 移动端
      } else if (width < 1024) {
        setResponsiveHeight(350); // 平板
      } else {
        setResponsiveHeight(400); // 桌面
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [propHeight]);

  // 使用 responsiveHeight 代替固定 height
  const height = responsiveHeight;

  // 获取 K 线数据
  const fetchKlineData = useCallback(async () => {
    setLoading(true);
    try {
      // 尝试从 API 获取真实数据
      const res = await klineApi.get(symbol, timeframe, 500);

      // 转换 API 数据为图表格式
      const apiData: KLineDataPoint[] = res.data.map((item) => ({
        time: item.time as UTCTimestamp,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
      }));

      setKlineData(apiData);
    } catch (error) {
      console.warn('API 数据获取失败，使用模拟数据:', error);

      // 降级：使用模拟数据
      await new Promise(resolve => setTimeout(resolve, 300));
      setKlineData(generateMockKlineData(30));
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    fetchKlineData();
  }, [fetchKlineData]);

  // 将交易记录转换为图表标记
  const markers: TradeMarker[] = trades.flatMap(trade => {
    const result: TradeMarker[] = [];

    // 买入点 - 绿色向上箭头
    if (trade.open_time) {
      result.push({
        time: trade.open_time as UTCTimestamp,
        position: 'belowBar',
        color: '#00C087',
        shape: 'arrowUp',
        text: 'B',
        size: 1.5,
      });
    }

    // 卖出点 - 红色向下箭头
    if (trade.close_time && !trade.is_open) {
      result.push({
        time: trade.close_time as UTCTimestamp,
        position: 'aboveBar',
        color: '#F23645',
        shape: 'arrowDown',
        text: 'S',
        size: 1.5,
      });
    }

    return result;
  });

  // 处理时间框架变更
  const handleTimeframeChange = (tf: string) => {
    setTimeframe(tf);
  };

  // 切换全屏
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // 将 TradeRecord 转换为 TradeSignal（用于 TradeSignalCard）
  const convertToTradeSignal = (trade: TradeRecord): TradeSignal => ({
    id: trade.id,
    pair: trade.pair,
    side: trade.side,
    open_rate: trade.open_rate,
    close_rate: trade.close_rate,
    current_rate: trade.current_rate,
    amount: trade.amount,
    stake_amount: trade.stake_amount,
    profit: trade.profit,
    profit_percent: trade.profit_percent,
    open_time: trade.open_time,
    close_time: trade.close_time,
    buy_tag: trade.buy_tag,
    sell_reason: trade.sell_reason,
    strategy: trade.strategy,
    timeframe: trade.timeframe,
    leverage: trade.leverage,
    stop_loss: trade.stop_loss,
    stop_loss_pct: trade.stop_loss_pct,
    is_open: trade.is_open,
  });

  // 全屏模式
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-bg-primary">
        <div className="h-full flex flex-col">
          {/* 头部 */}
          <div className="flex items-center justify-between p-4 border-b border-border-primary">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-text-primary">{symbol} K线图</h2>
              {trades.length > 0 && (
                <span className="text-sm text-text-secondary">
                  {Math.ceil(markers.length / 2)} 笔交易
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={fetchKlineData} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* 图表 */}
          <div className="flex-1 p-4 relative">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <KLineChart
                data={klineData}
                markers={markers}
                height={window.innerHeight - 120}
                timeframe={timeframe as '1m' | '5m' | '15m' | '1h' | '4h' | '1d'}
                showVolume={true}
                onTimeframeChange={handleTimeframeChange}
              />
            )}
            {/* 交易信号详情卡片 */}
            {selectedTrade && (
              <TradeSignalCard
                trade={convertToTradeSignal(selectedTrade)}
                open={!!selectedTrade}
                onClose={() => setSelectedTrade(null)}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>{symbol} K线图</span>
            {trades.length > 0 && (
              <span className="text-sm text-text-secondary font-normal">
                {Math.ceil(markers.length / 2)} 笔交易
              </span>
            )}
          </div>
          {showControls && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={fetchKlineData} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        {loading ? (
          <div className="flex items-center justify-center" style={{ height: `${height}px` }}>
            <div className="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full" />
          </div>
        ) : klineData.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-text-secondary" style={{ height: `${height}px` }}>
            <Info className="w-12 h-12 mb-4 opacity-50" />
            <p>暂无 K 线数据</p>
          </div>
        ) : (
          <KLineChart
            data={klineData}
            markers={markers}
            height={height}
            timeframe={timeframe as '1m' | '5m' | '15m' | '1h' | '4h' | '1d'}
            showVolume={true}
            onTimeframeChange={handleTimeframeChange}
          />
        )}
        {/* 交易信号详情卡片 */}
        {selectedTrade && (
          <TradeSignalCard
            trade={convertToTradeSignal(selectedTrade)}
            open={!!selectedTrade}
            onClose={() => setSelectedTrade(null)}
          />
        )}

        {/* 图例说明 + 交易列表 */}
        {trades.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border-primary">
            {/* 图例 */}
            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent border-b-success" />
                <span className="text-text-secondary">买入点 (B)</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[10px] border-l-transparent border-r-transparent border-t-danger" />
                <span className="text-text-secondary">卖出点 (S)</span>
              </div>
              <span className="text-xs text-text-tertiary ml-auto">点击交易查看详情</span>
            </div>
            {/* 交易列表（可点击查看信号详情） */}
            <div className="flex flex-wrap gap-2">
              {trades.slice(0, 5).map((trade) => (
                <button
                  key={trade.id}
                  onClick={() => {
                    setSelectedTrade(trade);
                    onTradeClick?.(trade);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-bg-tertiary hover:bg-bg-secondary transition-colors text-sm"
                >
                  <span className={trade.profit_percent && trade.profit_percent > 0 ? 'text-success' : trade.profit_percent && trade.profit_percent < 0 ? 'text-danger' : 'text-text-primary'}>
                    {trade.side === 'buy' ? '买' : '卖'}
                  </span>
                  <span className="text-text-secondary">@{trade.open_rate?.toFixed(2)}</span>
                  {trade.profit_percent !== undefined && (
                    <span className={trade.profit_percent > 0 ? 'text-success' : 'text-danger'}>
                      {trade.profit_percent > 0 ? '+' : ''}{(trade.profit_percent * 100).toFixed(2)}%
                    </span>
                  )}
                </button>
              ))}
              {trades.length > 5 && (
                <span className="px-3 py-1.5 text-sm text-text-tertiary">+{trades.length - 5} 更多</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TradingKLineView;
