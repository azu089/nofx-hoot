/**
 * 独立 LLM 客户端（从 HOOT LLMService 提取，去除 NestJS/Prisma 依赖）
 *
 * 支持 provider：openai, anthropic, google, xai, openrouter, ollama
 * API Key 仅从环境变量获取
 */

import OpenAI from 'openai';

export interface LLMResponse {
  content: string;
  tokenUsage: number;
  latencyMs: number;
  cost: number;
  thinking?: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
}

// Tool calling 相关类型
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface LLMToolResponse extends LLMResponse {
  toolCalls?: ToolCall[];
}

interface ModelCost {
  input: number; // per million tokens
  output: number;
}

// Provider routing config
interface ProviderConfig {
  baseURL: string;
  envVar: string;
}

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  openai: { baseURL: 'https://api.openai.com/v1', envVar: 'OPENAI_API_KEY' },
  deepseek: { baseURL: 'https://api.deepseek.com/v1', envVar: 'DEEPSEEK_API_KEY' },
  anthropic: { baseURL: 'https://api.anthropic.com/v1', envVar: 'ANTHROPIC_API_KEY' },
  google: { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai', envVar: 'GOOGLE_API_KEY' },
  xai: { baseURL: 'https://api.x.ai/v1', envVar: 'XAI_API_KEY' },
  openrouter: { baseURL: 'https://openrouter.ai/api/v1', envVar: 'OPENROUTER_API_KEY' },
  ollama: { baseURL: 'http://localhost:11434/v1', envVar: '' },
};

const MODEL_COSTS: Record<string, ModelCost> = {
  'gpt-4o': { input: 2.50, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4.1': { input: 2.0, output: 8.0 },
  'gpt-4.1-mini': { input: 0.40, output: 1.60 },
  'gpt-4.1-nano': { input: 0.10, output: 0.40 },
  'claude-opus-4-6': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
  'gemini-2.5-pro': { input: 1.25, output: 10.0 },
  'gemini-2.5-flash': { input: 0.15, output: 0.60 },
  'gemini-3-flash-preview': { input: 0.50, output: 3.00 },
  'grok-4-fast': { input: 0.20, output: 0.50 },
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
};

export class LlmClient {
  private provider: string;
  private baseURL: string;
  private clientCache: Map<string, OpenAI> = new Map();

  constructor(provider: string, baseURL?: string) {
    this.provider = provider.toLowerCase();
    this.baseURL = baseURL || PROVIDER_CONFIGS[this.provider]?.baseURL || '';
  }

  private getApiKey(): string {
    const config = PROVIDER_CONFIGS[this.provider];
    if (!config) throw new Error(`Unsupported provider: ${this.provider}`);
    if (this.provider === 'ollama') return 'ollama';
    const key = process.env[config.envVar] || '';
    if (!key) throw new Error(`API key not set: ${config.envVar}`);
    return key;
  }

  private getClient(): OpenAI {
    const cacheKey = `${this.provider}:${this.baseURL}`;
    let client = this.clientCache.get(cacheKey);
    if (!client) {
      client = new OpenAI({
        baseURL: this.baseURL,
        apiKey: this.getApiKey(),
        timeout: 120000,
      });
      this.clientCache.set(cacheKey, client);
    }
    return client;
  }

  private calculateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const cost = MODEL_COSTS[modelId];
    if (!cost) return 0;
    return (inputTokens / 1_000_000) * cost.input + (outputTokens / 1_000_000) * cost.output;
  }

  /**
   * Anthropic 直连（sk-ant-* key）
   */
  private async chatAnthropicDirect(
    modelId: string,
    systemPrompt: string,
    userMessage: string,
    options?: ChatOptions,
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const apiKey = this.getApiKey();
    const body = {
      model: modelId,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    };

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic API ${res.status}: ${errText}`);
    }

    const data = await res.json() as {
      content?: Array<{ type: string; text?: string; thinking?: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    };

    const textBlock = data.content?.find((b: any) => b.type === 'text');
    const thinkingBlock = data.content?.find((b: any) => b.type === 'thinking');
    const content = textBlock?.text || '';
    const thinking = thinkingBlock?.thinking;
    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;
    const latencyMs = Date.now() - startTime;
    const cost = this.calculateCost(modelId, inputTokens, outputTokens);

    return {
      content,
      tokenUsage: inputTokens + outputTokens,
      latencyMs,
      cost,
      ...(thinking && { thinking }),
    };
  }

  /**
   * 调用 LLM 生成内容
   */
  async chat(
    modelId: string,
    systemPrompt: string,
    userMessage: string,
    options?: ChatOptions,
  ): Promise<LLMResponse> {
    const startTime = Date.now();

    // Anthropic 直连
    if (this.provider === 'anthropic') {
      const apiKey = this.getApiKey();
      if (apiKey.startsWith('sk-ant-')) {
        return this.chatAnthropicDirect(modelId, systemPrompt, userMessage, options);
      }
    }

    const client = this.getClient();

    // OpenRouter 需要 provider 前缀
    let apiModelId = modelId;
    if (this.provider === 'openrouter') {
      if (modelId.startsWith('claude-')) apiModelId = `anthropic/${modelId}`;
      else if (modelId.startsWith('gemini-')) apiModelId = `google/${modelId}`;
      else if (modelId.startsWith('grok-')) apiModelId = `xai/${modelId}`;
      else if (modelId.startsWith('deepseek-')) apiModelId = `deepseek/${modelId}`;
    }

    // Thinking 模型需要更多 token 预算
    const isThinkingModel =
      modelId.startsWith('gemini-2.5') ||
      modelId.startsWith('gemini-3') ||
      modelId.includes('deepseek-r');
    const actualMaxTokens = isThinkingModel
      ? Math.max(options?.maxTokens ?? 4096, 12000)
      : options?.maxTokens ?? 4096;

    let response: OpenAI.Chat.Completions.ChatCompletion | undefined;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await client.chat.completions.create({
          model: apiModelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: options?.temperature ?? 0.7,
          max_tokens: actualMaxTokens,
        });
        break;
      } catch (err: any) {
        lastError = err;
        const isRateLimit = err.status === 429 || err.message?.includes('429');
        const isTimeout = err.message?.includes('timed out') || err.message?.includes('TIMEOUT');
        console.warn(`LLM call failed (attempt ${attempt}/3)${isRateLimit ? ' [rate-limit]' : ''}${isTimeout ? ' [timeout]' : ''}: ${err.message}`);
        if (attempt < 3) {
          const delay = (isRateLimit || isTimeout) ? attempt * 3000 : attempt * 1000;
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    if (!response) throw lastError;

    const message = response.choices[0]?.message as any;
    let content = message?.content || '';
    const thinking = message?.reasoning_content as string | undefined;

    if (!content && thinking) {
      content = thinking;
    }

    const usage = response.usage;
    const inputTokens = usage?.prompt_tokens || 0;
    const outputTokens = usage?.completion_tokens || 0;
    const latencyMs = Date.now() - startTime;
    const cost = this.calculateCost(modelId, inputTokens, outputTokens);

    return {
      content,
      tokenUsage: (usage?.total_tokens || inputTokens + outputTokens),
      latencyMs,
      cost,
      ...(thinking && { thinking }),
    };
  }

  /**
   * 带工具调用的 LLM 对话（Tool Loop 模式）
   *
   * 对齐 Python 原版 LangGraph ToolNode 循环：
   * 1. LLM 看到工具列表 → 自主决定调用哪些
   * 2. 工具执行返回结果 → 追加到 messages
   * 3. 再调 LLM → 可能继续调工具
   * 4. 直到 LLM 输出纯文本（无 tool_calls）→ 返回最终报告
   *
   * @param modelId 模型 ID
   * @param messages 初始消息列表
   * @param tools 工具定义列表
   * @param toolExecutor 工具执行函数：name + args → result string
   * @param options 可选参数
   * @param maxLoops 最大循环次数（防死循环，对应 Python recursion_limit）
   */
  async chatWithTools(
    modelId: string,
    messages: ChatMessage[],
    tools: ToolDefinition[],
    toolExecutor: (name: string, args: Record<string, unknown>) => Promise<string>,
    options?: ChatOptions,
    maxLoops: number = 20,
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const client = this.getClient();

    // OpenRouter 模型前缀
    let apiModelId = modelId;
    if (this.provider === 'openrouter') {
      if (modelId.startsWith('claude-')) apiModelId = `anthropic/${modelId}`;
      else if (modelId.startsWith('gemini-')) apiModelId = `google/${modelId}`;
      else if (modelId.startsWith('grok-')) apiModelId = `xai/${modelId}`;
      else if (modelId.startsWith('deepseek-')) apiModelId = `deepseek/${modelId}`;
    }

    let totalTokens = 0;
    let totalCost = 0;
    const conversationMessages: OpenAI.Chat.ChatCompletionMessageParam[] =
      messages.map(m => {
        if (m.role === 'tool') {
          return { role: 'tool' as const, content: m.content || '', tool_call_id: m.tool_call_id || '' };
        }
        if (m.role === 'assistant' && m.tool_calls) {
          return {
            role: 'assistant' as const,
            content: m.content,
            tool_calls: m.tool_calls.map(tc => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.function.name, arguments: tc.function.arguments },
            })),
          };
        }
        return { role: m.role as 'system' | 'user' | 'assistant', content: m.content || '' };
      });

    for (let loop = 0; loop < maxLoops; loop++) {
      let response: OpenAI.Chat.Completions.ChatCompletion | undefined;
      let lastError: Error | undefined;

      // 重试逻辑
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          response = await client.chat.completions.create({
            model: apiModelId,
            messages: conversationMessages,
            tools: tools as any,
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.maxTokens ?? 4096,
          });
          break;
        } catch (err: any) {
          lastError = err;
          const isRateLimit = err.status === 429 || err.message?.includes('429');
          console.warn(`LLM tool call failed (attempt ${attempt}/3)${isRateLimit ? ' [rate-limit]' : ''}: ${err.message}`);
          if (attempt < 3) {
            const delay = isRateLimit ? attempt * 3000 : attempt * 1000;
            await new Promise(r => setTimeout(r, delay));
          }
        }
      }

      if (!response) throw lastError;

      const choice = response.choices[0];
      const msg = choice?.message;
      const usage = response.usage;
      totalTokens += usage?.total_tokens || 0;
      totalCost += this.calculateCost(modelId, usage?.prompt_tokens || 0, usage?.completion_tokens || 0);

      // 无 tool_calls → 最终回复
      if (!msg?.tool_calls || msg.tool_calls.length === 0) {
        return {
          content: msg?.content || '',
          tokenUsage: totalTokens,
          latencyMs: Date.now() - startTime,
          cost: totalCost,
        };
      }

      // 有 tool_calls → 执行工具 → 追加结果 → 继续循环
      // 先把 assistant message（含 tool_calls）加入对话
      conversationMessages.push({
        role: 'assistant',
        content: msg.content,
        tool_calls: msg.tool_calls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      });

      // 逐个执行工具
      for (const toolCall of msg.tool_calls) {
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, unknown> = {};
        try {
          fnArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          fnArgs = {};
        }

        console.log(`    [TOOL] ${fnName}(${JSON.stringify(fnArgs).slice(0, 100)})`);

        let result: string;
        try {
          result = await toolExecutor(fnName, fnArgs);
        } catch (err: any) {
          result = `Error executing ${fnName}: ${err.message}`;
        }

        console.log(`    [TOOL] ${fnName} → ${result.length}c`);

        // 工具结果追加到对话
        conversationMessages.push({
          role: 'tool',
          content: result,
          tool_call_id: toolCall.id,
        });
      }
    }

    // 超过最大循环 → 强制结束
    return {
      content: 'Analysis could not be completed within the maximum number of tool iterations.',
      tokenUsage: totalTokens,
      latencyMs: Date.now() - startTime,
      cost: totalCost,
    };
  }
}
