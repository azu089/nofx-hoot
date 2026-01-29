/**
 * 共享常量
 */

// ========== 交易所 ==========

export const EXCHANGES = ['binance', 'okx', 'bybit'] as const;

export const EXCHANGE_NAMES: Record<string, string> = {
  binance: 'Binance',
  okx: 'OKX',
  bybit: 'Bybit',
};

// ========== 错误码 ==========

export const ERROR_CODES = {
  // 成功
  SUCCESS: 0,

  // 参数错误 40000-40999
  INVALID_PARAMS: 40001,
  MISSING_PARAMS: 40002,

  // 认证错误 41000-41999
  UNAUTHORIZED: 41001,
  INVALID_TOKEN: 41002,
  TOKEN_EXPIRED: 41003,

  // 权限错误 42000-42999
  FORBIDDEN: 42001,
  NO_PERMISSION: 42002,

  // 业务错误 43000-43999
  USER_NOT_FOUND: 43001,
  USER_ALREADY_EXISTS: 43002,
  INVALID_PASSWORD: 43003,
  API_KEY_NOT_FOUND: 43004,
  STRATEGY_NOT_FOUND: 43005,
  INSUFFICIENT_BALANCE: 43006,
  POSITION_NOT_FOUND: 43007,

  // 系统错误 50000-50999
  INTERNAL_ERROR: 50001,
  DATABASE_ERROR: 50002,
  EXCHANGE_ERROR: 50003,
} as const;

// ========== 默认值 ==========

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const DEFAULT_MAX_POSITIONS = 3;
export const DEFAULT_AMOUNT_PER_TRADE = '100'; // USDT

// ========== 时间 ==========

export const HEARTBEAT_INTERVAL = 15 * 60 * 1000; // 15 分钟
export const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 天
