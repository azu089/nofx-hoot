import { IsEnum } from 'class-validator';

/**
 * 交易分析请求 DTO
 */
export class AnalyzeTradesDto {
  @IsEnum(['7d', '30d', '90d'], { message: '时间范围必须为 7d/30d/90d' })
  timeRange: '7d' | '30d' | '90d'; // 分析时间范围
}
