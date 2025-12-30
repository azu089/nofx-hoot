/**
 * 交易统计响应 DTO
 */
export class TradeStatsDto {
  total_trades: number; // 总交易数
  open_trades: number; // 持仓数
  closed_trades: number; // 已平仓数
  win_trades: number; // 盈利交易数
  loss_trades: number; // 亏损交易数
  win_rate: string; // 胜率（百分比）
  total_pnl: string; // 总盈亏（USDT）
  total_profit: string; // 总盈利（USDT）
  total_loss: string; // 总亏损（USDT）
  total_gas_fee: string; // 总手续费（USDT）
  avg_pnl_per_trade: string; // 平均每笔盈亏
  best_trade: string; // 最大单笔盈利
  worst_trade: string; // 最大单笔亏损
}
