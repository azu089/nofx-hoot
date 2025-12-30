import { IsOptional, IsString } from 'class-validator';

/**
 * 交易历史响应 DTO
 */
export class TradeResponseDto {
  id: string;
  user_id: string;
  instance_id?: string;
  strategy_id?: string;
  exchange: string;
  symbol: string;
  side: string;
  order_type: string;
  entry_price?: string;
  exit_price?: string;
  quantity: string;
  leverage?: number;
  pnl?: string;
  pnl_percentage?: string;
  gas_fee?: string;
  status: string;
  opened_at: Date;
  closed_at?: Date;
  synced_at?: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * 查询交易历史请求 DTO
 */
export class QueryTradesDto {
  @IsOptional()
  @IsString()
  instance_id?: string;

  @IsOptional()
  @IsString()
  strategy_id?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  symbol?: string;
}
