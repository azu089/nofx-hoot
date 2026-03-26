import { Logger } from '@nestjs/common';
import WebSocket from 'ws';
import { IWsProvider, MarkPriceTick, TickCallback } from './ws-provider.interface';

/**
 * 基础 WebSocket Provider
 *
 * 封装通用逻辑：
 * - 多 symbol 共享一条 WS 连接（或按交易所要求每 symbol 一条）
 * - 指数退避自动重连（1s → 2s → 4s → 最长 30s）
 * - 心跳保活（ping/pong）
 * - 订阅回调 Map（symbol → Set<callback>）
 */
export abstract class BaseWsProvider implements IWsProvider {
  protected readonly logger: Logger;

  // symbol（归一化）→ 回调集合
  protected callbacks = new Map<string, Set<TickCallback>>();

  // exchangeSymbol → WS 实例（部分交易所每 symbol 一条连接）
  protected connections = new Map<string, WebSocket>();

  // 重连计时器
  private reconnectTimers = new Map<string, NodeJS.Timeout>();
  private reconnectDelays = new Map<string, number>();

  // 心跳计时器（共享连接模式用）
  private heartbeatTimer?: NodeJS.Timeout;

  protected destroyed = false;

  constructor(loggerName: string) {
    this.logger = new Logger(loggerName);
  }

  // ==================== 子类必须实现 ====================

  /** 将归一化 symbol（BTC/USDT:USDT）转为交易所格式 */
  protected abstract toExchangeSymbol(symbol: string): string;

  /** 将交易所格式 symbol 转回归一化格式 */
  protected abstract fromExchangeSymbol(exchangeSymbol: string): string;

  /** 构造 WS URL（每 symbol 一条连接模式用） */
  protected abstract buildWsUrl(exchangeSymbol: string): string;

  /** 连接建立后发送订阅消息（共享连接模式；每 symbol 独立连接模式可空实现） */
  protected abstract sendSubscribe(ws: WebSocket, exchangeSymbol: string): void;

  /** 发送取消订阅消息 */
  protected abstract sendUnsubscribe(ws: WebSocket, exchangeSymbol: string): void;

  /** 解析 WS 消息，返回 tick 或 null（无法解析时） */
  protected abstract parseMessage(data: string): MarkPriceTick | null;

  /** 是否使用共享连接模式（一条 WS 订阅多 symbol）；默认 false（每 symbol 一条） */
  protected get useSharedConnection(): boolean { return false; }

  /** 共享连接的 WS URL（useSharedConnection=true 时使用） */
  protected get sharedWsUrl(): string { return ''; }

  /** 心跳间隔（ms），0 表示不发送心跳 */
  protected get heartbeatIntervalMs(): number { return 0; }

  /** 心跳消息内容 */
  protected get heartbeatMessage(): string { return 'ping'; }

  // ==================== 公开接口 ====================

  subscribe(symbol: string, callback: TickCallback): void {
    if (this.destroyed) return;

    if (!this.callbacks.has(symbol)) {
      this.callbacks.set(symbol, new Set());
    }
    this.callbacks.get(symbol)!.add(callback);

    if (this.useSharedConnection) {
      this.ensureSharedConnection(symbol);
    } else {
      this.ensureSymbolConnection(symbol);
    }
  }

  unsubscribe(symbol: string, callback: TickCallback): void {
    const cbs = this.callbacks.get(symbol);
    if (!cbs) return;

    cbs.delete(callback);

    if (cbs.size === 0) {
      this.callbacks.delete(symbol);
      const exchangeSymbol = this.toExchangeSymbol(symbol);

      if (this.useSharedConnection) {
        const sharedWs = this.connections.get('__shared__');
        if (sharedWs && sharedWs.readyState === WebSocket.OPEN) {
          this.sendUnsubscribe(sharedWs, exchangeSymbol);
        }
        // 共享连接：所有 symbol 都取消后才关闭
        if (this.callbacks.size === 0) {
          this.closeConnection('__shared__');
        }
      } else {
        this.closeConnection(exchangeSymbol);
      }
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    for (const key of this.connections.keys()) {
      this.closeConnection(key);
    }
    for (const t of this.reconnectTimers.values()) clearTimeout(t);
    this.reconnectTimers.clear();
    this.callbacks.clear();
  }

  // ==================== 连接管理 ====================

  /** 每 symbol 独立连接模式 */
  private ensureSymbolConnection(symbol: string): void {
    const exchangeSymbol = this.toExchangeSymbol(symbol);
    if (this.connections.has(exchangeSymbol)) return;
    this.connect(exchangeSymbol, this.buildWsUrl(exchangeSymbol));
  }

  /** 共享连接模式 */
  private ensureSharedConnection(symbol: string): void {
    if (!this.connections.has('__shared__')) {
      this.connect('__shared__', this.sharedWsUrl, true);
    } else {
      const ws = this.connections.get('__shared__')!;
      if (ws.readyState === WebSocket.OPEN) {
        this.sendSubscribe(ws, this.toExchangeSymbol(symbol));
      }
      // 若仍在 CONNECTING，open 事件会批量订阅
    }
  }

  protected connect(key: string, url: string, isShared = false): void {
    if (this.destroyed) return;

    const ws = new WebSocket(url);
    this.connections.set(key, ws);

    ws.on('open', () => {
      this.reconnectDelays.delete(key);
      this.logger.log(`[WS] 已连接: ${key}`);

      if (isShared) {
        // 共享连接：订阅所有当前已注册的 symbol
        for (const sym of this.callbacks.keys()) {
          this.sendSubscribe(ws, this.toExchangeSymbol(sym));
        }
        this.startHeartbeat(ws);
      } else {
        // 从 key（exchangeSymbol）反查 symbol 并订阅
        const symbol = this.fromExchangeSymbol(key);
        this.sendSubscribe(ws, key);
        if (this.heartbeatIntervalMs > 0) this.startHeartbeat(ws);
        void symbol;
      }
    });

    ws.on('message', (raw: Buffer) => {
      try {
        const tick = this.parseMessage(raw.toString());
        if (!tick) return;

        const cbs = this.callbacks.get(tick.symbol);
        if (cbs) {
          for (const cb of cbs) {
            try { cb(tick); } catch (e: any) {
              this.logger.error(`[WS] 回调异常 ${tick.symbol}: ${e.message}`);
            }
          }
        }
      } catch (e: any) {
        // 静默忽略解析错误（订阅确认/心跳消息等）
      }
    });

    ws.on('close', (code) => {
      this.logger.warn(`[WS] 断开: ${key} code=${code}`);
      this.connections.delete(key);
      if (!this.destroyed && this.callbacks.size > 0) {
        this.scheduleReconnect(key, url, isShared);
      }
    });

    ws.on('error', (err) => {
      this.logger.error(`[WS] 错误: ${key} - ${err.message}`);
    });

    ws.on('pong', () => {
      // 心跳正常，不需要处理
    });
  }

  private scheduleReconnect(key: string, url: string, isShared: boolean): void {
    if (this.reconnectTimers.has(key)) return;

    const delay = Math.min(
      (this.reconnectDelays.get(key) ?? 1000) * 2,
      30_000,
    );
    this.reconnectDelays.set(key, delay);

    this.logger.warn(`[WS] ${delay / 1000}s 后重连: ${key}`);
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(key);
      if (!this.destroyed) {
        this.connect(key, url, isShared);
      }
    }, delay);
    this.reconnectTimers.set(key, timer);
  }

  private closeConnection(key: string): void {
    const timer = this.reconnectTimers.get(key);
    if (timer) { clearTimeout(timer); this.reconnectTimers.delete(key); }

    const ws = this.connections.get(key);
    if (ws) {
      ws.removeAllListeners();
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      this.connections.delete(key);
    }
  }

  private startHeartbeat(ws: WebSocket): void {
    if (this.heartbeatIntervalMs <= 0) return;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping(this.heartbeatMessage);
      }
    }, this.heartbeatIntervalMs);
  }
}
