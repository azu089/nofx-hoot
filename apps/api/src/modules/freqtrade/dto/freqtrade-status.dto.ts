/**
 * Freqtrade 状态响应 DTO
 */
export class FreqtradeStatusDto {
  state: 'running' | 'stopped';
  strategy_name?: string;
  max_open_trades: number;
  stake_amount: number;
  dry_run: boolean;
  exchange: string;
}
