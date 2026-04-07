/**
 * Bear Researcher Agent
 * 代表空头观点参与投资辩论，基于 4 份分析报告构建看跌论证
 * 更新 investment_debate_state（bear_history + history + count）
 */

import { LlmClient } from '../../llm/llm-client.js';
import { AgentState, InvestDebateState } from '../../types/state.js';
import { FinancialSituationMemory } from '../memory.js';
import { buildBearPrompt } from '../../prompts/researcher-prompts.js';


/**
 * 创建 Bear Researcher agent
 *
 * @param llmClient - LLM 客户端实例
 * @param modelId - 使用的模型 ID
 * @param memory - BM25 记忆系统（可选）
 */
export function createBearResearcher(
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
    // Bear 读取 current_response 作为上一轮 Bull 的观点
    const currentBullResponse = investment_debate_state?.current_response ?? '';

    // 3. 构建 user prompt
    const userMessage = buildBearPrompt({
      market_research_report: market_report,
      sentiment_report,
      news_report,
      fundamentals_report,
      history,
      current_response: currentBullResponse,
      past_memory_str: pastMemoryStr,
    });

    // 4. 调用 LLM（对齐 Python: llm.invoke(prompt)，无 system message）
    const response = await llmClient.chat(modelId, '', userMessage);
    const bearArgument = response.content;

    // 5. 更新辩论状态（对齐 Python: "\n" 单换行，前缀 "Bear Analyst: "）
    const currentCount = investment_debate_state?.count ?? 0;
    const argument = `Bear Analyst: ${bearArgument}`;

    const updatedDebateState: InvestDebateState = {
      history: (investment_debate_state?.history ?? '') + '\n' + argument,
      bull_history: investment_debate_state?.bull_history ?? '',
      bear_history: (investment_debate_state?.bear_history ?? '') + '\n' + argument,
      current_response: argument,
      judge_decision: investment_debate_state?.judge_decision ?? '',
      count: currentCount + 1,
    };

    return {
      investment_debate_state: updatedDebateState,
      sender: 'BearResearcher',
    };
  };
}
