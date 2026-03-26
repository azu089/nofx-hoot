import { Injectable, Logger } from '@nestjs/common';
import { IWsProvider, MarkPriceTick, TickCallback } from './ws-provider.interface';

/**
 * REST Fallback Provider
 *
 * 用途：
 * 1. DEX（Lighter、Aster）无 WS markPrice 端点
 * 2. CEX WS 断线时降级使用
 *
 * 实现方式：每个 symbol 独立 setInterval 轮询，
 * 轮询间隔由外部注入的 getPriceFn 决定（5s）。
 */
@Injectable()
export class RestFallbackProvider implements IWsProvider {
  private readonly logger = new Logger(RestFallbackProvider.name);

  // symbol → { callbacks, timer, getPriceFn }
  private subscriptions = new Map<string, {
    callbacks: Set<TickCallback>;
    timer: NodeJS.Timeout;
  }>();

  // 外部注入的价格获取函数（由 PriceWatchService 设置）
  private getPriceFn?: (symbol: string) => Promise<number>;
  private intervalMs = 5_000;

  setGetPriceFn(fn: (symbol: string) => Promise<number>, intervalMs = 5_000): void {
    this.getPriceFn = fn;
    this.intervalMs = intervalMs;
  }

  subscribe(symbol: string, callback: TickCallback): void {
    if (!this.subscriptions.has(symbol)) {
      const callbacks = new Set<TickCallback>();
      const timer = setInterval(() => this.poll(symbol), this.intervalMs);
      this.subscriptions.set(symbol, { callbacks, timer });
      // 立即执行一次
      setTimeout(() => this.poll(symbol), 100);
    }
    this.subscriptions.get(symbol)!.callbacks.add(callback);
  }

  unsubscribe(symbol: string, callback: TickCallback): void {
    const sub = this.subscriptions.get(symbol);
    if (!sub) return;

    sub.callbacks.delete(callback);
    if (sub.callbacks.size === 0) {
      clearInterval(sub.timer);
      this.subscriptions.delete(symbol);
    }
  }

  destroy(): void {
    for (const sub of this.subscriptions.values()) {
      clearInterval(sub.timer);
    }
    this.subscriptions.clear();
  }

  private async poll(symbol: string): Promise<void> {
    if (!this.getPriceFn) return;
    const sub = this.subscriptions.get(symbol);
    if (!sub || sub.callbacks.size === 0) return;

    try {
      const price = await this.getPriceFn(symbol);
      if (!price || price <= 0) return;

      const tick: MarkPriceTick = { symbol, markPrice: price, timestamp: Date.now() };
      for (const cb of sub.callbacks) {
        try { cb(tick); } catch (e: any) {
          this.logger.error(`[REST Fallback] 回调异常 ${symbol}: ${e.message}`);
        }
      }
    } catch (e: any) {
      this.logger.warn(`[REST Fallback] 获取价格失败 ${symbol}: ${e.message}`);
    }
  }
}
