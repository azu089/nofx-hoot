import { Injectable } from '@nestjs/common';
import WebSocket from 'ws';
import { BaseWsProvider } from './base-ws.provider';
import { MarkPriceTick } from './ws-provider.interface';

/**
 * Bitget 永续合约 markPrice WebSocket Provider
 *
 * 端点：wss://ws.bitget.com/v2/ws/public
 * 共享连接模式
 * instType: USDT-FUTURES, channel: mark-price
 */
@Injectable()
export class BitgetWsProvider extends BaseWsProvider {
  constructor() {
    super('BitgetWsProvider');
  }

  protected get useSharedConnection(): boolean { return true; }
  protected get sharedWsUrl(): string { return 'wss://ws.bitget.com/v2/ws/public'; }
  protected get heartbeatIntervalMs(): number { return 25_000; }
  protected get heartbeatMessage(): string { return 'ping'; }

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
      args: [{ instType: 'USDT-FUTURES', channel: 'mark-price', instId: exchangeSymbol }],
    }));
  }

  protected sendUnsubscribe(ws: WebSocket, exchangeSymbol: string): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      op: 'unsubscribe',
      args: [{ instType: 'USDT-FUTURES', channel: 'mark-price', instId: exchangeSymbol }],
    }));
  }

  protected parseMessage(data: string): MarkPriceTick | null {
    if (data === 'pong') return null;
    const msg = JSON.parse(data);
    // 格式：{ action: 'update', arg: { channel: 'mark-price', instId: 'BTCUSDT' }, data: [{ markPrice: '69500', ts: '...' }] }
    if (msg.arg?.channel !== 'mark-price' || !msg.data?.[0]) return null;

    const price = parseFloat(msg.data[0].markPrice);
    if (!price || price <= 0) return null;

    return {
      symbol: this.fromExchangeSymbol(msg.arg.instId),
      markPrice: price,
      timestamp: parseInt(msg.data[0].ts, 10) || Date.now(),
    };
  }
}
