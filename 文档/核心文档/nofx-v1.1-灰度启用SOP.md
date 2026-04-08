# nofx v1.1 升级 — 灰度启用操作手册 (SOP)

> 版本: v1.0
> 日期: 2026-04-08
> 适用: HOOT nofx feature/ai-trader-upgrade-2026-04 分支合并后

---

## 一、原则

- **18 项新能力全部默认 disabled**
- 旧策略 JSON 不含新字段时，行为与原版完全一致
- 每项能力可独立启用，互不依赖（除明确依赖关系）
- 任一项出问题可独立关闭，不影响其他

---

## 二、启用顺序

按风险递增，依赖优先：

### Phase A：基础设施（生产即可启用，零行为变化）

| 顺序 | 能力 | 启用方式 | 风险 |
|---|---|---|---|
| A1 | Audit Pipeline | 默认 LoggerSink 自动启用 | 无 |
| A2 | Token Budget Guard | 默认自动检查（warn 级日志） | 无 |
| A3 | Feature Flag 框架 | 默认空，按需 SetSpec | 无 |

### Phase B：策略级配置项（per-strategy 启用）

| 顺序 | 能力 | 配置位置 | 推荐起步策略数 |
|---|---|---|---|
| B1 | StrategyAIBudget | `strategy.config.ai_budget_policy` | 1 个 |
| B2 | MinPos/MaxPos 配置化 | `strategy.config.risk_control.{min_position_size, max_positions}` | 全部 |
| B3 | Sized Adjust Actions | `strategy.config.enable_sized_actions = true` | 1 个 |
| B4 | Exit Philosophy hybrid | `strategy.config.exit_philosophy = "hybrid"` | 1 个 |
| B5 | ATR Adaptive 止盈 | `strategy.config.atr_adaptive` | 1 个 |

### Phase C：架构升级（feature flag 灰度）

| 顺序 | 能力 | 启用方式 | 灰度策略 |
|---|---|---|---|
| C1 | PreTradeSimulator | `HOOT_FF_pretrade_sim=on` 或 `pct:10` | 10% → 50% → 100% |
| C2 | Global Blacklist | `HOOT_FF_global_blacklist=on` + 管理员手动 BanGlobal | 按需 |
| C3 | CandidateRanker | `HOOT_FF_candidate_ranker=on` | 全开（无副作用） |
| C4 | PM Authority shadow | `HOOT_FF_pm_authority=shadow` | 1 个 trader 跑 1 周 |
| C5 | PM Authority partial | `HOOT_FF_pm_authority=partial` | 灰度 trader 子集 |
| C6 | PM Authority full | `HOOT_FF_pm_authority=full` | 全量 |

---

## 三、Phase A 操作步骤

### A1. Audit Pipeline
**启用方式**：自动启用，无需操作

**观察**：
```bash
docker logs -f nofx | grep "📋 \[AUDIT\]"
# 应能看到 context_built / ai_call_done / event_signal_active 等事件
```

**关停**：运行时通过 `audit.Disable()` 调用（需在代码中暴露 admin endpoint）

### A2. Token Budget Guard
**启用方式**：自动启用，warn 级阈值 80%、阻止级 100%

**观察**：
```bash
docker logs -f nofx | grep -E "Token budget"
# warn: ⚠️ Token budget warning
# block: 🚨 Token budget DANGER
```

**调整**：本期硬编码阈值，未来可做成 strategy config 字段

**关停**：暂无开关，如要禁用需 git revert P1-2 commit

### A3. Feature Flag 框架
**启用方式**：环境变量
```bash
# 全局开关
export HOOT_FF_some_flag=on

# 策略白名单
export HOOT_FF_some_flag=strategies:s1,s2,s3

# 灰度百分比
export HOOT_FF_some_flag=pct:25

# trader 白名单
export HOOT_FF_some_flag=traders:trader1,trader2
```

**或运行时**：通过 admin endpoint 调用 `feature_flag.SetSpec(key, spec)`

---

## 四、Phase B 操作步骤

### B1. StrategyAIBudget — 单策略试点

**步骤 1**：选 1 个非关键策略，编辑其 config JSON：
```sql
UPDATE strategies
SET config = jsonb_set(
  config::jsonb,
  '{ai_budget_policy}',
  '{"enabled": true, "cooldown_seconds": 180, "max_calls_per_day": 500, "skip_when_idle": true}'::jsonb
)::text
WHERE id = '<your-strategy-id>';
```

**步骤 2**：重启关联 trader 或等待下一个周期

**观察**：
```bash
docker logs -f nofx | grep "💰.*AI Budget"
# 应能看到 "AI Budget skip: cooldown_remaining=Xs" 或 "daily_limit_reached"
```

**验证**：
- 该策略无持仓时，连续触发周期内 AI 调用次数符合 cooldown
- 有持仓时仍正常调用 AI（持仓必须管理）

**回滚**：
```sql
UPDATE strategies
SET config = jsonb_set(config::jsonb, '{ai_budget_policy,enabled}', 'false'::jsonb)::text
WHERE id = '<your-strategy-id>';
```

### B2. MinPos/MaxPos 配置化
**已生效**：原版字段，仅重构。无需操作。

**调整方式**：
```sql
UPDATE strategies
SET config = jsonb_set(
  jsonb_set(config::jsonb, '{risk_control,min_position_size}', '15'::jsonb),
  '{risk_control,max_positions}', '5'::jsonb
)::text
WHERE id = '<your-strategy-id>';
```

### B3. Sized Adjust Actions

**步骤 1**：启用：
```sql
UPDATE strategies
SET config = jsonb_set(config::jsonb, '{enable_sized_actions}', 'true'::jsonb)::text
WHERE id = '<your-strategy-id>';
```

**步骤 2**：观察 AI 是否开始返回 reduce_long/scale_long 等 action：
```bash
docker logs -f nofx | grep -E "Reduce (long|short)|Scale (long|short)"
```

**验证**：reduce_long 后查交易所持仓数量是否减少 partial_pct 部分

**回滚**：`enable_sized_actions = false`

### B4. Exit Philosophy hybrid

**步骤 1**：选 1 个策略：
```sql
UPDATE strategies
SET config = jsonb_set(config::jsonb, '{exit_philosophy}', '"hybrid"'::jsonb)::text
WHERE id = '<your-strategy-id>';
```

**步骤 2**：检查 system prompt 是否含新段：
```bash
docker logs -f nofx | grep -A 5 "Exit Philosophy"
```

**观察**：AI 在该策略下平仓决策的频率和触发条件是否改变（应当更"信号驱动"，机械止损减少）

**回滚**：`exit_philosophy = "mechanical"` 或删除字段

### B5. ATR Adaptive 止盈

**步骤 1**：
```sql
UPDATE strategies
SET config = jsonb_set(
  config::jsonb,
  '{atr_adaptive}',
  '{"enabled": true, "multiplier": 2.0, "min_threshold": 0.005, "max_threshold": 0.05}'::jsonb
)::text
WHERE id = '<your-strategy-id>';
```

**观察**：持仓提示日志中应出现 `(ATR 自适应 X.XX%)` 字样

**回滚**：`atr_adaptive.enabled = false`

---

## 五、Phase C 操作步骤

### C1. PreTradeSimulator 灰度

**10% 灰度**：
```bash
export HOOT_FF_pretrade_sim=pct:10
docker compose restart nofx
```

**观察**：
```bash
docker logs -f nofx | grep -E "PreTradeSim (passed|blocked)"
# passed: ✓ PreTradeSim passed BTC open_long (est margin 50.00 USDT)
# blocked: 🚫 PreTradeSim blocked ETH open_long: margin 60.00 > available 50.00 × 0.95 buffer
```

**验证**：blocked 比例 < 5%，且原因合理（保证金不足是真实情况）

**逐级放量**：`pct:10 → pct:30 → pct:50 → pct:100 → on`

**关停**：`unset HOOT_FF_pretrade_sim` 重启

### C2. Global Blacklist

**启用框架**：
```bash
export HOOT_FF_global_blacklist=on
docker compose restart nofx
```

**手动 ban**（管理后台或运行时调用）：
```go
kernel.BanGlobal("PEPEUSDT", "extreme volatility, liquidation cascade", "admin", time.Now().Add(24*time.Hour))
```

**观察**：所有 trader 不再开 PEPEUSDT

**豁免特定策略**：
```go
kernel.AddExemption("PEPEUSDT", "vip-strategy-id")
```

**移除**：
```go
kernel.UnbanGlobal("PEPEUSDT")
```

### C3. CandidateRanker

**全开**（推荐）：
```bash
export HOOT_FF_candidate_ranker=on
docker compose restart nofx
```

**观察**：
```bash
docker logs -f nofx | grep "CandidateRanker"
# 🎯 [trader1] CandidateRanker: 5 open candidates → kept 3, dropped 2 (slots=3)
```

**验证**：被 dropped 的应该是 confidence 较低或 R:R 较小的候选

**关停**：`unset HOOT_FF_candidate_ranker`

### C4. PM Authority shadow

**步骤 1**：选 1 个 trader 启用 shadow：
```bash
export HOOT_FF_pm_authority=traders:trader_001
# 或 strategy 级
```
然后在 strategy config 设：
```sql
UPDATE strategies SET config = jsonb_set(config::jsonb, '{pm_authority_mode}', '"shadow"'::jsonb)::text WHERE id = 'sid';
```

**观察 1 周**：
```bash
docker logs -f nofx | grep -E "PM (shadow|authority_mode)"
# 应能看到 PM 决策与 AI 决策的对比快照
# audit.snapshot phase=pm_decision_shadow
```

**关键指标**：
- PM 决策与 AI 决策的同 symbol 冲突率
- PM 决策若执行，是否会改善 PnL（事后对比）

### C5. PM Authority partial

**前提**：C4 shadow 跑 1 周无异常

**升级**：`pm_authority_mode = "partial"`

**观察**：
```bash
docker logs -f nofx | grep "PM partial override"
```

**验证**：被 PM 覆盖的 AI close 提案，PM 的 reasoning 是否合理

### C6. PM Authority full

**前提**：C5 partial 跑 1-2 周稳定，PM 决策质量得到验证

**升级**：`pm_authority_mode = "full"`

**注意**：full 模式 AI 完全失去 close 决策权，**生产环境慎用**

---

## 六、紧急回滚预案

### 6.1 单点关停
- B 类策略级：DB 改字段为 `false` 或删除字段
- C 类 feature flag：环境变量改为 `off` 或 `unset` + 重启

### 6.2 全量回滚到 dev 分支
```bash
cd /Users/azu/量化项目/HOOT/reference/nofx
git checkout dev
make build
docker compose restart nofx
```

### 6.3 单 commit 回滚
```bash
git revert <commit-hash>
git push
make build
docker compose restart nofx
```

---

## 七、监控与告警

### 关键日志关键字
| 关键字 | 含义 | 行动 |
|---|---|---|
| `🚨 Token budget DANGER` | 策略 prompt 超 context | 缩减币种/周期 |
| `🚫 PreTradeSim blocked` | 下单前模拟拒绝 | 检查保证金 |
| `🛡️ SAFE MODE ACTIVATED` | 连续 AI 失败 | 检查 API key/网络 |
| `🏛️ PM full authority blocked` | PM 拒绝 AI close | 检查 PM 决策质量 |
| `💰 AI Budget skip` | AI 预算跳过调用 | 正常，节省成本 |
| `🎯 CandidateRanker` | 候选裁剪发生 | 正常，优化选择 |

### 审计快照查询（未来 SQL 表 audit_events）
```sql
SELECT phase, COUNT(*), MAX(timestamp)
FROM audit_events
WHERE trader_id = 'xxx' AND timestamp > NOW() - INTERVAL '1 day'
GROUP BY phase ORDER BY 2 DESC;
```

---

## 八、责任人

- **PM**: 决策启用顺序 / 验收每个 Phase
- **AI Assistant**: 提供启用脚本 / 排查异常
- **运维**: 执行 SQL / 重启服务 / 监控日志

---

## 九、当前 v1.1 commit 列表

| Commit | 任务 | 启用 Phase |
|---|---|---|
| 24d1e77a | P0.2 字段扩展 | A（基础） |
| 08d1ecf3 | P0.1 Feature Flag | A3 |
| b58aad6f | P1-1 StrategyAIBudget | B1 |
| 27e3a5b4 | P1-2 Token Budget | A2 |
| 81df3e44 | P1-3 Audit Pipeline | A1 |
| 7a1dbef3 | P1-4 PositionGateKey 细化 | 自动启用 |
| 8b0312b1 | P1-5 EventSignal 审计 | 跟随 A1 |
| 31889dc5 | P1-6 MinPos/MaxPos 配置化 | B2 |
| 53aee716 | P2-1 ATR14 历史序列 | 自动 |
| 3c522a61 | P2-2 ATR 自适应止盈 | B5 |
| 901091ed | P2-3 Exit Philosophy | B4 |
| fba9ba5a | P2-4 Sized Actions 执行层 | 跟随 B3 |
| e649b231 | P2-5 Sized Actions Prompt | B3 |
| 60a282c1 | P3-1 PreTradeSimulator 包 | C1 |
| 183b7b57 | P3-2 InstitutionalPipeline | C4/C5/C6 |
| 3f09992c | P3-3 全局黑名单 | C2 |
| 5877de00 | P3-4 PreTradeSim 接入 | C1 |
| 13cc9a3f | P4-1 CandidateRanker | C3 |
| f54f8d84 | 修测试 | 无操作 |

---

**待 PM 验收并签字**

签字: _____________________
日期: _____________________
