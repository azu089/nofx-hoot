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
  @IsEnum(['solo', 'debate', 'research'])
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
  @Min(3)
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

  @IsOptional()
  @IsObject()
  debateConfig?: {
    maxRounds?: number;   // 2-5, 投资辩论轮数 (默认 3)
    riskRounds?: number;  // 2-3, 风控辩论轮数 (默认 3)
    temperature?: number; // 0.3-1.0, LLM 温度 (默认 0.7)
  };

  @IsOptional()
  @IsObject()
  stopConditions?: {
    maxCycles?: number;           // 最大运行周期数 (0 = 无限)
    profitTargetPercent?: number; // 达到此盈利%后自动停止
    maxLossPercent?: number;      // 达到此亏损%后自动停止
  };
}

/**
 * 更新 AI 策略
 */
export class UpdateStrategyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(['solo', 'debate', 'research'])
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
  @Min(3)
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

  @IsOptional()
  @IsObject()
  debateConfig?: {
    maxRounds?: number;
    riskRounds?: number;
    temperature?: number;
  };

  @IsOptional()
  @IsObject()
  stopConditions?: {
    maxCycles?: number;
    profitTargetPercent?: number;
    maxLossPercent?: number;
  };
}
