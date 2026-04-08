# Gatekeeper Vote() vs HOOT Arena 评估报告

> 任务: P4-1 (HOOT nofx AI 智能交易升级 v1.1)
> 日期: 2026-04-08
> 状态: 评估完成，决策待 PM 确认

---

## 一、背景

改版 nofx 在 `kernel/engine.go` 中引入了 `Gatekeeper.Vote()` 投票层，按 score/confidence 选择最优候选币种。这是改版相对原版独有的能力之一（P3 第 17 项）。

HOOT 自身已有 **Arena 多 AI 辩论**（独立 strategy_type=arena），承担"多模型共识"的职责。两者在功能上存在重叠，因此本次升级保留 P4-1 作为评估项，先判断是否值得吸收。

---

## 二、机制对比

| 维度 | 改版 Vote() | HOOT Arena |
|---|---|---|
| **执行层级** | Gatekeeper 内部，单 AI 调用结果的后置过滤 | 完整的独立 strategy_type，AI 调用前的多模型对话 |
| **决策粒度** | 按 score/confidence 排序候选币种 | 多个 AI 模型独立分析后辩论投票 |
| **参与方** | 1 个 AI（Solo Trader）+ 评分函数 | 多个 AI 模型（如 deepseek + qwen + grok） |
| **触发时机** | 每个交易周期 | 用户主动选 arena strategy_type |
| **成本** | 低（无额外 AI 调用） | 高（多次 LLM 调用） |
| **共识强度** | 弱（单 AI 的内部排序） | 强（多 AI 独立判断） |
| **解释性** | 弱（score 数字） | 强（每个 AI 的论据 + 裁判总结） |

---

## 三、职责重叠分析

**重叠区**：
- 都是"在多个候选/方案中选最优"的机制
- 都用某种"评分"作为依据（Vote 用 score，Arena 用辩论后置信度）

**互补区**：
- Vote() 是 Solo Trader 内部的**后置过滤**：AI 已经给了 N 个候选，从中挑 top K
- Arena 是**前置共识**：多个 AI 各自决策再投票，产出 1 个统一结果
- Vote() 是**单 AI 内的取舍**，Arena 是**多 AI 间的协商**

**结论**：两者**不是完全替代**，而是不同层次的工具。

---

## 四、HOOT 现状评估

HOOT 当前在 Solo Trader 路径上**没有**Vote() 类似的后置过滤层。AI 输出多个候选时，原版的处理方式是：
1. Gatekeeper 过滤无效候选（gateFilterDecisions）
2. 排序（sortDecisionsByPriority - close 优先 close 后 open）
3. 逐个执行（受 maxPositions 限制）

如果 AI 输出 5 个 open 候选但 maxPositions=3，原版**只是按出现顺序取前 3 个**，没有按 confidence/score 取最优。**这是真实的 gap**。

---

## 五、三种选择对比

### A. 完全不吸收（Arena 已覆盖）
- **理由**：Arena 已经做了多 AI 共识，是 HOOT 核心卖点
- **缺点**：Solo Trader 路径下的"AI 给了 5 个候选只能取 3 个"问题没解决
- **风险**：Solo 用户的体验可能不如改版

### B. 做成 Arena 的轻量 fallback
- **理由**：Arena 超时/失败时降级用 Vote() 兜底
- **缺点**：用户用 Arena 是要"高质量决策"，降级到 Vote() 不符合预期
- **判断**：方向不对

### C. 吸收为 Solo Trader 的候选预筛层
- **理由**：填补"AI 候选 > maxPositions 时的取舍"gap
- **位置**：放在 sortDecisionsByPriority 之前，按 confidence × volume × R:R 综合 score 排序
- **实现成本**：小（~80 行 + 测试）
- **与 Arena 关系**：Arena 仍是高端模式，Vote() 是 Solo 的低成本优化
- **风险**：低，纯排序逻辑，可灰度

---

## 六、推荐决策

**采纳方案 C，且按以下方式差异化实现**：

1. **命名**：不叫 Vote()，叫 `CandidateRanker`（"投票"字眼与 Arena 混淆，"排序器"语义更清晰）
2. **位置**：`kernel/candidate_ranker.go`（独立文件）
3. **算法**：综合得分 = confidence × 0.5 + risk_reward × 0.3 + recent_winrate × 0.2
4. **触发条件**：仅当 `len(candidates) > maxPositions` 时启用
5. **灰度**：通过 feature_flag `HOOT_FF_candidate_ranker=on/strategies:.../pct:N`
6. **默认 disabled**：旧策略零行为变化
7. **审计**：每次启用都写 audit 快照（候选 + 得分 + 选中）

**与 Arena 的边界声明**（写入文档）：
- Arena = 多 AI 间的前置共识（高成本，高质量）
- CandidateRanker = 单 AI 内的后置取舍（零成本，简单排序）
- 两者**互补不互斥**：用 Arena 的 strategy 也可以启用 Ranker
- Solo 用户用 Ranker 提升体验，付费用户用 Arena 获得高质量

---

## 七、实现量预估

| 项 | 工作量 |
|---|---|
| `kernel/candidate_ranker.go` | ~120 行 |
| 单元测试（正常/边界/无候选/全候选） | ~80 行 |
| 主循环接入（Step E 之后，sort 之前） | ~10 行 |
| feature_flag 集成 | 复用 P0.1 |
| audit 集成 | 复用 P1-3 |
| **合计** | ~210 行 + 1-2 小时 |

---

## 八、最终建议

✅ **建议在 v1.2 实现**（当前 v1.1 升级阶段已完成 13 项核心能力，本项可作为下一轮迭代的首选）

理由：
- 当前 v1.1 已经覆盖了 16 项原本计划吸收的能力（除了拒绝的马丁和退化的 fallback "hold"）
- Vote() 不是"必须现在做"的项目
- 另起 v1.2 cycle 可以独立测试 + 灰度，避免与 v1.1 的灰度策略混淆
- v1.1 已经引入大量新 audit / feature_flag 数据，先观察生产数据 1-2 周再决定 v1.2 范围更稳妥

如果 PM 急需**现在就做**，按方案 C 实施，估计 2-3 小时含测试。

---

**待 PM 决策**:
- [ ] A. 现在实施方案 C
- [ ] B. 推迟到 v1.2
- [ ] C. 不做，关闭 P4-1

签字: AI Assistant
日期: 2026-04-08
