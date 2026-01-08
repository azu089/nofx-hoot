import { Injectable, Logger } from '@nestjs/common';

/**
 * 市场数据服务
 * 提供交易对搜索、热门交易对等功能
 *
 * 注意：实际的 K 线数据和交易对列表由用户 VPS 上的 Freqtrade 管理
 * 这里只提供前端搜索用的静态列表
 */
@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);

  // 支持的交易对列表（主流币种）
  private readonly SUPPORTED_SYMBOLS = [
    // 主流币
    'BTC/USDT',
    'ETH/USDT',
    'BNB/USDT',
    'SOL/USDT',
    'XRP/USDT',
    'DOGE/USDT',
    'ADA/USDT',
    'AVAX/USDT',
    'SHIB/USDT',
    'DOT/USDT',
    'LINK/USDT',
    'MATIC/USDT',
    'TRX/USDT',
    'UNI/USDT',
    'ATOM/USDT',
    'LTC/USDT',
    'ETC/USDT',
    'FIL/USDT',
    'APT/USDT',
    'ARB/USDT',
    // 其他热门币
    'OP/USDT',
    'INJ/USDT',
    'IMX/USDT',
    'SUI/USDT',
    'SEI/USDT',
    'TIA/USDT',
    'NEAR/USDT',
    'FTM/USDT',
    'ALGO/USDT',
    'VET/USDT',
    'ICP/USDT',
    'HBAR/USDT',
    'SAND/USDT',
    'MANA/USDT',
    'AAVE/USDT',
    'MKR/USDT',
    'SNX/USDT',
    'CRV/USDT',
    'LDO/USDT',
    'RUNE/USDT',
  ];

  // 热门交易对（推荐，置顶显示）
  private readonly POPULAR_SYMBOLS = [
    'BTC/USDT',
    'ETH/USDT',
    'BNB/USDT',
    'SOL/USDT',
    'XRP/USDT',
    'DOGE/USDT',
    'ADA/USDT',
    'AVAX/USDT',
    'LINK/USDT',
    'DOT/USDT',
  ];

  constructor() {
    this.logger.log(`市场服务已启动，支持 ${this.SUPPORTED_SYMBOLS.length} 个交易对`);
  }

  /**
   * 搜索交易对
   * @param search 搜索关键词（可选）
   * @param limit 返回数量限制
   * @returns 匹配的交易对列表
   */
  async searchSymbols(search?: string, limit: number = 50): Promise<string[]> {
    if (!search || search.trim() === '') {
      // 无搜索词时返回热门交易对 + 部分其他交易对
      const result = [...this.POPULAR_SYMBOLS];
      for (const symbol of this.SUPPORTED_SYMBOLS) {
        if (!result.includes(symbol)) {
          result.push(symbol);
          if (result.length >= limit) break;
        }
      }
      return result.slice(0, limit);
    }

    // 搜索匹配
    const searchUpper = search.toUpperCase().trim();
    const exactMatch: string[] = [];
    const startsWithMatch: string[] = [];
    const containsMatch: string[] = [];

    for (const symbol of this.SUPPORTED_SYMBOLS) {
      const baseCurrency = symbol.split('/')[0];

      // 精确匹配基础货币
      if (baseCurrency === searchUpper) {
        exactMatch.push(symbol);
      }
      // 以搜索词开头
      else if (baseCurrency.startsWith(searchUpper)) {
        startsWithMatch.push(symbol);
      }
      // 包含搜索词
      else if (symbol.toUpperCase().includes(searchUpper)) {
        containsMatch.push(symbol);
      }
    }

    // 按优先级合并结果
    const result = [...exactMatch, ...startsWithMatch, ...containsMatch];

    this.logger.debug(
      `搜索交易对 "${search}": 找到 ${result.length} 个匹配`,
    );

    return result.slice(0, limit);
  }

  /**
   * 获取热门交易对
   * @returns 热门交易对列表
   */
  getPopularSymbols(): string[] {
    return this.POPULAR_SYMBOLS;
  }

  /**
   * 获取所有支持的交易对
   */
  getAllSymbols(): string[] {
    return this.SUPPORTED_SYMBOLS;
  }
}
