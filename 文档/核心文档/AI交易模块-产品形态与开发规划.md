# HOOT AI 交易模块 - 产品形态与开发规划

> 版本: v1.0 | 日期: 2026-02-10
> 状态: PM 已确认产品形态，准备实施

---

## 一、产品概述

HOOT AI 交易模块包含两个独立产品，分别移植自两个开源项目：

| | 产品 A：AI 研究团队 | 产品 B：AI 自动交易 |
|---|---|---|
| **模式** | 深研模式 | 快速交易模式 |
| **核心能力** | 多智能体深度研究 → 决策 | 策略配置 → 自动循环交易 |
| **触发方式** | 用户手动触发 | 自动周期运行 |
| **适合人群** | 想看 AI 怎么分析的用户 | 想让 AI 自动赚钱的用户 |

---

## 二、源项目事实（不可修改的基准）

### 深研模式原始实现

- **架构**: Python + LangGraph，7 个 AI agent，5 阶段流水线
- **使用方式**: CLI 手动触发，每次分析一个股票
- **输出**: BUY/SELL/HOLD 文本建议
- **不执行交易**: 没有调用任何交易所 API
- **无自动循环**: 分析完就结束
- **风控**: 三方辩论（激进/保守/中立），只给建议不拦截
- **记忆**: BM25 per-agent 历史检索
- **反思**: 交易后反思，存入记忆

### 快速交易模式实现

- **架构**: Go (Gin) + React，严格分策略设计
- **Strategy = AI 的"宪法"**: 用户配置币种来源、指标、风控、自定义 Prompt
- **两种决策模式**: Solo Trader（单 AI）/ Debate Arena（多 AI 辩论投票）
- **执行交易**: 有，通过 CCXT 直接执行（per-trader 独立管道）
- **自动循环**: 有，auto_trader 周期运行
- **双层风控**: 代码强制硬限制 + AI 引导软限制
- **竞赛模式**: 多 Trader 实时 ROI 排行榜
- **Grid 网格交易**: 独立策略类型
- **自学习**: Sharpe 分层 + 近期交易注入 prompt
- **策略市场**: 用户发布/订阅策略

---

## 三、产品 A：AI 研究团队

### 3.1 用户使用流程

```
用户进入"AI 研究"页面
    ↓
选择币种（如 BTC/USDT）
选择研究深度（快速1轮 / 标准3轮 / 深度5轮）
选择是否自动执行（开关）
    ↓
点击"开始研究"
    ↓
5 阶段流水线（实时展示进度和内容）：

  阶段1：4 个分析师并行研究
  ├─ 基本面分析师：链上数据、持仓量变化、资金流
  ├─ 情绪分析师：社交媒体情绪、恐惧贪婪指数
  ├─ 新闻分析师：近期重大事件、监管动态
  └─ 技术分析师：K线形态、指标信号、支撑阻力位

  阶段2：多头 vs 空头辩论
  ├─ 多头代理人：基于分析报告论证做多理由
  ├─ 空头代理人：论证做空/观望理由
  └─ 裁判：综合评估，给出初步倾向

  阶段3：交易员生成提案
  └─ 基于辩论结果，提出具体交易计划
     （方向、杠杆、仓位%、止损位、止盈位）

  阶段4：风控三方辩论
  ├─ 激进派：支持更大仓位、更高杠杆
  ├─ 保守派：建议缩小风险敞口
  ├─ 中立派：平衡评估
  └─ 裁判：给出最终风控调整意见

  阶段5：最终决策
  └─ 综合所有阶段，输出 BUY / SELL / HOLD
    ↓
展示完整研究报告（每个阶段的内容都可查看）
    ↓
├─ 自动执行已开启 → 直接调 CCXT 下单
└─ 自动执行未开启 → 用户手动点击"执行交易"
    ↓
交易完成后 → AI 反思（复盘本次决策质量）→ 存入记忆库
```

### 3.2 深研模式核心功能

| 功能 | 原始实现 | HOOT 实现 |
|------|---------|----------|
| 4 类分析师 | 4 个 LLM agent prompt | 4 个分析角色 |
| 多头/空头辩论 | 2 agent 对话 + judge | 辩论服务 |
| 风控三方辩论 | aggressive/conservative/neutral + judge | 风控辩论 |
| 研究深度配置 | max_debate_rounds 参数 | 用户可选 1/3/5 轮 |
| BM25 记忆 | per-agent 历史检索 | memory.service |
| 交易后反思 | reflection agent 生成教训 | 新增反思流程 |
| 多轮研究 | debate rounds 迭代 | 辩论轮次 |

### 3.3 HOOT 新增的能力（原项目没有）

| 功能 | 说明 |
|------|------|
| 交易执行 | 原项目只输出建议，HOOT 直接调 CCXT 执行 |
| 自动执行开关 | 用户可选研究后自动执行 |
| 实时进度展示 | WebSocket 推送每阶段进度 |
| 加密货币适配 | 原项目面向股票，HOOT 适配加密货币市场数据 |

### 3.4 用户看到的页面

| 页面 | 功能 |
|------|------|
| AI 研究入口 | 选币、选深度、自动执行开关、开始按钮 |
| 研究进度页 | 5 阶段实时展示（类似 ChatGPT 思考过程） |
| 研究报告页 | 完整报告 + 最终决策卡片 + 执行按钮 |
| 研究历史列表 | 所有历史研究记录，可查看详情 |

---

## 四、产品 B：AI 自动交易

### 4.1 用户使用流程

```
用户进入"AI 策略"页面
    ↓
点击"创建 AI 策略"（分步配置向导）：

  步骤1：币种来源
  ├─ 手动选择币种列表（如 BTC, ETH, SOL）
  ├─ 或启用 AI 推荐池（自动选币）
  ├─ 或启用 OI 排行榜（按持仓量变化选币）
  └─ 排除列表（不交易的币种）

  步骤2：技术指标（勾选启用）
  ├─ K线配置：主时间框架(5m) + 长时间框架(4h)
  ├─ EMA (20, 50)
  ├─ MACD
  ├─ RSI (7, 14)
  ├─ ATR (14)
  ├─ 布林带 (20)
  ├─ 成交量
  ├─ 持仓量 (OI)
  └─ 资金费率

  步骤3：风控参数
  ├─ 最大同时持仓数（默认3）
  ├─ BTC/ETH 最大杠杆（默认5x）
  ├─ 山寨币最大杠杆（默认5x）
  ├─ 最大保证金使用率（默认90%）
  ├─ 最小仓位 USDT（默认12）
  ├─ 最小风险回报比（默认3:1）
  └─ 最小置信度（默认75%）

  步骤4：交易模式
  ├─ Solo 模式：单个 AI 独立决策（快速，延迟低）
  └─ Debate 模式：多个 AI 辩论共识（稳健，准确率高）

  步骤5：确认并保存
    ↓
点击"启动策略"
    ↓
AI 自动循环运行（每个周期）：
  1. 获取市场数据（K线 + 用户勾选的指标）
  2. 检查现有持仓（是否需要止盈/止损/调仓）
  3. 扫描候选币种（根据币种来源配置）
  4. AI 决策（Solo 或 Debate 模式）
     ├─ Solo: 单 AI 分析 → 输出决策
     └─ Debate: 多 AI 各自分析 → 多轮辩论 → 投票共识
  5. 双层风控检查
     ├─ 代码强制：超过 maxPositions/maxLeverage → 直接拒绝
     └─ AI 引导：低于 minConfidence/minRR → 提示但不拦截
  6. 直接执行交易（不走队列，直接调 CCXT）
  7. 记录结果 → 更新 Sharpe → 触发进化调整
    ↓
用户随时可以：
  ├─ 暂停 / 恢复策略
  ├─ 查看实时持仓和 PnL
  ├─ 查看每次 AI 决策的思考过程
  ├─ 调整策略参数（不停策略即可热更新）
  └─ 查看策略性能统计（胜率、Sharpe、最大回撤）
```

### 4.2 快速交易模式核心功能

| 功能 | 快速模式原设计 | HOOT 实现 |
|------|-------------|----------|
| 策略配置体系 | StrategyConfig（20+ 字段） | AI 策略配置表 |
| 币种来源系统 | static/ai500/oi_top/mixed | 手动/AI推荐/OI排行 |
| 指标可配置 | 每个指标独立开关 | 勾选式指标配置 |
| 风控参数化 | maxPositions/maxLeverage/maxMargin 等 | 风控配置表单 |
| 自定义 Prompt | 角色定义/交易频率/入场标准/决策流程 | 高级用户可编辑 |
| Solo Trader | 单 AI 快速决策 | Solo 模式 |
| Debate Arena | 多 AI 辩论 + 加权投票共识 | Debate 模式 |
| 自动交易循环 | auto_trader 周期运行 | 定时任务调度 |
| 双层风控 | 代码强制 + AI 引导 | safety.service 扩展 |
| 自学习进化 | Sharpe 分层 + prompt 调整 | evolution.service |
| 竞赛模式 | 多 Trader ROI 排行榜 | 新增竞赛页面 |
| Grid 网格交易 | grid_trading 策略类型 | 新增 Grid 模式 |
| 策略市场 | 用户发布/订阅 | 扩展现有策略市场 |

### 4.3 Debate 模式的共识投票机制

```
示例：3 个 AI 对 BTC 的决策

AI-1（多头性格）: open_long   置信度=80  杠杆=10  仓位=30%
AI-2（空头性格）: open_short  置信度=60  杠杆=5   仓位=20%
AI-3（分析性格）: open_long   置信度=70  杠杆=8   仓位=25%

加权投票：
  open_long  得分 = 0.80 + 0.70 = 1.50 ✓ 胜出
  open_short 得分 = 0.60

最终共识：
  方向: open_long
  置信度: (80+70)/2 = 75%
  杠杆: (10+8)/2 = 9x
  仓位: (30+25)/2 = 27.5%
```

### 4.4 用户看到的页面

| 页面 | 功能 |
|------|------|
| AI 策略列表 | 我的策略 + 运行状态 |
| 创建策略向导 | 分步配置（币种→指标→风控→模式→确认） |
| 策略详情页 | 运行状态、持仓列表、PnL 曲线、决策日志 |
| 辩论详情页 | 每轮辩论的 AI 发言和最终投票结果 |
| 竞赛排行榜 | 多策略 ROI 对比 |
| AI 策略市场 | 浏览/订阅其他用户发布的 AI 策略 |

---

## 五、共享基础设施

两个产品共享底层服务，避免重复开发：

```
                    用户
                   /    \
            产品 A          产品 B
         AI 研究团队      AI 自动交易
              \            /
         ┌──── 共享 AI 服务层 ────┐
         │                        │
         │  llm.service          │ LLM 调用（DeepSeek/GPT-4/Claude/Gemini）
         │  debate.service       │ 辩论引擎（多角色 + 共识）
         │  indicators.service   │ 技术指标计算
         │  memory.service       │ BM25 记忆系统
         │  safety.service       │ 安全检查（9层）
         │  evolution.service    │ 进化引擎（Sharpe 分层）
         │  ai-performance       │ 性能追踪
         │  trade-history        │ 交易历史分析
         │  prompts.ts           │ 提示词模板
         │                        │
         └────────────────────────┘
                    ↓
         ┌── HOOT 已有基础设施 ──┐
         │                        │
         │  CCXT 交易执行（直接） │ ← AI 交易不走 BullMQ 队列
         │  API Key 管理（加密）  │
         │  持仓管理              │
         │  费用计算（燃油费）    │
         │  WebSocket 推送        │
         │                        │
         └────────────────────────┘
```

### 5.1 v2-dev 可复用文件清单

| 文件 | 质量 | 复用方式 |
|------|------|---------|
| debate.service.ts | 95% | 直接复用 |
| llm.service.ts | 100% | 直接复用 |
| memory.service.ts | 95% | 直接复用 |
| evolution.service.ts | 100% | 直接复用 |
| indicators.service.ts | 98% | 直接复用 |
| trade-history.service.ts | 100% | 直接复用 |
| ai-performance.service.ts | 95% | 直接复用 |
| prompts.ts | 100% | 直接复用 |
| safety.service.ts | 90% | 需补完 L5 回撤计算 |
| market-data.service.ts | 60% | 需修复方法签名 |
| ai.service.ts | 80% | 需拆分为两个产品的编排器 |
| ai-trade.processor.ts | - | 需重写（改为直接执行，不走队列） |
| auto-scheduler.service.ts | - | 需改造为产品 B 专用调度器 |

### 5.2 需要新增的文件

| 文件 | 产品 | 说明 |
|------|------|------|
| research.service.ts | A | 5 阶段研究管线编排 |
| research-analysts.service.ts | A | 4 类分析师（基本面/情绪/新闻/技术） |
| research-reflection.service.ts | A | 交易后反思机制 |
| ai-strategy.service.ts | B | AI 策略 CRUD + 配置管理 |
| auto-trader.service.ts | B | AI 自动交易循环 |
| consensus.service.ts | B | 多币种加权投票共识 |
| grid-trading.service.ts | B | Grid 网格交易 |
| ai-execution.service.ts | 共享 | AI 交易直接执行（不走队列，调 CCXT） |

---

## 六、AI 交易执行方式

### 关键设计：不走 BullMQ 队列

```
Freqtrade 策略交易（已有）：
  Signal → BullMQ 'trade' 队列 → TradeProcessor → CCXT
  （适合信号分发场景，多用户排队处理）

AI 交易（本模块）：
  AI 决策 → ai-execution.service → 直接调 CCXT → 返回结果
  （AI 决策时效性强，直接执行无延迟）
```

### ai-execution.service 职责

1. 接收 AI 决策（方向、币种、杠杆、仓位大小、止损、止盈）
2. 获取用户 API Key（解密）
3. 调用 CCXT 创建订单
4. 创建/更新 Position 记录
5. 计算燃油费（如有盈利）
6. 返回执行结果给调用方

---

## 七、数据库新增表

### ai_strategies（AI 策略表 - 产品 B 专用）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| userId | UUID | 用户 ID |
| name | String | 策略名称 |
| strategyType | Enum | normal / grid |
| tradingMode | Enum | solo / debate |
| coinSourceConfig | JSON | 币种来源配置 |
| indicatorConfig | JSON | 技术指标配置 |
| riskControlConfig | JSON | 风控参数配置 |
| promptSections | JSON | 自定义 Prompt（可选） |
| gridConfig | JSON | Grid 配置（仅 grid 类型） |
| intervalMinutes | Int | 运行间隔（分钟） |
| isActive | Boolean | 是否运行中 |
| isPublic | Boolean | 是否公开到策略市场 |
| createdAt | DateTime | 创建时间 |

### ai_research_sessions（研究会话表 - 产品 A 专用）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| userId | UUID | 用户 ID |
| symbol | String | 研究币种 |
| depth | Enum | quick(1) / standard(3) / deep(5) |
| autoExecute | Boolean | 是否自动执行 |
| status | Enum | running / completed / failed |
| stages | JSON | 5 阶段的详细内容 |
| finalDecision | JSON | 最终决策 |
| executedTradeId | UUID | 执行的交易 ID（如有） |
| totalCost | Decimal | LLM 调用成本 |
| createdAt | DateTime | 创建时间 |

### ai_strategy_competitions（竞赛记录表 - 产品 B 扩展）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| strategyId | UUID | 策略 ID |
| period | String | 统计周期（daily/weekly/monthly） |
| roi | Decimal | 收益率 |
| sharpe | Decimal | Sharpe Ratio |
| winRate | Decimal | 胜率 |
| totalTrades | Int | 总交易数 |
| snapshotAt | DateTime | 快照时间 |

---

## 八、开发阶段

### Phase 1：共享基础设施（复用 v2-dev + 新增执行层）

1. 将 v2-dev 可复用服务集成到主项目 `apps/api/src/modules/ai/`
2. 新建 `ai-execution.service.ts`（直接调 CCXT，不走队列）
3. 修复 `market-data.service.ts` 方法签名
4. 补完 `safety.service.ts` L5 回撤计算
5. 新增数据库表（Prisma migration）

### Phase 2：产品 A 后端（AI 研究团队）

1. 新建 `research.service.ts`（5 阶段流水线编排）
2. 新建 4 类分析师 prompt
3. 新建反思机制
4. 接入 ai-execution.service 执行交易
5. WebSocket 推送研究进度
6. API 端点：触发研究、查询进度、查询历史

### Phase 3：产品 B 后端（AI 自动交易）

1. 新建 `ai-strategy.service.ts`（策略 CRUD）
2. 新建 `auto-trader.service.ts`（自动循环）
3. 新建 `consensus.service.ts`（多币种投票共识）
4. 新建 `grid-trading.service.ts`（网格交易）
5. 策略市场（扩展现有策略市场支持 AI 策略）
6. 竞赛排行榜
7. API 端点：策略管理、启停控制、状态查询

### Phase 4：前端 UI

1. 产品 A 页面：研究入口、进度页、报告页、历史列表
2. 产品 B 页面：策略列表、创建向导、详情页、辩论详情、竞赛榜
3. 共享：AI 设置页（LLM 配置、预算管理）
4. 移动端适配

---

## 九、与 HOOT 已有功能的边界

| HOOT 已有功能 | AI 模块关系 | 说明 |
|--------------|-----------|------|
| Freqtrade 策略市场 | 独立共存 | AI 策略是另一种策略类型 |
| Signal → Trade 队列 | 不共享 | AI 交易直接执行 |
| API Key 管理 | 复用 | AI 交易使用同一套 API Key |
| 持仓管理 | 复用 | AI 交易的持仓记录在同一个 positions 表 |
| 风控引擎 | 扩展 | AI 有额外的双层风控 |
| 燃油费计算 | 复用 | AI 交易盈利同样收取燃油费 |
| WebSocket 推送 | 复用 | AI 研究进度通过同一 Gateway 推送 |
| 会员权限 | 复用 | AI 功能可能需要特定会员等级 |

---

## 十、参考源码位置

| 目录 | 说明 |
|------|------|
| `v2-dev/backend/modules/ai/` | 可复用的 AI 后端服务（24 个文件） |
| `v2-dev/reference/deep-research/` | 深研模式参考源码 |
| `v2-dev/reference/auto-trader/` | 快速交易模式参考源码 |
