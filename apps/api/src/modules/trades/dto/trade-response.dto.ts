import {
  IsOptional,
  IsString,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

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
 * 盈亏状态筛选
 */
export enum PnlStatus {
  ALL = 'all',
  PROFIT = 'profit',
  LOSS = 'loss',
}

/**
 * 查询交易历史请求 DTO
 * 支持服务端分页、日期筛选、交易对搜索
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

  /**
   * 交易对搜索（模糊匹配）
   * 示例: "BTC" 会匹配 BTCUSDT, BTCBUSD 等
   */
  @IsOptional()
  @IsString()
  pair?: string;

  /**
   * 盈亏状态筛选
   * all - 全部, profit - 盈利, loss - 亏损
   */
  @IsOptional()
  @IsEnum(PnlStatus, { message: '盈亏状态必须是 all、profit 或 loss' })
  pnl_status?: PnlStatus;

  /**
   * 开始日期 (YYYY-MM-DD)
   */
  @IsOptional()
  @IsDateString({}, { message: '开始日期格式不正确，应为 YYYY-MM-DD' })
  start_date?: string;

  /**
   * 结束日期 (YYYY-MM-DD)
   */
  @IsOptional()
  @IsDateString({}, { message: '结束日期格式不正确，应为 YYYY-MM-DD' })
  end_date?: string;

  /**
   * 每页数量 (默认 20, 最大 100)
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '每页数量必须是整数' })
  @Min(1, { message: '每页数量最少为 1' })
  @Max(100, { message: '每页数量最多为 100' })
  limit?: number = 20;

  /**
   * 偏移量 (默认 0)
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '偏移量必须是整数' })
  @Min(0, { message: '偏移量不能为负数' })
  offset?: number = 0;
}

/**
 * 分页交易历史响应 DTO
 */
export class PaginatedTradesResponseDto {
  /** 交易列表 */
  trades: TradeResponseDto[];
  /** 总数 */
  total: number;
  /** 每页数量 */
  limit: number;
  /** 偏移量 */
  offset: number;
  /** 是否有更多 */
  has_more: boolean;
}
