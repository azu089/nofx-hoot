import { IsString, IsUUID, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// 持仓响应
export class PositionResponse {
  id: string;
  exchange: string;
  symbol: string;
  side: string;
  entryPrice: string;
  amount: string;
  currentPrice?: string;
  pnl?: string;
  pnlPercent?: string;
  status: string;
  exchangeOrderId?: string;
  strategyName?: string;
  closeReason?: string;
  closedAt?: Date;
  createdAt: Date;
  // 交易配置
  tradingType?: string; // spot, futures
  leverage?: number; // 杠杆倍数
  margin?: string; // 保证金（本金）
  marginMode?: string; // cross, isolated
  // 实时数据（同步自交易所）
  markPrice?: string; // 标记价格
  liquidationPrice?: string; // 强平价格
  unrealizedPnl?: string; // 未实现盈亏
  marginRatio?: string; // 保证金比率
  lastSyncAt?: Date; // 最后同步时间
}

// 持仓列表响应
export class PositionListResponse {
  items: PositionResponse[];
  total: number;
  totalPnl: string;
}

// 平仓 DTO
export class ClosePositionDto {
  @IsUUID('4')
  apiKeyId: string;
}

// 紧急清仓 DTO
export class EmergencyCloseAllDto {
  @IsUUID('4')
  apiKeyId: string;
}

// 交易历史查询 DTO
export class TradeHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsString()
  side?: string; // buy, sell

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  locale?: string; // 语言设置，前端自动传递
}

// 交易历史响应
export class TradeHistoryResponse {
  id: string;
  symbol: string;
  side: string;
  type: string;
  price: string; // 保持兼容，使用 closePrice
  entryPrice: string; // 开仓价
  closePrice: string; // 平仓价
  amount: string;
  total: string;
  pnl: string;
  pnlPercent?: string; // 收益率
  fee: string;
  status: string;
  closedAt: Date;
  createdAt: Date;
  // 交易配置
  tradingType?: string; // spot, futures
  leverage?: number;
  margin?: string;
  marginMode?: string;
  closeReason?: string; // 平仓原因：signal, stop_loss, take_profit, manual
  strategyName?: string; // 策略名称
}

// 执行日志响应
export class ExecutionLogResponse {
  id: string;
  time: Date;
  strategy: string;
  action: string;
  symbol: string;
  status: 'success' | 'warning' | 'error';
  message: string;
}

// 盈亏统计响应
export class PnlStatsResponse {
  totalPnl: string;
  todayPnl: string;
  weekPnl: string;
  monthPnl: string;
  unrealizedPnl: string;
  tradeCount: number;
  winRate: string;
}
