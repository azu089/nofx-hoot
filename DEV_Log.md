# HOOT 开发日志 (DEV Log)

> 项目: HOOT - AI 量化交易平台
> 记录每个 Phase 的关键变更、决策与验收结果
> 格式: 倒序（最新在上）

---

## [2026-02-22] Phase 11: 大资金实战硬约束补全 + 手续费修复

**状态**: 进行中

### 硬约束补全（5 项致命漏洞修复）

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| T1 | SL/TP 设置原子化 | `ai-execution.service.ts` | 3 次重试 → 失败降级到 position-monitor 软监控 |
| T2 | 杠杆设置强制化 | `ai-execution.service.ts` | 3 次重试 → 查询交易所实际杠杆 → 用实际值计算 |
| T3 | 熔断器集成 | `auto-trader.service.ts` | `CircuitBreakerService` 注入，runCycle 入口检查 + 执行结果记录 |
| T4 | 新仓位注册 Monitor | `ai-execution.service.ts` | 开仓后 `trackPosition()`，平仓后 `untrackPosition()` |
| T5 | 订单簿滑点预估 | `market-data.service.ts` + `auto-trader.service.ts` | `fetchOrderBook()` + `estimateSlippage()` + AI prompt 注入 |

### 滑点保护策略

- **L1**: 订单簿数据注入 AI prompt，AI 自行判断是否开仓
- **L2**: 滑点 > 0.5% 日志警告
- **L3**: 滑点 > 3% 绝对安全阀拦截（硬约束）
- **L4**: 流动性不足（`!canFill`）拦截

### 手续费（燃油费）扣除修复

**严重问题**: 之前 5 条平仓路径中只有 1 条正确调用了手续费扣除。

修复文件:
- `ai-execution.service.ts` — AI 执行层平仓：补全 `calculateFee + chargeFee`
- `position-monitor.service.ts` — 监控触发平仓：注入 FeeService + 扣费逻辑
- `positions.service.ts` — 手动/传统平仓：注入 FeeService + 扣费逻辑

### 手续费率表（最新）

| 用户类型 | 质押状态 | 质押总量 | 最终费率 | 计算方式 |
|---------|---------|---------|---------|---------|
| Free | 无质押 | — | **25%** | 基础费率 |
| Free | 有质押 | < 10,000 HOOT | **22.5%** | 25% × (1 - 10%) |
| Free | 有质押 | ≥ 10,000 HOOT | **21.25%** | 25% × (1 - 15%) |
| Free | 有质押 | ≥ 50,000 HOOT | **20%** | 25% × (1 - 20%) |
| Free | 有质押 | ≥ 100,000 HOOT | **18.75%** | 25% × (1 - 25%) |
| Pro | 无质押 | — | **20%** | 基础费率 |
| Pro | 有质押 | < 10,000 HOOT | **18%** | 20% × (1 - 10%) |
| Pro | 有质押 | ≥ 10,000 HOOT | **17%** | 20% × (1 - 15%) |
| Pro | 有质押 | ≥ 50,000 HOOT | **16%** | 20% × (1 - 20%) |
| Pro | 有质押 | ≥ 100,000 HOOT | **15%** | 20% × (1 - 25%) |

**折扣组成**:
- 质押折扣: 有活跃 HOOT 质押 = **10%** 折扣（不分活期/定期，统一享受）
- VIP 折扣（按质押总量叠加）: ≥10,000 = 5% / ≥50,000 = 10% / ≥100,000 = 15%
- 两种折扣可叠加，公式: `最终费率 = 基础费率 × (1 - 质押折扣 - VIP折扣)`
- 最终费率不低于 0

**扣费机制**:
- 仅盈利时收费，亏损不扣
- 从用户点卡余额（`pointBalance`）扣除
- 幂等性: `uniqueOrderId` 防重复扣费
- 余额不足时只扣可用部分

### 质押系统简化

- ~~旧: A 类（活期无折扣）/ B 类（定期 10% 折扣）~~
- **新: 统一 HOOT 质押**，有活跃质押即享 10% 折扣
- 查询条件: `status: { in: ['active', 'locked'] }`

### 变更文件清单

| 文件 | 改动 |
|------|------|
| `ai-execution.service.ts` | T1+T2+T4 + 手续费扣除 |
| `auto-trader.service.ts` | T3 熔断器 + T5 滑点 + 流动性数据传递 |
| `market-data.service.ts` | T5 订单簿 + 滑点预估 |
| `prompt-builder.service.ts` | 流动性数据注入 prompt |
| `quick-analysis.service.ts` | liquidityData 透传 |
| `position-monitor.service.ts` | FeeService 注入 + 扣费逻辑 |
| `positions.service.ts` | FeeService 注入 + 扣费逻辑 |
| `fee.service.ts` | 去掉 A/B 质押分类，统一 HOOT 质押折扣 |
| `fee.service.spec.ts` | 测试同步更新 |

---

## [2026-02-22] 管理后台 + 移动端全量验收

**状态**: 通过

### 管理后台验收
- 12 个后台页面全量验收通过（用户/策略/AI/代理商/财务/系统等）
- 149 个后端接口，8,136 行管理后台代码
- 前后端对齐率 100%，无缺失 UI 入口
- AdminAuthGuard 鉴权正确，全局 Prefix `/admin`

### 移动端验收
- 24 个路由全部可访问，通过率 100%
- 36 个移动端组件，共 18,670 行代码
- 底部 5-Tab 导航（首页/交易/策略/钱包/我的）工作正常
- 无横向溢出，深色主题一致性通过

### 相关文件
- `apps/api/src/modules/admin/` — 管理后台 12 个 Controller + Service
- `apps/web/src/components/ui-v3/mobile/` — 36 个移动端组件
- `apps/api/src/modules/admin/dto/admin.dto.ts` — DTO 完善

---

## [2026-02-21] 实盘交易全流程端到端验收

**状态**: 通过（修复 1 个严重 Bug）

### 验收内容
- 测试账户: `aitest@hoot.ai` (ID: 0715f13f-6331-461e-ae5d-43f2717a4dac)
- 实盘交易: SOL/USDT:USDT short @ $80.52，qty=0.14，leverage=3x
- Position ID: `fdc2c524-3c17-4f5d-942e-7f63a9a7a1f9`，Order ID: `197191263988`

### 三种策略验证结果
| 策略模式 | 状态 | 说明 |
|---------|------|------|
| Research（产品A深研） | 通过 | 5阶段分析→AI决策→CCXT下单→Position记录 |
| Solo（极速单模型） | 通过 | 快速决策，无辩论阶段 |
| Debate（共识投票） | 通过（修复后） | 修复 normalizeSymbol 后正常 |

### 严重 Bug 修复: Debate 投票共识 symbol 格式不匹配
- 根因: Prompt 示例用 `"BTCUSDT"`，策略配置用 `"BTC/USDT"`，LLM 返回 `BTCUSDT` 导致 `symbolActions["BTC/USDT"]` 查找失败，confidence=0
- 修复: 添加 `normalizeSymbol()` 函数，去除 `/:`后匹配 + 大小写不敏感
- 文件: `apps/api/src/modules/ai/services/trading/debate-orchestrator.service.ts`

### 控制操作验证
- 热更新/暂停/恢复/停止/全局暂停 全部正常
- 边界用例: 无效币种/不存在ID/无Token/未启动策略 均返回正确错误

### 预算消耗
- 本次验收消耗 $0.20（月预算 $10 的 2%）

---

## [2026-02-16] Phase 10: NoFx 网格交易 + 监控 + 执行层补齐

**变更文件**: 8 个，新增代码约 1,000 行

### 核心改动
- `grid-trading.service.ts` 完整重写（378 → 1,418 行），实现生产级网格交易引擎
- 3 种网格分布: `uniform`（均匀）/ `gaussian`（正态）/ `pyramid`（金字塔）
- ATR 自动边界: `atrMultiplier × ATR14`，动态适应波动率
- 5 种仓位方向: neutral / long / short / long_bias / short_bias
- 3 级 Donchian 突破检测: short(72h)→减仓 / mid(240h)→暂停 / long(504h)→退出
- 4 级市场状态: narrow(<2%) / standard(≤3%) / wide(≤4%) / volatile(>4%)
- AI 决策: 每交易周期 1 次 LLM 调用，返回 JSON 数组（7 种操作指令）
- 风控三层: maxDrawdown% + dailyLossLimit% + 紧急退出

### Schema 变更
- `AiStrategy` 新增 `gridRuntimeState Json?` — 运行时网格状态
- `AiStrategy` 新增 `consecutiveFailures Int @default(0)` — 连续失败计数
- 连续失败 ≥ 3 次自动暂停策略 + WebSocket 通知

### 新增模块
- `CcxtAdapter` 新增 `GridExchangeAdapter` 接口: `placeLimitOrder` / `cancelOrder` / `getOrderBook`
- Grid Prompts: `GRID_SYSTEM_PROMPT` + `buildGridUserPrompt` + `GridContext` (~200 行)
- `snapshotPositionsOnStartup()`: 启动时交易所 vs DB 持仓快照同步，防状态漂移
- `reconcileGridState()`: 运行中 DB → 交易所同步，保证幂等性

### 验证结果
- `prisma generate` OK
- `tsc --noEmit` 0 errors
- 7 个子任务全部完成

---

## [2026-02-16] Phase 9.2: Product B 精确对齐修复

**变更文件**: 约 5 个

### 8 项偏差修复（D1-D7+D10）
- D1: 硬币扫描器 OI 模式批间延迟 500ms（防 Binance rate limit）
- D2: 辩论轮次角色标签对齐 NoFx TRADING_ROLE_PROMPTS
- D3: `positionPct` 范围校验 `0.1-1.0 → clamp(0.1, 1.0)`
- D4: `determineVotingConsensus` 加权平均参数计算修正
- D5: SL/TP 方向感知转换（做多/做空不同公式）
- D6: `lastError` 初始化避免 TS2454 编译报错
- D7: `retryCall` 泛型显式类型参数避免 TS 推断丢失
- D10: `sceneText` 从 `quickAnalysis` 传递真实值（非硬编码）

---

## [2026-02-16] Phase 9.1: 产品B辩论流水线对齐 NoFx

**变更文件**: 约 6 个

### 核心架构简化
- 辩论阶段: 4 阶段（辩论→Judge→风控辩论→多模型共识）→ **2 阶段**（辩论轮次→投票共识）
- LLM 调用次数: 29 次 → **20 次**（节省 31%）
- `skipJudge` 开关: `DebateConfig.skipJudge=true` 跳过 Judge 裁决，改用 5 人投票

### 关键实现
- `TRADING_ROLE_PROMPTS`: 5 个角色，每个约 3 行短提示（对比产品A的 150-250 行）
- `<final_vote>` 标签: JSON 数组 multi-coin 投票格式
- `determineVotingConsensus`: `weight=confidence/100`，`min0.5`，加法累积 score，算术平均参数
- SL/TP 转换: 百分比(`0.03`) → 绝对价格(`price × (1 ± pct)`)，方向感知
- `positionPct` 转换: `0.1-1.0 → 1-20`（`×100 + clamp`）

### 前端同步
- `DEBATE_STAGE_LABELS_V2`（2 阶段标签）
- 动态按 `riskDebateResult.totalCost` 判断阶段渲染

### 验证结果
- 后端 0 编译错误，前端 0 错误
- 10 语言 JSON 全部通过

---

## [2026-02-16] Phase 8.4: 产品A TradingAgents 对齐修复

**变更文件**: `research-pipeline.service.ts`, `debate.service.ts`, `risk-debate.service.ts`

### 5 项 GAP 修复
| GAP | 说明 | 修复方式 |
|-----|------|---------|
| GAP-A | Trader BM25 记忆缺失 | Stage 3 注入 trader 角色 per-role BM25 |
| GAP-B | Judge BM25 记忆缺失 | `runJudge()` 注入 invest_judge 角色 per-role BM25 |
| GAP-C | Trader 输出格式不标准 | 专用 JSON schema 含 leverage/positionSizePercent/stopLoss/takeProfit |
| GAP-D | 反思角色不足 | 5 → 7 角色（新增 analyst + contrarian），含历史提取 + ROLE_LABELS |
| GAP-E | 风控报告被截断 | 1,500 → 3,000 字符 |

- 产品A 对齐度: 约 88% → **约 95%**
- 编译: 0 错误

---

## [2026-02-16] Phase 8.3: AI 模块隔离 + 产品A配置优化

**变更文件**: 约 15 个

### 目录重组
- `apps/api/src/modules/ai/` 拆分为 3 个子目录:
  - `research/`（5 文件）— 产品A 研究管线
  - `trading/`（9 文件）— 产品B 自动交易
  - `shared/`（9 文件）— 公共服务（BM25/记忆/预算/执行）

### 常量拆分
- `prompts.ts`（707行）→ `models.ts` + `research-prompts.ts` + `trading-prompts.ts` + barrel 导出

### 产品A 质量提升
- 分析师报告注入辩论（debate.service Round1 prepend）
- Per-role BM25 记忆（`@Optional AiMemoryService`，fallback 到 unified）
- Judge 优先使用深度模型（`judgeModel > deepModel`）
- 风控辩论者可读分析报告摘要（注入 1,500 字摘要）

---

## [2026-02-15] Phase 8.2: Debate Arena 4 阶段辩论

**变更文件**: 约 10 个，新增 ~490 行

### 新增服务
- `DebateOrchestratorService`: 4 阶段编排器（投资辩论 → 风控辩论 → 共识投票）
- `AiDebateSession` Prisma 模型: 记录完整辩论生命周期

### 5 项质量修复
- Q1: 补全辩论阶段（之前只有 1 轮，现在 3-5 轮）
- Q2: 独立投票（每位辩论者独立输出，不受他人影响）
- Q3: BM25 风控记忆（风控辩论者有历史损失记忆）
- Q4: 默认 SL=3% / TP=6% 兜底（防止 AI 输出空值）
- Q5: 辩论上下文注入（共识阶段可看完整辩论过程）

### 前端
- `constants/debate.ts`: 阶段标签 + 辩论者配置
- 创建页: 模型选择器（普通/辩论模式切换）
- VoteSheet: 增强（模型显示名 + 推理展开 + 4 阶段进度）
- 列表页: Debate 模式紫色徽章（MessageSquare 图标）
- i18n: 10 语言 × 25 keys debate 命名空间

---

## [2026-02-14] Phase 8.1: DEX 接入

**新增文件**: 14 个，变更文件: 10 个，共 4,454 行

### ExchangeAdapter 统一接口
- 抽象接口 `IExchangeAdapter`: 统一 CEX 和 DEX 操作
- `CcxtAdapter`: CEX + Hyperliquid（CCXT 原生支持）
- `LighterAdapter`: REST + PlaceholderSigner（SDK 待集成）
- `AsterAdapter`: Binance 风格 API + ABI 编码 + ECDSA 签名（viem 库）
- `AdapterFactory`: 按 `authType + exchange` 路由到正确适配器

### DB Schema 变更（需 PM 批准已执行）
- `ApiKey` 新增: `authType`, `walletAddress`, `encryptedPrivateKey` 等 10 个 DEX 字段
- `Position` 新增: `exchangeType`（CEX/DEX）, `txHash`（链上交易哈希）

### API + 前端
- 新增端点: `POST /api-keys/dex` — DEX 凭证创建
- `CreateDexCredentialDto`: 3 个交易所专属字段验证
- 前端: DEX 表单（Hyperliquid/Lighter/Aster 各自字段）
- i18n: 10 语言 × 24 keys DEX 相关翻译

### 约定
- Symbol 格式: 所有适配器接受 CCXT 格式 `"BTC/USDT:USDT"`，内部自行转换
- Hyperliquid: `ccxt.hyperliquid({privateKey, walletAddress})`
- DEX WebSocket 事件: `dex:connection:status`, `dex:tx:confirmed`, `dex:tx:failed`

---

## [2026-02-10] Phase 8.0: AI 智能交易基础层

**新增文件**: 42 个，共 21,434 行代码

### 产品A — 研究团队（TradingAgents 对标）
- 5 阶段研究管线: 市场数据 → 5 个分析师 → AI 辩论 → 风控审查 → 最终决策
- 5 位分析师: 技术(RSI/MACD/BB) / 基本面(PE/PS/TVL) / 情绪(社媒情绪) / 量价(OI/资金费率) / 新闻(事件驱动)
- BM25 加权记忆淘汰: 亏损记忆优先淘汰，盈利记忆保留更久
- 恐惧贪婪指数: `alternative.me` 免费 API，注入情绪分析师
- Sharpe Ratio: 使用 `sqrt(365)` 年化（加密货币适配）

### 产品B — 自动交易引擎
- 3 种模式: Solo（极速单模型）/ Research（产品A辩论）/ Debate（共识投票）
- 硬币扫描器: OI 排名 + 资金费率筛选，批间延迟 500ms
- 策略引擎: BullMQ 定时任务，`removeStrategyJob` 精确过滤防误删

### CCXT 执行层
- `formatQuantity`: 3 层精度（amountToPrecision → limits → precision → 3位降级）
- 部分成交: `filledAmount < 95%` 警告，`filledAmount = 0` 中止
- `cancelExistingOrders`: 开仓前取消同方向活跃订单（防重复下单）
- `cleanupRelatedOrders`: 平仓后清理 SL/TP 残留（防二次触发）
- `setMarginModeWithRetry`: 区分已设置 / -4046 / -4048 错误，3 次重试
- `retryCall` 包装: 3 次重试（解决 TUN 代理间歇故障）

### 安全加固
- LLM 双轨制: 平台默认 Key（env）+ 用户自备 Key（AES-256-GCM 加密存储）
- `common/utils/crypto.util.ts` 复用加密工具
- 日志脱敏: 不输出 API Key 明文

### Prisma 新增模型
- `AiConfig` — 用户 AI 配置（LLM Key / 月预算 / 风控参数）
- `AiResearchSession` — 产品A 研究会话记录
- `AiStrategy` — 产品B 策略定义
- `AiMemory` — BM25 加权交易记忆
- `AiDebateSession` — 辩论会话记录

### 前端（7 个页面）
- `/ai-research` — 产品A 研究入口
- `/ai-research/[id]` — 产品A 研究详情（实时 WebSocket 进度）
- `/ai-trading` — 产品B 策略列表
- `/ai-trading/create` — 产品B 创建向导
- `/ai-trading/[id]` — 产品B 策略详情
- `/settings/ai` — AI 设置页（LLM Key / 预算 / 风控）

### 实盘验证（2026-02-13）
- SOL/USDT:USDT short @ $80.52，全流程通过
- 发现 `exchangeInfo` 本地缓存机制: `/tmp/binance_exchangeinfo.json`（683 对，48h TTL）
- 仓位百分比: AI 输出 `positionSizePercent(1-20)`，execution 层 `≤20` 视为百分比

---

## [2025-12] Phase 7: 测试与部署

**变更文件**: Dockerfile, docker-compose.prod.yml, deploy.sh, backup.sh 等

### Docker 生产构建
- 三阶段构建（deps → builder → runner）
- `docker-compose.prod.yml`: 7 个服务（API / Web / Postgres / Redis / Nginx / TG-Bot / Admin-Bot）
- Nginx 反向代理，SSL 终止

### 部署脚本
- `deploy.sh`（356 行）: 含蓝绿部署 + 自动回滚逻辑
- `backup.sh`: 定时备份到 S3 + Telegram 告警通知

### 安全加固
- Helmet 安全头
- CORS 白名单
- 接口限流（rate-limit）

### 健康检查
- `GET /api/health` — 主健康端点
- `GET /api/health/db` — 数据库连通性
- `GET /api/health/redis` — Redis 连通性
- `GET /api/health/queue` — BullMQ 队列状态
- `GET /api/health/ws` — WebSocket 状态
- 共 5 个健康检查端点

---

## [2025-12] Phase 6: 代币经济

**变更文件**: staking 模块，referral 模块，token 模块

### 质押分红系统
- HOOT 代币质押（Type-A 固定 / Type-B 累积权重）
- 每日快照 + 按权重分红
- 解质押冷却期 + 罚金机制

### 任务与空投
- 每日签到（连续签到加成）
- 社交任务（Twitter / Telegram 关注）
- 空投资格快照

### 推荐返佣
- 3 级推荐树（L1/L2/L3 不同佣金比例）
- 代理商结算周期（T+1 日结）

### 会员体系
- 3 个等级: 普通 / 黄金 / 钻石
- 费率折扣 + 专属功能解锁

---

## [2025-12] Phase 5: 辅助功能

**变更文件**: telegram-bot 模块，agent 模块，admin 模块

### Telegram Bot（用户端）
- 账户绑定与登录链接
- 余额查询 / 订单通知 / 策略状态
- 多语言支持（中/英/日/韩/俄/泰/土/越/印尼）

### Telegram Bot（管理员端）
- 用户管理快捷操作
- 系统状态告警推送

### 代理商系统
- 代理商注册与审核
- 下级用户跟踪
- 佣金自动结算

### 管理后台（Admin API）
- 用户管理（封禁/解封/余额调整）
- 策略管理（上下架）
- 财务报表

---

## [2025-12] Phase 4: 钱包与资金

**变更文件**: wallet 模块，transaction 模块

### 核心功能
- USDT 余额 + HOOT 余额双账户
- 充值: 链上地址生成 + 到账监听
- 提现: 审核队列 + 链上发送
- 交易历史分页查询

### 资金安全规则（强制执行）
- 所有金额使用 `DECIMAL(18,8)`，禁用 `FLOAT`
- 计算使用 `decimal.js`，禁用 JavaScript 原生浮点运算
- 所有写操作使用 `Prisma $transaction`
- 计费幂等: `unique_order_id = {type}_{userId}_{timestamp}_{nonce}`

---

## [2025-12] Phase 3: 核心交易系统 MVP

**变更文件**: auth 模块，api-keys 模块，strategy 模块，trading 模块

### 认证系统
- JWT AccessToken（15 分钟）+ RefreshToken（7 天）
- bcrypt 密码加密
- Telegram Mini App 验证

### API Key 管理
- AES-256-GCM 加密存储（encrypted_blob + iv + auth_tag）
- 严禁明文落地
- 支持 Binance / OKX / Bybit / Gate 等主流交易所

### 策略市场
- 策略列表 + 订阅/退订
- 策略详情（历史收益/胜率/最大回撤）
- 订阅配置（仓位比例 / 风控参数）

### 信号分发
- Freqtrade Webhook → NestJS → BullMQ 队列 → 用户账户
- WebSocket 推送实时信号

### CCXT 交易执行
- 支持 Futures（USDT 本位合约）
- 市价单 + 止损止盈

---

## [2025-12] Phase 2: 前端 UI 设计

**变更文件**: apps/web/src/components/ui-v3/

### V0 API 生成
- 使用 V0.app API 生成高保真移动端 UI 原型
- 深色主题设计系统:
  - 主背景: `#0A0A0F`
  - 卡片背景: `#12121A`
  - 边框: `#1E1E2E`
  - 强调色: `#06B6D4`（Cyan）

### 移动端组件（36 个，共 18,670 行）
- 底部 5-Tab 导航
- Dashboard、策略市场、交易控制台、钱包、设置 等主要页面
- 全部中文文案
- 响应式断点: Mobile `< 768px` / Desktop `>= 768px`

---

## [2025-12] Phase 1: 环境准备

**变更文件**: 项目根目录配置文件

### Monorepo 初始化
- pnpm workspace 结构:
  - `apps/api` — NestJS 后端（端口 4001）
  - `apps/web` — Next.js 前端（端口 3001）
  - `apps/admin` — Refine 管理后台
  - `apps/telegram-bot` — 用户 TG 机器人
  - `apps/admin-bot` — 管理员 TG 机器人
  - `packages/shared` — 共享类型与工具

### 基础设施
- `docker-compose.yml`: PostgreSQL 15（端口 5433）+ Redis 7（端口 6379）
- ESLint + Prettier 代码规范
- Husky Git Hooks（提交前 lint 检查）
- `.env.example` 环境变量模板

### 技术选型确认
- ORM: **Prisma 5.x**（非 TypeORM）
- 队列: **BullMQ 5.x**
- 交易所: **CCXT 4.x**
- 通知: **Novu**
- 资金计算: **decimal.js**（严禁 float）

---

## 版本记录

| 版本 | 日期 | 说明 |
|-----|------|------|
| v1.0 | 2025-12 | Phase 1-7 基础平台完成 |
| v2.0 | 2026-02-10 | Phase 8.0 AI 智能交易基础层 |
| v2.1 | 2026-02-14 | Phase 8.1 DEX 接入 |
| v2.2 | 2026-02-15 | Phase 8.2 Debate Arena |
| v2.3 | 2026-02-16 | Phase 8.3/8.4/9.1/9.2/10 AI优化+网格交易 |
| v2.4 | 2026-02-21 | 实盘验收 + normalizeSymbol Bug 修复 |
| v2.5 | 2026-02-22 | 管理后台 + 移动端全量验收通过 |
| v2.6 | 2026-02-22 | Phase 11 大资金硬约束 + 手续费修复 + 质押简化 |
