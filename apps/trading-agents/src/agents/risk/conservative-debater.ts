/**
 * Conservative Risk Debater Agent
 * 风险辩论中的保守派：强调资产保护、风险最小化和稳定增长
 * 更新 risk_debate_state（conservative_history + history + count）
 */

import { LlmClient } from '../../llm/llm-client.js';
import { AgentState, RiskDebateState } from '../../types/state.js';
import { buildConservativePrompt } from '../../prompts/risk-prompts.js';
import { buildRiskTradingContext } from '../../prompts/trading-context-prompts.js';


/**
 * 创建 Conservative Risk Debater agent
 *
 * @param llmClient - LLM 客户端实例
 * @param modelId - 使用的模型 ID
 */
export function createConservativeDebater(
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
    const currentNeutralResponse = risk_debate_state?.current_neutral_response ?? '';
    const traderDecision = trader_investment_plan ?? '(No trader plan provided)';

    // 构建 user message（保守派论证）
    const userMessage = buildConservativePrompt({
      trader_decision: traderDecision,
      market_research_report: market_report,
      sentiment_report,
      news_report,
      fundamentals_report,
      history,
      current_aggressive_response: currentAggressiveResponse,
      current_neutral_response: currentNeutralResponse,
    });

    // 交易上下文
    const tradingCtxBlock = state.trading_context
      ? '\n\n' + buildRiskTradingContext(state.trading_context)
      : '';

    // 调用 LLM
    const response = await llmClient.chat(modelId, '', userMessage + tradingCtxBlock);
    const conservativeArgument = response.content;

    // 更新风险辩论状态（对齐 Python: "\n" 单换行，前缀 "Conservative Analyst: "）
    const currentCount = risk_debate_state?.count ?? 0;
    const argument = `Conservative Analyst: ${conservativeArgument}`;

    const updatedRiskState: RiskDebateState = {
      history: (history || '') + '\n' + argument,
      aggressive_history: risk_debate_state?.aggressive_history ?? '',
      conservative_history: (risk_debate_state?.conservative_history ?? '') + '\n' + argument,
      neutral_history: risk_debate_state?.neutral_history ?? '',
      latest_speaker: 'Conservative',
      current_aggressive_response: risk_debate_state?.current_aggressive_response ?? '',
      current_conservative_response: argument,
      current_neutral_response: risk_debate_state?.current_neutral_response ?? '',
      judge_decision: risk_debate_state?.judge_decision ?? '',
      count: currentCount + 1,
    };

    return {
      risk_debate_state: updatedRiskState,
      sender: 'ConservativeDebater',
    };
  };
}
