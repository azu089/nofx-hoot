import { Injectable } from '@nestjs/common';
import WebSocket from 'ws';
import { BaseWsProvider } from './base-ws.provider';
import { MarkPriceTick } from './ws-provider.interface';

/**
 * Binance USDM 永续合约 markPrice WebSocket Provider
 *
 * 端点：wss://fstream.binance.com/ws/<symbol>@markPrice@1s
 * 每个 symbol 独立一条 WS 连接（每秒推送一次 markPrice）
 * 公开端点，无需 Auth
 */
@Injectable()
export class BinanceWsProvider extends BaseWsProvider {
  constructor() {
    super('BinanceWsProvider');
  }

  /** BTC/USDT:USDT → btcusdt */
  protected toExchangeSymbol(symbol: string): string {
    return symbol.split('/')[0].toLowerCase() +
      symbol.split('/')[1].split(':')[0].toLowerCase();
  }

  /** btcusdt → BTC/USDT:USDT */
  protected fromExchangeSymbol(exchangeSymbol: string): string {
    // 末尾固定是 usdt，截取基础币种
    const base = exchangeSymbol.replace('usdt', '').toUpperCase();
    return `${base}/USDT:USDT`;
  }

  protected buildWsUrl(exchangeSymbol: string): string {
    return `wss://fstream.binance.com/ws/${exchangeSymbol}@markPrice@1s`;
  }

  // 每 symbol 独立连接模式：open 后无需额外发订阅消息
  protected sendSubscribe(_ws: WebSocket, _exchangeSymbol: string): void {}
  protected sendUnsubscribe(_ws: WebSocket, _exchangeSymbol: string): void {}

  protected parseMessage(data: string): MarkPriceTick | null {
    const msg = JSON.parse(data);
    // 格式：{ e: 'markPriceUpdate', s: 'BTCUSDT', p: '69500.00', T: 1234567890000 }
    if (msg.e !== 'markPriceUpdate' || !msg.p || !msg.s) return null;

    const price = parseFloat(msg.p);
    if (!price || price <= 0) return null;

    return {
      symbol: this.fromExchangeSymbol(msg.s.toLowerCase()),
      markPrice: price,
      timestamp: msg.T ?? Date.now(),
    };
  }
}
