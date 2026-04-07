/**
 * News Analyst Agent — Tool Loop 模式
 * 1:1 对齐 Python 原版：LLM 自主决定调用 get_news / get_global_news
 */

import type { LlmClient } from '../../llm/llm-client.js';
import type { ChatMessage } from '../../llm/llm-client.js';
import type { AgentState } from '../../types/state.js';
import { NEWS_ANALYST_PROMPT, AGENT_COLLABORATION_PREFIX } from '../../prompts/analyst-prompts.js';
import { buildInstrumentContext, getLanguageInstruction } from '../agent-utils.js';
import { NEWS_ANALYST_TOOLS, executeToolCall } from '../tools.js';

export function createNewsAnalyst(
  llmClient: LlmClient,
  modelId: string,
) {
  return async (state: AgentState): Promise<Partial<AgentState>> => {
    const { trade_date, company_of_interest } = state;

    const instrumentContext = buildInstrumentContext(company_of_interest);
    const langInstruction = getLanguageInstruction();
    const toolNames = NEWS_ANALYST_TOOLS.map(t => t.function.name).join(', ');

    const systemPrompt = [
      AGENT_COLLABORATION_PREFIX,
      ` You have access to the following tools: ${toolNames}.`,
      `\n${NEWS_ANALYST_PROMPT}${langInstruction}`,
      `For your reference, the current date is ${trade_date}. ${instrumentContext}`,
    ].join('');

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: company_of_interest },
    ];

    const response = await llmClient.chatWithTools(
      modelId,
      messages,
      NEWS_ANALYST_TOOLS,
      executeToolCall,
      { temperature: 0.7, maxTokens: 4096 },
    );

    return {
      news_report: response.content,
      sender: 'NewsAnalyst',
    };
  };
}
