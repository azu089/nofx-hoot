# nofx 极速策略对齐日志

> 创建日期：2026-03-24
> 目的：防止跨轮次/跨会话遗忘，记录每轮对比发现和修复内容

---

## 对齐背景与规则

PM 要求：极速策略 bug 太多、逻辑混乱，需逐文件对齐 nofx 参考实现。

**对齐原则**：
1. 逐文件对比，每轮只改 1 个维度
2. HOOT 商业差异（多租户/BYOK/三模式/9层安全检查等）标记为例外，不对齐
3. PM 已确认的刻意差异：最近交易从交易所 getClosedPnl 获取（替代 nofx DB 10条）、条件单从交易所 getStopOrders 获取
4. 注意检查：信息是否重复调用、数据来源是否不统一

**nofx 参考文件**（路径 `reference/nofx/`）：
- `trader/auto_trader_loop.go` — 主循环 runCycle + buildTradingContext
- `trader/auto_trader_orders.go` — 开仓/平仓执行 + CODE ENFORCED 检查
- `trader/auto_trader_risk.go` — 回撤监控 + enforceMaxPositions/MinSize/ValueRatio
- `trader/auto_trader_decision.go` — 权益快照 saveEquitySnapshot + 订单确认 recordAndConfirmOrder + 持仓变更 recordPositionChange
- `kernel/grid_engine.go` — Prompt 构建（BuildGridSystemPrompt / BuildGridUserPrompt）

**HOOT 极速策略文件**：
- `apps/api/src/modules/ai/services/trading/auto-trader.service.ts` — 主循环（2841行）
- `apps/api/src/modules/ai/services/ai-execution.service.ts` — 决策执行（1052行）
- `apps/api/src/modules/ai/processors/drawdown-monitor.processor.ts` — 回撤监控
- `apps/api/src/modules/ai/services/trading/quick-analysis.service.ts` — 市场分析 + LLM（1183行）
- `apps/api/src/modules/ai/services/trading/prompt-builder.service.ts` — Prompt 构建（681行）
- `apps/api/src/modules/ai/services/trading/strategy-engine.service.ts` — 策略管理（1173行）
- `apps/api/src/modules/ai/constants/trading-prompts.ts` — 提示词常量（1480行）
- `apps/api/src/modules/ai/types/ai.types.ts` — 类型定义（319行）

---

## 对齐总览

| 轮次 | 对比维度 | nofx 参考文件 | HOOT 对应文件 | 关键检查点 | 状态 |
|------|---------|-------------|-------------|-----------|------|
| 1 | 主循环流程 | auto_trader_loop.go | auto-trader.service.ts | 10步顺序、buildContext数据采集、决策排序、数据源统一、重复调用 | ✅ 6 bug |
| 2 | 下单执行 | auto_trader_orders.go | ai-execution.service.ts | CODE ENFORCED 3项、余额自适应公式、重复持仓检查、平仓fallback | ✅ 5 bug |
| 3 | 风控监控 | auto_trader_risk.go | drawdown-monitor.processor.ts | 回撤触发条件(>5%且>=40%)、peakPnL缓存、adapter泄漏 | ✅ 3 bug |
| 4 | 决策记录 | auto_trader_decision.go | auto-trader.service.ts (aiStrategyLog 写入) | 权益快照、AI耗时、候选币、失败场景日志 | ✅ 4 bug |
| 5 | Prompt 构建 | kernel/engine.go BuildSystemPrompt + BuildUserPrompt | prompt-builder.service.ts | SystemPrompt 8段 + UserPrompt 10段逐段对比 | ✅ 1 bug |
| 6 | 市场分析 | engine.go fetchMarketData + formatter.go | quick-analysis.service.ts + trading-prompts.ts | K线注入、多TF、OI过滤、数据源融合 | ✅ 1 bug + 2 TODO |
| 7 | 类型+常量+解析 | engine.go 类型+parseFullDecisionResponse | ai.types.ts + safety-defaults.ts + decision-parser.ts | 字段逐一、解析逐分支、验证逐条 | ✅ 2 bug |
| 8 | 提示词+Schema 复查 | kernel/schema.go + engine.go prompt 路径 | schema-dictionary.ts + prompt-builder.service.ts | Schema 字段逐条、TradingRules/OI/Mistakes、Margin 描述差异 | ✅ 0 bug（确认对齐） |
| 9 | 前端日志 | nofx DecisionRecord 全字段 | ai.ts 类型 + solo-log-card.tsx | accountSnapshot/AI耗时/候选币 前端同步 | ✅ 3 bug |

---

## 第 1 轮：主循环流程（2026-03-24，已完成）

### 发现的问题

| # | 问题 | 严重性 | 状态 |
|---|------|--------|------|
| 1 | Adapter 每周期创建 4-5 个实例 | 🔴 严重 | ✅ 已修复 |
| 2 | 余额获取 2 次（getFullBalance + getAvailableBalance） | 🔴 严重 | ✅ 已修复 |
| 3 | 订单簿同币种重复获取 | 🟡 中等 | ✅ 已修复 |
| 4 | 日回撤检查 2 次（不同数据源） | 🟡 中等 | ✅ 已修复 |
| 5 | 交易统计计算 2 次（不同时间窗口） | 🟡 中等 | ✅ 已修复 |
| 6 | 权益快照保存过晚 | 🟡 中等 | ✅ 已修复 |

### 修改的文件

| 文件 | 改动摘要 |
|------|---------|
| auto-trader.service.ts | 周期级 cycleAdapter + 余额/日回撤/统计/快照合并 |
| ai-execution.service.ts | getFullBalance/getAvailableBalance/executeDecision/closeAllStrategyPositions 加 existingAdapter 参数 |
| strategy-engine.service.ts | syncPositionsForUser 加 existingAdapter 参数 |

### HOOT 商业例外（不需要对齐）

- 多租户（userId/aiConfig/BYOK）、月度预算、Free/Pro 门控
- 熔断器、WebSocket 推送
- 三种模式（quick/debate/research）
- 9 层安全检查
- 交易所 getClosedPnl（替代 nofx DB 10 条）
- 交易所 getStopOrders（条件单注入 prompt）
- closedPnlSync 结尾同步
- coinScanner 多模式选币
- 策略级 maxPositions 隔离

### 修复后数据流

```
周期开始
  ├─ cycleAdapter = createAdapter()     ← 1 次创建
  ├─ syncPositionsForUser(cycleAdapter) ← 复用
  ├─ getFullBalance(cycleAdapter)       ← 1 次余额
  ├─ saveEquitySnapshot()               ← 提前（对齐 nofx）
  ├─ 日回撤检查                          ← 1 次（统一数据源）
  ├─ getStopOrders(cycleAdapter)        ← 复用
  ├─ getClosedPnl(cycleAdapter)         ← 复用
  ├─ tradingStats                       ← 1 次计算
  ├─ AI 决策
  ├─ executeDecision(cycleAdapter)      ← 复用
  ├─ closedPnlSync(cycleAdapter)        ← 复用
  └─ finally: cycleAdapter.dispose()    ← 1 次销毁
```

---

## 第 2 轮：下单执行（2026-03-24，已完成）

### 发现的问题

| # | 问题 | 严重性 | 状态 |
|---|------|--------|------|
| 1 | maxPositions 用 DB 计数（DB 脏数据误拦） | 🔴 严重 | ✅ 已修复：优先用交易所持仓数 |
| 2 | cancelAllOrders 误杀其他策略 SL/TP | 🔴 严重 | ✅ 已修复：删除（nofx 无此操作） |
| 3 | 平仓无交易所 fallback | 🟡 中等 | ✅ 已修复：DB 查不到→交易所 getPositions |
| 4 | 平仓用 DB amount 而非 0（平全部） | 🟡 中等 | ✅ 已修复：closeLong(symbol, 0) 对齐 nofx |
| 5 | 执行时又调 getBalance | 🟡 中等 | ✅ 已修复：通过 exchangeAvailableBalance 传入复用 |

### 修改的文件

| 文件 | 改动摘要 |
|------|---------|
| ai-execution.service.ts | AiDecision 加 exchangePositionCount/exchangeAvailableBalance；openPosition 优先用传入值；删除 cancelAllOrders；closePosition 加交易所 fallback + 用 0 平全部；position 为 null 时安全处理 |
| auto-trader.service.ts | executeDecision 调用传入 exchangePositionCount + exchangeAvailableBalance |

### HOOT 商业例外（保留不对齐）

- allocatedCapital 资金池、maxTradeAmountUSD 单笔上限
- 部分成交 <50% 中止检查
- SL/TP 3 次重试 + 降级软监控
- cancelStopOrders 平仓后清理
- BM25 记忆存储、Position DB 记录
- WebSocket + TG 通知、positionMonitor
- 交易成本核算（fees + funding）

### nofx 对齐确认

| 功能点 | nofx | HOOT（修复后） |
|--------|------|----------------|
| maxPositions 数据源 | exchange GetPositions().length | exchangePositionCount（外部传入交易所数据）✅ |
| 开仓前 cancelAllOrders | 无 | 已删除 ✅ |
| 仓位价值比 enforcePositionValueRatio | equity × ratio | allocatedCapital × ratio ✅（HOOT 商业） |
| 余额自适应 marginFactor | 1.01/lev + 0.001 × 0.98 | adaptPositionToBalance 同公式 ✅ |
| enforceMinPositionSize | 12 USDT | 用户可配置，默认 12 ✅ |
| SetMarginMode | 开仓前设置 | 开仓前设置 ✅ |
| SetStopLoss/TakeProfit | 1 次调用 | 3 次重试 + 降级 ✅（HOOT 增强） |
| 平仓量 | CloseLong(symbol, 0) 平全部 | closeLong(symbol, 0) ✅ |
| 平仓 DB 查不到 | fallback 交易所 | fallback 交易所 ✅ |

---

## 第 3 轮：风控监控（2026-03-24，已完成）

### 发现的问题

| # | 问题 | 严重性 | 状态 |
|---|------|--------|------|
| 1 | 主循环 adapter 泄漏（创建后未 dispose） | 🔴 严重 | ✅ 已修复：adapterCache + finally 统一 dispose |
| 2 | autoClosePosition 用 DB amount 而非 0 | 🟡 中等 | ✅ 已修复：closeLong(symbol, 0) 对齐 nofx |
| 3 | checkScaleOut/autoClosePosition 重复创建 adapter | 🟡 中等 | ✅ 已修复：接收外部 adapter 参数 |

### 修改的文件

| 文件 | 改动摘要 |
|------|---------|
| drawdown-monitor.processor.ts | adapterCache 统一管理；checkScaleOut/checkPeakDrawdown/autoClosePosition 接收外部 adapter；平仓量改 0；finally 统一 dispose |

### HOOT 商业例外（保留）

- 分批止盈（3%/5%/8%）、绝对亏损保护（-20%/-30%）
- peakPnlPercent DB 持久化（比 nofx 内存更健壮）
- TG 告警、WebSocket 推送

---

## 第 4 轮：决策记录（2026-03-24，已完成）

### 对比范围
- nofx: `auto_trader_decision.go` — saveEquitySnapshot / saveDecision / recordAndConfirmOrder / recordPositionChange
- HOOT: `auto-trader.service.ts` L2233-2271 — cycleDecisions[] → aiStrategyLog.create()
- HOOT: `ai-execution.service.ts` — openPosition → prisma.position.create / closePosition → prisma.position.update

### 发现的问题

| # | 问题 | 严重性 | 状态 |
|---|------|--------|------|
| 1 | 全部 AI 分析失败时不记录日志（前端看不到失败原因） | 🔴 严重 | ✅ 已修复：失败也写入 cycleDecisions |
| 2 | aiStrategyLog 缺少账户快照（accountSnapshot） | 🟡 中等 | ✅ 已修复：在 decision JSON 中嵌入 |
| 3 | aiStrategyLog 缺少 AI 调用耗时（aiRequestDurationMs） | 🟡 中等 | ✅ 已修复：在 decision JSON 中嵌入 |
| 4 | aiStrategyLog 缺少候选币列表（candidateCoins） | 🟢 低 | ✅ 已修复：在 decision JSON 中嵌入 |

### 修改的文件

| 文件 | 改动摘要 |
|------|---------|
| auto-trader.service.ts | 分析失败写入 cycleDecisions（Fix 4-1）；aiStrategyLog 补充 accountSnapshot/aiRequestDurationMs/candidateCoins（Fix 4-2） |

### nofx 对齐确认

| nofx 字段 | HOOT 对应 | 状态 |
|-----------|----------|------|
| AccountState (totalBalance/available/unrealizedPnl/positionCount) | decision.accountSnapshot | ✅ |
| AIRequestDurationMs | decision.aiRequestDurationMs | ✅ |
| CandidateCoins[] | decision.candidateCoins | ✅ |
| SystemPrompt / InputPrompt / CoTTrace / RawResponse | rawResponse / systemPrompt / userPrompt | ✅（已有） |
| DecisionJSON + Decisions[] | decision.allDecisions[] | ✅（已有） |
| 错误场景记录（success=false） | cycleDecisions 包含失败 | ✅ |
| recordAndConfirmOrder（poll 5次确认） | CCXT OrderResult 直接获取 | ✅ HOOT更优 |

### HOOT 商业例外（保留）

- 持仓记录方式：CCXT OrderResult 直接获取成交信息（比 nofx poll 5 次更高效）
- allDecisions 合并格式：一轮一条日志，含所有币种
- BM25 记忆存储（平仓时）
- TG/WebSocket 通知

---

## 第 5 轮：Prompt 构建（2026-03-25，已完成）

### 对比范围
- nofx 主路径: `kernel/engine.go` L1030-1413 — `BuildSystemPrompt()` (8段) + `BuildUserPrompt()` (10段)
- nofx 备用路径: `kernel/prompt_builder.go` — 旧版 prompt（action 枚举不同，已废弃）
- HOOT: `prompt-builder.service.ts` L201-681 — `buildSystemPrompt()` (8段) + `buildUserPrompt()` (10段)

### SystemPrompt 逐段对比结果

| 段落 | nofx | HOOT | 对齐 |
|------|------|------|------|
| S0 Schema 字段字典 | GetSchemaPrompt(lang) | getSchemaPrompt({...}) | ✅ |
| S1 角色定义 | promptSections.RoleDefinition | ps.role | ✅ |
| S2 模式变体 | aggressive/conservative/scalping | 同 | ✅ |
| S3 Hard Constraints | CODE ENFORCED + AI GUIDED + **Max Margin Usage** | 同 (**已补充** maxMarginUsage) | ✅ |
| S4 频率意识 | TradingFrequency + writeAvailableIndicators | buildFrequencyAwareness | ✅ |
| S5 入场标准 | EntryStandards + 指标列表 | 合并到 S4 | ✅ |
| S6 决策流程 | 3步 | 合并到 S4 | ✅ |
| S7 输出格式 | XML tags + JSON + 字段说明 | 同 | ✅ |
| S8 自定义 | CustomPrompt | ps.custom | ✅ |

### UserPrompt 逐段对比结果

| 段落 | nofx | HOOT | 对齐 |
|------|------|------|------|
| [1] 系统状态 | Time/Period/Runtime | 同 | ✅ |
| [1b] BTC 参考 | price/1h/4h/MACD/RSI | 同 | ✅ |
| [2] 账户信息 | 一行 | 多行 | ✅ 信息一致 |
| [2.5] 币种配置 | 无 | coinSourceMode | ✅ HOOT 增强 |
| [3] 近期交易 | 10条 | 10条（交易所获取） | ✅ |
| [4] 交易统计 | Stats + Performance hints | 同 + Win/Loss Ratio | ✅ |
| [5] 持仓 | formatPositionInfo 全字段 | 同 + positionMarketDataMap | ✅ |
| [5.1] 条件单 | 无 | stopOrders | ✅ HOOT 增强 |
| [5.3] 上轮决策 | 无 | lastDecisions | ✅ HOOT 增强 |
| [6] 候选币数据 | formatMarketData + QuantData | marketDataPrompt | ✅ |
| [7] 排名 | OI/NetFlow/Price | marketRankingPrompt | ✅ |
| [7.5-7.9] 增强 | 无 | 新闻/社媒/恐贪/记忆 | ✅ HOOT 增强 |
| [8] 流动性 | 无 | liquidityData | ✅ HOOT 增强 |

### 发现的问题

| # | 问题 | 严重性 | 状态 |
|---|------|--------|------|
| 1 | Hard Constraints 缺少 Max Margin Usage（nofx 有） | 🟡 中等 | ✅ 已修复：prompt-builder + 3处传参 |

### 修改的文件

| 文件 | 改动摘要 |
|------|---------|
| prompt-builder.service.ts | PromptConfig.riskControl 加 maxMarginUsage；buildHardConstraints 输出 Max Margin Usage 行 |
| auto-trader.service.ts | 3处 promptConfig 构建加 maxMarginUsage 传递 |

### 重要确认
- nofx `prompt_builder.go` 是**备用路径**（action: HOLD/PARTIAL_CLOSE/FULL_CLOSE/ADD_POSITION/OPEN_NEW/WAIT），非主路径
- nofx 主路径 `engine.go` 用 `open_long/open_short/close_long/close_short/hold/wait`，与 HOOT 一致
- HOOT 不应参考 prompt_builder.go 的 action 枚举

---

## 第 6 轮：市场数据采集（2026-03-25，已完成）

### 对比范围
- nofx: `kernel/engine.go` fetchMarketDataWithStrategy + `kernel/formatter.go` formatKlineData
- HOOT: `quick-analysis.service.ts` fetchMarketData + `trading-prompts.ts` formatMarketDataPrompt

### 发现的问题

| # | 问题 | 严重性 | 状态 |
|---|------|--------|------|
| 1 | **原始 K 线不注入 prompt** — AI 只看指标数字，看不到价格形态 | 🔴 重大 | ✅ 已修复：formatMarketDataPrompt 末尾注入 30 根 OHLCV |
| 2 | 副时间框架 OHLCV 未获取 | 🟡 中等 | ⏳ TODO：需确认 token 预算（2TF ≈ 600 token） |
| 3 | 无 OI 流动性过滤（nofx: minOIValue 15M USD） | 🟡 中等 | ⏳ TODO：coinScanner 已有自己的过滤逻辑 |

### 修改的文件

| 文件 | 改动摘要 |
|------|---------|
| trading-prompts.ts | formatMarketDataPrompt 末尾增加 K 线注入（30 根，对齐 nofx formatter.go） |
| quick-analysis.service.ts | analyze() + analyzeMultiCoin() 传入 ohlcv 参数 |

### nofx 对齐确认

| 数据维度 | nofx | HOOT（修复后） |
|----------|------|----------------|
| 原始 K 线 | 30 根 OHLCV 明文注入 | ✅ 30 根注入 |
| 技术指标 | 从 TimeframeData 提取 | ✅ indicators.calculateAll |
| OI / FR | 条件获取 | ✅ 并行获取 |
| 市场排名 | OIRanking + NetFlow + Price | ✅ nofxosRanking |
| BTC 参考 | MarketDataMap["BTCUSDT"] | ✅ 单独 fetchOHLCV |
| QuantData | 机构/散户资金流 | ✅ enhancedData |
| 新闻/社媒/恐贪/记忆 | 无 | ✅ HOOT 增强 |
| 流动性数据 | 无 | ✅ HOOT 增强 |

---

## 前 6 轮累计

| 轮次 | Bug | 关键修复 |
|------|-----|---------|
| 1 主循环 | 6 | adapter 复用、余额/回撤/统计去重 |
| 2 下单执行 | 5 | DB→交易所数据源、删 cancelAllOrders、平仓 fallback |
| 3 风控监控 | 3 | adapter 泄漏、平仓量、adapter 复用 |
| 4 决策记录 | 4 | 失败日志、accountSnapshot、AI 耗时 |
| 5 Prompt | 1 | maxMarginUsage |
| 6 市场分析 | 1+2TODO | **K 线注入**（最重大单项修复） |
| **合计** | **20 bug + 2 TODO** | |

---

## 第 7 轮：类型+常量+解析（2026-03-25，已完成）

### 对比范围
- nofx: `kernel/engine.go` Decision/FullDecision/Context 类型 + parseFullDecisionResponse + validateDecision
- HOOT: `ai.types.ts` AiTradeDecision/RiskControlConfig + `safety-defaults.ts` + `decision-parser.ts` parseDecisions/validateDecision

### Decision 字段逐一对比

| nofx 字段 | HOOT 字段 | 对齐 |
|-----------|----------|------|
| Symbol | symbol? | ✅ |
| Action (6种) | action: AiAction (6种) | ✅ 完全一致 |
| Leverage int | leverage: number | ✅ |
| PositionSizeUSD | positionSizeUSD? | ✅ |
| StopLoss | stopLoss: number\|null | ✅ |
| TakeProfit | takeProfit: number\|null | ✅ |
| Confidence int | confidence: number | ✅ |
| **RiskUSD** | **riskUsd?** | ✅ **已补充** |
| Reasoning | reasoning | ✅ |

### 解析函数逐分支对比

| 解析步骤 | nofx extractDecisions | HOOT parseDecisions | 对齐 |
|----------|----------------------|---------------------|------|
| 隐形字符移除 | removeInvisibleRunes | removeInvisible | ✅ |
| 中文标点修复 (16种) | fixMissingQuotes | fixChinesePunctuation | ✅ 完全一致 |
| `<decision>` 标签 | ✅ | ✅ | ✅ |
| ` ```json ``` ` 围栏 | ✅ | ✅ | ✅ |
| 裸 JSON 数组 | ✅ | ✅ | ✅ |
| 裸单对象 `{...}` | ❌ | ✅ (L3.5) | ✅ HOOT 更宽容 |
| 格式校验 (~, 千位) | validateJSONFormat | validateJSONFormat | ✅ 完全一致 |
| 安全回退 | wait + 摘要 | wait + action 频率 | ✅ HOOT 更智能 |
| Action 别名 (long→open_long) | ❌ | ✅ | ✅ HOOT 更宽容 |

### 验证函数逐规则对比

| 验证规则 | nofx validateDecision | HOOT validateDecision | 对齐 |
|----------|----------------------|----------------------|------|
| Action 合法性 | 6种 | 6种 | ✅ |
| Leverage > 0 | ✅ | ✅ | ✅ |
| Leverage clamp | maxLeverage | maxLeverage | ✅ |
| SL > 0 && TP > 0 | ✅ | ✅ | ✅ |
| SL/TP 方向 | long:SL<TP, short:SL>TP | 同 | ✅ |
| R/R ≥ 3.0 | 估算 entryPrice | currentPrice | ✅ HOOT 更准确 |
| MinPositionSize | $60 BTC/ETH, $12 山寨 | 同 | ✅ |
| PosValue ≤ equity×ratio | ✅ (解析层) | 执行层已覆盖 | ✅ |

### 常量对比

| 常量 | nofx | HOOT safety-defaults | 对齐 |
|------|------|---------------------|------|
| minPosSizeBTCETH | $60 | $60 | ✅ |
| minPosSizeAlt | $12 | $12 | ✅ |
| btcEthMaxRatio | 5.0 | 5.0 | ✅ |
| altMaxRatio | 1.0 | 1.0 | ✅ |
| minRiskRewardRatio | 3.0 | 3.0 | ✅ |

### 发现的问题

| # | 问题 | 严重性 | 状态 |
|---|------|--------|------|
| 1 | RiskControlConfig 缺少 btcEthMaxLeverage/altcoinMaxLeverage + maxMarginUsage + minRiskRewardRatio + minConfidence | 🟡 中等 | ✅ 已补充 |
| 2 | AiTradeDecision 缺少 riskUsd + decision-parser 不解析 risk_usd | 🟡 中等 | ✅ 已补充 |

### 修改的文件

| 文件 | 改动摘要 |
|------|---------|
| ai.types.ts | RiskControlConfig 补充 5 个缺失字段；AiTradeDecision 补充 riskUsd |
| decision-parser.ts | convertRawDecision 解析 risk_usd → riskUsd |

---

## 前 7 轮累计

| 轮次 | Bug | 关键修复 |
|------|-----|---------|
| 1 主循环 | 6 | adapter 复用、余额/回撤/统计去重 |
| 2 下单执行 | 5 | DB→交易所数据源、删 cancelAllOrders、平仓 fallback |
| 3 风控监控 | 3 | adapter 泄漏、平仓量、adapter 复用 |
| 4 决策记录 | 4 | 失败日志、accountSnapshot、AI 耗时 |
| 5 Prompt | 1 | maxMarginUsage |
| 6 市场分析 | 1+2TODO | K 线注入 prompt |
| 7 类型+解析 | 2 | riskUsd + 分类杠杆字段 |
| **合计** | **22 bug + 2 TODO** | |

---

## 第 8 轮：提示词+Schema 逐行复查（2026-03-25，已完成）

### 对比范围
- nofx: `kernel/schema.go` DataDictionary + TradingRules + OIInterpretation + CommonMistakes + GetSchemaPrompt
- nofx: `kernel/formatter.go` formatAccount/formatTradingStats/formatCurrentPositions/formatCandidateCoins
- HOOT: `schema-dictionary.ts` 同名结构 + `prompt-builder.service.ts` 各 section

### Schema 字段逐条对比

| 类别 | nofx 字段 | HOOT 字段 | 对齐 |
|------|----------|----------|------|
| **AccountMetrics** | Equity/Balance/PnL/Margin (4) | 同 (4) | ✅ 字段完全一致 |
| **TradeMetrics** | Entry/Exit/Profit/PnL%/HoldDuration (5) | 同 (5) | ✅ |
| **PositionMetrics** | UnrealizedPnL%/PeakPnL%/Drawdown/Leverage/Margin/LiqPrice (6) | 同 (6) | ✅ |
| **MarketData** | Volume/OI/OIChange (3) | 同 (3) + FundingRate/MarketRegime/LongShortRatio/TakerBuySell/LiquidationData/PutCallRatio/StablecoinFlow/ETFFlow (8) | ✅ HOOT 多 8 个增强字段 |

### Margin 描述关键差异（刻意修改，已确认正确）

| 路径 | 描述 | 原因 |
|------|------|------|
| nofx schema.go | `安全值<30%，危险值>70%` | 旧路径，会导致 AI 因 margin 高主动平仓 |
| nofx formatter.go | `if margin > 70% → ⚠️ 风险警告` | 旧路径同上 |
| nofx engine.go L1256 | 只展示数字，不加⚠️提示 | **新路径（主路径）** |
| HOOT | `系统在开仓时自动控制保证金上限，不需要因保证金使用率高而主动平仓` | ✅ 对齐 nofx 新路径 |

### OI 解读对比

| 场景 | nofx | HOOT | 对齐 |
|------|------|------|------|
| OI↑ + Price↑ | 强多头趋势 | 同 | ✅ |
| OI↑ + Price↓ | 强空头趋势 | 同 | ✅ |
| OI↓ + Price↑ | 空头平仓 | 同 | ✅ |
| OI↓ + Price↓ | 多头平仓 | 同 | ✅ |

### CommonMistakes 对比

| nofx (4条) | HOOT (4条) | 对齐 |
|------------|-----------|------|
| 混淆已实现/未实现 | 同 | ✅ |
| 忽略杠杆影响 | 同 | ✅ |
| 不理解 PeakPnL | 同 | ✅ |
| 忽略 OI 变化 | 同 | ✅ |

### TradingRules 差异（HOOT 刻意改进）

| 规则 | nofx | HOOT | 说明 |
|------|------|------|------|
| MaxMarginUsage | 30%（作为规则注入） | 已删除（保证金由代码层控制） | ✅ 对齐 engine.go 主路径 |
| ScaleOut | 固定 3%/5%/8% | ATR 倍数 1.5/2.5/4 | ✅ HOOT 改进（波动率自适应） |
| PositionSizeLimit | 15% 固定 | 已删除（由 Position Value Ratio 代码层控制） | ✅ 对齐 engine.go |

### 结论

**第 8 轮无新增 bug**。Schema 字段、OI 解读、CommonMistakes 完全一致。所有差异（Margin 描述、ScaleOut 公式、规则注入策略）均为刻意设计，已确认正确。

nofx 有两套 prompt 路径，HOOT 对齐的是 **engine.go 主路径**（不是 prompt_builder.go 备用路径，也不是 formatter.go 旧路径），这是正确的选择。

---

## 前 8 轮累计

| 轮次 | Bug | 关键修复 |
|------|-----|---------|
| 1 主循环 | 6 | adapter 复用、余额/回撤/统计去重 |
| 2 下单执行 | 5 | DB→交易所数据源、删 cancelAllOrders、平仓 fallback |
| 3 风控监控 | 3 | adapter 泄漏、平仓量、adapter 复用 |
| 4 决策记录 | 4 | 失败日志、accountSnapshot、AI 耗时 |
| 5 Prompt | 1 | maxMarginUsage |
| 6 市场分析 | 1+2TODO | K 线注入 prompt |
| 7 类型+解析 | 2 | riskUsd + 分类杠杆字段 |
| 8 Schema 复查 | 0 | 确认全部对齐 |
| **合计** | **22 bug + 2 TODO** | |

---

## 第 9 轮：前端日志（2026-03-25，已完成）

### 对比范围
- nofx: `auto_trader_loop.go` + `auto_trader_decision.go` 所有 logger 输出 + DecisionRecord 结构
- HOOT: `apps/web/src/types/ai.ts` StrategyLog + `solo-log-card.tsx` 日志卡片展示

### nofx DecisionRecord 字段 → 前端展示对比

| nofx 字段 | 用户可见 | HOOT 前端展示 | 状态 |
|-----------|---------|--------------|------|
| AccountState (equity/available/positionCount) | 调试 | ✅ **已补充** accountSnapshot | ✅ |
| AIRequestDurationMs | 调试 | ✅ **已补充** ⏱ Xs | ✅ |
| CandidateCoins[] | 调试 | ✅ **已补充** 🎯 BTC/SOL | ✅ |
| SystemPrompt | 展开可见 | ✅ systemPrompt（已有） | ✅ |
| UserPrompt | 展开可见 | ✅ userPrompt（已有） | ✅ |
| CoTTrace | 展开可见 | ✅ aiThinking（已有） | ✅ |
| RawResponse | 展开可见 | ✅ rawResponse（已有） | ✅ |
| DecisionJSON | 展示 | ✅ decision 对象（已有） | ✅ |
| Decisions[] 执行结果 | 展示 | ✅ allDecisions[]（已有） | ✅ |
| ExecutionLog[] 步骤日志 | 调试 | ❌ nofx 独有 | ✅ 非必要 |
| CycleNumber | 标识 | ❌ 不展示 | ✅ 非必要 |

### 发现的问题

| # | 问题 | 严重性 | 状态 |
|---|------|--------|------|
| 1 | 前端类型缺少 accountSnapshot（第 4 轮后端已写入但前端未同步） | 🔴 严重 | ✅ 已修复：ai.ts 补充字段 + solo-log-card 展示 |
| 2 | 前端类型缺少 aiRequestDurationMs | 🟡 中等 | ✅ 已修复：同上 |
| 3 | 前端类型缺少 candidateCoins | 🟢 低 | ✅ 已修复：同上 |

### 修改的文件

| 文件 | 改动摘要 |
|------|---------|
| apps/web/src/types/ai.ts | StrategyLog.decision 补充 accountSnapshot/aiRequestDurationMs/candidateCoins 类型 |
| apps/web/src/components/ui-v3/ai/timeline-cards/solo-log-card.tsx | AI 思考链后展示：耗时 + 权益 + 持仓数 + 日PnL + 候选币 |

---

## 第 9b 轮：深度对齐补充（2026-03-25）

### 发现的问题

| # | 问题 | 严重性 | 状态 |
|---|------|--------|------|
| 1 | **CoTTrace 拆分问题** — DeepSeek-Reasoner 的 `<reasoning>` 只有1句话，详细分析在 thinking 里，用户看不到 | 🔴 严重 | ✅ 已修复：analysis 字段统一取值（<reasoning> 太短时 fallback thinking） |
| 2 | **accountSnapshot 缺少 positions 快照** — nofx 每条记录附带完整持仓详情 | 🔴 严重 | ✅ 已修复：补充 positions[] 数组 |
| 3 | **accountSnapshot 缺少 marginUsedPct** | 🟡 中等 | ✅ 已修复 |

### 修改的文件

| 文件 | 改动摘要 |
|------|---------|
| quick-analysis.service.ts | analyze() + analyzeMultiCoin() 的 analysis 字段统一取值：`<reasoning>` 太短(<50字)时用 thinking 替代 |
| auto-trader.service.ts | accountSnapshot 补充 marginUsedPct + positions[] 持仓快照 |
| apps/web/src/types/ai.ts | accountSnapshot 类型同步 marginUsedPct + positions[] |

### CoTTrace 统一后各模型用户体验

| 模型 | 修复前 | 修复后 |
|------|--------|--------|
| DeepSeek-Chat | ✅ 200字分析 | ✅ 不变 |
| DeepSeek-Reasoner | ❌ 1句话 | ✅ 500字完整推理（从 thinking 填充） |
| GPT-4o / Qwen / Gemini | ✅ 200字分析 | ✅ 不变 |
| Claude | ✅ 200字分析 | ✅ 不变 |

---

## 全部对齐总结

| 轮次 | 维度 | Bug | 关键修复 |
|------|------|-----|---------|
| 1 | 主循环 | 6 | adapter 5→1、余额/回撤/统计/快照去重 |
| 2 | 下单执行 | 5 | DB→交易所数据源、删cancelAllOrders、平仓fallback+0 |
| 3 | 风控监控 | 3 | adapter泄漏、平仓量改0、adapter复用 |
| 4 | 决策记录 | 4 | 失败日志、accountSnapshot、AI耗时、候选币 |
| 5 | Prompt | 1 | maxMarginUsage注入prompt |
| 6 | 市场分析 | 1+2TODO | **K线注入prompt** |
| 7 | 类型+解析 | 2 | riskUsd解析、分类杠杆字段 |
| 8 | Schema复查 | 0 | 确认全部对齐 |
| 9 | 前端日志 | 3 | 前端类型+展示同步后端新字段 |
| 9b | 深度补充 | 3 | **CoTTrace统一**、positions快照、marginUsedPct |
| **合计** | | **28 bug + 2 TODO** | |

### 修改文件汇总（12 个文件）

| 文件 | 轮次 |
|------|------|
| auto-trader.service.ts | 1,2,4,5,9b |
| ai-execution.service.ts | 1,2 |
| strategy-engine.service.ts | 1 |
| drawdown-monitor.processor.ts | 3 |
| prompt-builder.service.ts | 5 |
| trading-prompts.ts | 6 |
| quick-analysis.service.ts | 6,9b |
| ai.types.ts | 7 |
| decision-parser.ts | 7 |
| apps/web/src/types/ai.ts | 9,9b |
| apps/web/src/components/ui-v3/ai/timeline-cards/solo-log-card.tsx | 9 |

## 第 10 轮：前端日志结构化展示（2026-03-25）

### PM 需求
用户看到的日志 = 账户状态（含持仓/盈亏/资金/历史） + 每币市场数据 + 每币完整分析 + "我决定..."第一人称决策

### 修改

| # | 改动 | 文件 | 效果 |
|---|------|------|------|
| 1 | **Prompt 输出格式**：每币 reasoning 从 1 句话→≥3 句（指标值+分析+我决定...） | prompt-builder.service.ts | AI 输出结构化的每币独立分析 |
| 2 | **allDecisions 补充 marketSnapshot**：每币市场数据快照写入 DB | auto-trader.service.ts | 前端可展示每币指标面板 |
| 3 | **前端 CoinReasoning 过滤修复**：删除误杀长文本的条件 | solo-log-card.tsx | 完整分析不被跳过 |
| 4 | **前端每币市场数据面板**：在每币 reasoning 上方展示指标行 | solo-log-card.tsx | 用户看到 AI 拿到的数据 |
| 5 | **aiThinking 顶层写入修复**：之前漏写 | auto-trader.service.ts | 调试思考链可见 |

### 修复后前端展示结构

```
┌── 账户状态 ──────────────────────────────────────┐
│ ⏱ 3.2s  💰 $1,234  📊 2仓  日PnL +5.32  🎯 BTC/SOL │
│
├── BTC ───────────────────────────────────────────┤
│ [观望]                                      45%  │ ← 动作+置信度
│ $96,432  RSI 45  MACD -0.003  ATR 1.2%  FR 0.001%│ ← marketSnapshot
│ 💡 EMA(7)<EMA(25)<EMA(99)空头排列，RSI(14)=45    │ ← 完整分析
│   中性偏弱。OI+1.3%配合价格下跌属空头主导。       │
│   R:R=1.86不足3:1。我决定观望，等RSI跌破30再做空。 │ ← 第一人称决策
│
├── SOL ───────────────────────────────────────────┤
│ [开多] 5x  $113保证金  $172.50  ×2.9        82%  │
│ $172.50  RSI 62  MACD +0.15  ATR 2.1%  OI +3.2% │
│ 💡 放量突破$170关键阻力，OI+3.2%多头主导。        │
│   EMA(7)>EMA(25)确认多头。我决定开多SOL，          │
│   5x$500，SL$160 TP$185，R:R=3.2:1。             │
│ ↓$160 (-7.2%)  ↑$185 (+7.2%)  1:3.2              │
│
├── AI 整体分析（折叠）──────────────────────────────┤
│ ▼ 综合BTC空头+SOL突破，资金从BTC流向山寨...        │
└──────────────────────────────────────────────────┘
```

### 修改文件汇总

| 文件 | 改动 |
|------|------|
| prompt-builder.service.ts | 输出格式：每币 reasoning ≥3句+指标值+"我决定..." |
| auto-trader.service.ts | allDecisions 补充 marketSnapshot + aiThinking 顶层写入 |
| solo-log-card.tsx | 删除 reasoning 误杀条件 + 每币市场数据面板 |

---

### 未解决 TODO（需 PM 确认）

1. **副时间框架 OHLCV 注入**：两个 TF 的 K 线 ≈ 600 token，需确认 LLM 成本预算
2. **OI 流动性过滤**：nofx 过滤 OI<15M USD 的币，HOOT coinScanner 有自己的过滤逻辑
