/**
 * 交易所 WebSocket markPrice Provider 统一接口
 *
 * 每个交易所实现此接口，向 PriceWatchService 推送实时标记价格。
 * 连接管理（重连、心跳）由各 Provider 自己负责。
 */

export interface MarkPriceTick {
  symbol: string;      // 归一化格式，如 'BTC/USDT:USDT'
  markPrice: number;
  timestamp: number;   // ms
}

export type TickCallback = (tick: MarkPriceTick) => void;

export interface IWsProvider {
  /** 订阅某 symbol 的 markPrice 推送（symbol 为归一化格式） */
  subscribe(symbol: string, callback: TickCallback): void;

  /** 取消订阅（当该 symbol 无任何订阅时，自动关闭 WS 连接） */
  unsubscribe(symbol: string, callback: TickCallback): void;

  /** 关闭所有连接（模块销毁时调用） */
  destroy(): void;
}
