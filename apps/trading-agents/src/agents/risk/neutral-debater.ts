/**
 * Neutral Risk Debater Agent
 * 风险辩论中的中立派：提供平衡视角，挑战激进和保守两方的极端立场
 * 更新 risk_debate_state（neutral_history + history + count）
 */

import { LlmClient } from '../../llm/llm-client.js';
import { AgentState, RiskDebateState } from '../../types/state.js';
import { buildNeutralPrompt } from '../../prompts/risk-prompts.js';
import { buildRiskTradingContext } from '../../prompts/trading-context-prompts.js';


/**
 * 创建 Neutral Risk Debater agent
 *
 * @param llmClient - LLM 客户端实例
 * @param modelId - 使用的模型 ID
 */
export function createNeutralDebater(
  llmClient: LlmClient,
  modelId: string,
) {
  return async (state: AgentState): Promise<Partial<AgentState>> => {
    const {
      market_report,
      sentiment_report,
      news_report,
      fundamentals_report,
      risk_debate_state,
      trader_investment_plan,
      company_of_interest,
    } = state;

    // 读取当前风险辩论状态
    const history = risk_debate_state?.history ?? '';
    const currentAggressiveResponse = risk_debate_state?.current_aggressive_response ?? '';
    const currentConservativeResponse = risk_debate_state?.current_conservative_response ?? '';
    const traderDecision = trader_investment_plan ?? '(No trader plan provided)';

    // 构建 user message（中立派论证）
    const userMessage = buildNeutralPrompt({
      trader_decision: traderDecision,
      market_research_report: market_report,
      sentiment_report,
      news_report,
      fundamentals_report,
      history,
      current_aggressive_response: currentAggressiveResponse,
      current_conservative_response: currentConservativeResponse,
    });

    // 交易上下文
    const tradingCtxBlock = state.trading_context
      ? '\n\n' + buildRiskTradingContext(state.trading_context)
      : '';

    // 调用 LLM
    const response = await llmClient.chat(modelId, '', userMessage + tradingCtxBlock);
    const neutralArgument = response.content;

    // 更新风险辩论状态（对齐 Python: "\n" 单换行，前缀 "Neutral Analyst: "）
    const currentCount = risk_debate_state?.count ?? 0;
    const argument = `Neutral Analyst: ${neutralArgument}`;

    const updatedRiskState: RiskDebateState = {
      history: (history || '') + '\n' + argument,
      aggressive_history: risk_debate_state?.aggressive_history ?? '',
      conservative_history: risk_debate_state?.conservative_history ?? '',
      neutral_history: (risk_debate_state?.neutral_history ?? '') + '\n' + argument,
      latest_speaker: 'Neutral',
      current_aggressive_response: risk_debate_state?.current_aggressive_response ?? '',
      current_conservative_response: risk_debate_state?.current_conservative_response ?? '',
      current_neutral_response: argument,
      judge_decision: risk_debate_state?.judge_decision ?? '',
      count: currentCount + 1,
    };

    return {
      risk_debate_state: updatedRiskState,
      sender: 'NeutralDebater',
    };
  };
}
