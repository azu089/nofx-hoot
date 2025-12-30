'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { KLineChart, KLineDataPoint, TradeMarker } from '@/components/charts/KLineChart';
import {
  SignalCard,
  SignalList,
  TradingSignal,
  SignalSummary,
} from '@/components/features/trading/SignalCard';
import {
  AdvancedParams,
  STRATEGY_PARAM_TEMPLATES,
  ParamCategory,
} from '@/components/features/trading/AdvancedParams';
import {
  TrendingUp,
  TrendingDown,
  Settings,
  Bell,
  Filter,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

// 模拟 K 线数据生成
function generateMockKLineData(count: number): KLineDataPoint[] {
  const data: KLineDataPoint[] = [];
  let basePrice = 42000 + Math.random() * 3000;
  const now = Date.now();

  for (let i = count - 1; i >= 0; i--) {
    const time = Math.floor((now - i * 3600000) / 1000) as number;
    const volatility = 0.02;
    const change = (Math.random() - 0.5) * volatility * basePrice;

    const open = basePrice;
    const close = basePrice + change;
    const high = Math.max(open, close) + Math.random() * Math.abs(change) * 0.5;
    const low = Math.min(open, close) - Math.random() * Math.abs(change) * 0.5;
    const volume = Math.random() * 1000 + 100;

    data.push({
      time: time as any,
      open,
      high,
      low,
      close,
      volume,
    });

    basePrice = close;
  }

  return data;
}

// 模拟交易信号
function generateMockSignals(): TradingSignal[] {
  const signals: TradingSignal[] = [
    {
      id: '1',
      type: 'buy',
      symbol: 'BTC/USDT',
      price: 43250.50,
      targetPrice: 44500,
      stopLoss: 42500,
      takeProfit: 45000,
      strength: 'strong',
      status: 'active',
      strategy: 'RSI 超卖反弹',
      reason: 'RSI 跌破 30 后回升，MACD 金叉确认，成交量放大',
      indicators: [
        { name: 'RSI', value: '32.5', signal: 'bullish' },
        { name: 'MACD', value: '金叉', signal: 'bullish' },
        { name: 'Volume', value: '+45%', signal: 'bullish' },
        { name: 'EMA20', value: '支撑', signal: 'bullish' },
      ],
      timestamp: new Date(Date.now() - 300000).toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    },
    {
      id: '2',
      type: 'sell',
      symbol: 'ETH/USDT',
      price: 2280.00,
      targetPrice: 2200,
      stopLoss: 2320,
      strength: 'medium',
      status: 'active',
      strategy: '双顶形态',
      reason: '形成双顶形态，颈线位置附近，建议减仓',
      indicators: [
        { name: 'Pattern', value: '双顶', signal: 'bearish' },
        { name: 'RSI', value: '68', signal: 'neutral' },
      ],
      timestamp: new Date(Date.now() - 600000).toISOString(),
    },
    {
      id: '3',
      type: 'alert',
      symbol: 'BTC/USDT',
      price: 43100.00,
      strength: 'weak',
      status: 'active',
      strategy: '价格预警',
      reason: '接近重要支撑位 $43,000，注意观察',
      timestamp: new Date(Date.now() - 120000).toISOString(),
    },
  ];

  return signals;
}

// 生成买卖点标记
function generateTradeMarkers(klineData: KLineDataPoint[]): TradeMarker[] {
  const markers: TradeMarker[] = [];

  // 在一些 K 线上添加买卖点标记
  if (klineData.length > 20) {
    markers.push({
      time: klineData[klineData.length - 15].time,
      position: 'belowBar',
      color: '#00C087',
      shape: 'arrowUp',
      text: '买入',
    });
  }

  if (klineData.length > 10) {
    markers.push({
      time: klineData[klineData.length - 8].time,
      position: 'aboveBar',
      color: '#F23645',
      shape: 'arrowDown',
      text: '卖出',
    });
  }

  if (klineData.length > 5) {
    markers.push({
      time: klineData[klineData.length - 3].time,
      position: 'belowBar',
      color: '#00C087',
      shape: 'arrowUp',
      text: '买入',
    });
  }

  return markers;
}

export default function SignalsPage() {
  const [klineData, setKlineData] = useState<KLineDataPoint[]>([]);
  const [markers, setMarkers] = useState<TradeMarker[]>([]);
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [timeframe, setTimeframe] = useState('1h');
  const [activeTab, setActiveTab] = useState('signals');
  const [params, setParams] = useState<ParamCategory[]>(STRATEGY_PARAM_TEMPLATES);
  const [isParamsLocked, setIsParamsLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  // 加载数据
  useEffect(() => {
    setLoading(true);
    // 模拟 API 请求延迟
    setTimeout(() => {
      const data = generateMockKLineData(100);
      setKlineData(data);
      setMarkers(generateTradeMarkers(data));
      setSignals(generateMockSignals());
      setLoading(false);
    }, 500);
  }, [timeframe]);

  // 处理时间框架变化
  const handleTimeframeChange = (tf: string) => {
    setTimeframe(tf);
  };

  // 处理信号执行
  const handleExecuteSignal = (signal: TradingSignal) => {
    toast.success(`已执行 ${signal.type === 'buy' ? '买入' : '卖出'} ${signal.symbol}`);
    setSignals((prev) =>
      prev.map((s) => (s.id === signal.id ? { ...s, status: 'triggered' as const } : s))
    );
  };

  // 处理信号忽略
  const handleDismissSignal = (signal: TradingSignal) => {
    setSignals((prev) =>
      prev.map((s) => (s.id === signal.id ? { ...s, status: 'cancelled' as const } : s))
    );
  };

  // 处理参数变化
  const handleParamChange = (key: string, value: number | string | boolean) => {
    setParams((prev) =>
      prev.map((cat) => ({
        ...cat,
        params: cat.params.map((p) => (p.key === key ? { ...p, value } : p)),
      }))
    );
  };

  // 保存参数
  const handleSaveParams = () => {
    toast.success('参数已保存');
  };

  // 重置参数
  const handleResetParams = () => {
    setParams(STRATEGY_PARAM_TEMPLATES);
    toast.info('参数已重置为默认值');
  };

  // 活跃信号数量
  const activeSignals = signals.filter((s) => s.status === 'active');

  return (
    <div className="min-h-screen bg-bg-primary p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">信号中心</h1>
            <p className="text-text-secondary mt-1">
              实时交易信号与 K 线分析
            </p>
          </div>
          <div className="flex items-center gap-3">
            <SignalSummary signals={signals} />
            <Button variant="outline" size="sm">
              <Bell className="w-4 h-4 mr-2" />
              通知设置
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLoading(true);
                setTimeout(() => {
                  const data = generateMockKLineData(100);
                  setKlineData(data);
                  setMarkers(generateTradeMarkers(data));
                  setLoading(false);
                }, 300);
              }}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </div>

        {/* 主要内容区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：K 线图表 */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-text-primary">
                    BTC/USDT
                  </h2>
                  <Badge className="bg-success/20 text-success">+2.35%</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-text-primary">
                    ${klineData.length > 0 ? klineData[klineData.length - 1].close.toFixed(2) : '--'}
                  </span>
                </div>
              </div>

              {loading ? (
                <div className="h-[400px] flex items-center justify-center bg-bg-secondary rounded-md">
                  <div className="text-text-secondary">加载中...</div>
                </div>
              ) : (
                <KLineChart
                  data={klineData}
                  markers={markers}
                  height={400}
                  timeframe={timeframe as any}
                  showVolume={true}
                  onTimeframeChange={handleTimeframeChange}
                />
              )}
            </Card>

            {/* 信号/参数标签页 */}
            <Tabs defaultValue="signals" value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="signals" className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  交易信号
                  {activeSignals.length > 0 && (
                    <Badge className="bg-brand-primary text-white ml-1">
                      {activeSignals.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="params" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  策略参数
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signals" className="mt-4">
                <SignalList
                  signals={signals}
                  onExecute={handleExecuteSignal}
                  onDismiss={handleDismissSignal}
                />
              </TabsContent>

              <TabsContent value="params" className="mt-4">
                <AdvancedParams
                  categories={params}
                  onChange={handleParamChange}
                  onSave={handleSaveParams}
                  onReset={handleResetParams}
                  isLocked={isParamsLocked}
                  onLockToggle={() => setIsParamsLocked(!isParamsLocked)}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* 右侧：信号快览 */}
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="font-medium text-text-primary mb-4">活跃信号</h3>
              <div className="space-y-3">
                {activeSignals.length > 0 ? (
                  activeSignals.slice(0, 5).map((signal) => (
                    <SignalCard key={signal.id} signal={signal} compact />
                  ))
                ) : (
                  <p className="text-text-secondary text-sm py-4 text-center">
                    暂无活跃信号
                  </p>
                )}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-medium text-text-primary mb-4">今日统计</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">总信号数</span>
                  <span className="font-medium text-text-primary">{signals.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">买入信号</span>
                  <span className="font-medium text-success">
                    {signals.filter((s) => s.type === 'buy').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">卖出信号</span>
                  <span className="font-medium text-danger">
                    {signals.filter((s) => s.type === 'sell').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">已执行</span>
                  <span className="font-medium text-brand-primary">
                    {signals.filter((s) => s.status === 'triggered').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">成功率</span>
                  <span className="font-medium text-success">78%</span>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-medium text-text-primary mb-4">快捷操作</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <Filter className="w-4 h-4 mr-2" />
                  信号过滤
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Bell className="w-4 h-4 mr-2" />
                  设置提醒
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Settings className="w-4 h-4 mr-2" />
                  指标设置
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
