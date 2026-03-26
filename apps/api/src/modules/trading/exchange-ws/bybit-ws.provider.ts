import { Injectable } from '@nestjs/common';
import WebSocket from 'ws';
import { BaseWsProvider } from './base-ws.provider';
import { MarkPriceTick } from './ws-provider.interface';

/**
 * Bybit 线性永续合约 markPrice WebSocket Provider
 *
 * 端点：wss://stream.bybit.com/v5/public/linear
 * 共享连接模式：一条 WS 订阅所有 symbol
 * topic: tickers.BTCUSDT（含 markPrice 字段）
 * 每 20s 发一次 ping 保活
 */
@Injectable()
export class BybitWsProvider extends BaseWsProvider {
  constructor() {
    super('BybitWsProvider');
  }

  protected get useSharedConnection(): boolean { return true; }
  protected get sharedWsUrl(): string { return 'wss://stream.bybit.com/v5/public/linear'; }
  protected get heartbeatIntervalMs(): number { return 20_000; }
  protected get heartbeatMessage(): string { return JSON.stringify({ op: 'ping' }); }

  /** BTC/USDT:USDT → BTCUSDT */
  protected toExchangeSymbol(symbol: string): string {
    const base = symbol.split('/')[0];
    return `${base}USDT`;
  }

  /** BTCUSDT → BTC/USDT:USDT */
  protected fromExchangeSymbol(exchangeSymbol: string): string {
    const base = exchangeSymbol.replace('USDT', '');
    return `${base}/USDT:USDT`;
  }

  protected buildWsUrl(_exchangeSymbol: string): string { return this.sharedWsUrl; }

  protected sendSubscribe(ws: WebSocket, exchangeSymbol: string): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      op: 'subscribe',
      args: [`tickers.${exchangeSymbol}`],
    }));
  }

  protected sendUnsubscribe(ws: WebSocket, exchangeSymbol: string): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      op: 'unsubscribe',
      args: [`tickers.${exchangeSymbol}`],
    }));
  }

  protected parseMessage(data: string): MarkPriceTick | null {
    const msg = JSON.parse(data);

    // pong 响应
    if (msg.op === 'pong' || msg.ret_msg === 'pong') return null;

    // 格式：{ topic: 'tickers.BTCUSDT', data: { markPrice: '69500.00', ... }, ts: 1234567890000 }
    if (!msg.topic?.startsWith('tickers.') || !msg.data?.markPrice) return null;

    const price = parseFloat(msg.data.markPrice);
    if (!price || price <= 0) return null;

    const exchangeSymbol = msg.topic.replace('tickers.', '');
    return {
      symbol: this.fromExchangeSymbol(exchangeSymbol),
      markPrice: price,
      timestamp: msg.ts ?? Date.now(),
    };
  }
}
