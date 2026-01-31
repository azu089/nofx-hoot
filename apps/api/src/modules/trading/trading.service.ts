import { Injectable, Logger } from '@nestjs/common';
import * as ccxt from 'ccxt';
import { ApiKeysService } from '../api-keys/api-keys.service';

export interface OrderResult {
  orderId: string;
  symbol: string;
  side: string;
  amount: number;
  price: number;
  status: string;
  exchange: string;
}

// 交易配置
export interface TradingConfig {
  tradingType: 'spot' | 'futures';
  leverage?: number;
  marginMode?: 'cross' | 'isolated';
  slippageTolerance?: number; // 百分比，如 0.5 表示 0.5%
  maxRetries?: number;
  retryDelayMs?: number;
}

// 默认配置
const DEFAULT_CONFIG: TradingConfig = {
  tradingType: 'spot',
  leverage: 1,
  marginMode: 'cross',
  slippageTolerance: 0.5,
  maxRetries: 3,
  retryDelayMs: 1000,
};

@Injectable()
export class TradingService {
  private readonly logger = new Logger(TradingService.name);
  private exchangeInstances: Map<string, ccxt.Exchange> = new Map();

  constructor(private apiKeysService: ApiKeysService) {}

  // 获取或创建交易所实例
  private async getExchange(
    userId: string,
    apiKeyId: string,
    config: TradingConfig = DEFAULT_CONFIG,
  ): Promise<ccxt.Exchange> {
    const cacheKey = `${userId}:${apiKeyId}:${config.tradingType}`;

    // 检查缓存
    if (this.exchangeInstances.has(cacheKey)) {
      return this.exchangeInstances.get(cacheKey)!;
    }

    // 获取解密的 API Key
    const credentials = await this.apiKeysService.getDecryptedApiKey(
      userId,
      apiKeyId,
    );

    // 创建交易所实例
    const ExchangeClass = ccxt[credentials.exchange as keyof typeof ccxt];
    if (!ExchangeClass) {
      throw new Error(`不支持的交易所: ${credentials.exchange}`);
    }

    const exchangeOptions: any = {
      apiKey: credentials.apiKey,
      secret: credentials.apiSecret,
      enableRateLimit: true,
      options: {
        defaultType: config.tradingType === 'futures' ? 'future' : 'spot',
      },
    };

    // 合约交易额外配置
    if (config.tradingType === 'futures') {
      exchangeOptions.options.defaultMarginMode = config.marginMode || 'cross';
    }

    const exchange = new (ExchangeClass as any)(exchangeOptions);

    // 加载市场信息
    await exchange.loadMarkets();

    // 如果是合约交易，设置杠杆
    if (config.tradingType === 'futures' && config.leverage && config.leverage > 1) {
      this.logger.log(`设置杠杆: ${config.leverage}x`);
      // 注意：杠杆需要在具体交易对上设置，这里只是记录
    }

    // 缓存实例（5分钟后过期）
    this.exchangeInstances.set(cacheKey, exchange);
    setTimeout(() => {
      this.exchangeInstances.delete(cacheKey);
    }, 5 * 60 * 1000);

    return exchange;
  }

  // 带重试的执行函数
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `执行失败 (尝试 ${attempt}/${maxRetries}): ${lastError.message}`,
        );

        // 判断是否可重试的错误
        if (!this.isRetryableError(error)) {
          throw error;
        }

        if (attempt < maxRetries) {
          await this.sleep(delayMs * attempt); // 指数退避
        }
      }
    }

    throw lastError;
  }

  // 判断错误是否可重试
  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'ETIMEDOUT',
      'ECONNRESET',
      'ENOTFOUND',
      'ESOCKETTIMEDOUT',
      'RequestTimeout',
      'NetworkError',
    ];

    const message = error?.message || '';
    return retryableErrors.some((e) => message.includes(e));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 执行交易（带完整配置支持）
  async executeOrder(
    userId: string,
    apiKeyId: string,
    symbol: string,
    side: 'buy' | 'sell',
    amountUsdt: number,
    config: TradingConfig = DEFAULT_CONFIG,
  ): Promise<OrderResult> {
    const exchange = await this.getExchange(userId, apiKeyId, config);
    const { maxRetries, retryDelayMs, slippageTolerance, leverage, tradingType } = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    this.logger.log(
      `执行交易: ${side} ${symbol} 金额 ${amountUsdt} USDT (${tradingType}${tradingType === 'futures' ? ` ${leverage}x` : ''})`,
    );

    // 检查交易对是否存在
    if (!exchange.markets[symbol]) {
      throw new Error(`交易对不存在: ${symbol}`);
    }

    const market = exchange.markets[symbol];

    // 带重试的执行
    return this.executeWithRetry(
      async () => {
        // 获取当前价格
        const ticker = await exchange.fetchTicker(symbol);
        const currentPrice = ticker.last || ticker.close;

        if (!currentPrice) {
          throw new Error('无法获取当前价格');
        }

        // 计算下单数量（USDT 金额 / 当前价格）
        let amount = amountUsdt / currentPrice;

        // 合约交易考虑杠杆
        if (tradingType === 'futures' && leverage && leverage > 1) {
          // 杠杆交易，实际开仓金额 = 本金 * 杠杆
          // 但下单数量保持不变（保证金占用 = amountUsdt / leverage）
          this.logger.log(`合约交易: 本金 ${amountUsdt} USDT, ${leverage}x 杠杆`);

          // 在币安等交易所，需要先设置杠杆
          try {
            await (exchange as any).setLeverage(leverage, symbol);
          } catch (e) {
            this.logger.warn(`设置杠杆失败（可能已设置）: ${(e as Error).message}`);
          }
        }

        // 检查最小下单量
        const minAmount = market.limits?.amount?.min;
        if (minAmount && amount < minAmount) {
          throw new Error(`下单量 ${amount} 低于最小值 ${minAmount}`);
        }

        // 精度处理（使用 CCXT 内置方法）
        amount = parseFloat(exchange.amountToPrecision(symbol, amount));

        this.logger.log(`计算下单: 价格 ${currentPrice}, 数量 ${amount}`);

        // 创建市价订单（可选滑点保护）
        let order;
        if (slippageTolerance && slippageTolerance > 0) {
          // 使用限价单模拟滑点保护
          const slippageMultiplier = side === 'buy'
            ? 1 + slippageTolerance / 100
            : 1 - slippageTolerance / 100;
          const limitPrice = currentPrice * slippageMultiplier;
          const precisePrice = parseFloat(exchange.priceToPrecision(symbol, limitPrice));

          this.logger.log(`滑点保护: 限价 ${precisePrice} (容忍 ${slippageTolerance}%)`);

          // 使用 IOC（Immediate or Cancel）限价单
          order = await exchange.createOrder(
            symbol,
            'limit',
            side,
            amount,
            precisePrice,
            { timeInForce: 'IOC' },
          );
        } else {
          // 普通市价单
          order = await exchange.createMarketOrder(symbol, side, amount);
        }

        this.logger.log(`订单创建成功: ${order.id}`);

        return {
          orderId: order.id,
          symbol: order.symbol,
          side: order.side,
          amount: order.amount || order.filled || amount,
          price: order.average || order.price || currentPrice,
          status: order.status,
          exchange: exchange.id,
        };
      },
      maxRetries,
      retryDelayMs,
    );
  }

  // 查询余额
  async fetchBalance(
    userId: string,
    apiKeyId: string,
    config: TradingConfig = DEFAULT_CONFIG,
  ): Promise<number> {
    const exchange = await this.getExchange(userId, apiKeyId, config);
    const balance = await exchange.fetchBalance();

    return balance.free?.USDT || 0;
  }

  // 查询合约持仓
  async fetchPositions(
    userId: string,
    apiKeyId: string,
    symbol?: string,
  ): Promise<any[]> {
    const config: TradingConfig = { tradingType: 'futures' };
    const exchange = await this.getExchange(userId, apiKeyId, config);

    try {
      const positions = await (exchange as any).fetchPositions(symbol ? [symbol] : undefined);
      return positions.filter((p: any) => parseFloat(p.contracts || p.info?.positionAmt || '0') !== 0);
    } catch (error) {
      this.logger.warn(`获取合约持仓失败: ${(error as Error).message}`);
      return [];
    }
  }

  // 关闭持仓（平仓）
  async closePosition(
    userId: string,
    apiKeyId: string,
    symbol: string,
    amount: number,
    side: 'long' | 'short',
    config: TradingConfig = DEFAULT_CONFIG,
  ): Promise<OrderResult> {
    // 平仓 = 反向下单
    const closeSide = side === 'long' ? 'sell' : 'buy';
    const { maxRetries, retryDelayMs, tradingType } = { ...DEFAULT_CONFIG, ...config };

    const exchange = await this.getExchange(userId, apiKeyId, config);

    return this.executeWithRetry(
      async () => {
        // 精度处理
        const preciseAmount = parseFloat(
          exchange.amountToPrecision(symbol, amount),
        );

        this.logger.log(
          `平仓: ${closeSide} ${symbol} 数量 ${preciseAmount} (${tradingType})`,
        );

        let order;
        if (tradingType === 'futures') {
          // 合约平仓，使用 reduceOnly
          order = await exchange.createMarketOrder(
            symbol,
            closeSide,
            preciseAmount,
            undefined,
            { reduceOnly: true },
          );
        } else {
          // 现货平仓，直接卖出
          order = await exchange.createMarketOrder(symbol, closeSide, preciseAmount);
        }

        this.logger.log(`平仓订单成功: ${order.id}`);

        return {
          orderId: order.id,
          symbol: order.symbol,
          side: order.side,
          amount: order.amount || order.filled || preciseAmount,
          price: order.average || order.price || 0,
          status: order.status,
          exchange: exchange.id,
        };
      },
      maxRetries,
      retryDelayMs,
    );
  }

  // 部分平仓
  async closePositionPartially(
    userId: string,
    apiKeyId: string,
    symbol: string,
    totalAmount: number,
    closeRatio: number, // 0-1，如 0.5 表示平仓 50%
    side: 'long' | 'short',
    config: TradingConfig = DEFAULT_CONFIG,
  ): Promise<OrderResult> {
    const closeAmount = totalAmount * closeRatio;
    this.logger.log(
      `部分平仓: ${symbol} 平仓比例 ${closeRatio * 100}%，数量 ${closeAmount}`,
    );
    return this.closePosition(userId, apiKeyId, symbol, closeAmount, side, config);
  }

  // 获取当前价格
  async getCurrentPrice(
    userId: string,
    apiKeyId: string,
    symbol: string,
    config: TradingConfig = DEFAULT_CONFIG,
  ): Promise<number> {
    const exchange = await this.getExchange(userId, apiKeyId, config);
    const ticker = await exchange.fetchTicker(symbol);
    return ticker.last || ticker.close || 0;
  }

  // 检查交易对是否支持
  async isSymbolSupported(
    userId: string,
    apiKeyId: string,
    symbol: string,
    config: TradingConfig = DEFAULT_CONFIG,
  ): Promise<boolean> {
    const exchange = await this.getExchange(userId, apiKeyId, config);
    return !!exchange.markets[symbol];
  }
}
