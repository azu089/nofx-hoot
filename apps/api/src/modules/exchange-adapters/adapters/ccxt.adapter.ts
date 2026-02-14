/**
 * CcxtAdapter — CCXT 统一适配器
 *
 * 支持所有 CCXT 兼容的交易所:
 *   CEX: Binance, OKX, Bybit, Gate, Bitget, Coinbase
 *   DEX: Hyperliquid (CCXT 原生支持)
 *
 * 从 ai-execution.service.ts 提取并统一化
 *
 * NoFx 参考: trader/binance/futures.go
 */

import * as ccxt from 'ccxt';
import { Logger } from '@nestjs/common';
import { ExchangeAdapter } from '../types/adapter.interface';
import {
  ExchangeBalance,
  ExchangePosition,
  OrderResult,
  OrderStatus,
  OrderStatusDetail,
  OpenOrder,
  ClosedPnlRecord,
  MarketPrecision,
  ExchangeCategory,
} from '../types/exchange.types';

// CCXT 期货子类映射
const FUTURES_CLASS_MAP: Record<string, string> = {
  binance: 'binanceusdm',
  okx: 'okx',
  bybit: 'bybit',
  gate: 'gate',
  bitget: 'bitget',
  coinbase: 'coinbase',
  hyperliquid: 'hyperliquid',
};

// CCXT 订单状态 → 统一状态映射
function mapOrderStatus(status: string | undefined): OrderStatus {
  switch (status) {
    case 'open':
      return 'NEW';
    case 'closed':
      return 'FILLED';
    case 'canceled':
      return 'CANCELED';
    case 'expired':
      return 'EXPIRED';
    case 'rejected':
      return 'REJECTED';
    default:
      return 'NEW';
  }
}

export interface CcxtAdapterConfig {
  exchangeType: string;
  apiKey?: string;
  apiSecret?: string;
  walletAddress?: string;
  privateKey?: string;
  isTestnet: boolean;
}

export class CcxtAdapter implements ExchangeAdapter {
  readonly exchangeType: string;
  readonly category: ExchangeCategory;
  readonly isDex: boolean;
  readonly isTestnet: boolean;

  private exchange: ccxt.Exchange | null = null;
  private config: CcxtAdapterConfig;
  private readonly logger = new Logger(CcxtAdapter.name);

  constructor(config: CcxtAdapterConfig) {
    this.config = config;
    this.exchangeType = config.exchangeType;
    this.isDex = config.exchangeType === 'hyperliquid';
    this.isTestnet = config.isTestnet;
    this.category = this.isDex ? 'dex' : 'cex';
  }

  async initialize(): Promise<void> {
    const className =
      FUTURES_CLASS_MAP[this.exchangeType] || this.exchangeType;
    const ExchangeClass = (ccxt as any)[className];

    if (!ExchangeClass) {
      throw new Error(`CCXT 不支持交易所: ${className}`);
    }

    const options: any = {
      enableRateLimit: true,
      timeout: 60000,
      options: { defaultType: 'future', fetchCurrencies: false },
    };

    // CEX: API Key + Secret
    if (this.config.apiKey) {
      options.apiKey = this.config.apiKey;
      options.secret = this.config.apiSecret;
    }

    // DEX (Hyperliquid): wallet + private key
    if (this.config.walletAddress) {
      options.walletAddress = this.config.walletAddress;
    }
    if (this.config.privateKey) {
      options.privateKey = this.config.privateKey;
    }

    // 测试网
    if (this.isTestnet) {
      options.sandbox = true;
    }

    this.exchange = new ExchangeClass(options);

    // 显式加载期货市场（带容错，最多 3 次重试）
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.exchange.loadMarkets();
        break;
      } catch (e: any) {
        this.logger.warn(`加载市场数据失败(${attempt}/3): ${e.message}`);
        if (attempt === 3) throw e;
        await new Promise((r) => setTimeout(r, 3000 * attempt));
      }
    }
  }

  async dispose(): Promise<void> {
    this.exchange = null;
  }

  /** 获取底层 CCXT 实例（供内部使用） */
  getExchange(): ccxt.Exchange {
    if (!this.exchange) {
      throw new Error('适配器未初始化，请先调用 initialize()');
    }
    return this.exchange;
  }

  // ========================= 账户查询 =========================

  async getBalance(): Promise<ExchangeBalance> {
    const ex = this.getExchange();
    const balance = await ex.fetchBalance();
    const total = Number(balance.total?.['USDT'] || 0);
    const free = Number(balance.free?.['USDT'] || 0);
    return {
      totalEquity: total,
      availableBalance: free,
      usedMargin: total - free,
      unrealizedPnl: 0,
    };
  }

  async getPositions(): Promise<ExchangePosition[]> {
    const ex = this.getExchange();
    const positions = await ex.fetchPositions();
    return positions
      .filter((p: any) => Math.abs(Number(p.contracts || 0)) > 0)
      .map((p: any) => ({
        symbol: p.symbol,
        side: (p.side || 'long') as 'long' | 'short',
        quantity: Math.abs(Number(p.contracts || 0)),
        entryPrice: Number(p.entryPrice || 0),
        markPrice: Number(p.markPrice || 0),
        unrealizedPnl: Number(p.unrealizedPnl || 0),
        leverage: Number(p.leverage || 1),
        marginMode: (p.marginMode || 'cross') as 'cross' | 'isolated',
        margin: Number(p.initialMargin || p.collateral || 0),
        liquidationPrice: p.liquidationPrice
          ? Number(p.liquidationPrice)
          : undefined,
      }));
  }

  // ========================= 开仓 / 平仓 =========================

  async openLong(
    symbol: string,
    quantity: number,
    leverage: number,
  ): Promise<OrderResult> {
    const ex = this.getExchange();
    await this.setLeverage(symbol, leverage);
    const order = await ex.createMarketOrder(symbol, 'buy', quantity);
    return this.mapOrderResult(order);
  }

  async openShort(
    symbol: string,
    quantity: number,
    leverage: number,
  ): Promise<OrderResult> {
    const ex = this.getExchange();
    await this.setLeverage(symbol, leverage);
    const order = await ex.createMarketOrder(symbol, 'sell', quantity);
    return this.mapOrderResult(order);
  }

  async closeLong(symbol: string, quantity: number): Promise<OrderResult> {
    const ex = this.getExchange();
    const params: any = { reduceOnly: true };
    const order = await ex.createMarketOrder(
      symbol,
      'sell',
      quantity || undefined,
      undefined,
      params,
    );
    return this.mapOrderResult(order);
  }

  async closeShort(symbol: string, quantity: number): Promise<OrderResult> {
    const ex = this.getExchange();
    const params: any = { reduceOnly: true };
    const order = await ex.createMarketOrder(
      symbol,
      'buy',
      quantity || undefined,
      undefined,
      params,
    );
    return this.mapOrderResult(order);
  }

  // ========================= 杠杆 / 保证金 =========================

  async setLeverage(symbol: string, leverage: number): Promise<void> {
    const ex = this.getExchange();
    try {
      await ex.setLeverage(leverage, symbol);
    } catch (e: any) {
      // 忽略"已设置"错误
      if (!e.message?.includes('No need to change leverage')) {
        throw e;
      }
    }
  }

  async setMarginMode(
    symbol: string,
    isCrossMargin: boolean,
  ): Promise<void> {
    const ex = this.getExchange();
    const mode = isCrossMargin ? 'cross' : 'isolated';
    try {
      await ex.setMarginMode(mode, symbol);
    } catch (e: any) {
      // 忽略"已设置"或"有持仓"错误
      const msg = e.message || '';
      if (
        msg.includes('No need to change margin type') ||
        msg.includes('-4046') ||
        msg.includes('-4048')
      ) {
        return;
      }
      throw e;
    }
  }

  // ========================= 市场数据 =========================

  async getMarketPrice(symbol: string): Promise<number> {
    const ex = this.getExchange();
    const ticker = await ex.fetchTicker(symbol);
    return ticker.last || 0;
  }

  // ========================= 止盈止损 =========================

  async setStopLoss(
    symbol: string,
    positionSide: string,
    quantity: number,
    stopPrice: number,
  ): Promise<void> {
    const ex = this.getExchange();
    const side = positionSide === 'long' ? 'sell' : 'buy';
    await ex.createOrder(symbol, 'stop_market', side, quantity, undefined, {
      stopPrice,
      reduceOnly: true,
    });
  }

  async setTakeProfit(
    symbol: string,
    positionSide: string,
    quantity: number,
    takeProfitPrice: number,
  ): Promise<void> {
    const ex = this.getExchange();
    const side = positionSide === 'long' ? 'sell' : 'buy';
    await ex.createOrder(
      symbol,
      'take_profit_market',
      side,
      quantity,
      undefined,
      {
        stopPrice: takeProfitPrice,
        reduceOnly: true,
      },
    );
  }

  // ========================= 订单管理 =========================

  async cancelAllOrders(symbol: string): Promise<void> {
    const ex = this.getExchange();
    await ex.cancelAllOrders(symbol);
  }

  async cancelStopOrders(symbol: string): Promise<void> {
    const ex = this.getExchange();
    const openOrders = await ex.fetchOpenOrders(symbol);
    const stopOrders = openOrders.filter(
      (o: any) =>
        o.type?.includes('stop') || o.type?.includes('take_profit'),
    );
    for (const order of stopOrders) {
      try {
        await ex.cancelOrder(order.id, symbol);
      } catch {
        // 订单可能已被取消
      }
    }
  }

  async getOrderStatus(
    symbol: string,
    orderId: string,
  ): Promise<OrderStatusDetail> {
    const ex = this.getExchange();
    const order = await ex.fetchOrder(orderId, symbol);
    return {
      status: mapOrderStatus(order.status),
      avgPrice: Number(order.average || order.price || 0),
      filledQuantity: Number(order.filled || 0),
      fee: Number(order.fee?.cost || 0),
    };
  }

  async getOpenOrders(symbol: string): Promise<OpenOrder[]> {
    const ex = this.getExchange();
    const orders = await ex.fetchOpenOrders(symbol);
    return orders.map((o: any) => ({
      orderId: o.id,
      symbol: o.symbol,
      side: (o.side || 'buy') as 'buy' | 'sell',
      positionSide: 'long' as 'long' | 'short', // CCXT 不直接返回 positionSide
      type: (o.type || 'limit') as OpenOrder['type'],
      price: o.price ? Number(o.price) : undefined,
      stopPrice: o.stopPrice ? Number(o.stopPrice) : undefined,
      quantity: Number(o.amount || 0),
      status: o.status || 'open',
    }));
  }

  // ========================= 精度 =========================

  async formatQuantity(symbol: string, quantity: number): Promise<string> {
    const ex = this.getExchange();

    // 3 层精度降级策略（移植自 ai-execution.service.ts）
    try {
      return ex.amountToPrecision(symbol, quantity);
    } catch {
      // fallback 1: market.limits
      const market = ex.market(symbol);
      if (market?.limits?.amount?.min) {
        const step = market.limits.amount.min;
        const adjusted = Math.floor(quantity / step) * step;
        return adjusted.toString();
      }
      // fallback 2: market.precision
      if (market?.precision?.amount !== undefined) {
        const decimals =
          typeof market.precision.amount === 'number'
            ? market.precision.amount
            : 3;
        return quantity.toFixed(decimals);
      }
      // fallback 3: 3 位小数
      return quantity.toFixed(3);
    }
  }

  async getMarketPrecision(symbol: string): Promise<MarketPrecision> {
    const ex = this.getExchange();
    const market = ex.market(symbol);
    return {
      symbol,
      pricePrecision:
        typeof market.precision?.price === 'number'
          ? market.precision.price
          : 2,
      quantityPrecision:
        typeof market.precision?.amount === 'number'
          ? market.precision.amount
          : 3,
      minQuantity: market.limits?.amount?.min || 0,
      minNotional: market.limits?.cost?.min || 0,
      tickSize:
        typeof market.precision?.price === 'number'
          ? Math.pow(10, -market.precision.price)
          : 0.01,
      stepSize: market.limits?.amount?.min || 0.001,
    };
  }

  // ========================= 历史数据 =========================

  async getClosedPnl(
    _startTime: Date,
    _limit: number,
  ): Promise<ClosedPnlRecord[]> {
    // CCXT 不统一支持此接口，返回空数组
    return [];
  }

  // ========================= 内部辅助 =========================

  private mapOrderResult(order: ccxt.Order): OrderResult {
    return {
      orderId: order.id,
      symbol: order.symbol || '',
      side: (order.side || 'buy') as 'buy' | 'sell',
      avgPrice: Number(order.average || order.price || 0),
      quantity: Number(order.amount || 0),
      filledQuantity: Number(order.filled || 0),
      fee: Number(order.fee?.cost || 0),
      status: mapOrderStatus(order.status),
    };
  }
}
