/**
 * Portfolio Manager Agent — 1:1 对齐 Python portfolio_manager.py
 * Python 原版只传 instrument_context + rating scale + trader_plan + past_memory_str + risk debate history + language_instruction
 * 不传 4 份报告摘要
 */

import { LlmClient } from '../../llm/llm-client.js';
import { AgentState, RiskDebateState } from '../../types/state.js';
import { FinancialSituationMemory } from '../memory.js';
import { buildPortfolioManagerPrompt } from '../../prompts/manager-prompts.js';
import { buildPMTradingContext } from '../../prompts/trading-context-prompts.js';
import { buildInstrumentContext, getLanguageInstruction } from '../agent-utils.js';

export function createPortfolioManager(
  llmClient: LlmClient,
  modelId: string,
  memory?: FinancialSituationMemory,
) {
  return async (state: AgentState): Promise<Partial<AgentState>> => {
    const {
      market_report,
      sentiment_report,
      news_report,
      fundamentals_report,
      risk_debate_state,
      investment_plan,
      company_of_interest,
    } = state;

    // 1. 记忆检索（对齐 Python: curr_situation = 4 份报告拼接，n_matches=2）
    let pastMemoryStr = '';
    if (memory) {
      const currSituation = `${market_report}\n\n${sentiment_report}\n\n${news_report}\n\n${fundamentals_report}`;
      const memories = memory.getMemories(currSituation, 2);
      if (memories.length > 0) {
        pastMemoryStr = memories.map(m => m.recommendation + '\n\n').join('');
      }
    }

    // 2. 读取风控辩论历史和 trader 计划
    const history = risk_debate_state?.history ?? '';
    const traderPlan = investment_plan ?? '';
    const instrumentContext = buildInstrumentContext(company_of_interest);
    const langInstruction = getLanguageInstruction();

    // 3. 构建 prompt + 交易上下文
    const tradingCtxBlock = state.trading_context
      ? '\n\n' + buildPMTradingContext(state.trading_context)
      : '';
    const prompt = buildPortfolioManagerPrompt({
      instrument_context: instrumentContext,
      trader_plan: traderPlan,
      past_memory_str: pastMemoryStr,
      history,
      language_instruction: langInstruction,
    }) + tradingCtxBlock;

    // 4. 调用 LLM
    const response = await llmClient.chat(modelId, '', prompt);
    const decision = response.content;

    // 5. 更新风控辩论状态（对齐 Python: latest_speaker="Judge"）
    const updatedRiskState: RiskDebateState = {
      judge_decision: decision,
      history: risk_debate_state?.history ?? '',
      aggressive_history: risk_debate_state?.aggressive_history ?? '',
      conservative_history: risk_debate_state?.conservative_history ?? '',
      neutral_history: risk_debate_state?.neutral_history ?? '',
      latest_speaker: 'Judge',
      current_aggressive_response: risk_debate_state?.current_aggressive_response ?? '',
      current_conservative_response: risk_debate_state?.current_conservative_response ?? '',
      current_neutral_response: risk_debate_state?.current_neutral_response ?? '',
      count: risk_debate_state?.count ?? 0,
    };

    return {
      risk_debate_state: updatedRiskState,
      final_trade_decision: decision,
    };
  };
}
