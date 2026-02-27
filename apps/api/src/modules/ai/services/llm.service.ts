import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * LLM 调用结果
 */
export interface LLMResponse {
  content: string; // 生成的内容
  tokenUsage: number; // 消耗的 Token 数
  latencyMs: number; // 延迟（毫秒）
  cost: number; // 预估成本（美元）
  thinking?: string; // AI 思考链（DeepSeek-Reasoner reasoning_content / Claude 扩展思考）
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
  anthropic?: string; // Claude（直连 Anthropic API）
  gemini?: string;    // Gemini（直连 Google AI API）
  openrouter?: string; // 向后兼容旧配置
  qwen?: string;
  grok?: string;
  kimi?: string;
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
 * - DeepSeek (deepseek-chat, deepseek-reasoner)
 * - OpenAI (gpt-4o-mini 等)
 * - Claude (直连 Anthropic API，sk-ant-* 自动检测)
 * - Gemini (直连 Google AI API，OpenAI 兼容接口)
 * - Qwen (阿里通义千问，DashScope OpenAI 兼容接口)
 * - Grok (xAI，OpenAI 兼容接口)
 * - Kimi (Moonshot AI，OpenAI 兼容接口)
 *
 * 三轨制 Key 解析（优先级从高到低）：
 * 1. 用户自备 Key（AiConfig.apiKeys 中配置，AES-256-GCM 加密存储）
 * 2. 平台 DB 配置（PlatformConfig.llm_platform_config）
 * 3. 环境变量（DEEPSEEK_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY / QWEN_API_KEY / GROK_API_KEY / KIMI_API_KEY）
 *
 * 无论使用哪种 Key，预算系统均生效
 */
@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);

  // 平台 DB 配置缓存（5 分钟 TTL）
  private platformCfgCache: Record<string, { apiKey: string; enabled: boolean; modelName: string }> | null = null;
  private platformCfgLoadedAt = 0;
  private readonly PLATFORM_CFG_TTL_MS = 5 * 60 * 1000; // 5 分钟

  constructor(private prisma: PrismaService) {}

  // 模型成本配置（每百万 Token）
  private readonly modelCosts: Record<string, ModelCost> = {
    'deepseek-chat': { input: 0.14, output: 0.28 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'claude-3-5-haiku-20241022': { input: 1.0, output: 5.0 }, // 旧版兼容
    'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
    'gemini-2.0-flash-001': { input: 0.10, output: 0.40 }, // 旧版兼容
    'gemini-2.0-flash': { input: 0.10, output: 0.40 },     // 旧版兼容
    'gemini-2.5-flash': { input: 0.30, output: 2.50 },     // 旧版兼容
    'gemini-3-flash-preview': { input: 0.50, output: 3.00 },
    'qwen-plus': { input: 0.80, output: 2.0 },     // 旧版兼容
    'qwen3.5-plus': { input: 0.80, output: 2.0 },
    'grok-3': { input: 3.0, output: 15.0 },         // 旧版兼容
    'grok-4-fast': { input: 0.20, output: 0.50 },
    'moonshot-v1-8k': { input: 0.17, output: 0.17 }, // 旧版兼容
    'kimi-k2.5': { input: 0.60, output: 2.50 },
  };

  /**
   * 从 DB 或缓存中获取平台 Provider 配置（三轨优先级第二层）
   * 读取 platform_configs.llm_platform_config，带 5 分钟 TTL 缓存
   * 返回 { apiKey, modelName }，modelName 为空字符串表示使用代码默认值
   */
  private async getPlatformProviderConfig(provider: string): Promise<{ apiKey: string; modelName: string }> {
    const now = Date.now();
    if (!this.platformCfgCache || now - this.platformCfgLoadedAt > this.PLATFORM_CFG_TTL_MS) {
      try {
        const row = await this.prisma.platformConfig.findUnique({
          where: { key: 'llm_platform_config' },
        });
        if (row?.value) {
          const parsed = JSON.parse(row.value) as {
            providers?: Record<string, { apiKey?: string; enabled?: boolean; modelName?: string }>;
          };
          this.platformCfgCache = {};
          for (const [name, cfg] of Object.entries(parsed.providers || {})) {
            this.platformCfgCache[name] = {
              apiKey: cfg.apiKey || '',
              enabled: cfg.enabled ?? true,
              modelName: cfg.modelName || '',
            };
          }
        } else {
          this.platformCfgCache = {};
        }
      } catch (err) {
        this.logger.warn(`读取平台 LLM 配置失败: ${err.message}`);
        this.platformCfgCache = {};
      }
      this.platformCfgLoadedAt = now;
    }
    const cfg = this.platformCfgCache[provider];
    return { apiKey: cfg?.apiKey || '', modelName: cfg?.modelName || '' };
  }

  /**
   * 解析实际调用的模型 ID
   * 若管理员在平台配置中为 provider 设置了 modelName 覆盖，则使用覆盖值；
   * 否则返回原始 modelId（代码默认值）
   */
  private async resolveModelId(modelId: string): Promise<string> {
    const providerPrefixes: Array<[string, string]> = [
      ['deepseek', 'deepseek'],
      ['gpt-', 'openai'],
      ['claude-', 'anthropic'],
      ['gemini-', 'gemini'],
      ['qwen', 'qwen'],           // 匹配 qwen-plus 和 qwen3.5-plus
      ['grok-', 'grok'],
      ['moonshot-', 'kimi'],
      ['kimi-', 'kimi'],           // 匹配 kimi-k2.5
    ];
    const provider = providerPrefixes.find(([prefix]) => modelId.startsWith(prefix))?.[1];
    if (!provider) return modelId;
    const { modelName } = await this.getPlatformProviderConfig(provider);
    return modelName || modelId;
  }

  /**
   * 根据模型 ID 和用户 API Key 创建 OpenAI 客户端
   *
   * 三轨制解析（优先级从高到低）：
   * 1. 用户自备 Key（AiConfig.apiKeys，AES-256-GCM 加密）
   * 2. 平台 DB 配置（PlatformConfig.llm_platform_config，5 分钟 TTL 缓存）
   * 3. 环境变量（DEEPSEEK_API_KEY 等，兜底）
   */
  private async createClient(modelId: string, apiKeys: UserApiKeys): Promise<OpenAI> {
    let baseURL = '';
    let apiKey = '';
    let provider = '';

    if (modelId.startsWith('deepseek')) {
      provider = 'deepseek';
      baseURL = 'https://api.deepseek.com/v1';
      apiKey = apiKeys.deepseek || (await this.getPlatformProviderConfig('deepseek')).apiKey || process.env.DEEPSEEK_API_KEY || '';
    } else if (modelId.startsWith('gpt-')) {
      provider = 'openai';
      baseURL = 'https://api.openai.com/v1';
      apiKey = apiKeys.openai || (await this.getPlatformProviderConfig('openai')).apiKey || process.env.OPENAI_API_KEY || '';
    } else if (modelId.startsWith('claude-')) {
      provider = 'anthropic';
      baseURL = 'https://openrouter.ai/api/v1'; // sk-ant-* 由 chat() 拦截走直连
      apiKey = apiKeys.anthropic || apiKeys.openrouter
        || (await this.getPlatformProviderConfig('anthropic')).apiKey
        || (await this.getPlatformProviderConfig('openrouter')).apiKey
        || process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY || '';
    } else if (modelId.startsWith('gemini-')) {
      provider = 'gemini';
      baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai';
      apiKey = apiKeys.gemini
        || (await this.getPlatformProviderConfig('gemini')).apiKey
        || process.env.GEMINI_API_KEY || '';
    } else if (modelId.startsWith('qwen')) {
      provider = 'qwen';
      baseURL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
      apiKey = apiKeys.qwen || (await this.getPlatformProviderConfig('qwen')).apiKey || process.env.QWEN_API_KEY || '';
    } else if (modelId.startsWith('grok-')) {
      provider = 'grok';
      baseURL = 'https://api.x.ai/v1';
      apiKey = apiKeys.grok || (await this.getPlatformProviderConfig('grok')).apiKey || process.env.GROK_API_KEY || '';
    } else if (modelId.startsWith('moonshot-') || modelId.startsWith('kimi-')) {
      provider = 'kimi';
      baseURL = modelId.startsWith('kimi-') ? 'https://api.moonshot.ai/v1' : 'https://api.moonshot.cn/v1';
      apiKey = apiKeys.kimi || (await this.getPlatformProviderConfig('kimi')).apiKey || process.env.KIMI_API_KEY || '';
    } else {
      throw new Error(`不支持的模型: ${modelId}`);
    }

    if (!apiKey) {
      throw new Error(
        `${provider} API Key 未配置。用户未提供、平台 DB 未配置且环境变量 ${this.getEnvVarName(provider)} 为空`,
      );
    }

    return new OpenAI({
      baseURL,
      apiKey,
      timeout: 60000, // 60s — Qwen/DashScope 等海外调用可能较慢
    });
  }

  /**
   * 检查是否有可用的 LLM Key（用户 key / 平台 DB key / 环境变量，三轨均检查）
   * 供外部调用方在发起分析前快速判断
   */
  async hasAvailableKey(modelId: string, apiKeys: UserApiKeys): Promise<boolean> {
    if (modelId.startsWith('deepseek')) {
      if (apiKeys.deepseek || process.env.DEEPSEEK_API_KEY) return true;
      const { apiKey } = await this.getPlatformProviderConfig('deepseek');
      return !!apiKey;
    } else if (modelId.startsWith('gpt-')) {
      if (apiKeys.openai || process.env.OPENAI_API_KEY) return true;
      const { apiKey } = await this.getPlatformProviderConfig('openai');
      return !!apiKey;
    } else if (modelId.startsWith('claude-')) {
      if (apiKeys.anthropic || apiKeys.openrouter || process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY) return true;
      const anthropicCfg = await this.getPlatformProviderConfig('anthropic');
      if (anthropicCfg.apiKey) return true;
      const orCfg = await this.getPlatformProviderConfig('openrouter');
      return !!orCfg.apiKey;
    } else if (modelId.startsWith('gemini-')) {
      if (apiKeys.gemini || process.env.GEMINI_API_KEY) return true;
      const { apiKey } = await this.getPlatformProviderConfig('gemini');
      return !!apiKey;
    } else if (modelId.startsWith('qwen')) {
      if (apiKeys.qwen || process.env.QWEN_API_KEY) return true;
      const { apiKey } = await this.getPlatformProviderConfig('qwen');
      return !!apiKey;
    } else if (modelId.startsWith('grok-')) {
      if (apiKeys.grok || process.env.GROK_API_KEY) return true;
      const { apiKey } = await this.getPlatformProviderConfig('grok');
      return !!apiKey;
    } else if (modelId.startsWith('moonshot-') || modelId.startsWith('kimi-')) {
      if (apiKeys.kimi || process.env.KIMI_API_KEY) return true;
      const { apiKey } = await this.getPlatformProviderConfig('kimi');
      return !!apiKey;
    }
    return false;
  }

  /** 获取 provider 对应的环境变量名 */
  private getEnvVarName(provider: string): string {
    const map: Record<string, string> = {
      deepseek: 'DEEPSEEK_API_KEY',
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      gemini: 'GEMINI_API_KEY',
      openrouter: 'OPENROUTER_API_KEY',
      qwen: 'QWEN_API_KEY',
      grok: 'GROK_API_KEY',
      kimi: 'KIMI_API_KEY',
    };
    return map[provider] || `${provider.toUpperCase()}_API_KEY`;
  }

  /**
   * 直连 Anthropic API（sk-ant-* Key 专用）
   * Anthropic 原生 API 格式与 OpenAI 不同，需要单独处理
   */
  private async chatAnthropicDirect(
    modelId: string,
    systemPrompt: string,
    userMessage: string,
    apiKey: string,
    options?: ChatOptions,
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const body = {
      model: modelId,
      max_tokens: options?.maxTokens ?? 1000,
      temperature: options?.temperature ?? 0.7,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    };

    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
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

        // Claude 扩展思考时 content 数组形如 [{type:'thinking', thinking:'...'}, {type:'text', text:'...'}]
        const textBlock = data.content?.find(b => b.type === 'text');
        const thinkingBlock = data.content?.find(b => b.type === 'thinking');
        const content = textBlock?.text || '';
        const thinking = thinkingBlock?.thinking;
        const inputTokens = data.usage?.input_tokens || 0;
        const outputTokens = data.usage?.output_tokens || 0;
        const totalTokens = inputTokens + outputTokens;
        const latencyMs = Date.now() - startTime;
        const cost = this.calculateCost(modelId, inputTokens, outputTokens);

        this.logger.log(`${modelId} (Anthropic直连) 完成: ${totalTokens} tokens, ${latencyMs}ms, $${cost.toFixed(6)}`);
        return { content, tokenUsage: totalTokens, latencyMs, cost, ...(thinking && { thinking }) };
      } catch (err) {
        lastError = err;
        this.logger.warn(`Anthropic 直连失败 (尝试 ${attempt}/2): ${err.message}`);
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
      }
    }

    throw lastError;
  }

  /**
   * 解析 Anthropic API Key（三轨制）
   */
  private async resolveAnthropicKey(apiKeys: UserApiKeys): Promise<string> {
    return apiKeys.anthropic
      || apiKeys.openrouter
      || (await this.getPlatformProviderConfig('anthropic')).apiKey
      || (await this.getPlatformProviderConfig('openrouter')).apiKey
      || process.env.ANTHROPIC_API_KEY
      || process.env.OPENROUTER_API_KEY
      || '';
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

    // 应用平台 modelName 覆盖（管理员可在后台指定具体版本，无需重部署）
    const effectiveModelId = await this.resolveModelId(modelId);
    if (effectiveModelId !== modelId) {
      this.logger.log(`模型覆盖: ${modelId} → ${effectiveModelId}`);
    }

    try {
      // Claude + sk-ant-* Key → 直连 Anthropic API（非 OpenAI 兼容格式）
      if (effectiveModelId.startsWith('claude-')) {
        const anthropicKey = await this.resolveAnthropicKey(apiKeys);
        if (anthropicKey.startsWith('sk-ant-')) {
          return this.chatAnthropicDirect(effectiveModelId, systemPrompt, userMessage, anthropicKey, options);
        }
      }

      const client = await this.createClient(effectiveModelId, apiKeys);

      // OpenRouter 要求非 OpenAI 模型加 provider 前缀
      let apiModelId = effectiveModelId;
      if (effectiveModelId.startsWith('claude-')) {
        const resolvedKey = await this.resolveAnthropicKey(apiKeys);
        if (resolvedKey && !resolvedKey.startsWith('sk-ant-')) {
          apiModelId = `anthropic/${effectiveModelId}`;
        }
      }

      this.logger.log(`调用 ${apiModelId}: ${userMessage.slice(0, 50)}...`);

      // 调用 API（带重试）
      let response: OpenAI.Chat.Completions.ChatCompletion | undefined;
      let lastError: Error | undefined;

      // Gemini 2.5 系列为内置思考模型，thinking tokens 计入 max_tokens 配额
      // 若不保留足够空间，thinking 结束后无 token 可输出 JSON，导致 SafeFallback
      // 最低保障 6000 tokens（thinking ~2000-3000 + 结构化输出 ~1000-2000）
      const isThinkingModel = effectiveModelId.startsWith('gemini-2.5') || effectiveModelId.startsWith('gemini-3');
      const actualMaxTokens = isThinkingModel
        ? Math.max(options?.maxTokens ?? 1000, 6000)
        : options?.maxTokens ?? 1000;

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
        } catch (err) {
          lastError = err;
          const isRateLimit = err.message?.includes('RATE_LIMIT') || err.message?.includes('429') || err.status === 429;
          const isTimeout = err.message?.includes('timed out') || err.message?.includes('TIMEOUT') || err.message?.includes('ECONNRESET');
          this.logger.warn(`调用失败 (尝试 ${attempt}/3)${isRateLimit ? ' [限流]' : ''}${isTimeout ? ' [超时]' : ''}: ${err.message}`);

          if (attempt < 3) {
            // 限流/超时错误用更长的退避（3s/6s），普通错误用短退避（1s/2s）
            const delay = (isRateLimit || isTimeout) ? attempt * 3000 : attempt * 1000;
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      if (!response) {
        throw lastError;
      }

      const message = response.choices[0]?.message as any;
      const content = message?.content || '';
      const thinking = message?.reasoning_content as string | undefined; // DeepSeek-Reasoner 思考链
      const usage = response.usage;
      const inputTokens = usage?.prompt_tokens || 0;
      const outputTokens = usage?.completion_tokens || 0;
      const totalTokens = usage?.total_tokens || inputTokens + outputTokens;

      const latencyMs = Date.now() - startTime;
      const cost = this.calculateCost(effectiveModelId, inputTokens, outputTokens);

      this.logger.log(
        `${effectiveModelId} 完成: ${totalTokens} tokens, ${latencyMs}ms, $${cost.toFixed(6)}`,
      );

      return {
        content,
        tokenUsage: totalTokens,
        latencyMs,
        cost,
        ...(thinking && { thinking }),
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      this.logger.error(
        `${effectiveModelId} 调用失败 (${latencyMs}ms): ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
