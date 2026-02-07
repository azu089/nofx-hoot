/**
 * 统一交易对 Symbol 工具函数
 *
 * 全局约定：
 * - 合约交易统一使用 CCXT 标准格式: ETH/USDT:USDT
 * - 现货交易统一使用: ETH/USDT
 * - Freqtrade webhook 发送的 pair 格式即为 ETH/USDT:USDT（合约）或 ETH/USDT（现货）
 *
 * 本文件提供标准化函数，确保全链路 symbol 格式一致。
 */

/**
 * 标准化为合约 symbol 格式
 * 输入: "ETH/USDT", "ETH/USDT:USDT", "ETHUSDT" 等
 * 输出: "ETH/USDT:USDT"
 */
export function toFuturesSymbol(symbol: string): string {
  // 已经是合约格式
  if (symbol.includes(':')) {
    return symbol;
  }
  // ETH/USDT → ETH/USDT:USDT
  if (symbol.includes('/')) {
    const quote = symbol.split('/')[1];
    return `${symbol}:${quote}`;
  }
  // ETHUSDT → ETH/USDT:USDT（兜底）
  if (symbol.endsWith('USDT')) {
    const base = symbol.replace('USDT', '');
    return `${base}/USDT:USDT`;
  }
  return symbol;
}

/**
 * 标准化为现货 symbol 格式
 * 输入: "ETH/USDT:USDT", "ETH/USDT", "ETHUSDT"
 * 输出: "ETH/USDT"
 */
export function toSpotSymbol(symbol: string): string {
  // 移除合约后缀
  if (symbol.includes(':')) {
    return symbol.split(':')[0];
  }
  // 已经是现货格式
  if (symbol.includes('/')) {
    return symbol;
  }
  // ETHUSDT → ETH/USDT
  if (symbol.endsWith('USDT')) {
    const base = symbol.replace('USDT', '');
    return `${base}/USDT`;
  }
  return symbol;
}

/**
 * 根据交易类型标准化 symbol
 * futures → ETH/USDT:USDT
 * spot    → ETH/USDT
 */
export function normalizeSymbol(
  symbol: string,
  tradingType: 'futures' | 'spot' = 'futures',
): string {
  return tradingType === 'futures'
    ? toFuturesSymbol(symbol)
    : toSpotSymbol(symbol);
}

/**
 * 比较两个 symbol 是否代表同一交易对
 * 忽略 :USDT 后缀和 / 分隔符差异
 * "ETH/USDT:USDT" === "ETH/USDT" === "ETHUSDT"
 */
export function isSameSymbol(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s
      .replace(/:.*$/, '')
      .replace('/', '')
      .toUpperCase();
  return normalize(a) === normalize(b);
}
