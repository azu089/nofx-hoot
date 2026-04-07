package arena

import (
	"fmt"
	"strings"
)

// ---------------------------------------------------------------------------
// prompt_builder.go — Arena 策略 system prompt 预览构建器
//
// 复用 nofx 的 handlePreviewPrompt 端点模式：返回单一字符串供前端 Prompt 预览面板渲染。
// 与 ai_trading 的 engine.BuildSystemPrompt 等价，但内容是 13 个角色的 markdown 拼接。
//
// 数据来源：prompt_constants.go 里的 13 个常量（与 agents.go 实际运行使用同一份）
// ---------------------------------------------------------------------------

// BuildSystemPrompt 根据 ArenaConfig 生成完整的 13 角色辩论 prompt 预览
//
// variant 参数（"balanced" / "aggressive" / "conservative"）会临时覆盖 RiskPreference，
// 用户可在前端右侧面板的下拉框切换查看不同偏好下的最终输出。
func BuildSystemPrompt(cfg *ArenaConfig, variant string) string {
	if cfg == nil {
		cfg = DefaultArenaConfig()
	}
	// variant 覆盖 risk_preference（不修改原始 cfg）
	riskPref := cfg.RiskPreference
	if variant != "" {
		riskPref = variant
	}

	var b strings.Builder

	// ─── Header ─────────────────────────────────────────────────────────────
	b.WriteString("# 🏟️ Arena 竞技交易策略 — 13 角色辩论流程\n\n")
	b.WriteString(fmt.Sprintf("**交易币种**: `%s`  \n", strings.Join(cfg.Symbols, "`, `")))
	b.WriteString(fmt.Sprintf("**启用分析师**: %d 个 (%s)  \n",
		len(cfg.SelectedAnalysts), strings.Join(cfg.SelectedAnalysts, ", ")))
	b.WriteString(fmt.Sprintf("**投研辩论**: %d 轮  \n", cfg.MaxDebateRounds))
	b.WriteString(fmt.Sprintf("**风控辩论**: %d 轮  \n", cfg.MaxRiskRounds))
	b.WriteString(fmt.Sprintf("**风险偏好**: %s  \n", riskPref))

	totalCalls := len(cfg.SelectedAnalysts) + cfg.MaxDebateRounds*2 + 1 + 1 + cfg.MaxRiskRounds*3 + 1 + 1
	b.WriteString(fmt.Sprintf("**预计 LLM 调用**: %d 次  \n\n", totalCalls))
	b.WriteString("---\n\n")

	// ─── 阶段 1：分析师 ─────────────────────────────────────────────────────
	b.WriteString("## 阶段 1️⃣ — 分析师采集数据（Tool Calling 模式）\n\n")
	b.WriteString("> 每个分析师通过 LLM tool calling 自主探索数据：LLM 分析问题 → 调用工具获取原始数据 → 收到 tool result → 继续分析或调用更多工具 → 最终产出报告。\n> 这是 TradingAgents 的核心设计：让 AI 像人类分析师一样按需查询数据，而非被动阅读预喂内容。\n\n")

	// 样例 symbol 和日期用于预览占位符替换
	sampleSymbol := "BTCUSDT"
	if len(cfg.Symbols) > 0 {
		sampleSymbol = cfg.Symbols[0]
	}
	sampleDate := "2026-04-07"

	for _, a := range cfg.SelectedAnalysts {
		switch a {
		case AnalystMarket:
			writeAnalystWithTools(&b, "🔵 技术分析师 (Market Analyst)",
				"价格数据 + 技术指标（LLM 通过 get_stock_data/get_indicators 自主查询）",
				MarketAnalystSystemMessage, AnalystMarket, sampleSymbol, sampleDate, cfg)
		case AnalystSocial:
			writeAnalystWithTools(&b, "🔵 情绪分析师 (Social Analyst)",
				"社交媒体情绪 + 公众讨论（LLM 通过 get_news 自主查询）",
				SocialAnalystSystemMessage, AnalystSocial, sampleSymbol, sampleDate, cfg)
		case AnalystNews:
			writeAnalystWithTools(&b, "🔵 新闻分析师 (News Analyst)",
				"宏观新闻 + 公司/项目新闻（LLM 通过 get_news/get_global_news 自主查询）",
				NewsAnalystSystemMessage, AnalystNews, sampleSymbol, sampleDate, cfg)
		case AnalystFundamentals:
			writeAnalystWithTools(&b, "🔵 基本面分析师 (Fundamentals Analyst)",
				"财报 + 加密基本面（LLM 通过 get_fundamentals 等 4 个工具自主查询）",
				FundamentalsAnalystSystemMessage, AnalystFundamentals, sampleSymbol, sampleDate, cfg)
		}
	}

	// ─── 阶段 2：投研辩论 ─────────────────────────────────────────────────
	b.WriteString(fmt.Sprintf("## 阶段 2️⃣ — 投研辩论 Bull vs Bear (× %d 轮)\n\n", cfg.MaxDebateRounds))
	b.WriteString("> 公牛与熊研究员基于 4 份分析报告交替发言，每个角色都能看到对方上一轮论点 + BM25 历史记忆 + 简要持仓。\n\n")

	b.WriteString("### 🟢 公牛研究员 (Bull Researcher)\n\n")
	writeRolePrompt(&b, BullResearcherSystemPrompt, BullResearcherUserPromptTpl)

	b.WriteString("### 🔴 熊研究员 (Bear Researcher)\n\n")
	writeRolePrompt(&b, BearResearcherSystemPrompt, BearResearcherUserPromptTpl)

	// ─── 阶段 3：研究主管裁决 ─────────────────────────────────────────────
	b.WriteString("## 阶段 3️⃣ — 研究主管裁决\n\n")
	b.WriteString("> 综合 Bull/Bear 辩论历史，输出明确的投资计划（Buy/Sell/Hold）+ 战略行动建议。\n\n")
	b.WriteString("### 🟣 研究主管 (Research Manager)\n\n")
	writeRolePrompt(&b, ResearchManagerSystemPrompt, ResearchManagerUserPromptTpl)

	// ─── 阶段 4：交易员 ──────────────────────────────────────────────────
	b.WriteString("## 阶段 4️⃣ — 交易员制定具体方案\n\n")
	b.WriteString("> ⚡ **此角色看到完整账户上下文 + 风控约束**（余额、持仓、杠杆上限、保证金使用率）\n\n")
	b.WriteString("### 🟠 交易员 (Trader)\n\n")
	writeRolePrompt(&b, TraderSystemPromptTpl, TraderUserPromptTpl)

	// ─── 阶段 5：风控辩论 ─────────────────────────────────────────────────
	b.WriteString(fmt.Sprintf("## 阶段 5️⃣ — 三方风控辩论 (× %d 轮)\n\n", cfg.MaxRiskRounds))
	b.WriteString("> 三个风控角色就交易员方案展开辩论，每位都能看到其他两位的最新观点 + 简要持仓 + 风控约束。\n\n")

	b.WriteString("### 🔥 激进风控 (Aggressive Debater)\n\n")
	writeRolePrompt(&b, AggressiveDebaterSystemPrompt, AggressiveDebaterUserPromptTpl)

	b.WriteString("### 🛡️ 保守风控 (Conservative Debater)\n\n")
	writeRolePrompt(&b, ConservativeDebaterSystemPrompt, ConservativeDebaterUserPromptTpl)

	b.WriteString("### ⚖️ 中立风控 (Neutral Debater)\n\n")
	writeRolePrompt(&b, NeutralDebaterSystemPrompt, NeutralDebaterUserPromptTpl)

	// ─── 阶段 6：投资组合经理最终决策 ─────────────────────────────────────
	b.WriteString("## 阶段 6️⃣ — 投资组合经理最终决策\n\n")
	b.WriteString(fmt.Sprintf("> ⚡ **此角色看到完整账户上下文 + 风控约束**，综合 3 方风控辩论给出 5 档评级（Buy/Overweight/Hold/Underweight/Sell）。当前风险偏好：**%s**\n\n", riskPref))
	b.WriteString("### 🟣 投资组合经理 (Portfolio Manager)\n\n")
	writeRolePrompt(&b, PortfolioManagerSystemPrompt, PortfolioManagerUserPromptTpl)

	// ─── 阶段 7：信号提取 ─────────────────────────────────────────────────
	b.WriteString("## 阶段 7️⃣ — 信号提取\n\n")
	b.WriteString("> 从投资组合经理的完整决策文本中提取 1 个评级关键词，用于执行层映射为开/平仓动作。\n\n")
	b.WriteString("### ⚙️ 信号提取器 (Signal Extractor)\n\n")
	b.WriteString("**System Prompt:**\n\n")
	writeBlock(&b, SignalExtractorSystemPrompt)
	b.WriteString("**User Prompt:** 投资组合经理的完整决策文本（原样传入）\n\n")

	// ─── Footer ─────────────────────────────────────────────────────────────
	b.WriteString("---\n\n")
	b.WriteString("## 📝 说明\n\n")
	b.WriteString("- 上述 prompts 是**实际运行时**发送给 LLM 的完整内容（与 `arena/agents.go` 共享同一份常量，绝不漂移）\n")
	b.WriteString("- **System Prompt** 定义角色身份和任务；**User Prompt** 包含具体的市场数据、辩论历史、账户快照等\n")
	b.WriteString("- `{xxx}` 是运行时占位符，由对应的数据字段填充：\n")
	b.WriteString("  - `{symbol}` `{trade_date}` — 交易对 + 当前时间戳\n")
	b.WriteString("  - `{market_data}` `{indicators}` `{sentiment_data}` `{news_data}` `{fundamentals_data}` — 市场原始数据\n")
	b.WriteString("  - `{market_report}` `{sentiment_report}` `{news_report}` `{fundamentals_report}` — 前序分析师报告\n")
	b.WriteString("  - `{debate_history}` `{last_bull_argument}` `{last_bear_argument}` — 投研辩论上下文\n")
	b.WriteString("  - `{risk_debate_history}` `{last_aggressive_response}` `{last_conservative_response}` `{last_neutral_response}` — 风控辩论上下文\n")
	b.WriteString("  - `{trader_plan}` `{investment_plan}` — 前序角色的输出\n")
	b.WriteString("  - `{positions_brief}` — 简要持仓（分析师 / 研究员 / 风控辩论者可见）\n")
	b.WriteString("  - `{account_context}` `{risk_constraints}` — 完整账户 + 风控约束（仅 Trader / Portfolio Manager 可见）\n")
	b.WriteString("  - `{past_memories}` — BM25 记忆系统检索出的最相似 2 条历史决策\n")
	b.WriteString("- 信号映射规则：`BUY/OVERWEIGHT → 开多`，`SELL/UNDERWEIGHT → 开空/平多`，`HOLD → 不动作`\n")
	b.WriteString("- 反向切换需要 2 个周期（先平仓 → 下周期再反向开仓），保证原子性\n")

	return b.String()
}

// writeBlock 写一个 markdown 代码块
func writeBlock(b *strings.Builder, content string) {
	b.WriteString("```\n")
	b.WriteString(content)
	b.WriteString("\n```\n\n")
}

// writeRolePrompt 输出一个角色的 system + user prompt（含标签）
// 用于 9 个推理角色（Bull/Bear/ResearchManager/Trader/3风控/PortfolioManager），他们是单次 LLM 调用，有固定 user prompt 模板
func writeRolePrompt(b *strings.Builder, systemPrompt, userPromptTpl string) {
	b.WriteString("**System Prompt:**\n\n")
	writeBlock(b, systemPrompt)
	b.WriteString("**User Prompt Template:**\n\n")
	writeBlock(b, userPromptTpl)
}

// writeAnalystWithTools 输出一个分析师的完整预览（含完整 system prompt + 可用工具列表）
// 4 个分析师用 tool calling，没有固定 user prompt 模板 —— LLM 的每次消息由工具循环动态构造
func writeAnalystWithTools(b *strings.Builder, title, inputs, systemMessage, analystType, sampleSymbol, sampleDate string, cfg *ArenaConfig) {
	b.WriteString("### ")
	b.WriteString(title)
	b.WriteString("\n")
	b.WriteString("**输入**: ")
	b.WriteString(inputs)
	b.WriteString("\n\n")

	// 完整 system prompt（运行时填充占位符后的样子）
	fullSystem := buildAnalystSystemPrompt(systemMessage, analystType, sampleSymbol, sampleDate, cfg)
	b.WriteString("**System Prompt（已填充占位符）:**\n\n")
	writeBlock(b, fullSystem)

	// 可用工具列表
	tools := AnalystToolSets[analystType]
	b.WriteString(fmt.Sprintf("**可用工具（%d 个，LLM 自主调用）:**\n\n", len(tools)))
	for _, t := range tools {
		b.WriteString(fmt.Sprintf("- **`%s`** — %s\n", t.Function.Name, t.Function.Description))
		// 参数列表
		if props, ok := t.Function.Parameters["properties"].(map[string]any); ok {
			required := map[string]bool{}
			if reqList, ok := t.Function.Parameters["required"].([]string); ok {
				for _, r := range reqList {
					required[r] = true
				}
			}
			for name, schema := range props {
				schemaMap, _ := schema.(map[string]any)
				typeStr, _ := schemaMap["type"].(string)
				desc, _ := schemaMap["description"].(string)
				reqTag := ""
				if required[name] {
					reqTag = " *required*"
				}
				b.WriteString(fmt.Sprintf("  - `%s` (%s)%s — %s\n", name, typeStr, reqTag, desc))
			}
		}
	}
	b.WriteString("\n**初始 User Message:**\n\n")
	// 实际运行时 positions_brief 会被 FormatPositionsBrief 填充（空持仓时为 "Current Positions: None"）
	// 预览里展示样例结果，便于用户看到真实效果
	b.WriteString(fmt.Sprintf("```\n%s\n\nCurrent Positions: None\n```\n\n", sampleSymbol))
	b.WriteString(fmt.Sprintf("（LLM 收到 system+初始 user message 后，会主动调用上述工具探索数据，每次调用后收到 `role=\"tool\"` 的结果消息，最多 %d 轮循环直到给出最终报告）\n\n", MaxToolCallIterations))
}

// fillTemplate 将 map 中的 key-value 替换到模板字符串的 {key} 占位符。
// 例：fillTemplate("Hello {name}!", map[string]string{"name": "World"}) → "Hello World!"
// 预存缺失函数，被 agents.go 中所有分析师/辩论者角色的 user prompt 构建调用。
func fillTemplate(tpl string, vars map[string]string) string {
	result := tpl
	for k, v := range vars {
		result = strings.ReplaceAll(result, "{"+k+"}", v)
	}
	return result
}

