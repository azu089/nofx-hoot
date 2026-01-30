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

@Injectable()
export class TradingService {
  private readonly logger = new Logger(TradingService.name);
  private exchangeInstances: Map<string, ccxt.Exchange> = new Map();

  constructor(private apiKeysService: ApiKeysService) {}

  // 获取或创建交易所实例
  private async getExchange(
    userId: string,
    apiKeyId: string,
  ): Promise<ccxt.Exchange> {
    const cacheKey = `${userId}:${apiKeyId}`;

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

    const exchange = new (ExchangeClass as any)({
      apiKey: credentials.apiKey,
      secret: credentials.apiSecret,
      enableRateLimit: true,
      options: {
        defaultType: 'future', // 使用合约交易
      },
    });

    // 加载市场信息
    await exchange.loadMarkets();

    // 缓存实例（5分钟后过期）
    this.exchangeInstances.set(cacheKey, exchange);
    setTimeout(() => {
      this.exchangeInstances.delete(cacheKey);
    }, 5 * 60 * 1000);

    return exchange;
  }

  // 执行交易
  async executeOrder(
    userId: string,
    apiKeyId: string,
    symbol: string,
    side: 'buy' | 'sell',
    amountUsdt: number,
  ): Promise<OrderResult> {
    const exchange = await this.getExchange(userId, apiKeyId);

    this.logger.log(
      `执行交易: ${side} ${symbol} 金额 ${amountUsdt} USDT`,
    );

    // 检查交易对是否存在
    if (!exchange.markets[symbol]) {
      throw new Error(`交易对不存在: ${symbol}`);
    }

    const market = exchange.markets[symbol];

    // 获取当前价格
    const ticker = await exchange.fetchTicker(symbol);
    const currentPrice = ticker.last || ticker.close;

    if (!currentPrice) {
      throw new Error('无法获取当前价格');
    }

    // 计算下单数量（USDT 金额 / 当前价格）
    let amount = amountUsdt / currentPrice;

    // 检查最小下单量
    const minAmount = market.limits?.amount?.min;
    if (minAmount && amount < minAmount) {
      throw new Error(
        `下单量 ${amount} 低于最小值 ${minAmount}`,
      );
    }

    // 精度处理（使用 CCXT 内置方法）
    amount = parseFloat(exchange.amountToPrecision(symbol, amount));

    this.logger.log(
      `计算下单: 价格 ${currentPrice}, 数量 ${amount}`,
    );

    // 创建市价订单
    const order = await exchange.createMarketOrder(symbol, side, amount);

    this.logger.log(`订单创建成功: ${order.id}`);

    return {
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      amount: order.amount,
      price: order.average || order.price || currentPrice,
      status: order.status,
      exchange: exchange.id,
    };
  }

  // 查询余额
  async fetchBalance(userId: string, apiKeyId: string): Promise<number> {
    const exchange = await this.getExchange(userId, apiKeyId);
    const balance = await exchange.fetchBalance();

    return balance.free?.USDT || 0;
  }

  // 关闭持仓（平仓）
  async closePosition(
    userId: string,
    apiKeyId: string,
    symbol: string,
    amount: number,
    side: 'long' | 'short',
  ): Promise<OrderResult> {
    // 平仓 = 反向下单
    const closeSide = side === 'long' ? 'sell' : 'buy';

    const exchange = await this.getExchange(userId, apiKeyId);

    // 精度处理
    const preciseAmount = parseFloat(
      exchange.amountToPrecision(symbol, amount),
    );

    const order = await exchange.createMarketOrder(
      symbol,
      closeSide,
      preciseAmount,
      undefined,
      { reduceOnly: true }, // 只减仓
    );

    return {
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      amount: order.amount,
      price: order.average || order.price || 0,
      status: order.status,
      exchange: exchange.id,
    };
  }
}
