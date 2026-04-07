/**
 * Bull Researcher Agent
 * 代表多头观点参与投资辩论，基于 4 份分析报告构建看涨论证
 * 更新 investment_debate_state（bull_history + history + count）
 */

import { LlmClient } from '../../llm/llm-client.js';
import { AgentState, InvestDebateState } from '../../types/state.js';
import { FinancialSituationMemory } from '../memory.js';
import { buildBullPrompt } from '../../prompts/researcher-prompts.js';


/**
 * 创建 Bull Researcher agent
 *
 * @param llmClient - LLM 客户端实例
 * @param modelId - 使用的模型 ID
 * @param memory - BM25 记忆系统（可选）
 */
export function createBullResearcher(
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

    // 1. 从记忆系统检索相似场景经验
    // 对齐 Python: curr_situation = 4 份报告完整拼接，n_matches=2，recommendation 直接拼接
    let pastMemoryStr = '';
    if (memory) {
      const currSituation = `${market_report}\n\n${sentiment_report}\n\n${news_report}\n\n${fundamentals_report}`;
      const memories = memory.getMemories(currSituation, 2);
      if (memories.length > 0) {
        pastMemoryStr = memories.map(m => m.recommendation + '\n\n').join('');
      }
    }

    // 2. 读取辩论状态
    const history = investment_debate_state?.history ?? '';
    const currentBearResponse = investment_debate_state?.current_response ?? '';

    // 3. 构建 user prompt（包含所有资料和历史）
    const userMessage = buildBullPrompt({
      market_research_report: market_report,
      sentiment_report,
      news_report,
      fundamentals_report,
      history,
      current_response: currentBearResponse,
      past_memory_str: pastMemoryStr,
    });

    // 4. 调用 LLM（对齐 Python: llm.invoke(prompt)，无 system message）
    const response = await llmClient.chat(modelId, '', userMessage);
    const bullArgument = response.content;

    // 5. 更新辩论状态（对齐 Python: "\n" 单换行，前缀 "Bull Analyst: "）
    const currentCount = investment_debate_state?.count ?? 0;
    const argument = `Bull Analyst: ${bullArgument}`;

    const updatedDebateState: InvestDebateState = {
      history: (investment_debate_state?.history ?? '') + '\n' + argument,
      bull_history: (investment_debate_state?.bull_history ?? '') + '\n' + argument,
      bear_history: investment_debate_state?.bear_history ?? '',
      current_response: argument,
      judge_decision: investment_debate_state?.judge_decision ?? '',
      count: currentCount + 1,
    };

    return {
      investment_debate_state: updatedDebateState,
      sender: 'BullResearcher',
    };
  };
}
