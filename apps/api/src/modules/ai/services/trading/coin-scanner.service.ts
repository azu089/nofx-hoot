import { Injectable, Logger } from '@nestjs/common';
import { LLMService, UserApiKeys } from '../llm.service';
import { MarketDataService } from '../market-data.service';
import { CoinSourceConfig } from '../../types/ai.types';

/**
 * 币种扫描服务 — 产品 B 五种币种来源模式
 *
 * 对齐 NoFx kernel/engine.go GetCandidateCoins() L414-572:
 * 1. static: 用户手动指定币种列表
 * 2. ai: LLM 推荐（根据用户标准）
 * 3. oi_top: OI 最高 N 个（多头兴趣集中）
 * 4. oi_low: OI 最低 N 个（空头/减仓候选）
 * 5. mixed: 混合模式（ai + oi_top + oi_low + static 去重合并）
 */
// R1: OI 最小流动性阈值（USD），对齐 NoFx minOIThresholdMillions = 15
const MIN_OI_VALUE_USD = 15_000_000;

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

    let result: string[];

    switch (config.mode) {
      case 'static':
      case 'manual':
        result = this.scanStatic(config);
        break;

      case 'ai':
        if (!apiKeys || !modelId) {
          this.logger.warn('[扫描] AI 模式需要 apiKeys 和 modelId，降级为 static');
          result = config.coins || this.CANDIDATE_POOL.slice(0, 5);
        } else {
          result = await this.scanAi(config, apiKeys, modelId);
        }
        break;

      case 'oi_top':
        result = await this.scanOiTop(config);
        break;

      case 'oi_low':
        result = await this.scanOiLow(config);
        break;

      case 'mixed':
        result = await this.scanMixed(config, apiKeys, modelId);
        break;

      default:
        this.logger.warn(`[扫描] 未知模式: ${config.mode}, 使用默认`);
        result = ['BTC/USDT', 'ETH/USDT'];
    }

    // 对齐 NoFx filterExcludedCoins (kernel/engine.go L549-572)
    return this.filterExcludedCoins(result, config.excludedCoins);
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
    const oiResults = await this.fetchAllOi();

    // R1: 流动性过滤 — 对齐 NoFx minOIThresholdMillions = 15
    const liquidResults = oiResults.filter((r) => r.oiValueUSD >= MIN_OI_VALUE_USD);

    // 按 OI 降序排序，取前 topN
    liquidResults.sort((a, b) => b.openInterest - a.openInterest);
    const selected = liquidResults.slice(0, topN).map((r) => r.symbol);

    this.logger.log(
      `[扫描] OI Top: 总${oiResults.length}个, 流动性达标${liquidResults.length}个, 选出${selected.length}个 (min $${(MIN_OI_VALUE_USD / 1e6).toFixed(0)}M)`,
    );

    return selected.length > 0 ? selected : ['BTC/USDT', 'ETH/USDT'];
  }

  // ========================= OI Low 模式 =========================
  // 对齐 NoFx kernel/engine.go L473-491
  // OI 最低的 N 个币种 — 减仓/空头候选

  private async scanOiLow(config: CoinSourceConfig): Promise<string[]> {
    const topN = config.maxCoins || 10;
    const oiResults = await this.fetchAllOi();

    // R1: 流动性过滤 — 低 OI 策略也不能选流动性过低的币（大滑点风险）
    const liquidResults = oiResults.filter((r) => r.oiValueUSD >= MIN_OI_VALUE_USD);

    // 按 OI 升序排序（最低在前）
    liquidResults.sort((a, b) => a.openInterest - b.openInterest);
    const selected = liquidResults.slice(0, topN).map((r) => r.symbol);

    this.logger.log(
      `[扫描] OI Low: 总${oiResults.length}个, 流动性达标${liquidResults.length}个, 选出${selected.length}个 (min $${(MIN_OI_VALUE_USD / 1e6).toFixed(0)}M)`,
    );

    return selected.length > 0 ? selected : ['BTC/USDT', 'ETH/USDT'];
  }

  // ========================= Mixed 模式 =========================
  // 对齐 NoFx kernel/engine.go L493-542
  // 混合多种来源去重合并

  private async scanMixed(
    config: CoinSourceConfig,
    apiKeys?: UserApiKeys,
    modelId?: string,
  ): Promise<string[]> {
    const maxCoins = config.maxCoins || 10;
    const seen = new Set<string>();
    const combined: string[] = [];

    const addUnique = (coins: string[]) => {
      for (const c of coins) {
        if (!seen.has(c)) {
          seen.add(c);
          combined.push(c);
        }
      }
    };

    // 1. OI Top（占 30%）
    try {
      const oiTopCoins = await this.scanOiTop({
        ...config,
        maxCoins: Math.ceil(maxCoins * 0.3),
      });
      addUnique(oiTopCoins);
    } catch (e) {
      this.logger.warn(`[扫描] Mixed OI Top 失败: ${e.message}`);
    }

    // 2. OI Low（占 20%）
    try {
      const oiLowCoins = await this.scanOiLow({
        ...config,
        maxCoins: Math.ceil(maxCoins * 0.2),
      });
      addUnique(oiLowCoins);
    } catch (e) {
      this.logger.warn(`[扫描] Mixed OI Low 失败: ${e.message}`);
    }

    // 3. AI 推荐（占 30%，需要 apiKeys）
    if (apiKeys && modelId) {
      try {
        const aiCoins = await this.scanAi(
          { ...config, maxCoins: Math.ceil(maxCoins * 0.3) },
          apiKeys,
          modelId,
        );
        addUnique(aiCoins);
      } catch (e) {
        this.logger.warn(`[扫描] Mixed AI 失败: ${e.message}`);
      }
    }

    // 4. Static 补足（如果不够 maxCoins）
    if (combined.length < maxCoins) {
      const staticCoins = config.coins || this.CANDIDATE_POOL;
      addUnique(staticCoins);
    }

    const result = combined.slice(0, maxCoins);
    this.logger.log(
      `[扫描] Mixed: 合并去重后 ${combined.length} 个, 最终 ${result.length} 个`,
    );

    return result.length > 0 ? result : ['BTC/USDT', 'ETH/USDT'];
  }

  // ========================= 辅助方法 =========================

  /**
   * 获取候选池所有币种的 OI（共享给 oi_top 和 oi_low）
   */
  private async fetchAllOi(): Promise<Array<{ symbol: string; openInterest: number; oiValueUSD: number }>> {
    const oiResults: Array<{ symbol: string; openInterest: number; oiValueUSD: number }> = [];
    const batchSize = 5;

    for (let i = 0; i < this.CANDIDATE_POOL.length; i += batchSize) {
      const batch = this.CANDIDATE_POOL.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (symbol) => {
          const oi = await this.marketData.fetchOpenInterest(symbol);
          return {
            symbol,
            openInterest: oi?.openInterest || 0,
            oiValueUSD: oi?.openInterestValue || 0, // R1: USD 计价
          };
        }),
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.openInterest > 0) {
          oiResults.push(r.value);
        }
      }

      // 批间延迟 500ms，避免 Binance rate limit
      if (i + batchSize < this.CANDIDATE_POOL.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    return oiResults;
  }

  /**
   * 过滤排除币种 — 对齐 NoFx filterExcludedCoins (kernel/engine.go L549-572)
   */
  private filterExcludedCoins(coins: string[], excluded?: string[]): string[] {
    if (!excluded || excluded.length === 0) return coins;

    const excludedSet = new Set(excluded.map((c) => c.toUpperCase()));
    const filtered = coins.filter((c) => !excludedSet.has(c.toUpperCase()));

    if (filtered.length < coins.length) {
      this.logger.log(
        `[扫描] 排除 ${coins.length - filtered.length} 个币种: ${excluded.join(', ')}`,
      );
    }

    return filtered;
  }

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
