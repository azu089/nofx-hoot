/**
 * Freqtrade 交易响应 DTO
 */
export class FreqtradeTradeDto {
  trade_id: number;
  pair: string;
  is_open: boolean;
  fee_open: string;
  fee_close: string;
  open_rate: string;
  close_rate?: string;
  amount: string;
  stake_amount: string;
  strategy: string;
  buy_tag?: string;
  timeframe: number;
  open_date: string;
  close_date?: string;
  profit_pct?: string;
  profit_abs?: string;
  sell_reason?: string;
  leverage?: number;
}

/**
 * Freqtrade 持仓响应
 */
export class FreqtradeOpenTradeDto {
  trade_id: number;
  pair: string;
  is_open: boolean;
  open_rate: string;
  amount: string;
  stake_amount: string;
  current_rate?: string;
  current_profit?: string;
  current_profit_pct?: string;
  stop_loss?: string;
  initial_stop_loss?: string;
  strategy: string;
  open_date: string;
  leverage?: number;
}

/**
 * 强制平仓请求 DTO
 */
export class ForceExitDto {
  tradeid: number; // Freqtrade API 使用小写 tradeid
}
