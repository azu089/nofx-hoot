import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  Min,
  Max,
} from 'class-validator';

/**
 * 创建 AI 策略
 */
export class CreateStrategyDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsEnum(['normal', 'grid'])
  strategyType?: string = 'normal';

  @IsOptional()
  @IsEnum(['solo', 'debate'])
  tradingMode?: string = 'solo';

  @IsObject()
  coinSourceConfig: Record<string, any>; // { mode, coins?, maxCoins? }

  @IsObject()
  indicatorConfig: Record<string, any>; // { timeframe, secondaryTimeframe?, indicators }

  @IsObject()
  riskControlConfig: Record<string, any>; // { maxPositions, minPositionSize, maxLeverage }

  @IsOptional()
  @IsObject()
  promptSections?: Record<string, any>;

  @IsOptional()
  @IsObject()
  gridConfig?: Record<string, any>;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  intervalMinutes?: number = 60;

  @IsOptional()
  @IsString()
  exchangeApiKeyId?: string;

  @IsOptional()
  @IsObject()
  apiKeys?: Record<string, string>; // LLM API Keys

  @IsOptional()
  models?: string[]; // 启用的 LLM 模型
}

/**
 * 更新 AI 策略
 */
export class UpdateStrategyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(['solo', 'debate'])
  tradingMode?: string;

  @IsOptional()
  @IsObject()
  coinSourceConfig?: Record<string, any>;

  @IsOptional()
  @IsObject()
  indicatorConfig?: Record<string, any>;

  @IsOptional()
  @IsObject()
  riskControlConfig?: Record<string, any>;

  @IsOptional()
  @IsObject()
  promptSections?: Record<string, any>;

  @IsOptional()
  @IsObject()
  gridConfig?: Record<string, any>;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  intervalMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsString()
  exchangeApiKeyId?: string;

  @IsOptional()
  @IsObject()
  apiKeys?: Record<string, string>;

  @IsOptional()
  models?: string[];
}
