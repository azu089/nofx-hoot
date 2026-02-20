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
 * - DeepSeek
 * - OpenAI
 * - OpenRouter (Claude/Gemini)
 * - Qwen (阿里通义千问，DashScope OpenAI 兼容接口)
 * - Grok (xAI，OpenAI 兼容接口)
 * - Kimi (Moonshot AI，OpenAI 兼容接口)
 *
 * 双轨制 Key 解析（优先级从高到低）：
 * 1. 用户自备 Key（AiConfig.apiKeys 中配置，AES-256-GCM 加密存储）
 * 2. 平台默认 Key（环境变量 DEEPSEEK_API_KEY / OPENAI_API_KEY / OPENROUTER_API_KEY / QWEN_API_KEY / GROK_API_KEY / KIMI_API_KEY）
 *
 * 无论使用哪种 Key，预算系统均生效
 */
@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);

  // 平台 DB 配置缓存（5 分钟 TTL）
  private platformCfgCache: Record<string, { apiKey: string; enabled: boolean }> | null = null;
  private platformCfgLoadedAt = 0;
  private readonly PLATFORM_CFG_TTL_MS = 5 * 60 * 1000; // 5 分钟

  constructor(private prisma: PrismaService) {}

  // 模型成本配置（每百万 Token）
  private readonly modelCosts: Record<string, ModelCost> = {
    'deepseek-chat': { input: 0.14, output: 0.28 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'claude-3-5-haiku-20241022': { input: 1.0, output: 5.0 },
    'gemini-2.0-flash-001': { input: 0.10, output: 0.40 },
    'gemini-2.0-flash': { input: 0.10, output: 0.40 },
    'qwen-plus': { input: 0.80, output: 2.0 },
    'grok-2': { input: 2.0, output: 10.0 },
    'moonshot-v1-8k': { input: 0.17, output: 0.17 },
  };

  /**
   * 从 DB 或缓存中获取平台 API Key（三轨优先级第二层）
   * 读取 platform_configs.llm_platform_config，带 5 分钟 TTL 缓存
   */
  private async getPlatformApiKey(provider: string): Promise<string> {
    const now = Date.now();
    if (!this.platformCfgCache || now - this.platformCfgLoadedAt > this.PLATFORM_CFG_TTL_MS) {
      try {
        const row = await this.prisma.platformConfig.findUnique({
          where: { key: 'llm_platform_config' },
        });
        if (row?.value) {
          const parsed = JSON.parse(row.value) as {
            providers?: Record<string, { apiKey?: string; enabled?: boolean }>;
          };
          this.platformCfgCache = {};
          for (const [name, cfg] of Object.entries(parsed.providers || {})) {
            this.platformCfgCache[name] = { apiKey: cfg.apiKey || '', enabled: cfg.enabled ?? true };
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
    return this.platformCfgCache[provider]?.apiKey || '';
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
      apiKey = apiKeys.deepseek || await this.getPlatformApiKey('deepseek') || process.env.DEEPSEEK_API_KEY || '';
    } else if (modelId.startsWith('gpt-')) {
      provider = 'openai';
      baseURL = 'https://api.openai.com/v1';
      apiKey = apiKeys.openai || await this.getPlatformApiKey('openai') || process.env.OPENAI_API_KEY || '';
    } else if (modelId.startsWith('claude-') || modelId.startsWith('gemini-')) {
      provider = 'openrouter';
      baseURL = 'https://openrouter.ai/api/v1';
      apiKey = apiKeys.openrouter || await this.getPlatformApiKey('openrouter') || process.env.OPENROUTER_API_KEY || '';
    } else if (modelId.startsWith('qwen-')) {
      provider = 'qwen';
      baseURL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
      apiKey = apiKeys.qwen || await this.getPlatformApiKey('qwen') || process.env.QWEN_API_KEY || '';
    } else if (modelId.startsWith('grok-')) {
      provider = 'grok';
      baseURL = 'https://api.x.ai/v1';
      apiKey = apiKeys.grok || await this.getPlatformApiKey('grok') || process.env.GROK_API_KEY || '';
    } else if (modelId.startsWith('moonshot-')) {
      provider = 'kimi';
      baseURL = 'https://api.moonshot.cn/v1';
      apiKey = apiKeys.kimi || await this.getPlatformApiKey('kimi') || process.env.KIMI_API_KEY || '';
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
      timeout: 30000,
    });
  }

  /**
   * 检查是否有可用的 LLM Key（用户或平台）
   * 供外部调用方在发起分析前快速判断
   */
  hasAvailableKey(modelId: string, apiKeys: UserApiKeys): boolean {
    if (modelId.startsWith('deepseek')) {
      return !!(apiKeys.deepseek || process.env.DEEPSEEK_API_KEY);
    } else if (modelId.startsWith('gpt-')) {
      return !!(apiKeys.openai || process.env.OPENAI_API_KEY);
    } else if (modelId.startsWith('claude-') || modelId.startsWith('gemini-')) {
      return !!(apiKeys.openrouter || process.env.OPENROUTER_API_KEY);
    } else if (modelId.startsWith('qwen-')) {
      return !!(apiKeys.qwen || process.env.QWEN_API_KEY);
    } else if (modelId.startsWith('grok-')) {
      return !!(apiKeys.grok || process.env.GROK_API_KEY);
    } else if (modelId.startsWith('moonshot-')) {
      return !!(apiKeys.kimi || process.env.KIMI_API_KEY);
    }
    return false;
  }

  /** 获取 provider 对应的环境变量名 */
  private getEnvVarName(provider: string): string {
    const map: Record<string, string> = {
      deepseek: 'DEEPSEEK_API_KEY',
      openai: 'OPENAI_API_KEY',
      openrouter: 'OPENROUTER_API_KEY',
      qwen: 'QWEN_API_KEY',
      grok: 'GROK_API_KEY',
      kimi: 'KIMI_API_KEY',
    };
    return map[provider] || `${provider.toUpperCase()}_API_KEY`;
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
      const client = await this.createClient(modelId, apiKeys);

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
