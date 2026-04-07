/**
 * Aggressive Risk Debater Agent
 * 风险辩论中的激进派：强调高收益高风险机会，挑战保守和中立观点
 * 更新 risk_debate_state（aggressive_history + history + count）
 */

import { LlmClient } from '../../llm/llm-client.js';
import { AgentState, RiskDebateState } from '../../types/state.js';
import { buildAggressivePrompt } from '../../prompts/risk-prompts.js';
import { buildRiskTradingContext } from '../../prompts/trading-context-prompts.js';


/**
 * 创建 Aggressive Risk Debater agent
 *
 * @param llmClient - LLM 客户端实例
 * @param modelId - 使用的模型 ID
 */
export function createAggressiveDebater(
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
    const currentConservativeResponse = risk_debate_state?.current_conservative_response ?? '';
    const currentNeutralResponse = risk_debate_state?.current_neutral_response ?? '';
    const traderDecision = trader_investment_plan ?? '(No trader plan provided)';

    // 交易上下文（如有）
    const tradingCtxBlock = state.trading_context
      ? '\n\n' + buildRiskTradingContext(state.trading_context)
      : '';

    // 构建 user message（激进派论证）
    const userMessage = buildAggressivePrompt({
      trader_decision: traderDecision,
      market_research_report: market_report,
      sentiment_report,
      news_report,
      fundamentals_report,
      history,
      current_conservative_response: currentConservativeResponse,
      current_neutral_response: currentNeutralResponse,
    });

    // 调用 LLM（对齐 Python: llm.invoke(prompt)，无 system message）
    const response = await llmClient.chat(modelId, '', userMessage + tradingCtxBlock);
    const aggressiveArgument = response.content;

    // 更新风险辩论状态（对齐 Python: "\n" 单换行，前缀 "Aggressive Analyst: "）
    const currentCount = risk_debate_state?.count ?? 0;
    const argument = `Aggressive Analyst: ${aggressiveArgument}`;

    const updatedRiskState: RiskDebateState = {
      history: (history || '') + '\n' + argument,
      aggressive_history: (risk_debate_state?.aggressive_history ?? '') + '\n' + argument,
      conservative_history: risk_debate_state?.conservative_history ?? '',
      neutral_history: risk_debate_state?.neutral_history ?? '',
      latest_speaker: 'Aggressive',
      current_aggressive_response: argument,
      current_conservative_response: risk_debate_state?.current_conservative_response ?? '',
      current_neutral_response: risk_debate_state?.current_neutral_response ?? '',
      judge_decision: risk_debate_state?.judge_decision ?? '',
      count: currentCount + 1,
    };

    return {
      risk_debate_state: updatedRiskState,
      sender: 'AggressiveDebater',
    };
  };
}
