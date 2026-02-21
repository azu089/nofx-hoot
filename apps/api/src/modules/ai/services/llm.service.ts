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
  private platformCfgCache: Record<string, { apiKey: string; enabled: boolean; modelName: string }> | null = null;
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
    'grok-3': { input: 3.0, output: 15.0 },
    'moonshot-v1-8k': { input: 0.17, output: 0.17 },
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
      ['claude-', 'openrouter'],
      ['gemini-', 'openrouter'],
      ['qwen-', 'qwen'],
      ['grok-', 'grok'],
      ['moonshot-', 'kimi'],
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
    } else if (modelId.startsWith('claude-') || modelId.startsWith('gemini-')) {
      provider = 'openrouter';
      baseURL = 'https://openrouter.ai/api/v1';
      apiKey = apiKeys.openrouter || (await this.getPlatformProviderConfig('openrouter')).apiKey || process.env.OPENROUTER_API_KEY || '';
    } else if (modelId.startsWith('qwen-')) {
      provider = 'qwen';
      baseURL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
      apiKey = apiKeys.qwen || (await this.getPlatformProviderConfig('qwen')).apiKey || process.env.QWEN_API_KEY || '';
    } else if (modelId.startsWith('grok-')) {
      provider = 'grok';
      baseURL = 'https://api.x.ai/v1';
      apiKey = apiKeys.grok || (await this.getPlatformProviderConfig('grok')).apiKey || process.env.GROK_API_KEY || '';
    } else if (modelId.startsWith('moonshot-')) {
      provider = 'kimi';
      baseURL = 'https://api.moonshot.cn/v1';
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
      timeout: 30000,
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
    } else if (modelId.startsWith('claude-') || modelId.startsWith('gemini-')) {
      if (apiKeys.openrouter || process.env.OPENROUTER_API_KEY) return true;
      const { apiKey } = await this.getPlatformProviderConfig('openrouter');
      return !!apiKey;
    } else if (modelId.startsWith('qwen-')) {
      if (apiKeys.qwen || process.env.QWEN_API_KEY) return true;
      const { apiKey } = await this.getPlatformProviderConfig('qwen');
      return !!apiKey;
    } else if (modelId.startsWith('grok-')) {
      if (apiKeys.grok || process.env.GROK_API_KEY) return true;
      const { apiKey } = await this.getPlatformProviderConfig('grok');
      return !!apiKey;
    } else if (modelId.startsWith('moonshot-')) {
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

    // 应用平台 modelName 覆盖（管理员可在后台指定具体版本，无需重部署）
    const effectiveModelId = await this.resolveModelId(modelId);
    if (effectiveModelId !== modelId) {
      this.logger.log(`模型覆盖: ${modelId} → ${effectiveModelId}`);
    }

    try {
      const client = await this.createClient(effectiveModelId, apiKeys);

      this.logger.log(`调用 ${effectiveModelId}: ${userMessage.slice(0, 50)}...`);

      // 调用 API（带重试）
      let response: OpenAI.Chat.Completions.ChatCompletion | undefined;
      let lastError: Error | undefined;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          response = await client.chat.completions.create({
            model: effectiveModelId,
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
      const cost = this.calculateCost(effectiveModelId, inputTokens, outputTokens);

      this.logger.log(
        `${effectiveModelId} 完成: ${totalTokens} tokens, ${latencyMs}ms, $${cost.toFixed(6)}`,
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
        `${effectiveModelId} 调用失败 (${latencyMs}ms): ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
