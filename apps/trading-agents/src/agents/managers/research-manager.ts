/**
 * Research Manager Agent — 1:1 对齐 Python research_manager.py
 * 多空辩论裁判：读取辩论历史 + 记忆 → 输出投资决策
 * Python 原版只传 past_memory_str + instrument_context + debate history，不传 4 份报告
 */

import { LlmClient } from '../../llm/llm-client.js';
import { AgentState, InvestDebateState } from '../../types/state.js';
import { FinancialSituationMemory } from '../memory.js';
import { buildResearchManagerPrompt } from '../../prompts/manager-prompts.js';
import { buildInstrumentContext } from '../agent-utils.js';

export function createResearchManager(
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
      investment_debate_state,
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

    // 2. 读取辩论历史
    const history = investment_debate_state?.history ?? '';
    const instrumentContext = buildInstrumentContext(company_of_interest);

    // 3. 构建 prompt（Python 原版是单个 prompt 直接 llm.invoke，不区分 system/user）
    const prompt = buildResearchManagerPrompt({
      past_memory_str: pastMemoryStr,
      instrument_context: instrumentContext,
      history,
    });

    // 4. 调用 LLM（用 prompt 作为 user message，system 留空角色定义）
    const response = await llmClient.chat(modelId, '', prompt);
    const plan = response.content;

    // 5. 更新辩论状态
    const updatedDebateState: InvestDebateState = {
      judge_decision: plan,
      history: investment_debate_state?.history ?? '',
      bear_history: investment_debate_state?.bear_history ?? '',
      bull_history: investment_debate_state?.bull_history ?? '',
      current_response: plan,
      count: investment_debate_state?.count ?? 0,
    };

    return {
      investment_debate_state: updatedDebateState,
      investment_plan: plan,
    };
  };
}
