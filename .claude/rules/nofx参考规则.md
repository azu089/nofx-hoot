# nofx 参考规则（强制执行）

> 所有 AI 网格策略的问题分析、Bug 修复、功能开发，必须先读 nofx 全逻辑，不能只看片段。

---

## 核心规则

**凡是涉及网格策略 AI 逻辑的任何操作，必须先阅读 nofx 完整实现：**

```
reference/nofx/trader/auto_trader_grid.go   ← 网格主循环
reference/nofx/trader/grid_regime.go        ← 箱体突破/方向自适应
```

**禁止行为**：
- ❌ 只看 grid-trading.service.ts 的某一段就下结论
- ❌ 只看报错信息就修改代码，不对照 nofx 全流程
- ❌ 实现新功能不先确认 nofx 的对应实现是什么
- ❌ 改"突破/填单/补单/止损/平仓"逻辑不先读 nofx

---

## 参考文件路径

| 文件 | 用途 |
|------|------|
| `reference/nofx/trader/auto_trader_grid.go` | 网格主循环：syncOrderFills、下单、止损、AI提示词 |
| `reference/nofx/trader/grid_regime.go` | 箱体突破检测、方向自适应、虚假突破恢复 |

---

## 必须对照 nofx 的场景

| 场景 | 必读 nofx 函数 |
|------|--------------|
| 买单/卖单成交处理 | `syncOrderFills()` |
| 补挂买单/卖单 | `placeGridLimitOrder()` |
| 止损触发 | `checkStopLoss()` |
| 价格突破箱体 | `checkBoxBreakout()`, `detectBoxBreakout()`, `confirmBreakout()` |
| 暂停/恢复网格 | `handleBreakout()`, `checkFalseBreakoutRecovery()` |
| 方向自适应 | `executeDirectionAdjustment()`, `determineGridDirection()` |
| AI 提示词内容 | `buildGridUserPrompt()` |
| 每层数量计算 | `calculateLayerQty()` |
| 仓位上限控制 | `checkPositionCap()` |

---

## 对照检查清单（修 Bug 前必做）

修改任何网格策略代码前，必须输出：

```
## nofx 对照确认

### nofx 中的实现
- 函数名：xxx
- 文件位置：reference/nofx/trader/xxx.go:L行号
- 核心逻辑：[引用关键代码]

### HOOT TS 当前实现
- 函数名：xxx
- 文件位置：apps/api/src/modules/ai/services/trading/grid-trading.service.ts:L行号
- 当前逻辑：[引用关键代码]

### 差异点
- [列出与 nofx 的差异，说明是刻意保留还是 Bug]

### 修复方案
- [基于 nofx 逻辑的最小修复]
```

---

## 突破箱体逻辑（已验证，禁止随意修改）

完整突破处理流程（基于 nofx + HOOT 双实现验证）：

```
每个周期主循环
  ↓
Step 1: checkBreakout()           ← 简单边界突破（网格上下界）
  - ≥2%  → cancelAllOrders + isPaused=true + return（跳过 AI）
  - 1-2% → 记录，继续运行
  ↓
Step 2: detectBoxBreakout()       ← 多周期 Donchian 箱体突破
  - 优先级：Long > Mid > Short
  - 返回：level + direction + magnitude
  ↓
Step 3: confirmBreakout()         ← 过滤虚假突破
  - nofx：连续 3 根 K 线确认
  - HOOT 扩展：OI 增强立即确认，OI 平稳需 5 次
  ↓
Step 4: getBreakoutAction()       ← 映射到动作
  - Short → reduce_position(50%)
  - Mid   → pause_grid
  - Long  → close_all（紧急平仓）
  ↓
Step 5: executeBreakoutAction()   ← 执行动作
  ↓
Step 6: checkFalseBreakoutRecovery()  ← 每轮检查是否可恢复
  - 价格回到长期箱体内 → reset 突破状态，解除暂停
  - positionReductionPct 恢复到 50%（AI 逐步补仓）
  ↓
Step 7: AI LLM 决策（传递完整突破信息）
```

---

## 暂停来源区分（pauseSource）

| pauseSource | 触发原因 | 能否自动恢复 |
|------------|---------|------------|
| `'breakout'` | 网格边界突破（≥2%） | ✅ 价格回归后自动恢复 |
| `'ai'` | AI 决策调用 pause_grid | ✅ AI 可主动 resume |
| `'risk_control'` | 回撤/日损触发风控 | ❌ 需 PM 手动干预 |

**严禁把 `risk_control` 类型的暂停自动解除。**

---

## 违反此规则的后果

不对照 nofx 全逻辑就修改策略代码 = **交付不合格**，必须打回。

历史教训（严禁重蹈）：
- **2026-03-11**：placeGridLimitOrder 中 `finalLevel.price = price` 导致层价格被覆盖 → 已删除，参考 nofx 确认正确
- **2026-03-06**：syncOrderFills 移位 + 买单成交 side 不翻转，均为对照 nofx 后才发现的错误
- **2026-02-28**：OKX net_mode `side='net'` 漏判多头，未对照 nofx 持仓检测逻辑
