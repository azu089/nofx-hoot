import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

/**
 * LLM 调用结果
 */
export interface LLMResponse {
  content: string; // 生成的内容
  tokenUsage: number; // 消耗的 Token 数
  latencyMs: number; // 延迟（毫秒）
  cost: number; // 预估成本（美元）
}

/**
 * 调用选项
 */
export interface ChatOptions {
  temperature?: number; // 温度参数（0-2）
  maxTokens?: number; // 最大生成 Token 数
}

/**
 * 用户提供的 API Keys
 */
export interface UserApiKeys {
  deepseek?: string;
  openai?: string;
  openrouter?: string;
}

/**
 * 模型成本配置（每百万 Token）
 */
interface ModelCost {
  input: number; // 输入成本（美元）
  output: number; // 输出成本（美元）
}

/**
 * LLM 服务
 *
 * 通过 OpenAI SDK 以统一接口调用多个 LLM 提供商：
 * - DeepSeek
 * - OpenAI
 * - OpenRouter (Claude/Gemini)
 *
 * API Key 由用户从前端配置页面填入，存储在 AiConfig.apiKeys 中
 */
@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);

  // 模型成本配置（每百万 Token）
  private readonly modelCosts: Record<string, ModelCost> = {
    'deepseek-chat': { input: 0.14, output: 0.28 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'claude-3-5-haiku-20241022': { input: 1.0, output: 5.0 },
    'gemini-2.0-flash-001': { input: 0.10, output: 0.40 },
    'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  };

  /**
   * 根据模型 ID 和用户 API Key 创建 OpenAI 客户端
   * 注意：不缓存客户端，因为不同用户有不同的 Key
   */
  private createClient(modelId: string, apiKeys: UserApiKeys): OpenAI {
    let baseURL = '';
    let apiKey = '';
    let provider = '';

    if (modelId.startsWith('deepseek')) {
      provider = 'deepseek';
      baseURL = 'https://api.deepseek.com/v1';
      apiKey = apiKeys.deepseek || '';
    } else if (modelId.startsWith('gpt-')) {
      provider = 'openai';
      baseURL = 'https://api.openai.com/v1';
      apiKey = apiKeys.openai || '';
    } else if (modelId.startsWith('claude-') || modelId.startsWith('gemini-')) {
      provider = 'openrouter';
      baseURL = 'https://openrouter.ai/api/v1';
      apiKey = apiKeys.openrouter || '';
    } else {
      throw new Error(`不支持的模型: ${modelId}`);
    }

    if (!apiKey) {
      throw new Error(
        `${provider} API Key 未配置，请在 AI 配置页面填写 ${provider} 的 API Key`,
      );
    }

    return new OpenAI({
      baseURL,
      apiKey,
      timeout: 30000,
    });
  }

  /**
   * 计算成本
   */
  private calculateCost(
    modelId: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const cost = this.modelCosts[modelId];
    if (!cost) {
      this.logger.warn(`模型 ${modelId} 成本未配置，使用默认值`);
      return 0;
    }

    const inputCost = (inputTokens / 1_000_000) * cost.input;
    const outputCost = (outputTokens / 1_000_000) * cost.output;

    return inputCost + outputCost;
  }

  /**
   * 调用 LLM 生成内容
   *
   * @param modelId 模型 ID
   * @param systemPrompt 系统提示词
   * @param userMessage 用户消息
   * @param apiKeys 用户提供的 API Keys
   * @param options 可选参数
   * @returns LLM 响应
   */
  async chat(
    modelId: string,
    systemPrompt: string,
    userMessage: string,
    apiKeys: UserApiKeys,
    options?: ChatOptions,
  ): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const client = this.createClient(modelId, apiKeys);

      this.logger.log(`调用 ${modelId}: ${userMessage.slice(0, 50)}...`);

      // 调用 API（带重试）
      let response: OpenAI.Chat.Completions.ChatCompletion | undefined;
      let lastError: Error | undefined;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          response = await client.chat.completions.create({
            model: modelId,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.maxTokens ?? 1000,
          });

          break;
        } catch (err) {
          lastError = err;
          this.logger.warn(`调用失败 (尝试 ${attempt}/2): ${err.message}`);

          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }

      if (!response) {
        throw lastError;
      }

      const content = response.choices[0]?.message?.content || '';
      const usage = response.usage;
      const inputTokens = usage?.prompt_tokens || 0;
      const outputTokens = usage?.completion_tokens || 0;
      const totalTokens = usage?.total_tokens || inputTokens + outputTokens;

      const latencyMs = Date.now() - startTime;
      const cost = this.calculateCost(modelId, inputTokens, outputTokens);

      this.logger.log(
        `${modelId} 完成: ${totalTokens} tokens, ${latencyMs}ms, $${cost.toFixed(6)}`,
      );

      return {
        content,
        tokenUsage: totalTokens,
        latencyMs,
        cost,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      this.logger.error(
        `${modelId} 调用失败 (${latencyMs}ms): ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
