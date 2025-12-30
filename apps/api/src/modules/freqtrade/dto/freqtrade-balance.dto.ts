/**
 * Freqtrade 余额响应 DTO
 */
export class FreqtradeBalanceDto {
  currency: string;
  free: string; // 可用余额
  used: string; // 已使用余额
  total: string; // 总余额
}

/**
 * Freqtrade 余额总览响应
 */
export class FreqtradeBalancesDto {
  currencies: FreqtradeBalanceDto[];
  total: string; // 总资产（USDT）
  symbol: string;
  value: string;
  stake: string; // 质押货币
  note: string;
}
