import { IsString, IsUUID } from 'class-validator';

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
  createdAt: Date;
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
