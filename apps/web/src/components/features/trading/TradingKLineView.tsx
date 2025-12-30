'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { KLineChart, KLineDataPoint, TradeMarker } from '@/components/charts';
import { Button } from '@/components/ui/button';
import { RefreshCw, Maximize2, X, Info } from 'lucide-react';
import type { UTCTimestamp } from 'lightweight-charts';

// 交易记录类型
export interface TradeRecord {
  id: string;
  pair: string;
  side: 'buy' | 'sell';
  open_time: number;      // Unix timestamp
  close_time?: number;    // Unix timestamp
  open_rate: number;
  close_rate?: number;
  amount: number;
  profit?: number;
  profit_percent?: number;
  is_open?: boolean;
}

// 组件属性
interface TradingKLineViewProps {
  symbol: string;
  trades?: TradeRecord[];
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
  height = 400,
  showControls = true,
  onTradeClick,
  className = '',
}: TradingKLineViewProps) {
  const [klineData, setKlineData] = useState<KLineDataPoint[]>([]);
  const [timeframe, setTimeframe] = useState('1h');
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<TradeRecord | null>(null);

  // 获取 K 线数据
  const fetchKlineData = useCallback(async () => {
    setLoading(true);
    try {
      // TODO: 实际 API 调用
      // const res = await klineApi.get(symbol, timeframe);
      // setKlineData(res.data);

      // 模拟数据
      await new Promise(resolve => setTimeout(resolve, 500));
      setKlineData(generateMockKlineData(30));
    } catch (error) {
      console.error('Failed to fetch kline:', error);
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

  // 交易详情弹窗
  const TradeDetailPopup = ({ trade }: { trade: TradeRecord }) => {
    const isProfit = (trade.profit || 0) >= 0;

    return (
      <div className="absolute top-4 right-4 z-50 w-72 bg-bg-secondary border border-border-primary rounded-lg shadow-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-text-primary">{trade.pair}</h4>
          <button
            onClick={() => setSelectedTrade(null)}
            className="text-text-tertiary hover:text-text-primary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-text-secondary">方向</span>
            <span className={trade.side === 'buy' ? 'text-success' : 'text-danger'}>
              {trade.side === 'buy' ? '买入' : '卖出'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">开仓价</span>
            <span className="text-text-primary">${trade.open_rate.toLocaleString()}</span>
          </div>
          {trade.close_rate && (
            <div className="flex justify-between">
              <span className="text-text-secondary">平仓价</span>
              <span className="text-text-primary">${trade.close_rate.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-text-secondary">数量</span>
            <span className="text-text-primary">{trade.amount}</span>
          </div>
          {trade.profit !== undefined && (
            <div className="flex justify-between pt-2 border-t border-border-primary">
              <span className="text-text-secondary">盈亏</span>
              <span className={isProfit ? 'text-success font-medium' : 'text-danger font-medium'}>
                {isProfit ? '+' : ''}{trade.profit.toFixed(2)} USDT
                <span className="text-xs ml-1">
                  ({isProfit ? '+' : ''}{((trade.profit_percent || 0) * 100).toFixed(2)}%)
                </span>
              </span>
            </div>
          )}
        </div>

        {onTradeClick && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3"
            onClick={() => {
              onTradeClick(trade);
              setSelectedTrade(null);
            }}
          >
            查看详情
          </Button>
        )}
      </div>
    );
  };

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
            {selectedTrade && <TradeDetailPopup trade={selectedTrade} />}
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
        {selectedTrade && <TradeDetailPopup trade={selectedTrade} />}

        {/* 图例说明 */}
        {markers.length > 0 && (
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border-primary">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent border-b-success" />
              <span className="text-text-secondary">买入点 (B)</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[10px] border-l-transparent border-r-transparent border-t-danger" />
              <span className="text-text-secondary">卖出点 (S)</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TradingKLineView;
