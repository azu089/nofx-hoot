# nofx AI 智能交易升级规划

> 版本: v1.0 | 日期: 2026-04-08
> 状态: PM 已确认规划，按 Phase 推进
> 工作分支: `reference/nofx` → `feature/ai-trader-upgrade-2026-04`

---

## 背景

nofx 是 HOOT 自家的 AI 自动交易产品（产品 B）的实现本体。改版（`reference/nofx改版/`）作为外部参考案例，对比后发现 16 项可吸收能力。本规划落地这 16 项的差异化移植，保留 HOOT 自身风格（Arena 多 AI 辩论 / safeMode / 中央引擎 / Telegram 生态）。

## 核心原则

1. **学其神不抄其形**：每项至少做到命名 + 结构 + 耦合 HOOT 特性三项差异化
2. **逐步执行 + 灰度 rollout**：每个原子任务独立 commit + 可回滚
3. **不破坏现有策略运行**：所有新能力默认 disabled，配置开关后才生效
4. **守住底线**：保留 safeMode / Arena / 中央引擎 / 模块化拆分

## 16 项能力决策

### ✅ 吸收（16 项）

| # | 能力 | Phase | 工作量 |
|---|---|---|---|
| 1 | ATR 自适应止盈阈值 | P2 | 中 |
| 2 | 指标历史序列 | P2 | 中 |
| 3 | StrategyAIBudget (Per-Strategy Cost Guard) | P1 | 小 |
| 4 | Exit Philosophy 模板（禁止机械平仓选项） | P2 | 中 |
| 5 | 3 根 K 线信号驱动平仓 | P2 | 小 |
| 6 | 细粒度 reduce/scale action | P2 | 中 |
| 7 | MinPos/MaxPos 配置化 | P1 | 小 |
| 9 | InstitutionalPipeline + PM 授权 | P3 | 大 |
| 10 | Token Budget Middleware | P1 | 小 |
| 11 | PreTradeSimulator 接口 | P3 | 中 |
| 12 | PHASE_B 灰度通用化 | P0/P3 | 中 |
| 13 | Runtime Audit Pipeline | P1 | 小 |
| 14 | EventSignal 元数据 + Telegram 联动 | P1 | 小 |
| 15 | PositionGateKey 细化 | P1 | 小 |
| 16 | Adaptive Blacklist + EffectiveMinScore | P3 | 大 |

### ⚠️ 待评估（1 项）

| # | 能力 | 决策点 |
|---|---|---|
| 17 | Gatekeeper Vote() | 与 HOOT Arena 辩论职责重叠，先写评估文档再定 |

### ❌ 拒绝（2 项）

| # | 能力 | 理由 |
|---|---|---|
| 8 | MartingaleEngine | 越亏越加仓，与 HOOT AI 智能+风控优先定位冲突 |
| 18 | AI 失败 → fallback "hold" | 改版的退化，原版 safeMode 更安全，**保留原版** |

## 阶段划分

### Phase 0 — 公共基建
- 0.1 Feature Flag 框架（`feature_flag/`）✅ commit 08d1ecf3
- 0.2 StrategyConfig 字段扩展（JSON 字段，零迁移）✅ commit 24d1e77a
- ~~0.3 PreTradeContext 统一结构体~~ ❌ **取消** — 原版已有 `kernel.Context`，字段完备，复用即可。新能力按需给 kernel.Context 加 v1.1 指针字段，与 P0.2 策略一致

### Phase 1 — 低风险快速项（6 项）
- P1-1 StrategyAIBudget
- P1-2 Token Budget Middleware
- P1-3 Runtime Audit Pipeline
- P1-4 PositionGateKey 细化
- P1-5 EventSignal 元数据 + Telegram 联动
- P1-6 MinPos/MaxPos 配置化

### Phase 2 — 算法核心升级（5 项）
- P2-1 指标历史序列
- P2-2 ATR 自适应止盈阈值
- P2-3 Exit Philosophy 模板化
- P2-4 细粒度仓位 Action
- P2-5 System Prompt 重构

### Phase 3 — 架构升级（4 项，灰度）
- P3-1 PreTradeSimulator
- P3-2 InstitutionalPipeline + PM 授权（最大改动）
- P3-3 Adaptive Blacklist + EffectiveMinScore
- P3-4 PHASE_B 灰度接入

### Phase 4 — 评估决策项
- P4-1 Gatekeeper Vote() 评估报告

## 风险与回滚

- 每个原子任务独立 commit，可 `git revert` 单点回退
- 所有新能力默认 disabled
- Phase 3 PM Authority 走 shadow mode → partial → full 三阶段灰度
- 任一阶段 checkpoint 出问题，可叫停回退

## 守住的边界

- **safeMode 连续失败保护**：原版独有，比 fallback 更安全
- **Arena 多 AI 辩论**：HOOT 核心竞争力
- **中央引擎信号分发**：HOOT v6.0 架构基础
- **模块化拆分**：坚持多包拆分，避免单文件巨型化

## 进度追踪

详见 git log + DEV_Log.md（按时间倒序）

---

## v1.2 候选任务（待调研后决策）

### V1.2-1 PM Authority 默认模式升级 ⭐

**背景**：2026-04-08 真实策略审计发现 Gatekeeper `EXIT_G2_HTF_ALIGNED` 过度保护导致亏损：
- ETHUSDT LONG 案例：AI 连续 5 次 close_long 被 HTF EMA 顺势规则拦截
- 最终交易所 sync 被动关闭，亏损 -35 USDT

**重新对照改版的结论**：
改版并没有修改 EXIT_G2 规则本身，而是**架构级解决**：
- `kernel/engine.go` Layer 1c: PositionManager 是已持仓的**唯一决策权威**
- AI 对 PM 管理 symbol 的 close 提案**全部丢弃** (`if pmSymbols[c.Symbol] && !c.IsOpenAction() { continue }`)
- 只有 PM 输出的 close/reduce/scale 会进入后续流程
- **PM 生成的候选不走 GateExitAction 的 EXIT_G1/G2/G3**（PM 是更高权威）
- 等价于 HOOT P3-2 的 `partial`/`full` 模式

**HOOT 当前状态**：
- v1.1 的 P3-2 InstitutionalPipeline 已搭好 4 档授权模式
- 但**默认是 `off`**（顺序追加模式），与原版行为一致
- AI 的 close 仍走 Gatekeeper，无法绕过 EXIT_G2

**V1.2-1 任务内容**：

1. **调研 HOOT `runPositionManagement` 的决策质量**
   - 读代码: `trader/auto_trader_hoot.go`
   - 分析真实生产日志里 PM 曾经产出的决策 vs AI 决策的差异
   - 评估 PM 是否足够智能以承担"已持仓 symbol 的唯一权威"

2. **根据调研结论二选一**:
   - 如果 PM 质量达标 → 把 `PMAuthorityMode` 默认从 `off` 改为 `partial`，灰度验证后升级 `full`
   - 如果 PM 质量不够 → 先补强 PM（增加规则 / 接 Arena 二审 / 改进信号权重），再升级授权

3. **不改 Gatekeeper 规则** — Layer 1 修复（sync 豁免 + G1 价格同向）已在 v1.1 完成并足够

**风险**：
- PM 授权升级后，原本被 EXIT_G2 "保护住"的盈利案例可能丢失
- 需要 shadow mode 至少 1 周 + 真实 PnL 对比才能验证
- 存在"修复一个亏损案例引入更多亏损"的可能

**优先级**：🟠 中 — 证据不足，需要更多真实样本
**前置**：至少 10 个独立的 EXIT_G2 误拦案例（目前只有 1 个 ETH 案例）

### V1.2-2 其他候选

- AI prompt 增强：让 AI 感知 HTF EMA 状态，避免 15m 决策 vs 1h Gatekeeper 判定的信息窗口不对称
- Strategy config min_hold_seconds 调优：当前 1020s 是否合理？
- 收集 EXIT_G 拦截后的事后 PnL 对比数据，建立统计证据
