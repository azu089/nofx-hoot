/**
 * Arena Strategy (竞技策略) — Multi-Agent LLM Financial Trading Framework
 *
 * 策略类型标识：arena
 * 核心机制：多角色 AI 辩论 → 集体决策
 *
 * Usage:
 *   import { TradingAgentsGraph } from 'trading-agents';
 *
 *   const ta = new TradingAgentsGraph({ debug: true });
 *   const { state, signal } = await ta.propagate('NVDA', '2024-01-15');
 *   console.log(signal); // BUY / OVERWEIGHT / HOLD / UNDERWEIGHT / SELL
 */

export { TradingAgentsGraph } from './graph/trading-graph.js';
export type { PropagateResult } from './graph/trading-graph.js';
export type { AgentState, InvestDebateState, RiskDebateState, AnalystType, TradingContextForArena } from './types/state.js';
export type { TradingAgentsConfig } from './types/config.js';
export { STRATEGY_TYPE, STRATEGY_NAME } from './types/config.js';
export { DEFAULT_CONFIG } from './default-config.js';
export { LlmClient } from './llm/llm-client.js';
export type { LLMResponse, ChatOptions, ToolDefinition, ChatMessage } from './llm/llm-client.js';
export { FinancialSituationMemory } from './agents/memory.js';
