import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 触发 AI 分析请求 DTO
 */
export class TriggerAnalysisDto {
  @IsString()
  symbol: string; // 交易对，如 BTC/USDT:USDT

  @IsOptional()
  @IsString()
  @IsIn(['1h', '4h', '1d', '1w'])
  timeframe?: string = '4h'; // 时间周期

  @IsOptional()
  @IsString()
  subscriptionId?: string; // 关联的策略订阅 ID

  @IsOptional()
  @IsString()
  locale?: string;
}

/**
 * AI 分析列表查询 DTO
 */
export class ListAnalysesDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsString()
  @IsIn(['pending', 'executed', 'blocked', 'failed', 'hold'])
  status?: string;

  @IsOptional()
  @IsString()
  locale?: string;
}
