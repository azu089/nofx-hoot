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
  source?: string; // ai_strategy, ai_research, ai_analysis, strategy, manual
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

  @IsOptional()
  @IsString()
  exchange?: string; // 按交易所过滤（如 binance / okx）

  @IsOptional()
  @IsString()
  apiKeyId?: string; // 按 API Key 过滤（区分同交易所多账户）
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
  source?: string; // ai_strategy, ai_research, ai_analysis, strategy, manual
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
  // 执行详情
  orderId?: string;       // 交易所订单ID
  executedPrice?: string; // 成交价格
  executedAmount?: string;// 成交数量
  slippage?: string;      // 滑点百分比
  durationMs?: number;    // 执行耗时(ms)
  errorCode?: string;     // 错误码
  skipReason?: string;    // 跳过原因
  // AI 决策详情（来自 AiStrategyLog.decision JSON）
  confidence?: number;           // 置信度 0-100
  leverage?: number;             // 杠杆倍数
  positionSizePercent?: number;  // 仓位比例 1-20
  stopLoss?: number;             // 止损价格
  takeProfit?: number;           // 止盈价格
  reasoning?: string;            // AI 推理文本
  // 风控拦截详情（来自 executionResult JSON）
  blockedBy?: string;            // 拦截层标识
  blockReason?: string;          // 拦截原因
  // Debate 模式投票（来自 decision.votes）
  votes?: Array<{ modelId: string; action: string; confidence: number; reasoning?: string }>;
  // Grid 网格模式专属
  gridSummary?: string;    // 操作摘要 "5买/5卖"
  gridBuyRange?: string;   // 买单价格区间 "$0.1780~$0.1820"
  gridSellRange?: string;  // 卖单价格区间 "$0.1830~$0.1870"
  gridOrderCount?: number; // 总操作数
  // 策略类型标识（前端分策略渲染）
  strategyType?: 'research' | 'solo' | 'debate' | 'grid' | 'signal';
}

// 盈亏统计响应
export class PnlStatsResponse {
  totalPnl: string;
  todayPnl: string;
  todayRealizedPnl: string;
  weekPnl: string;
  monthPnl: string;
  unrealizedPnl: string;
  tradeCount: number;
  winRate: string;
}
