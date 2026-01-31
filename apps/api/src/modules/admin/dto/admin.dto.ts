import { IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// 分页查询 DTO
export class PaginationDto {
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
  search?: string;
}

// 用户列表查询
export class UserListDto extends PaginationDto {
  @IsOptional()
  @IsString()
  status?: string; // active, inactive
}

// 更新用户状态
export class UpdateUserStatusDto {
  @IsEnum(['active', 'inactive', 'banned'])
  status: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

// 策略列表查询
export class StrategyListDto extends PaginationDto {
  @IsOptional()
  @IsString()
  status?: string; // active, inactive
}

// 创建策略
export class CreateStrategyDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsString()
  freqtradeId: string;

  @IsOptional()
  @IsString()
  riskLevel?: string;
}

// 更新策略
export class UpdateStrategyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  riskLevel?: string;

  @IsOptional()
  isActive?: boolean;
}

// 提现审核操作
export class WithdrawActionDto {
  @IsEnum(['approved', 'rejected'])
  action: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  txHash?: string; // 审核通过时的交易哈希
}

// 提现列表查询
export class WithdrawListDto extends PaginationDto {
  @IsOptional()
  @IsEnum(['pending', 'approved', 'rejected', 'completed'])
  status?: string;
}

// ==================== 交易配置管理 ====================

import {
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';

// 更新平台配置
export class UpdatePlatformConfigDto {
  // 全局开关
  @IsOptional()
  @IsBoolean()
  tradingEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  newOrdersEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  spotEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  futuresEnabled?: boolean;

  // 全局限制
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxOrderAmountUsdt?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  minOrderAmountUsdt?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(125)
  maxLeverage?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  maxPositions?: number;

  // 交易对限制
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedSymbols?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blockedSymbols?: string[];
}

// 更新市场状态配置
export class UpdateMarketStatusConfigDto {
  @IsOptional()
  @IsNumber()
  maxVolatility24h?: number;

  @IsOptional()
  @IsNumber()
  priceDeviationThreshold?: number;

  @IsOptional()
  @IsBoolean()
  extremeMarketProtection?: boolean;

  @IsOptional()
  @IsBoolean()
  autoSuspendOnExtreme?: boolean;
}

// 更新熔断器配置
export class UpdateCircuitBreakerConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  errorThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  windowMs?: number;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  cooldownMs?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  halfOpenRequests?: number;
}

// 手动暂停交易对
export class SuspendTradingDto {
  @IsString()
  symbol: string;

  @IsString()
  exchange: string;

  @IsString()
  reason: string;
}

// 恢复交易对
export class ResumeTradingDto {
  @IsString()
  symbol: string;

  @IsString()
  exchange: string;
}
