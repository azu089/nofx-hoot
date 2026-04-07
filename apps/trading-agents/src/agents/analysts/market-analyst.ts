/**
 * Market Analyst Agent — Tool Loop 模式
 * 1:1 对齐 Python 原版：LLM 自主决定调用 get_stock_data / get_indicators
 */

import type { LlmClient } from '../../llm/llm-client.js';
import type { ChatMessage } from '../../llm/llm-client.js';
import type { AgentState } from '../../types/state.js';
import { MARKET_ANALYST_PROMPT, AGENT_COLLABORATION_PREFIX } from '../../prompts/analyst-prompts.js';
import { buildInstrumentContext, getLanguageInstruction } from '../agent-utils.js';
import { MARKET_ANALYST_TOOLS, executeToolCall } from '../tools.js';

export function createMarketAnalyst(
  llmClient: LlmClient,
  modelId: string,
) {
  return async (state: AgentState): Promise<Partial<AgentState>> => {
    const { trade_date, company_of_interest } = state;

    const instrumentContext = buildInstrumentContext(company_of_interest);
    const langInstruction = getLanguageInstruction();
    const toolNames = MARKET_ANALYST_TOOLS.map(t => t.function.name).join(', ');

    // 构建 system prompt — 对齐 Python 原版 ChatPromptTemplate
    const systemPrompt = [
      AGENT_COLLABORATION_PREFIX,
      ` You have access to the following tools: ${toolNames}.`,
      `\n${MARKET_ANALYST_PROMPT}${langInstruction}`,
      `For your reference, the current date is ${trade_date}. ${instrumentContext}`,
    ].join('');

    // 初始 messages — 对齐 Python MessagesPlaceholder(messages)
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: company_of_interest },
    ];

    // Tool Loop：LLM 自主决定调什么工具
    const response = await llmClient.chatWithTools(
      modelId,
      messages,
      MARKET_ANALYST_TOOLS,
      executeToolCall,
      { temperature: 0.7, maxTokens: 4096 },
    );

    return {
      market_report: response.content,
      sender: 'MarketAnalyst',
    };
  };
}
