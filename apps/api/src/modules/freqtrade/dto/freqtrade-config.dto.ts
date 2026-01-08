/**
 * Freqtrade 配置响应 DTO
 * 对应 Freqtrade REST API /api/v1/show_config
 */

/**
 * 交易对列表配置
 */
export interface PairlistConfig {
  method: string;
  number_assets?: number;
  sort_key?: string;
  min_value?: number;
  refresh_period?: number;
}

/**
 * 交易所配置
 */
export interface ExchangeConfig {
  name: string;
  key?: string;
  secret?: string;
  ccxt_config?: Record<string, unknown>;
  ccxt_sync_config?: Record<string, unknown>;
}

/**
 * Freqtrade 完整配置 DTO
 */
export class FreqtradeConfigDto {
  // 策略信息
  strategy?: string;
  strategy_path?: string;

  // 交易参数
  timeframe?: string;
  stake_currency?: string;
  stake_amount?: string | number;
  max_open_trades?: number;
  tradable_balance_ratio?: number;

  // 运行模式
  dry_run?: boolean;
  dry_run_wallet?: number;

  // 交易所配置
  exchange?: ExchangeConfig;

  // 交易对配置
  pairlists?: PairlistConfig[];
  pair_whitelist?: string[];
  pair_blacklist?: string[];

  // 止损配置
  stoploss?: number;
  trailing_stop?: boolean;
  trailing_stop_positive?: number;
  trailing_stop_positive_offset?: number;
  trailing_only_offset_is_reached?: boolean;
  stoploss_on_exchange?: boolean;

  // 分阶段止盈 (minimal_roi)
  minimal_roi?: Record<string, number>;

  // 其他配置
  unfilledtimeout?: {
    entry?: number;
    exit?: number;
    unit?: string;
  };
  entry_pricing?: {
    price_side?: string;
    use_order_book?: boolean;
    order_book_top?: number;
  };
  exit_pricing?: {
    price_side?: string;
    use_order_book?: boolean;
    order_book_top?: number;
  };

  // API 服务器配置
  api_server?: {
    enabled?: boolean;
    listen_ip_address?: string;
    listen_port?: number;
    verbosity?: string;
  };

  // 机器人名称
  bot_name?: string;

  // 原始配置（用于调试）
  _raw?: Record<string, unknown>;
}
