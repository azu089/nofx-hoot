import { Injectable } from '@nestjs/common';
import WebSocket from 'ws';
import { BaseWsProvider } from './base-ws.provider';
import { MarkPriceTick } from './ws-provider.interface';

/**
 * Gate.io 永续合约 markPrice WebSocket Provider
 *
 * 端点：wss://fx-ws.gateio.ws/v4/ws/usdt
 * 共享连接模式
 * channel: futures.mark_price
 */
@Injectable()
export class GateWsProvider extends BaseWsProvider {
  constructor() {
    super('GateWsProvider');
  }

  protected get useSharedConnection(): boolean { return true; }
  protected get sharedWsUrl(): string { return 'wss://fx-ws.gateio.ws/v4/ws/usdt'; }
  protected get heartbeatIntervalMs(): number { return 20_000; }

  /** BTC/USDT:USDT → BTC_USDT */
  protected toExchangeSymbol(symbol: string): string {
    const base = symbol.split('/')[0];
    return `${base}_USDT`;
  }

  /** BTC_USDT → BTC/USDT:USDT */
  protected fromExchangeSymbol(exchangeSymbol: string): string {
    const base = exchangeSymbol.replace('_USDT', '');
    return `${base}/USDT:USDT`;
  }

  protected buildWsUrl(_exchangeSymbol: string): string { return this.sharedWsUrl; }

  protected sendSubscribe(ws: WebSocket, exchangeSymbol: string): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      time: Math.floor(Date.now() / 1000),
      channel: 'futures.mark_price',
      event: 'subscribe',
      payload: [exchangeSymbol],
    }));
  }

  protected sendUnsubscribe(ws: WebSocket, exchangeSymbol: string): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      time: Math.floor(Date.now() / 1000),
      channel: 'futures.mark_price',
      event: 'unsubscribe',
      payload: [exchangeSymbol],
    }));
  }

  protected parseMessage(data: string): MarkPriceTick | null {
    const msg = JSON.parse(data);
    // 格式：{ channel: 'futures.mark_price', event: 'update', result: { contract: 'BTC_USDT', p: '69500', t: 1234567890 } }
    if (msg.channel !== 'futures.mark_price' || msg.event !== 'update' || !msg.result) return null;

    const price = parseFloat(msg.result.p);
    if (!price || price <= 0) return null;

    return {
      symbol: this.fromExchangeSymbol(msg.result.contract),
      markPrice: price,
      timestamp: (msg.result.t ?? 0) * 1000 || Date.now(),
    };
  }
}
