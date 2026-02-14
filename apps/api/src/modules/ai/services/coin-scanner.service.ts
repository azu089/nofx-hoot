import { Injectable, Logger } from '@nestjs/common';
import { LLMService, UserApiKeys } from './llm.service';
import { MarketDataService } from './market-data.service';
import { CoinSourceConfig } from '../types/ai.types';

/**
 * 币种扫描服务 — 产品 B 三种币种来源模式
 *
 * 参考 NoFx CoinSourceConfig:
 * 1. static: 用户手动指定币种列表
 * 2. ai: LLM 推荐（根据用户标准）
 * 3. oi_top: 按 OI（未平仓合约）变化排行
 */
@Injectable()
export class CoinScannerService {
  private readonly logger = new Logger(CoinScannerService.name);

  // 主流合约交易对候选池
  private readonly CANDIDATE_POOL = [
    'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
    'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'LINK/USDT',
    'MATIC/USDT', 'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'FIL/USDT',
    'APT/USDT', 'ARB/USDT', 'OP/USDT', 'SUI/USDT', 'NEAR/USDT',
    'PEPE/USDT', 'WIF/USDT', 'FET/USDT', 'INJ/USDT', 'TIA/USDT',
    'SEI/USDT', 'JUP/USDT', 'RENDER/USDT', 'STX/USDT', 'IMX/USDT',
  ];

  constructor(
    private readonly llm: LLMService,
    private readonly marketData: MarketDataService,
  ) {}

  /**
   * 根据配置扫描候选币种
   */
  async scanCoins(
    config: CoinSourceConfig,
    apiKeys?: UserApiKeys,
    modelId?: string,
  ): Promise<string[]> {
    this.logger.log(`[扫描] 模式: ${config.mode}`);

    switch (config.mode) {
      case 'static':
        return this.scanStatic(config);

      case 'ai':
        if (!apiKeys || !modelId) {
          this.logger.warn('[扫描] AI 模式需要 apiKeys 和 modelId，降级为 static');
          return config.coins || this.CANDIDATE_POOL.slice(0, 5);
        }
        return this.scanAi(config, apiKeys, modelId);

      case 'oi_top':
        return this.scanOiTop(config);

      default:
        this.logger.warn(`[扫描] 未知模式: ${config.mode}, 使用默认`);
        return ['BTC/USDT', 'ETH/USDT'];
    }
  }

  // ========================= Static 模式 =========================

  private scanStatic(config: CoinSourceConfig): string[] {
    const coins = config.coins || ['BTC/USDT', 'ETH/USDT'];
    this.logger.log(`[扫描] Static: ${coins.length} 个币种`);
    return coins;
  }

  // ========================= AI 模式 =========================

  private async scanAi(
    config: CoinSourceConfig,
    apiKeys: UserApiKeys,
    modelId: string,
  ): Promise<string[]> {
    const maxCoins = config.maxCoins || 5;
    const criteria = config.criteria || '高波动率、强趋势、充足流动性';

    const systemPrompt = `You are a crypto futures trading coin selector.
Your job is to select the best trading candidates from a pool of cryptocurrencies.

Respond with ONLY a JSON array of symbol strings, e.g.: ["BTC/USDT", "ETH/USDT", "SOL/USDT"]
Do NOT include any other text.`;

    const userMessage = `Select up to ${maxCoins} coins from the following pool based on these criteria:

Criteria: ${criteria}

Available coins:
${this.CANDIDATE_POOL.join(', ')}

Select the ${maxCoins} best candidates for futures trading. Focus on:
- High volatility (ATR-based movement)
- Clear trending patterns
- Sufficient liquidity and volume
- Current market narrative and momentum

Respond with ONLY a JSON array.`;

    try {
      const response = await this.llm.chat(
        modelId,
        systemPrompt,
        userMessage,
        apiKeys,
        { temperature: 0.3, maxTokens: 200 },
      );

      const parsed = this.parseCoinsResponse(response.content);
      this.logger.log(`[扫描] AI 推荐: ${parsed.join(', ')}`);
      return parsed.slice(0, maxCoins);
    } catch (error) {
      this.logger.warn(`[扫描] AI 推荐失败: ${error.message}, 降级为前 ${maxCoins} 个`);
      return this.CANDIDATE_POOL.slice(0, maxCoins);
    }
  }

  // ========================= OI Top 模式 =========================

  private async scanOiTop(config: CoinSourceConfig): Promise<string[]> {
    const topN = config.maxCoins || 10;
    // @deprecated minOiChange 需要双时间点 OI 数据才能计算变化率，V1 仅按绝对值排序
    const _minOiChange = config.minOiChange || 5;

    // 并行获取所有候选币种的 OI
    const oiResults: Array<{
      symbol: string;
      openInterest: number;
    }> = [];

    const batchSize = 5; // 每批 5 个，避免 rate limit
    for (let i = 0; i < this.CANDIDATE_POOL.length; i += batchSize) {
      const batch = this.CANDIDATE_POOL.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (symbol) => {
          const oi = await this.marketData.fetchOpenInterest(symbol);
          return { symbol, openInterest: oi?.openInterest || 0 };
        }),
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.openInterest > 0) {
          oiResults.push(r.value);
        }
      }

      // 批间延迟 500ms，避免 Binance rate limit (1200 req/min)
      if (i + batchSize < this.CANDIDATE_POOL.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // 按 OI 降序排序，取前 topN
    oiResults.sort((a, b) => b.openInterest - a.openInterest);
    const selected = oiResults.slice(0, topN).map((r) => r.symbol);

    this.logger.log(
      `[扫描] OI Top: 扫描 ${this.CANDIDATE_POOL.length} 个, 有效 ${oiResults.length} 个, 选出 ${selected.length} 个`,
    );

    return selected.length > 0 ? selected : ['BTC/USDT', 'ETH/USDT'];
  }

  // ========================= 辅助方法 =========================

  private parseCoinsResponse(content: string): string[] {
    try {
      // 尝试从 markdown code block 中提取
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      // 尝试找到 JSON 数组
      const arrayMatch = jsonStr.match(/\[[\s\S]*?\]/);
      if (arrayMatch) {
        jsonStr = arrayMatch[0];
      }

      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((s) => typeof s === 'string')
          .map((s) => s.toUpperCase())
          .filter((s) => this.CANDIDATE_POOL.includes(s));
      }

      return [];
    } catch {
      this.logger.warn('[扫描] AI 响应解析失败');
      return [];
    }
  }
}
