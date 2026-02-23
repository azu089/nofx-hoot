import {
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  IsObject,
  Min,
  Max,
} from 'class-validator';

/**
 * 手动测试执行 DTO (POST /ai/test-execute)
 */
export class TestExecuteDto {
  @IsString()
  @IsIn(['open_long', 'open_short', 'close_long', 'close_short', 'hold', 'wait'])
  action: string;

  @IsString()
  symbol: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  confidence?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  leverage?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  positionSizeUSD?: number;

  @IsOptional()
  @IsNumber()
  stopLoss?: number;

  @IsOptional()
  @IsNumber()
  takeProfit?: number;
}

/**
 * 更新研究循环配置 DTO (PUT /ai/research/:id/config)
 */
export class UpdateResearchConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  intervalMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCycles?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  profitTargetPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxLossPercent?: number;

  @IsOptional()
  @IsObject()
  riskControlConfig?: Record<string, number>;
}
