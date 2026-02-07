import { IsString, IsNotEmpty, IsNumber, IsIn, IsOptional } from 'class-validator';
import { Transform, Type } from 'class-transformer';

// 交易动作类型
export type TradeAction = 'entry_long' | 'exit_long' | 'entry_short' | 'exit_short';

// Freqtrade Webhook 信号 DTO
// 兼容 Freqtrade JSON webhook 格式（price 可能是字符串）
export class WebhookSignalDto {
  @IsString()
  @IsNotEmpty()
  strategy: string; // 策略名称（对应 freqtradeId）

  @IsString()
  @IsNotEmpty()
  symbol: string; // 交易对，如 BTC/USDT

  @IsIn(['buy', 'sell'])
  side: 'buy' | 'sell';

  // Freqtrade JSON webhook 发送的 price 是字符串，需要自动转换
  @Transform(({ value }) => typeof value === 'string' ? parseFloat(value) : value)
  @IsNumber()
  price: number;

  // 交易动作: entry_long / exit_long / entry_short / exit_short
  // 若不传则从 side 推断: buy → entry_long, sell → exit_long（向后兼容）
  @IsOptional()
  @IsIn(['entry_long', 'exit_long', 'entry_short', 'exit_short'])
  action?: TradeAction;
}

// 信号响应
export class SignalResponse {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  side: string;
  price: string;
  distributedAt: Date | null;
  createdAt: Date;
}

// 信号分发任务数据
export interface SignalJobData {
  signalId: string;
  strategyId: string;
  symbol: string;
  side: 'buy' | 'sell';
  action: TradeAction;
  price: string;
}

// 交易配置（从订阅继承）
export interface TradingConfigData {
  tradingType: 'spot' | 'futures';
  leverage: number;
  marginMode: 'cross' | 'isolated';
  slippageTolerance: number;
  autoClose: boolean;
  stopLossPercent?: number;
  takeProfitPercent?: number;
  maxRetries: number;
  retryDelayMs: number;
}

// 交易任务数据
export interface TradeJobData {
  signalId: string;
  userId: string;
  subscriptionId: string;
  apiKeyId: string;
  exchange: string;
  symbol: string;
  side: 'buy' | 'sell';
  action: TradeAction;
  price: string;
  amountPerTrade: string;
  // 新增交易配置
  tradingConfig: TradingConfigData;
}
