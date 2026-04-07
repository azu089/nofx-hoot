/**
 * Trader Agent — 1:1 对齐 Python trader.py
 * Python 原版：system = 角色 + past_memory_str, user = investment_plan + instrument_context
 * 不传 4 份报告摘要
 */

import { LlmClient } from '../../llm/llm-client.js';
import { AgentState } from '../../types/state.js';
import { FinancialSituationMemory } from '../memory.js';
import {
  buildTraderSystemPrompt,
  buildTraderContextMessage,
} from '../../prompts/trader-prompts.js';
import { buildTraderTradingContext } from '../../prompts/trading-context-prompts.js';
import { buildInstrumentContext } from '../agent-utils.js';

export function createTrader(
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
      investment_plan,
      company_of_interest,
    } = state;

    // 1. 记忆检索（对齐 Python: curr_situation = 4 份报告拼接，n_matches=2）
    let pastMemoryStr = 'No past memories found.';
    if (memory) {
      const currSituation = `${market_report}\n\n${sentiment_report}\n\n${news_report}\n\n${fundamentals_report}`;
      const memories = memory.getMemories(currSituation, 2);
      if (memories.length > 0) {
        pastMemoryStr = memories.map(m => m.recommendation + '\n\n').join('');
      }
    }

    // 2. 构建 system prompt（对齐 Python: 角色定义 + past_memory_str）
    const systemPrompt = buildTraderSystemPrompt(pastMemoryStr);

    // 3. 构建 user message（investment_plan + instrument_context + 交易上下文）
    const instrumentContext = buildInstrumentContext(company_of_interest);
    const tradingCtxBlock = state.trading_context
      ? '\n\n' + buildTraderTradingContext(state.trading_context)
      : '';
    const userMessage = buildTraderContextMessage(
      company_of_interest,
      instrumentContext,
      investment_plan ?? '',
    ) + tradingCtxBlock;

    // 4. 调用 LLM
    const response = await llmClient.chat(modelId, systemPrompt, userMessage);

    return {
      trader_investment_plan: response.content,
      sender: 'Trader',
    };
  };
}
