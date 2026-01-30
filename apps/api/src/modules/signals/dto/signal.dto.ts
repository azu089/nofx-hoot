import { IsString, IsNotEmpty, IsNumber, IsIn } from 'class-validator';

// Freqtrade Webhook 信号 DTO
export class WebhookSignalDto {
  @IsString()
  @IsNotEmpty()
  strategy: string; // 策略名称（对应 freqtradeId）

  @IsString()
  @IsNotEmpty()
  symbol: string; // 交易对，如 BTC/USDT

  @IsIn(['buy', 'sell'])
  side: 'buy' | 'sell';

  @IsNumber()
  price: number;
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
  price: string;
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
  price: string;
  amountPerTrade: string;
}
