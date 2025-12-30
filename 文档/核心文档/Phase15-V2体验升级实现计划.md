# Phase 15: V2 懂行用户体验升级 - 实现计划

> **目标用户**：既服务"小白"，也满足"懂王"的掌控感需求
> **核心理念**：渐进式披露（Progressive Disclosure）
> **产品定位**：外表是小白的傻瓜相机，内核是摄影师的单反
> **状态**：✅ **已完成** (2025-12-30)

---

## 一、功能优先级总览

| 优先级 | 功能 | 价值 | 状态 | 实现组件 |
|-------|------|------|------|----------|
| **P0** | 买卖点可视化（K线图） | 最有说服力 | ✅ 完成 | `TradingKLineView` + `KLineChart` |
| **P1** | 高级参数滑块 | 最有参与感 | ✅ 完成 | `AdvancedSettings` |
| **P2** | 信号卡片（交易逻辑翻译） | 最有专业感 | ✅ 完成 | `SignalCard` + `SignalList` + `SignalSummary` |
| **P3** | 回测报表升级 | 增强信任 | ✅ 完成 | 回测页面胜率饼图 + 风险评级 |

---

## 二、现有代码分析

### 2.1 已有组件

| 组件 | 路径 | 状态 |
|------|------|------|
| KLineChart | `components/charts/KLineChart.tsx` | ✅ 已实现，支持买卖点标记 |
| MiniKLineChart | `components/charts/KLineChart.tsx` | ✅ 已实现 |
| PnLChart | `components/charts/PnLChart.tsx` | ✅ 已实现 |
| 回测页面 | `app/(dashboard)/trading/backtest/page.tsx` | ✅ 已实现基础功能 |
| 交易控制台 | `app/(dashboard)/trading/page.tsx` | ✅ 已实现 |
| 信号页面 | `app/(dashboard)/trading/signals/page.tsx` | 存在，待确认 |

### 2.2 KLineChart 组件现有功能

```typescript
// 已支持的功能
interface KLineChartProps {
  data: KLineDataPoint[];        // K线数据
  markers?: TradeMarker[];       // 买卖点标记 ✅
  height?: number;               // 图表高度
  timeframe?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';  // 时间框架切换 ✅
  showVolume?: boolean;          // 成交量 ✅
  onTimeframeChange?: (tf: string) => void;
}

// 买卖点标记类型
interface TradeMarker {
  time: UTCTimestamp;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown' | 'circle';
  text: string;
}
```

---

## 三、P0: 买卖点可视化（K线图）

### 3.1 目标

用户一眼看懂策略在何时买卖，建立专业信任感。

**效果**："卧槽，这个策略是在跌到底部时抄底的，牛逼！"

### 3.2 需要实现的功能

1. **策略详情页集成 K 线图**
   - 路径：`/strategies/[id]` 页面
   - 展示该策略的历史交易点

2. **交易控制台集成 K 线图**
   - 路径：`/trading` 页面
   - 展示当前持仓币种的实时 K 线 + 买入点

3. **交易历史页集成 K 线图**
   - 路径：`/trading/history` 页面
   - 点击某笔交易，展示该笔交易的 K 线上下文

### 3.3 后端 API 需求

```typescript
// 1. 获取 K 线数据
GET /api/klines?symbol=BTC/USDT&timeframe=1h&limit=500

// Response
{
  "code": 0,
  "data": [
    {
      "time": 1703836800,  // Unix timestamp
      "open": 42000.5,
      "high": 42500.0,
      "low": 41800.0,
      "close": 42300.0,
      "volume": 1234.56
    }
  ]
}

// 2. 获取策略历史交易点
GET /api/strategies/:id/trades?limit=100

// Response
{
  "code": 0,
  "data": {
    "trades": [
      {
        "id": "xxx",
        "pair": "BTC/USDT",
        "side": "buy",       // buy | sell
        "open_time": 1703836800,
        "close_time": 1703840400,
        "open_rate": 42000.5,
        "close_rate": 42300.0,
        "profit": 7.14,
        "profit_percent": 0.71
      }
    ]
  }
}
```

### 3.4 前端实现

#### 新增组件：TradingKLineView

```tsx
// components/features/trading/TradingKLineView.tsx
'use client';

import { useState, useEffect } from 'react';
import { KLineChart, KLineDataPoint, TradeMarker } from '@/components/charts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { klineApi, tradesApi } from '@/lib/api';

interface TradingKLineViewProps {
  symbol: string;
  trades?: Trade[];  // 交易记录
  height?: number;
}

export function TradingKLineView({ symbol, trades = [], height = 400 }: TradingKLineViewProps) {
  const [klineData, setKlineData] = useState<KLineDataPoint[]>([]);
  const [timeframe, setTimeframe] = useState('1h');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKlineData();
  }, [symbol, timeframe]);

  const fetchKlineData = async () => {
    setLoading(true);
    try {
      const res = await klineApi.get(symbol, timeframe);
      setKlineData(res.data);
    } catch (error) {
      console.error('Failed to fetch kline:', error);
    } finally {
      setLoading(false);
    }
  };

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
      });
    }

    // 卖出点 - 红色向下箭头
    if (trade.close_time) {
      result.push({
        time: trade.close_time as UTCTimestamp,
        position: 'aboveBar',
        color: '#F23645',
        shape: 'arrowDown',
        text: 'S',
      });
    }

    return result;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{symbol} K线图</span>
          <span className="text-sm text-text-secondary font-normal">
            {markers.length / 2} 笔交易
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[400px] flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <KLineChart
            data={klineData}
            markers={markers}
            height={height}
            timeframe={timeframe}
            showVolume={true}
            onTimeframeChange={setTimeframe}
          />
        )}
      </CardContent>
    </Card>
  );
}
```

### 3.5 集成位置

1. **策略详情页** `/strategies/[id]/page.tsx`
   - 在策略配置区域下方添加 K 线图
   - 展示该策略的回测或实盘历史交易点

2. **交易控制台** `/trading/page.tsx`
   - 在持仓列表上方添加当前交易币种的 K 线图
   - 点击持仓自动切换到该币种

3. **交易历史** `/trading/history/page.tsx`
   - 点击某笔交易，展开显示 K 线上下文

---

## 四、P1: 高级参数滑块

### 4.1 目标

给用户"我在掌控"的感觉，而不是"开盲盒"。

### 4.2 交互设计

- **默认状态**：高级设置折叠，显示一个不起眼的开关 `[🔧 高级设置]`
- **展开后**：显示参数滑块，限制范围防止乱调

### 4.3 可调参数

| 参数名 | UI 形式 | 范围 | 后端映射 |
|--------|---------|------|---------|
| 止盈倍数 | 滑块 | 稳健(10%) ↔ 贪婪(50%) | Freqtrade `minimal_roi` |
| 最大持仓数 | 滑块 | 集中火力(3) ↔ 广撒网(10) | Freqtrade `max_open_trades` |
| 入场激进程度 | 下拉 | 保守 / 标准 / 激进 | 策略代码分支 |
| 止损百分比 | 滑块 | 严格(-3%) ↔ 宽松(-10%) | Freqtrade `stoploss` |

### 4.4 组件设计

```tsx
// components/features/strategies/AdvancedSettings.tsx
'use client';

import { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Select } from '@/components/ui/select';
import { Settings, ChevronDown, ChevronUp } from 'lucide-react';

interface AdvancedSettingsProps {
  strategyId: string;
  defaultValues?: StrategyParams;
  onChange?: (params: StrategyParams) => void;
}

interface StrategyParams {
  takeProfitPercent: number;   // 10-50
  maxOpenTrades: number;       // 3-10
  entryAggressiveness: 'conservative' | 'standard' | 'aggressive';
  stopLossPercent: number;     // 3-10
}

export function AdvancedSettings({ strategyId, defaultValues, onChange }: AdvancedSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [params, setParams] = useState<StrategyParams>(defaultValues || {
    takeProfitPercent: 20,
    maxOpenTrades: 5,
    entryAggressiveness: 'standard',
    stopLossPercent: 5,
  });

  const handleChange = (key: keyof StrategyParams, value: number | string) => {
    const newParams = { ...params, [key]: value };
    setParams(newParams);
    onChange?.(newParams);
  };

  return (
    <div className="border border-border-secondary rounded-lg overflow-hidden">
      {/* 折叠头部 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-bg-tertiary/50 hover:bg-bg-tertiary transition-colors"
      >
        <div className="flex items-center gap-2 text-text-secondary">
          <Settings className="w-4 h-4" />
          <span className="text-sm font-medium">高级设置</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-text-secondary" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-secondary" />
        )}
      </button>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="p-4 space-y-6 bg-bg-secondary/50">
          {/* 止盈倍数 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-text-primary">止盈目标</label>
              <span className="text-sm text-brand-primary font-medium">
                {params.takeProfitPercent}%
              </span>
            </div>
            <Slider
              value={params.takeProfitPercent}
              min={10}
              max={50}
              step={5}
              onChange={(v) => handleChange('takeProfitPercent', v)}
            />
            <div className="flex justify-between text-xs text-text-tertiary mt-1">
              <span>稳健 10%</span>
              <span>贪婪 50%</span>
            </div>
          </div>

          {/* 最大持仓数 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-text-primary">最大持仓数</label>
              <span className="text-sm text-brand-primary font-medium">
                {params.maxOpenTrades} 个
              </span>
            </div>
            <Slider
              value={params.maxOpenTrades}
              min={3}
              max={10}
              step={1}
              onChange={(v) => handleChange('maxOpenTrades', v)}
            />
            <div className="flex justify-between text-xs text-text-tertiary mt-1">
              <span>集中火力</span>
              <span>广撒网</span>
            </div>
          </div>

          {/* 入场激进程度 */}
          <div>
            <label className="text-sm text-text-primary block mb-2">入场激进程度</label>
            <Select
              value={params.entryAggressiveness}
              onChange={(e) => handleChange('entryAggressiveness', e.target.value)}
            >
              <option value="conservative">保守 - 仅在明确信号时入场</option>
              <option value="standard">标准 - 平衡风险与机会</option>
              <option value="aggressive">激进 - 抓住更多机会</option>
            </Select>
          </div>

          {/* 止损百分比 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-text-primary">止损线</label>
              <span className="text-sm text-danger font-medium">
                -{params.stopLossPercent}%
              </span>
            </div>
            <Slider
              value={params.stopLossPercent}
              min={3}
              max={10}
              step={1}
              onChange={(v) => handleChange('stopLossPercent', v)}
            />
            <div className="flex justify-between text-xs text-text-tertiary mt-1">
              <span>严格 -3%</span>
              <span>宽松 -10%</span>
            </div>
          </div>

          {/* 风险提示 */}
          <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
            <p className="text-xs text-warning">
              ⚠️ 修改参数会影响策略表现，建议先在回测中验证
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 4.5 后端 API

```typescript
// 更新策略参数
PUT /api/strategies/:id/config

// Request
{
  "takeProfitPercent": 20,
  "maxOpenTrades": 5,
  "entryAggressiveness": "standard",
  "stopLossPercent": 5
}

// Response
{
  "code": 0,
  "message": "参数已更新",
  "data": {
    "restartRequired": true  // 是否需要重启策略生效
  }
}
```

---

## 五、P2: 信号卡片（交易逻辑翻译）

### 5.1 目标

把代码日志翻译成"人话"，展示"为什么买/为什么卖"。

**效果**：懂行的人会点头："嗯，确实符合逻辑。"

### 5.2 卡片结构

```
┌─────────────────────────────────────┐
│  🟢 买入信号                    14:32  │
├─────────────────────────────────────┤
│  【触发条件】RSI 超卖 (数值 28)        │
│  【趋势判断】BTC 1小时级别看涨         │
│  【执行动作】市价买入 0.1 ETH          │
│  【入场价格】$2,350.00                │
├─────────────────────────────────────┤
│  💡 策略解读                          │
│  RSI 低于 30 表示市场超卖，配合        │
│  上升趋势，是较好的买入时机            │
└─────────────────────────────────────┘
```

### 5.3 组件设计

```tsx
// components/features/trading/SignalCard.tsx
'use client';

import { Card, CardContent } from '@/components/ui';
import { TrendingUp, TrendingDown, Lightbulb, Clock } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

interface SignalCardProps {
  signal: {
    id: string;
    type: 'buy' | 'sell';
    pair: string;
    time: string;

    // 触发条件
    trigger: {
      indicator: string;     // RSI, MACD, etc
      condition: string;     // 超卖, 金叉, etc
      value: number | string;
    };

    // 趋势判断
    trend: {
      timeframe: string;     // 1h, 4h, etc
      direction: 'bullish' | 'bearish' | 'neutral';
    };

    // 执行动作
    action: {
      orderType: 'market' | 'limit';
      amount: number;
      price: number;
    };

    // AI 解读
    explanation?: string;
  };
}

export function SignalCard({ signal }: SignalCardProps) {
  const isBuy = signal.type === 'buy';

  return (
    <Card className={`border-l-4 ${isBuy ? 'border-l-success' : 'border-l-danger'}`}>
      <CardContent className="p-4">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {isBuy ? (
              <TrendingUp className="w-5 h-5 text-success" />
            ) : (
              <TrendingDown className="w-5 h-5 text-danger" />
            )}
            <span className={`font-medium ${isBuy ? 'text-success' : 'text-danger'}`}>
              {isBuy ? '买入信号' : '卖出信号'}
            </span>
            <span className="text-text-secondary text-sm">{signal.pair}</span>
          </div>
          <div className="flex items-center gap-1 text-text-tertiary text-sm">
            <Clock className="w-3 h-3" />
            {formatDateTime(signal.time)}
          </div>
        </div>

        {/* 详情 */}
        <div className="space-y-2 mb-4">
          {/* 触发条件 */}
          <div className="flex items-start gap-2">
            <span className="text-text-tertiary text-sm w-20 flex-shrink-0">触发条件</span>
            <span className="text-text-primary text-sm">
              {signal.trigger.indicator} {signal.trigger.condition}
              <span className="text-brand-primary ml-1">({signal.trigger.value})</span>
            </span>
          </div>

          {/* 趋势判断 */}
          <div className="flex items-start gap-2">
            <span className="text-text-tertiary text-sm w-20 flex-shrink-0">趋势判断</span>
            <span className="text-text-primary text-sm">
              {signal.pair.split('/')[0]} {signal.trend.timeframe}级别
              <span className={`ml-1 ${
                signal.trend.direction === 'bullish' ? 'text-success' :
                signal.trend.direction === 'bearish' ? 'text-danger' : 'text-warning'
              }`}>
                {signal.trend.direction === 'bullish' ? '看涨' :
                 signal.trend.direction === 'bearish' ? '看跌' : '震荡'}
              </span>
            </span>
          </div>

          {/* 执行动作 */}
          <div className="flex items-start gap-2">
            <span className="text-text-tertiary text-sm w-20 flex-shrink-0">执行动作</span>
            <span className="text-text-primary text-sm">
              {signal.action.orderType === 'market' ? '市价' : '限价'}
              {isBuy ? '买入' : '卖出'} {signal.action.amount} {signal.pair.split('/')[0]}
            </span>
          </div>

          {/* 价格 */}
          <div className="flex items-start gap-2">
            <span className="text-text-tertiary text-sm w-20 flex-shrink-0">
              {isBuy ? '入场价格' : '出场价格'}
            </span>
            <span className="text-text-primary text-sm font-medium">
              ${signal.action.price.toLocaleString()}
            </span>
          </div>
        </div>

        {/* AI 解读 */}
        {signal.explanation && (
          <div className="p-3 bg-brand-primary/10 border border-brand-primary/20 rounded-lg">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-brand-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-brand-primary font-medium mb-1">策略解读</p>
                <p className="text-sm text-text-secondary">{signal.explanation}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### 5.4 信号列表页面

路径：`/trading/signals/page.tsx`

展示所有信号卡片，支持按时间/类型筛选。

---

## 六、P3: 回测报表升级

### 6.1 目标

用专业指标征服"懂王"用户，增强信任。

### 6.2 新增指标

| 指标 | 说明 | 展示方式 |
|------|------|---------|
| 夏普比率 (Sharpe Ratio) | 风险调整后收益 | 大字醒目展示 |
| 最大回撤 (Max Drawdown) | 最坏情况亏损 | 红色醒目字体 |
| 胜率 (Win Rate) | 盈利交易占比 | 饼图展示 |
| 盈亏比 (Profit Factor) | 总盈利/总亏损 | 数值展示 |
| 索提诺比率 (Sortino Ratio) | 下行风险调整收益 | 可选显示 |
| 卡玛比率 (Calmar Ratio) | 年化收益/最大回撤 | 可选显示 |

### 6.3 时段选择器

允许用户对比策略在不同行情下的表现：

- 最近 30 天
- 最近 90 天
- 最近 180 天
- 2022 年熊市（2022-01-01 ~ 2022-12-31）
- 2023 年复苏（2023-01-01 ~ 2023-12-31）
- 自定义时段

### 6.4 UI 改进

1. **胜率饼图**：直观展示盈亏比例
2. **回撤曲线**：用红色区域标注回撤区间
3. **交易分布图**：按币种/时间段分组的交易统计
4. **风险评级**：根据夏普比率和回撤给出 A-D 评级

---

## 七、后端 API 清单

### 7.1 K 线数据

```typescript
// 获取 K 线数据
GET /api/klines
Query: symbol, timeframe (1m|5m|15m|1h|4h|1d), limit

// 获取策略历史交易
GET /api/strategies/:id/trades
Query: limit, offset

// 获取实例交易历史
GET /api/instances/:id/trades
Query: limit, offset, pair
```

### 7.2 策略参数

```typescript
// 获取策略可配置参数
GET /api/strategies/:id/config

// 更新策略参数
PUT /api/strategies/:id/config
Body: { takeProfitPercent, maxOpenTrades, ... }
```

### 7.3 信号数据

```typescript
// 获取交易信号列表
GET /api/instances/:id/signals
Query: type (buy|sell), limit

// 获取信号详情（含 AI 解读）
GET /api/signals/:id
```

### 7.4 回测数据

```typescript
// 获取回测报表
GET /api/backtest/:id/report

// Response 增加字段
{
  sharpeRatio: number,
  sortinoRatio: number,
  calmarRatio: number,
  maxDrawdown: number,
  maxDrawdownDuration: number,  // 最大回撤持续天数
  winRate: number,
  profitFactor: number,
  avgWinAmount: number,
  avgLossAmount: number,
  largestWin: number,
  largestLoss: number,
  tradingDays: number,
  avgTradesPerDay: number,
}
```

---

## 八、实现顺序

### 阶段 1: P0 买卖点可视化（1-2天）

1. 后端实现 K 线数据 API
2. 前端创建 TradingKLineView 组件
3. 集成到策略详情页
4. 集成到交易控制台
5. 测试验收

### 阶段 2: P1 高级参数滑块（1天）

1. 后端实现参数配置 API
2. 前端创建 AdvancedSettings 组件
3. 创建 Slider 基础组件
4. 集成到策略订阅流程
5. 测试验收

### 阶段 3: P2 信号卡片（1天）

1. 后端实现信号数据 API
2. AI 解读服务集成（复用现有 AI 模块）
3. 前端创建 SignalCard 组件
4. 完善信号列表页面
5. 测试验收

### 阶段 4: P3 回测报表升级（0.5天）

1. 后端增加回测指标计算
2. 前端增加饼图、时段选择器
3. UI 优化（风险评级、颜色标注）
4. 测试验收

---

## 九、验收标准

### P0 验收
- [ ] K 线图正确显示历史数据
- [ ] 买卖点标记位置正确（买入在下方绿色，卖出在上方红色）
- [ ] 时间框架切换正常
- [ ] 点击标记可显示交易详情

### P1 验收
- [ ] 高级设置默认折叠
- [ ] 滑块拖动流畅，数值更新正确
- [ ] 参数保存成功后有提示
- [ ] 参数范围限制生效

### P2 验收
- [ ] 信号卡片信息完整
- [ ] AI 解读内容合理
- [ ] 买卖信号颜色区分明显
- [ ] 时间排序正确

### P3 验收
- [ ] 夏普比率等指标计算正确
- [ ] 胜率饼图展示正确
- [ ] 时段选择器切换数据正确
- [ ] 最大回撤用红色醒目标注

---

## 十、风险与注意事项

1. **K 线数据量**：注意分页和缓存，避免一次加载太多数据
2. **参数同步**：修改参数后需要重启策略，要有明确提示
3. **AI 解读成本**：控制 AI API 调用频率，考虑缓存
4. **移动端适配**：K 线图在小屏幕上的交互需要优化

---

**创建日期**：2025-12-30
**更新日期**：2025-12-30
**状态**：📋 待执行
