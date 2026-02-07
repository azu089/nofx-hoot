import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsUUID,
  Min,
  Max,
  IsOptional,
} from 'class-validator';

// 订阅策略 DTO
export class SubscribeStrategyDto {
  @IsUUID('4', { message: 'API Key ID 格式不正确' })
  apiKeyId: string;

  @IsNumber()
  @IsPositive({ message: '每单金额必须大于0' })
  amountPerTrade: number;

  @IsNumber()
  @Min(1)
  @Max(10)
  @IsOptional()
  maxPositions?: number = 3;
}

// 策略响应
export class StrategyResponse {
  id: string;
  name: string;
  description: string;
  freqtradeId: string;
  isActive: boolean;
  createdAt: Date;
  subscriberCount?: number;
  // 新增展示字段
  imageUrl?: string;
  riskLevel?: string;
  tags?: string[];
  return7d?: string;
  return30d?: string;
  return90d?: string;
  maxDrawdown?: string;
  winRate?: string;
  totalTrades?: number;
  isFeatured?: boolean;
}

// 策略详情响应（包含用户订阅状态）
export class StrategyDetailResponse extends StrategyResponse {
  isSubscribed: boolean;
  subscription?: {
    id: string;
    apiKeyId: string;
    amountPerTrade: string;
    maxPositions: number;
    isActive: boolean;
  };
}

// 我的订阅响应
export class MySubscriptionResponse {
  id: string;
  strategy: StrategyResponse;
  apiKeyId: string;
  amountPerTrade: string;
  maxPositions: number;
  isActive: boolean;
  createdAt: Date;
}

// 订阅汇总 - 单个订阅详情
export class SubscriptionSummaryDetail {
  subscriptionId: string;
  strategyId: string;
  strategyName: string;
  apiKeyId: string;
  apiKeyLabel: string;
  amountPerTrade: number;
  maxPositions: number;
  maxExposure: number; // amountPerTrade * maxPositions
  isActive: boolean;
}

// 订阅汇总响应 - 用于多策略风险提示
export class SubscriptionSummaryResponse {
  // 活跃订阅数量
  activeCount: number;
  // 总最大敞口（所有订阅的 maxExposure 之和）
  totalMaxExposure: number;
  // 各订阅详情
  subscriptions: SubscriptionSummaryDetail[];
  // 风险提示（当 totalMaxExposure / exchangeBalance > 0.8 时前端显示警告）
  riskLevel: 'safe' | 'warning' | 'danger';
  riskMessage?: string;
}
