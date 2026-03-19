# nofx 网格策略完整逻辑参考手册

> 基于 nofx Go 源码全量分析，供 HOOT TS 移植使用
> 生成日期：2026-03-13
> 覆盖范围：数据获取、状态管理、主循环、成交检测、突破处理、AI提示词、风控、持久化

---

## 目录

1. [整体架构](#1-整体架构)
2. [核心数据结构](#2-核心数据结构)
3. [主循环 RunGridCycle](#3-主循环-rungridcycle)
4. [网格初始化](#4-网格初始化)
5. [市场数据获取](#5-市场数据获取)
6. [技术指标计算](#6-技术指标计算)
7. [成交检测 syncGridState](#7-成交检测-syncgridstate)
8. [止损检测 checkAndExecuteStopLoss](#8-止损检测-checkandexecutestoploss)
9. [简单突破检测 checkBreakout](#9-简单突破检测-checkbreakout)
10. [箱体突破检测 checkBoxBreakout](#10-箱体突破检测-checkboxbreakout)
11. [虚假突破恢复 checkFalseBreakoutRecovery](#11-虚假突破恢复-checkfalsebreakoutrecovery)
12. [方向自适应](#12-方向自适应)
13. [AI 提示词系统](#13-ai-提示词系统)
14. [AI 决策执行](#14-ai-决策执行)
15. [下单逻辑 placeGridLimitOrder](#15-下单逻辑-placegridlimitorder)
16. [仓位上限检查](#16-仓位上限检查)
17. [网格偏斜自动调整](#17-网格偏斜自动调整)
18. [风控系统](#18-风控系统)
19. [数据持久化](#19-数据持久化)
20. [Regime 分级系统](#20-regime-分级系统)
21. [关键配置参数](#21-关键配置参数)

---

## 1. 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                     AutoTrader                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ GridState │  │  Trader  │  │ MCPClient│              │
│  │ (内存)    │  │ (交易所) │  │  (AI)    │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│       ↕              ↕              ↕                    │
│  ┌─────────────────────────────────────────────────┐    │
│  │              RunGridCycle (主循环)                │    │
│  │  1. checkBreakout      (简单边界突破)            │    │
│  │  2. checkMaxDrawdown   (最大回撤)                │    │
│  │  3. checkDailyLossLimit(日损限额)                │    │
│  │  4. checkBoxBreakout   (多周期箱体突破)          │    │
│  │  5. checkFalseBreakoutRecovery (虚假突破恢复)    │    │
│  │  6. buildGridContext   (构建AI上下文)            │    │
│  │  7. GetGridDecisions   (调用AI决策)              │    │
│  │  8. executeGridDecision(执行决策)                │    │
│  │  9. syncGridState      (同步交易所状态)          │    │
│  │ 10. saveGridDecisionRecord (保存记录)            │    │
│  └─────────────────────────────────────────────────┘    │
│       ↕                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Store   │  │  Market  │  │  Kernel  │              │
│  │ (DB/持久)│  │ (K线/指标)│  │ (提示词) │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└─────────────────────────────────────────────────────────┘
```

**设计哲学**：后端只提供数据 + 执行命令，AI 决策所有策略行为（开单/平仓/暂停）。

### 文件清单

| 文件 | 大小 | 作用 |
|------|------|------|
| `trader/auto_trader_grid.go` | 56K | 网格主循环、状态管理、下单、止损 |
| `trader/grid_regime.go` | 9.4K | Regime分级、箱体突破、方向自适应 |
| `trader/auto_trader_loop.go` | 16K | 通用交易主循环（非网格模式） |
| `trader/auto_trader_orders.go` | 12K | 开仓/平仓执行 |
| `trader/auto_trader_risk.go` | 8K | 回撤监控、峰值追踪、紧急平仓 |
| `trader/auto_trader_decision.go` | 6K | 权益快照、状态查询 |
| `kernel/grid_engine.go` | 23K | AI提示词构建、决策解析 |
| `kernel/schema.go` | 18K | 数据字典（双语）、交易规则 |
| `kernel/engine.go` | 70K | LLM引擎、决策解析、正则 |
| `market/data.go` | 38K | K线获取、技术指标计算 |
| `market/types.go` | 8K | 数据类型定义 |
| `store/grid.go` | 21K | 网格持久化模型 |

---

## 2. 核心数据结构

### 2.1 GridState（运行时内存状态）

**文件**: `trader/auto_trader_grid.go:20-73`

```go
type GridState struct {
    mu sync.RWMutex

    Config *store.GridStrategyConfig
    Levels []kernel.GridLevelInfo   // 网格层级数组

    // 网格边界
    UpperPrice  float64
    LowerPrice  float64
    GridSpacing float64

    // 状态标志
    IsPaused      bool
    IsInitialized bool

    // 绩效追踪
    TotalProfit   float64
    TotalTrades   int
    WinningTrades int
    MaxDrawdown   float64
    PeakEquity    float64
    DailyPnL      float64
    LastDailyReset time.Time

    // 订单跟踪
    OrderBook map[string]int  // OrderID -> LevelIndex

    // 箱体状态（6个边界值）
    ShortBoxUpper/Lower float64
    MidBoxUpper/Lower   float64
    LongBoxUpper/Lower  float64

    // 突破状态
    BreakoutLevel        string  // none/short/mid/long
    BreakoutDirection    string  // up/down
    BreakoutConfirmCount int     // 确认计数

    // 仓位缩减（0=正常, 50=虚假突破后缩减）
    PositionReductionPct float64

    // 方向自适应
    CurrentDirection     market.GridDirection  // neutral/long/short/long_bias/short_bias
    DirectionChangedAt   time.Time
    DirectionChangeCount int
}
```

### 2.2 GridLevelInfo（单层状态）

**文件**: `kernel/grid_engine.go:19-30`

```go
type GridLevelInfo struct {
    Index          int     // 层索引（0 = 最低）
    Price          float64 // 目标价格
    State          string  // "empty" | "pending" | "filled" | "stopped"
    Side           string  // "buy" | "sell"
    OrderID        string  // 当前订单ID（pending时）
    OrderQuantity  float64 // 订单数量
    PositionSize   float64 // 持仓数量（filled时）
    PositionEntry  float64 // 进场价格（filled时）
    AllocatedUSD   float64 // 分配的USD金额
    UnrealizedPnL  float64 // 未实现盈亏
}
```

**状态转换**：
```
empty ─(AI下单)→ pending ─(成交检测)→ filled ─(止损)→ stopped
  ↑                 │                              │
  └──(撤单/expired)─┘         ←────(平仓)──────────┘
```

### 2.3 GridContext（AI决策上下文）

**文件**: `kernel/grid_engine.go:33-90`

```go
type GridContext struct {
    // 基本信息
    Symbol       string
    CurrentTime  string
    CurrentPrice float64

    // 网格配置
    GridCount, TotalInvestment, Leverage, UpperPrice, LowerPrice, GridSpacing, Distribution

    // 网格状态
    Levels []GridLevelInfo
    ActiveOrderCount, FilledLevelCount int
    IsPaused bool

    // 市场数据（技术指标）
    ATR14, BollingerUpper/Middle/Lower, BollingerWidth float64
    EMA20, EMA50, EMADistance float64
    RSI14, MACD, MACDSignal, MACDHistogram float64
    FundingRate, Volume24h float64
    PriceChange1h, PriceChange4h float64

    // 账户信息
    TotalEquity, AvailableBalance, CurrentPosition, UnrealizedPnL float64

    // 绩效
    TotalProfit, TotalTrades, WinningTrades, MaxDrawdown, DailyPnL

    // 箱体指标
    BoxData *market.BoxData

    // 网格方向
    CurrentDirection string
}
```

### 2.4 BoxData（唐奇安通道箱体）

**文件**: `market/types.go:192-207`

```go
type BoxData struct {
    ShortUpper float64  // 短期箱体上轨（72根1h K线 = 3天）
    ShortLower float64  // 短期箱体下轨
    MidUpper   float64  // 中期箱体上轨（240根1h K线 = 10天）
    MidLower   float64  // 中期箱体下轨
    LongUpper  float64  // 长期箱体上轨（500根1h K线 ≈ 21天）
    LongLower  float64  // 长期箱体下轨
    CurrentPrice float64
}
```

### 2.5 GridConfigModel（持久化配置）

**文件**: `store/grid.go:15-70`

```go
// 核心参数
GridCount       int     // 网格层数，默认10
TotalInvestment float64 // 总投资额
Leverage        int     // 杠杆倍数，默认5
UpperPrice      float64 // 手动上界
LowerPrice      float64 // 手动下界
UseATRBounds    bool    // 是否用ATR计算边界，默认true
ATRMultiplier   float64 // ATR乘数，默认2.0
Distribution    string  // 资金分布：uniform/gaussian/pyramid

// 风控参数
MaxDrawdownPct     float64 // 最大回撤%，默认15
StopLossPct        float64 // 止损%，默认5
DailyLossLimitPct  float64 // 日损限额%，默认10
MaxPositionSizePct float64 // 最大仓位%，默认30

// 箱体参数
ShortBoxPeriod int // 短期箱体周期（1h K线数），默认72（3天）
MidBoxPeriod   int // 中期箱体周期，默认240（10天）
LongBoxPeriod  int // 长期箱体周期，默认500（21天）

// Regime杠杆限制
NarrowRegimeLeverage   int // 窄幅杠杆限制，默认2
StandardRegimeLeverage int // 标准杠杆限制，默认4
WideRegimeLeverage     int // 宽幅杠杆限制，默认3
VolatileRegimeLeverage int // 剧烈杠杆限制，默认2

// 方向自适应
EnableDirectionAdjust bool    // 是否启用方向调整，默认false
DirectionBiasRatio    float64 // 偏向比例，默认0.7 (70%/30%)

// 订单设置
OrderRefreshSec  int     // 订单刷新间隔，默认300s
UseMakerOnly     bool    // 仅挂单（PostOnly），默认true
SlippageTolerPct float64 // 滑点容忍，默认0.1%
```

---

## 3. 主循环 RunGridCycle

**文件**: `trader/auto_trader_grid.go:758-868`

```
RunGridCycle() 执行顺序：
│
├── 1. 检查 isRunning（停止则立即返回）
│
├── 2. 初始化检查（未初始化则调 InitializeGrid）
│
├── 3. ⚠️ checkBreakout() — 简单边界突破
│      ├── 突破 ≥2%: cancelAllOrders + isPaused=true + return（跳过AI）
│      └── 突破 1-2%: 记录，继续
│
├── 4. ⚠️ checkMaxDrawdown() — 最大回撤
│      └── 超限: emergencyExit（撤单+平仓+暂停）
│
├── 5. ⚠️ checkDailyLossLimit() — 日损限额
│      └── 超限: isPaused=true + return
│
├── 6. checkBoxBreakout() — 多周期唐奇安箱体突破
│      └── 确认后执行突破动作
│
├── 7. checkFalseBreakoutRecovery() — 虚假突破恢复
│      └── 价格回到长期箱体内: 解除暂停, 仓位恢复50%
│
├── 8. 检查 isPaused（暂停则跳过AI）
│
├── 9. buildGridContext() — 构建AI决策上下文
│      ├── 获取市场数据（5m + 4h K线）
│      ├── 计算技术指标
│      ├── 读取网格层级状态
│      └── 获取账户信息
│
├── 10. GetGridDecisions() — 调用AI决策
│       ├── 构建 SystemPrompt + UserPrompt
│       ├── 调用 LLM
│       └── 解析JSON决策数组
│
├── 11. 再次检查 isRunning
│
├── 12. 循环执行 executeGridDecision() — 执行每个决策
│       ├── place_buy_limit / place_sell_limit
│       ├── cancel_order / cancel_all_orders
│       ├── pause_grid / resume_grid
│       ├── adjust_grid
│       ├── close_long / close_short
│       └── hold
│
├── 13. syncGridState() — 同步交易所状态
│       ├── 获取活跃订单
│       ├── 检测消失订单（成交 vs 撤单）
│       ├── 更新层级状态
│       ├── checkAndExecuteStopLoss() — 止损
│       └── autoAdjustGrid() — 偏斜自动调整
│
└── 14. saveGridDecisionRecord() — 保存决策记录
```

**关键设计点**：
- 风控检查在 AI 决策之前，确保风险先行
- 每个决策执行前都检查 isRunning，支持中途停止
- syncGridState 在 AI 执行之后（对齐 nofx）
- 暂停时跳过 AI 调用，节省成本

---

## 4. 网格初始化

### 4.1 InitializeGrid

**文件**: `trader/auto_trader_grid.go:508-558`

```
InitializeGrid():
│
├── 获取当前市场价格
│
├── 计算网格边界
│   ├── UseATRBounds=true: 用ATR计算
│   │   └── halfRange = ATR14(4h) × ATRMultiplier(默认2.0)
│   │       upper = price + halfRange
│   │       lower = price - halfRange
│   ├── UseATRBounds=false: 用手动边界
│   │   └── upper = config.UpperPrice
│   │       lower = config.LowerPrice
│   └── ATR获取失败: 默认±3%×(GridCount/10)
│       └── multiplier = 0.03 × GridCount / 10
│           upper = price × (1 + multiplier)
│           lower = price × (1 - multiplier)
│
├── 计算网格间距
│   └── GridSpacing = (upper - lower) / (GridCount - 1)
│
├── 初始化层级 initializeGridLevels()
│
└── 设置交易所杠杆 SetLeverage()
```

### 4.2 initializeGridLevels（资金分布）

**文件**: `trader/auto_trader_grid.go:591-639`

三种分布模式：

| 分布 | 权重公式 | 特点 |
|------|---------|------|
| `uniform` | `weights[i] = 1.0` | 均匀分配 |
| `gaussian` | `exp(-(i-center)²/(2σ²))` | 中间多两端少 |
| `pyramid` | `GridCount - i` | 底部多顶部少 |

```go
// 每层分配的USD
allocatedUSD = TotalInvestment × weights[i] / totalWeight

// 初始方向
side = price > currentPrice ? "sell" : "buy"

// 每层下单数量计算
qty = allocatedUSD × leverage / price
```

**关键**: 分配量用 `allocatedUSD` 而非全局平均值，确保权重生效。

---

## 5. 市场数据获取

### 5.1 数据来源

**文件**: `market/data.go:34-125`

| 来源 | API | 适用场景 |
|------|-----|---------|
| **CoinAnk** | `coinank_api.Kline()` | 常规加密货币（免费API，无需认证） |
| **Hyperliquid** | `client.GetCandles()` | xyz DEX 资产 |
| **Binance** | 通过CoinAnk获取 | 默认交易所 |

```
GetWithExchange(symbol, exchange):
│
├── 判断数据源
│   ├── xyz资产 → Hyperliquid API（5m代替3m）
│   └── 常规资产 → CoinAnk API（支持exchange参数）
│
├── 获取短周期K线（3m/5m, 100根）
│   └── 数据过期检测: isStaleData() — 连续价格冻结则跳过
│
├── 获取长周期K线（4h, 100根）
│
├── 计算当前指标
│   ├── currentPrice = 最新K线收盘价
│   ├── EMA20 = calculateEMA(klines3m, 20)
│   ├── MACD = calculateMACD(klines3m)
│   ├── RSI7 = calculateRSI(klines3m, 7)
│   ├── priceChange1h = 20根3m K线前的价格变化%
│   └── priceChange4h = 1根4h K线前的价格变化%
│
├── 获取OI数据: getOpenInterestData()
├── 获取资金费率: getFundingRate()（1小时缓存）
│
└── 返回 Data 结构
```

### 5.2 多时间框架获取

**文件**: `market/data.go:288-397`

```go
GetWithTimeframes(symbol, ["5m", "4h"], "5m", 50)
```

网格模式调用 `buildGridContext()` 时使用 `["5m", "4h"]`，主时间框架为 `"5m"`。

每个时间框架独立计算：
- OHLCV K线数据
- EMA20、EMA50 序列
- MACD、RSI7、RSI14 序列
- 布林带（上/中/下轨）序列
- ATR14

---

## 6. 技术指标计算

**文件**: `market/data.go:552-693`

### 6.1 EMA（指数移动平均）

```go
// market/data.go:552-571
func calculateEMA(klines []Kline, period int) float64 {
    // 1. 前period根的SMA作为初始EMA
    ema = sum(close[0:period]) / period
    // 2. Wilder平滑
    multiplier = 2.0 / (period + 1)
    for i := period; i < len; i++ {
        ema = (close[i] - ema) × multiplier + ema
    }
}
```

### 6.2 MACD

```go
// market/data.go:574-585
MACD = EMA(12) - EMA(26)
```

### 6.3 RSI

```go
// market/data.go:588-629
// Wilder平滑法
avgGain = (prevAvgGain × (period-1) + gain) / period
avgLoss = (prevAvgLoss × (period-1) + loss) / period
RS = avgGain / avgLoss
RSI = 100 - 100/(1+RS)
```

### 6.4 ATR

```go
// market/data.go:632-663
TR = max(High-Low, |High-prevClose|, |Low-prevClose|)
ATR = Wilder平滑(TR, 14)
```

### 6.5 布林带

```go
// market/data.go:667-693
Middle = SMA(close, 20)
StdDev = sqrt(variance(close, 20))
Upper = Middle + 2 × StdDev
Lower = Middle - 2 × StdDev
BollingerWidth = (Upper - Lower) / Middle × 100  // 百分比
```

### 6.6 EMA距离

```go
// kernel/grid_engine.go:606-607
EMADistance = (EMA20 - EMA50) / EMA50 × 100  // 百分比
```

---

## 7. 成交检测 syncGridState

**文件**: `trader/auto_trader_grid.go:1200-1274`

```
syncGridState():
│
├── 获取交易所活跃订单 GetOpenOrders(symbol)
│   └── 构建 activeOrderIDs 集合
│
├── 获取交易所当前持仓 GetPositions()
│   └── 记录 currentPositionSize
│
├── 计算 expectedPositionSize（所有 filled 层的 PositionSize 之和）
│
├── 遍历所有层级
│   └── 如果 state=="pending" 且 OrderID 不在活跃订单中：
│       ├── |currentPosition| > |expectedPosition|:
│       │   └── 判定为成交 → state="filled", PositionEntry=Price
│       │       PositionSize=OrderQuantity, TotalTrades++
│       └── 否则:
│           └── 判定为撤单 → state="empty", 清除OrderID
│
├── checkAndExecuteStopLoss() — 止损检查
│
└── autoAdjustGrid() — 偏斜自动调整
```

**关键设计**：这是 **启发式** 成交检测（abs比较法）。通过对比实际持仓和预期持仓来判断订单是成交还是被撤单。

**⚠️ HOOT已实现的增强**：
- `syncOrderFills` 移到周期末尾（AI执行后）
- 消失挂单时刷新持仓快照
- 买单成交不翻转 side（保持 `buy`，持多头）
- 卖单成交直接 `state='empty'`

---

## 8. 止损检测 checkAndExecuteStopLoss

**文件**: `trader/auto_trader_grid.go:1791-1851`

```go
func checkAndExecuteStopLoss():
    if StopLossPct <= 0: return  // 未配置止损

    获取当前价格

    遍历所有层级:
        if state != "filled" || PositionEntry <= 0: continue

        // 计算亏损百分比
        if side == "buy":  // 多头: 价格跌=亏
            lossPct = (PositionEntry - currentPrice) / PositionEntry × 100
        else:               // 空头: 价格涨=亏
            lossPct = (currentPrice - PositionEntry) / PositionEntry × 100

        if lossPct >= StopLossPct:
            if side == "buy":
                trader.CloseLong(symbol, PositionSize)
            else:
                trader.CloseShort(symbol, PositionSize)

            state = "stopped"
            realizedLoss = -lossPct × AllocatedUSD / 100
            DailyPnL += realizedLoss
            TotalProfit += realizedLoss
```

**⚠️ 注意**：止损 side 判断 — `side === 'buy'` 表示持多头，用 `CloseLong`。HOOT 之前有 Bug 把 side 搞反了（2026-03-06 修复）。

---

## 9. 简单突破检测 checkBreakout

**文件**: `trader/auto_trader_grid.go:98-130`

```go
func checkBreakout() (BreakoutType, float64):
    currentPrice = GetMarketPrice(symbol)
    upper, lower = gridState 边界

    if currentPrice > upper:
        breakoutPct = (currentPrice - upper) / upper × 100
        return BreakoutUpper, breakoutPct

    if currentPrice < lower:
        breakoutPct = (lower - currentPrice) / lower × 100
        return BreakoutLower, breakoutPct

    return BreakoutNone, 0
```

### handleBreakout

**文件**: `trader/auto_trader_grid.go:256-283`

```
breakoutPct ≥ 2%:
  → cancelAllGridOrders()
  → isPaused = true
  → return error（本轮跳过AI）

breakoutPct ≥ 1%:
  → 记录日志，让AI决定是否调整
```

---

## 10. 箱体突破检测 checkBoxBreakout

### 10.1 三层检测

**文件**: `trader/grid_regime.go:97-130`

```go
func detectBoxBreakout(box *BoxData) (BreakoutLevel, direction):
    // 优先级: Long > Mid > Short
    if price > LongUpper:  return BreakoutLong, "up"
    if price < LongLower:  return BreakoutLong, "down"
    if price > MidUpper:   return BreakoutMid, "up"
    if price < MidLower:   return BreakoutMid, "down"
    if price > ShortUpper: return BreakoutShort, "up"
    if price < ShortLower: return BreakoutShort, "down"
    return BreakoutNone, ""
```

### 10.2 确认机制

**文件**: `trader/grid_regime.go:136-168`

```go
const BreakoutConfirmRequired = 3  // 需要3根K线确认

func confirmBreakout(state, currentLevel, direction):
    if currentLevel == None:
        reset state → return false  // 价格回箱，重置

    if same level & direction:
        state.ConfirmCount++
    else:
        reset to new breakout, count=1

    return ConfirmCount >= 3
```

### 10.3 突破动作映射

**文件**: `trader/grid_regime.go:184-196`

| 突破级别 | 动作 | 说明 |
|---------|------|------|
| `BreakoutShort` | `ReducePosition` | 仓位缩减到50% |
| `BreakoutMid` | `PauseGrid` | 暂停网格 + 撤单 |
| `BreakoutLong` | `CloseAll` | 暂停 + 撤单 + 全平 |

### 10.4 完整流程

**文件**: `trader/auto_trader_grid.go:286-346`

```
checkBoxBreakout():
│
├── 获取箱体数据 market.GetBoxData(symbol)
├── 更新 gridState 的6个边界值
├── detectBoxBreakout(box) → level, direction
├── confirmBreakout(state, level, direction) → confirmed?
│
├── 如果启用方向自适应:
│   └── BreakoutActionAdjustDirection → determineGridDirection → executeDirectionAdjustment
│
└── 未启用方向自适应:
    └── executeBreakoutAction(action)
        ├── ReducePosition: PositionReductionPct = 50
        ├── PauseGrid: isPaused=true + cancelAllOrders
        └── CloseAll: isPaused=true + cancelAllOrders + closeAllPositions
```

---

## 11. 虚假突破恢复 checkFalseBreakoutRecovery

**文件**: `trader/auto_trader_grid.go:446-500`

```go
func checkFalseBreakoutRecovery():
    // 仅在有突破记录 / 仓位缩减 / 暂停 / 方向偏移 时检查
    if 不需要恢复: return

    获取当前箱体数据

    // 价格回到长期箱体内
    if price >= LongLower && price <= LongUpper:
        BreakoutLevel = "none"
        BreakoutDirection = ""
        BreakoutConfirmCount = 0
        PositionReductionPct = 50  // ⚠️ 恢复时先用50%仓位
        IsPaused = false

    // 方向恢复（如果启用）
    if EnableDirectionAdjust && direction != neutral:
        if 价格回到短期箱体内:
            // 逐步恢复: long → long_bias → neutral ← short_bias ← short
            adjustGridDirection(newDirection)
```

**恢复路径**：
```
long → long_bias → neutral ← short_bias ← short
```

---

## 12. 方向自适应

### 12.1 方向类型

**文件**: `market/types.go:233-262`

| 方向 | 买卖比 | 说明 |
|------|--------|------|
| `neutral` | 50%/50% | 默认 |
| `long` | 100%/0% | 全部做多 |
| `short` | 0%/100% | 全部做空 |
| `long_bias` | 70%/30% | 偏多 |
| `short_bias` | 30%/70% | 偏空 |

### 12.2 方向决定逻辑

**文件**: `trader/grid_regime.go:212-248`

```go
func determineGridDirection(box, currentDirection, breakoutLevel, direction):
    switch breakoutLevel:
    case BreakoutShort:
        if direction == "up": return LongBias
        return ShortBias
    case BreakoutMid:
        if direction == "up": return Long
        return Short
    case BreakoutLong:
        return currentDirection  // 交给紧急处理
    case BreakoutNone:
        return determineRecoveryDirection()  // 逐步恢复
```

### 12.3 层级方向分配

**文件**: `trader/auto_trader_grid.go:643-727`

```
applyGridDirection(currentPrice):
│
├── neutral: 价格以下=buy, 以上=sell
├── long: 全部=buy
├── short: 全部=sell
└── long_bias/short_bias:
    targetBuyLevels = totalLevels × buyRatio
    按价格位置和配额分配
```

**⚠️ HOOT 设计选择**：方向自适应逻辑已删除（2026-03-06），改由 AI 通过 `pause_grid` 处理趋势市场。

---

## 13. AI 提示词系统

### 13.1 System Prompt（系统提示词）

**文件**: `kernel/grid_engine.go:104-206`

**中文版** (`lang="zh"`):

```
# 你是一个专业的网格交易AI

## 角色定义
你是一个经验丰富的网格交易专家，负责管理 {symbol} 的网格交易策略。

## 网格配置
- 交易对/层数/总投资/杠杆/价格分布

## 决策规则
### 市场状态判断
- 震荡市场（适合网格）: 布林带宽度 < 3%, EMA距离 < 1%
- 趋势市场（暂停网格）: 布林带宽度 > 4%, EMA距离 > 2%
- 高波动市场（谨慎）: ATR异常放大

### 可执行的操作
- place_buy_limit / place_sell_limit
- cancel_order / cancel_all_orders
- pause_grid / resume_grid
- adjust_grid / hold
- close_long / close_short

## 输出格式
JSON数组，每个决策包含:
symbol, action, price, quantity, level_index, order_id, confidence, reasoning
```

### 13.2 User Prompt（用户提示词）

**文件**: `kernel/grid_engine.go:216-325`

分为7个段：

```
## 当前时间: {time}

## 市场数据
- 当前价格, 1h/4h涨跌
- ATR14（绝对值+百分比）
- 布林带（上轨/中轨/下轨/宽度）
- EMA20, EMA50, 距离%
- RSI14, MACD/Signal/Histogram
- 资金费率

## 箱体指标（唐奇安通道）
| 箱体级别 | 上轨 | 下轨 | 宽度 |
| 短期(3天) | ... | ... | ...% |
| 中期(10天) | ... | ... | ...% |
| 长期(21天) | ... | ... | ...% |
+ 突破警告

## 账户状态
- 总权益, 可用余额, 当前持仓, 未实现盈亏

## 网格状态
- 范围, 间距, 活跃订单数, 成交层数, 暂停状态, 方向

## 网格层级详情
| 层级 | 价格 | 状态 | 方向 | 订单数量 | 持仓数量 | 未实现盈亏 |
（每层一行）

## 绩效统计
- 总利润, 交易次数, 胜率, 最大回撤, 今日盈亏

## 请分析以上数据，做出网格交易决策
输出JSON数组格式的决策列表。
```

### 13.3 决策解析

**文件**: `kernel/grid_engine.go:489-550`

```go
// 从AI响应中提取JSON数组
func parseGridDecisions(response, symbol):
    jsonStr = extractJSONArray(response)
    // 先尝试 ```json 代码块
    // 再尝试原始 JSON 数组

    json.Unmarshal(jsonStr, &decisions)

    // 验证 action 合法性
    validActions = {
        "place_buy_limit", "place_sell_limit",
        "cancel_order", "cancel_all_orders",
        "pause_grid", "resume_grid",
        "adjust_grid", "hold",
        "open_long", "open_short",
        "close_long", "close_short",
    }
```

### 13.4 AI 调用流程

**文件**: `kernel/grid_engine.go:443-486`

```go
func GetGridDecisions(ctx, mcpClient, config, lang):
    systemPrompt = BuildGridSystemPrompt(config, lang)
    userPrompt = BuildGridUserPrompt(ctx, lang)

    response = mcpClient.CallWithMessages(systemPrompt, userPrompt)

    decisions = parseGridDecisions(response, symbol)

    // 解析失败时的 fallback
    if err:
        decisions = [{action: "hold", confidence: 50, reasoning: "解析失败"}]

    return FullDecision{
        SystemPrompt, UserPrompt, CoTTrace,
        Decisions, RawResponse,
        AIRequestDurationMs, Timestamp,
    }
```

---

## 14. AI 决策执行

### 14.1 executeGridDecision

**文件**: `trader/auto_trader_grid.go:936-966`

```go
switch d.Action:
    "place_buy_limit"  → placeGridLimitOrder(d, "BUY")
    "place_sell_limit"  → placeGridLimitOrder(d, "SELL")
    "cancel_order"      → cancelGridOrder(d)
    "cancel_all_orders" → cancelAllGridOrders()
    "pause_grid"        → pauseGrid(reason)  // 撤单+暂停
    "resume_grid"       → resumeGrid()
    "adjust_grid"       → adjustGrid(d)  // 撤单+重新初始化
    "hold"              → log only
    "close_long"        → trader.CloseLong(symbol, quantity)
    "close_short"       → trader.CloseShort(symbol, quantity)
```

### 14.2 Decision 数据结构

**文件**: `kernel/engine.go` (Decision 类型定义在 engine.go 中)

```go
type Decision struct {
    Symbol          string  `json:"symbol"`
    Action          string  `json:"action"`
    Price           float64 `json:"price"`
    Quantity        float64 `json:"quantity"`
    LevelIndex      int     `json:"level_index"`
    OrderID         string  `json:"order_id"`
    Confidence      int     `json:"confidence"`
    Reasoning       string  `json:"reasoning"`
    PositionSizeUSD float64 `json:"position_size_usd"`
    Leverage        int     `json:"leverage"`
    StopLoss        float64 `json:"stop_loss"`
    TakeProfit      float64 `json:"take_profit"`
}
```

---

## 15. 下单逻辑 placeGridLimitOrder

**文件**: `trader/auto_trader_grid.go:1010-1104`

```
placeGridLimitOrder(decision, side):
│
├── 1. 获取 GridTrader 接口（或适配器）
│
├── 2. ⚠️ 数量验证与上限
│   ├── 每层最大保证金 = TotalInvestment / GridCount
│   ├── 每层最大仓位 = maxMarginPerLevel × Leverage
│   ├── 最大数量 = maxPositionValue / price
│   │
│   ├── 如果有 AllocatedUSD:
│   │   └── levelMaxQty = AllocatedUSD × Leverage / price
│   │       取两者最小值
│   │
│   ├── 如果 quantity > maxQuantityPerLevel:
│   │   └── cap 到 maxQuantityPerLevel
│   │
│   └── 绝对安全阈值: positionValue > TotalInvestment × Leverage × 2
│       └── 拒绝订单
│
├── 3. ⚠️ 总仓位限制检查
│   └── checkTotalPositionLimit(symbol, orderValue)
│       allowed = currentValue + pendingValue + orderValue ≤ TotalInvestment × Leverage
│
├── 4. 构造限价单请求
│   LimitOrderRequest{
│       Symbol, Side, Price, Quantity,
│       Leverage: config.Leverage,
│       PostOnly: config.UseMakerOnly,
│       ClientID: "grid-{levelIndex}-{nanoTimestamp}"
│   }
│
├── 5. 调用 PlaceLimitOrder()
│
└── 6. 更新层级状态
    level.State = "pending"
    level.OrderID = result.OrderID
    level.OrderQuantity = quantity
    OrderBook[OrderID] = levelIndex
```

**⚠️ 关键**:
- **禁止覆盖层价格**: `finalLevel.price = price` 这行在 HOOT 中已删除（2026-03-11 Bug）
- 数量验证三层防护: 层级限制 → 总仓位限制 → 绝对安全阈值

---

## 16. 仓位上限检查

### 16.1 总仓位限制

**文件**: `trader/auto_trader_grid.go:968-1008`

```go
func checkTotalPositionLimit(symbol, additionalValue):
    maxTotal = TotalInvestment × Leverage

    // 实际持仓 = exchange position × price
    currentPositionValue = abs(size) × markPrice

    // pending 订单也计入
    pendingValue = Σ(pending层的 qty × price)

    totalAfterOrder = currentValue + pendingValue + additionalValue
    allowed = totalAfterOrder ≤ maxTotal
```

### 16.2 非网格模式的仓位控制

**文件**: `trader/auto_trader_risk.go:185-217`

```go
// BTC/ETH: 最大 5x equity
// Altcoin: 最大 1x equity
maxPositionValue = equity × maxPositionValueRatio
if positionSize > maxPositionValue: cap
```

---

## 17. 网格偏斜自动调整

**文件**: `trader/auto_trader_grid.go:1334-1480`

```
autoAdjustGrid():
│
├── 检查偏斜 checkGridSkew()
│   ├── 一侧 filled > 3× 另一侧 且 >5 → skewed
│   └── 一侧全部filled，另一侧全empty且>5 → skewed
│
├── 检查价格偏移
│   └── |price - midPrice| > gridRange × 30% 才调整
│
├── cancelAllGridOrders()
│
├── 重新计算边界（ATR或默认）
├── 重新计算间距
├── initializeGridLevelsLocked()（重建层级）
│
└── 恢复 filled 仓位
    └── 对每个历史 filled 层，找最近的新层映射
        closestIdx = argmin(|newLevel.Price - filledLevel.PositionEntry|)
        恢复 state/PositionEntry/PositionSize/UnrealizedPnL
```

---

## 18. 风控系统

### 18.1 最大回撤检查

**文件**: `trader/auto_trader_grid.go:132-182`

```go
func checkMaxDrawdown():
    currentEquity = GetBalance()
    if currentEquity > PeakEquity: PeakEquity = currentEquity
    drawdown = (PeakEquity - currentEquity) / PeakEquity × 100
    return drawdown >= MaxDrawdownPct  // 默认15%
```

### 18.2 日损限额

**文件**: `trader/auto_trader_grid.go:186-210`

```go
func checkDailyLossLimit():
    // 跨日重置
    if 新的一天: DailyPnL = 0

    if DailyPnL < 0:
        dailyLossPct = (-DailyPnL) / TotalInvestment × 100
    return dailyLossPct >= DailyLossLimitPct  // 默认10%
```

### 18.3 紧急退出

**文件**: `trader/auto_trader_grid.go:221-253`

```go
func emergencyExit(reason):
    1. cancelAllGridOrders()
    2. 获取所有持仓
    3. 遍历平仓（多头CloseLong, 空头CloseShort）
    4. isPaused = true
```

### 18.4 回撤监控（独立goroutine）

**文件**: `trader/auto_trader_risk.go:11-107`

```go
// 每分钟检查一次持仓回撤
// 条件: 利润 > 5% 且 从峰值回撤 >= 40%
// 动作: emergencyClosePosition
```

### 18.5 仓位大小限制

**文件**: `trader/auto_trader_orders.go:80-99`

```go
// 保证金因子
marginFactor = 1.01/leverage + 0.001
maxAffordable = availableBalance / marginFactor
if positionSize > maxAffordable:
    actualSize = maxAffordable × 0.98  // 留2%缓冲
```

---

## 19. 数据持久化

### 19.1 数据库模型

**文件**: `store/grid.go`

| 表 | 用途 |
|---|------|
| `grid_configs` | 网格配置（永久） |
| `grid_instances` | 网格实例运行状态 |
| `grid_levels` | 每层状态快照 |

### 19.2 决策记录

**文件**: `trader/auto_trader_grid.go:1277-1324`

每轮保存:
```go
DecisionRecord{
    TraderID, CycleNumber, Timestamp,
    SystemPrompt, InputPrompt (UserPrompt),
    CoTTrace, RawResponse,
    DecisionJSON, AIRequestDurationMs,
    Decisions[]{ Action, Symbol, Quantity, Price, Reasoning, Success },
    ExecutionLog[],
}
```

### 19.3 权益快照

**文件**: `trader/auto_trader_decision.go:15-33`

```go
EquitySnapshot{
    TraderID, Timestamp,
    TotalEquity, Balance, UnrealizedPnL,
    PositionCount, MarginUsedPct,
}
```

---

## 20. Regime 分级系统

**文件**: `trader/grid_regime.go:16-90`

### 20.1 分级规则

```go
func classifyRegimeLevel(bollingerWidth, atr14Pct):
    Narrow:   BollWidth < 2%  && ATR < 1%   → 窄幅震荡
    Standard: BollWidth ≤ 3%  && ATR ≤ 2%   → 标准震荡
    Wide:     BollWidth ≤ 4%  && ATR ≤ 3%   → 宽幅震荡
    Volatile: BollWidth > 4%  || ATR > 3%   → 剧烈波动
```

### 20.2 Regime 对应的杠杆/仓位限制

| Regime | 杠杆限制 | 仓位限制 |
|--------|---------|---------|
| Narrow | 2x | 40% |
| Standard | 4x | 70% |
| Wide | 3x | 60% |
| Volatile | 2x | 40% |

---

## 21. 关键配置参数

### 21.1 AI 配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| AIProvider | deepseek | AI提供商 |
| AIModel | deepseek-chat | 模型名 |
| lang | en | 提示词语言 zh/en |

### 21.2 网格配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| GridCount | 10 | 网格层数 |
| Leverage | 5 | 杠杆 |
| Distribution | gaussian | 资金分布 |
| UseATRBounds | true | ATR自动边界 |
| ATRMultiplier | 2.0 | ATR乘数 |
| UseMakerOnly | true | PostOnly |
| OrderRefreshSec | 300 | 刷新间隔 |

### 21.3 风控配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| MaxDrawdownPct | 15 | 最大回撤% |
| StopLossPct | 5 | 止损% |
| DailyLossLimitPct | 10 | 日损% |
| MaxPositionSizePct | 30 | 仓位上限% |

### 21.4 箱体配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| ShortBoxPeriod | 72 | 短期箱体(3天,1h K) |
| MidBoxPeriod | 240 | 中期箱体(10天) |
| LongBoxPeriod | 500 | 长期箱体(21天) |
| BreakoutConfirmRequired | 3 | 确认K线数 |

---

## 附录A: HOOT vs nofx 已知差异

| 功能 | nofx | HOOT | 说明 |
|------|------|------|------|
| 方向自适应 | 有（EnableDirectionAdjust） | **已删除** | AI 通过 pause_grid 处理 |
| syncOrderFills | 主循环末尾（syncGridState） | 主循环末尾 | 已对齐 |
| 买单成交 side | 保持 "buy" | 保持 "buy" | 已对齐 |
| 卖单成交 | state="empty" | state="empty" | 已对齐 |
| OKX net_mode | 未特殊处理 | side='net' 兼容 | HOOT 增强 |
| 孤儿持仓检测 | 无 | **有** | HOOT 增强 |
| 消失挂单刷新 | 无 | **有** | HOOT 增强 |

## 附录B: 关键代码行号速查

> 以下行号基于当前 nofx 代码版本（2026-03-13 快照）

### trader/auto_trader_grid.go (56K)

| 行号 | 函数/结构 |
|------|---------|
| L20-73 | `GridState` 结构定义 |
| L76-83 | `NewGridState()` |
| L98-130 | `checkBreakout()` |
| L132-182 | `checkMaxDrawdown()` |
| L186-210 | `checkDailyLossLimit()` |
| L221-253 | `emergencyExit()` |
| L256-283 | `handleBreakout()` |
| L286-346 | `checkBoxBreakout()` |
| L349-386 | `executeBreakoutAction()` |
| L389-407 | `executeDirectionAdjustment()` |
| L446-500 | `checkFalseBreakoutRecovery()` |
| L508-558 | `InitializeGrid()` |
| L560-566 | `calculateDefaultBounds()` |
| L569-588 | `calculateATRBounds()` |
| L591-639 | `initializeGridLevels()` |
| L643-727 | `applyGridDirection()` |
| L730-756 | `adjustGridDirection()` |
| L758-868 | **`RunGridCycle()`** 主循环 |
| L871-933 | `buildGridContext()` |
| L936-966 | `executeGridDecision()` |
| L968-1008 | `checkTotalPositionLimit()` |
| L1010-1104 | **`placeGridLimitOrder()`** |
| L1107-1131 | `cancelGridOrder()` |
| L1134-1155 | `cancelAllGridOrders()` |
| L1158-1167 | `pauseGrid()` |
| L1170-1177 | `resumeGrid()` |
| L1180-1197 | `adjustGrid()` |
| L1200-1274 | **`syncGridState()`** 成交检测 |
| L1277-1324 | `saveGridDecisionRecord()` |
| L1334-1375 | `checkGridSkew()` |
| L1378-1480 | `autoAdjustGrid()` |
| L1637-1788 | `GetGridRiskInfo()` |
| L1791-1851 | **`checkAndExecuteStopLoss()`** |

### trader/grid_regime.go (9.4K)

| 行号 | 函数 |
|------|------|
| L16-34 | `classifyRegimeLevel()` |
| L37-62 | `getRegimeLeverageLimit()` |
| L65-90 | `getRegimePositionLimit()` |
| L97-130 | `detectBoxBreakout()` |
| L136-168 | `confirmBreakout()` |
| L184-196 | `getBreakoutAction()` |
| L212-248 | `determineGridDirection()` |
| L252-278 | `determineRecoveryDirection()` |
| L282-301 | `getBreakoutActionWithDirection()` |
| L304-312 | `shouldRecoverDirection()` |

### kernel/grid_engine.go (23K)

| 行号 | 函数 |
|------|------|
| L19-30 | `GridLevelInfo` 结构 |
| L33-90 | `GridContext` 结构 |
| L97-102 | `BuildGridSystemPrompt()` |
| L104-153 | `buildGridSystemPromptZh()` |
| L157-206 | `buildGridSystemPromptEn()` |
| L209-214 | `BuildGridUserPrompt()` |
| L216-325 | `buildGridUserPromptZh()` |
| L327-436 | `buildGridUserPromptEn()` |
| L443-486 | `GetGridDecisions()` AI调用 |
| L489-513 | `parseGridDecisions()` |
| L516-530 | `extractJSONArray()` |
| L533-550 | `isValidGridAction()` |
| L557-610 | `BuildGridContextFromMarketData()` |

### market/data.go (38K)

| 行号 | 函数 |
|------|------|
| L34-125 | `getKlinesFromCoinAnk()` |
| L128-166 | `getKlinesFromHyperliquid()` |
| L169-282 | `Get()` / `GetWithExchange()` |
| L288-397 | `GetWithTimeframes()` |
| L400-482 | `calculateTimeframeSeries()` |
| L552-571 | `calculateEMA()` |
| L574-585 | `calculateMACD()` |
| L588-629 | `calculateRSI()` |
| L632-663 | `calculateATR()` |
| L667-693 | `calculateBOLL()` |

### market/types.go

| 行号 | 类型 |
|------|------|
| L6-20 | `Data` 市场数据主结构 |
| L33-48 | `TimeframeSeriesData` |
| L50-54 | `OIData` |
| L56-65 | `IntradayData` |
| L67-77 | `LongerTermData` |
| L192-207 | `BoxData` 箱体数据 |
| L210-218 | `RegimeLevel` 常量 |
| L222-228 | `BreakoutLevel` 常量 |
| L233-239 | `GridDirection` 常量 |
| L243-262 | `GetBuySellRatio()` |

---

> 本文档覆盖 nofx 网格策略的**全部核心逻辑**，可直接作为 HOOT TS 移植参考。
> 对于具体代码实现细节，请直接 `Read` 对应文件和行号。
