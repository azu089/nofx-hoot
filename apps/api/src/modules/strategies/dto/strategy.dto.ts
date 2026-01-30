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
