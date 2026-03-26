import { Injectable } from '@nestjs/common';
import WebSocket from 'ws';
import { BaseWsProvider } from './base-ws.provider';
import { MarkPriceTick } from './ws-provider.interface';

/**
 * OKX 永续合约 markPrice WebSocket Provider
 *
 * 端点：wss://ws.okx.com:8443/ws/v5/public
 * 共享连接模式：一条 WS 订阅所有 symbol
 * channel: mark-price，instId: BTC-USDT-SWAP
 * 公开端点，无需 Auth
 */
@Injectable()
export class OkxWsProvider extends BaseWsProvider {
  constructor() {
    super('OkxWsProvider');
  }

  protected get useSharedConnection(): boolean { return true; }
  protected get sharedWsUrl(): string { return 'wss://ws.okx.com:8443/ws/v5/public'; }
  // OKX 要求每 20s 发一次 ping
  protected get heartbeatIntervalMs(): number { return 20_000; }
  protected get heartbeatMessage(): string { return 'ping'; }

  /** BTC/USDT:USDT → BTC-USDT-SWAP */
  protected toExchangeSymbol(symbol: string): string {
    const base = symbol.split('/')[0];
    return `${base}-USDT-SWAP`;
  }

  /** BTC-USDT-SWAP → BTC/USDT:USDT */
  protected fromExchangeSymbol(exchangeSymbol: string): string {
    const base = exchangeSymbol.replace('-USDT-SWAP', '');
    return `${base}/USDT:USDT`;
  }

  // 共享连接模式下 buildWsUrl 不用于 per-symbol
  protected buildWsUrl(_exchangeSymbol: string): string { return this.sharedWsUrl; }

  protected sendSubscribe(ws: WebSocket, exchangeSymbol: string): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      op: 'subscribe',
      args: [{ channel: 'mark-price', instId: exchangeSymbol }],
    }));
  }

  protected sendUnsubscribe(ws: WebSocket, exchangeSymbol: string): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      op: 'unsubscribe',
      args: [{ channel: 'mark-price', instId: exchangeSymbol }],
    }));
  }

  protected parseMessage(data: string): MarkPriceTick | null {
    if (data === 'pong') return null;
    const msg = JSON.parse(data);

    // 格式：{ arg: { channel: 'mark-price', instId: 'BTC-USDT-SWAP' }, data: [{ markPx: '69500.0', ts: '...' }] }
    if (msg.arg?.channel !== 'mark-price' || !msg.data?.[0]) return null;

    const tick = msg.data[0];
    const price = parseFloat(tick.markPx);
    if (!price || price <= 0) return null;

    return {
      symbol: this.fromExchangeSymbol(msg.arg.instId),
      markPrice: price,
      timestamp: parseInt(tick.ts, 10) || Date.now(),
    };
  }
}
