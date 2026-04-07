package arena

import (
	"fmt"
	"log"
	"nofx/mcp"
)

// ---------------------------------------------------------------------------
// analyst_loop.go — 通用 tool calling 循环
//
// 对应 Python TradingAgents 的 langgraph ToolNode → Agent → ToolNode 往返机制。
// 所有 4 个分析师（Market / Social / News / Fundamentals）共用这个循环。
//
// 流程：
//   1. 发送 system + user 消息给 LLM（携带工具定义）
//   2. LLM 返回：
//      - 无 tool_calls → 最终报告，返回
//      - 有 tool_calls → 执行每个工具，把结果作为 role="tool" 消息加入历史
//   3. 循环直到 LLM 给出无工具调用的最终答案，或达到硬上限 MaxToolCallIterations
//
// 设计决策：
//   - 硬上限 10 轮：Python 原版用 langgraph recursion_limit=100，实际分析师极少超过 5
//   - 工具执行失败不中断：把错误字符串作为 tool result 返回，让 LLM 决定如何恢复
//   - 完整日志：每次 iteration + 每个工具调用 + 参数 + 返回字符数
// ---------------------------------------------------------------------------

// MaxToolCallIterations 单个分析师的 tool calling 硬上限
//
// Python 原版 langgraph recursion_limit=100，实测分析师典型需要 3-5 轮即可完成。
// 这里设 20 是 4 倍安全余量：足以容纳复杂探索场景，又远低于 Python 上限以防止失控烧 token。
// 触顶时保持 Python 原版的 all-or-nothing 语义 — 直接返回 error，
// 由 engine.go Phase 1 的 "单个分析师失败不中断" 逻辑决定后续流程。
const MaxToolCallIterations = 20

// AnalystLoopConfig 分析师 tool calling 循环的配置
type AnalystLoopConfig struct {
	RoleName     string       // 用于日志，如 "MarketAnalyst"
	SystemPrompt string       // 完整的 system prompt（含 tool calling 前缀 + 占位符已填充）
	UserPrompt   string       // 初始 user message
	Tools        []mcp.Tool   // 分析师可用的工具列表
	ToolCtx      *ToolContext // 工具执行上下文（市场数据/信号/事件的引用）
}

// RunAnalystWithTools 执行分析师的 tool calling 循环
// 返回：LLM 最终给出的文本报告
func RunAnalystWithTools(client mcp.AIClient, cfg *AnalystLoopConfig) (string, error) {
	messages := []mcp.Message{
		{Role: "system", Content: cfg.SystemPrompt},
		{Role: "user", Content: cfg.UserPrompt},
	}

	log.Printf("[Arena][%s] Starting tool calling loop with %d tools available", cfg.RoleName, len(cfg.Tools))

	for iter := 0; iter < MaxToolCallIterations; iter++ {
		req := &mcp.Request{
			Messages:   messages,
			Tools:      cfg.Tools,
			ToolChoice: "auto",
		}

		resp, err := client.CallWithRequestFull(req)
		if err != nil {
			return "", fmt.Errorf("[%s] LLM call failed at iter %d: %w", cfg.RoleName, iter, err)
		}

		// Case 1: LLM 给出最终文本答案（无工具调用）
		if len(resp.ToolCalls) == 0 {
			log.Printf("[Arena][%s] ✅ Completed in %d iterations, final report: %d chars",
				cfg.RoleName, iter+1, len(resp.Content))
			return resp.Content, nil
		}

		// Case 2: LLM 要求调用工具
		log.Printf("[Arena][%s] iter=%d requested %d tool calls", cfg.RoleName, iter+1, len(resp.ToolCalls))

		// 2a. 把 assistant 消息（含 tool_calls）加入历史
		messages = append(messages, mcp.Message{
			Role:      "assistant",
			ToolCalls: resp.ToolCalls,
		})

		// 2b. 执行每个工具调用，把结果作为 role="tool" 消息加入历史
		for _, tc := range resp.ToolCalls {
			log.Printf("[Arena][%s]   → tool: %s(%s)", cfg.RoleName, tc.Function.Name, truncate(tc.Function.Arguments, 200))

			result, err := ExecuteToolCall(tc, cfg.ToolCtx)
			if err != nil {
				// 工具执行失败不中断循环，让 LLM 看到错误并自行恢复
				result = fmt.Sprintf("Error executing %s: %v", tc.Function.Name, err)
				log.Printf("[Arena][%s]   ✗ tool error: %v", cfg.RoleName, err)
			} else {
				log.Printf("[Arena][%s]   ✓ tool returned %d chars", cfg.RoleName, len(result))
			}

			messages = append(messages, mcp.Message{
				Role:       "tool",
				ToolCallID: tc.ID,
				Content:    result,
			})
		}
	}

	// 到这里说明达到了硬上限仍未产生最终答案
	return "", fmt.Errorf("[%s] exceeded max tool call iterations (%d)", cfg.RoleName, MaxToolCallIterations)
}

// truncate 截断字符串（用于日志，避免一条日志过长）
func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
