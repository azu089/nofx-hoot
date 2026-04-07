/**
 * 信号提取 - 1:1 对应 Python signal_processing.py
 * 从 final_trade_decision 中提取 BUY/OVERWEIGHT/HOLD/UNDERWEIGHT/SELL
 */

import type { LlmClient } from '../llm/llm-client.js';
import { SIGNAL_EXTRACTION_PROMPT } from '../prompts/trader-prompts.js';

export class SignalProcessor {
  private llmClient: LlmClient;
  private modelId: string;

  constructor(llmClient: LlmClient, modelId: string) {
    this.llmClient = llmClient;
    this.modelId = modelId;
  }

  async processSignal(fullSignal: string): Promise<string> {
    const response = await this.llmClient.chat(
      this.modelId,
      SIGNAL_EXTRACTION_PROMPT,
      fullSignal,
      { temperature: 0.1, maxTokens: 20 },
    );
    return response.content.trim();
  }
}
