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

- **safeMode 连续失败保护**：原版独有，比改版 fallback 更安全
- **Arena 多 AI 辩论**：HOOT 核心竞争力
- **中央引擎信号分发**：HOOT v6.0 架构基础
- **模块化拆分**：拒绝改版单文件 3160 行的反面教材

## 进度追踪

详见 git log + DEV_Log.md（按时间倒序）
