import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 循环配置 DTO
 */
export class CyclingConfigDto {
  @IsBoolean()
  enabled: boolean;

  @IsNumber()
  @Min(1)
  intervalMinutes: number; // 15, 30, 60, 240

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCycles?: number = 0; // 0 = 无限

  @IsOptional()
  @IsNumber()
  @Min(0)
  profitTargetPercent?: number = 0; // 0 = 不限

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxLossPercent?: number = 0; // 0 = 不限
}

/**
 * 启动 AI 研究
 */
export class StartResearchDto {
  @IsString()
  symbol: string; // 如 'BTC/USDT'

  @IsOptional()
  @IsEnum(['quick', 'standard', 'deep'])
  depth?: 'quick' | 'standard' | 'deep' = 'standard';

  @IsOptional()
  @IsBoolean()
  autoExecute?: boolean = false; // 是否自动执行交易

  @IsOptional()
  @IsString()
  quickModel?: string; // 快速模型（分析师用，~8 次调用）

  @IsOptional()
  @IsString()
  deepModel?: string; // 深度模型（裁判用，~2 次调用）

  @IsOptional()
  @IsString()
  exchangeApiKeyId?: string; // 指定交易所账号（覆盖全局配置）

  @IsOptional()
  @ValidateNested()
  @Type(() => CyclingConfigDto)
  cyclingConfig?: CyclingConfigDto; // 自动循环配置

  @IsOptional()
  @IsObject()
  riskControlConfig?: {
    maxPositions?: number;
    maxLeverage?: number;
    maxDailyDrawdown?: number;
    allocatedCapital?: number;
    maxDailyTrades?: number;
    cooldownMinutes?: number;
    circuitBreaker?: number; // 最大连续亏损次数
    btcEthMaxLeverage?: number;
    altcoinMaxLeverage?: number;
    btcEthMaxPositionValueRatio?: number;
    altcoinMaxPositionValueRatio?: number;
    minRiskRewardRatio?: number;
    minConfidence?: number;
    minPositionSize?: number;
  };
}

/**
 * 手动执行研究结果
 */
export class ExecuteResearchDto {
  @IsString()
  sessionId: string;
}
