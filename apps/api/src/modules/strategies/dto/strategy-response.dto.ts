import { Expose } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 策略性能统计（精简版）
 */
export class StrategyPerformanceDto {
  @ApiProperty({ description: '总交易次数', example: 150 })
  @Expose()
  total_trades: number;

  @ApiProperty({ description: '胜率 (%)', example: 65.5 })
  @Expose()
  win_rate: number;

  @ApiProperty({ description: '最大回撤 (%)', example: -12.5 })
  @Expose()
  max_drawdown: number;

  @ApiProperty({ description: '夏普比率', example: 1.8 })
  @Expose()
  sharpe_ratio: number;

  @ApiProperty({ description: '盈利因子', example: 2.1 })
  @Expose()
  profit_factor: number;
}

/**
 * 策略响应 DTO（列表页）
 * 不包含策略代码内容
 */
export class StrategyResponseDto {
  @ApiProperty({ description: '策略 ID', example: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ description: '策略名称', example: 'RSI 动量策略' })
  @Expose()
  name: string;

  @ApiProperty({ description: '策略描述', example: '基于 RSI 指标的动量交易策略' })
  @Expose()
  description: string | null;

  @ApiProperty({ description: '归属类型', example: 'system', enum: ['system', 'user'] })
  @Expose()
  owner_type: string;

  @ApiProperty({ description: '是否公开', example: true })
  @Expose()
  is_public: boolean;

  @ApiPropertyOptional({ description: '回测性能统计', type: StrategyPerformanceDto })
  @Expose()
  performance_stats?: {
    backtest: StrategyPerformanceDto;
    live: {
      total_trades: number;
      win_rate: number;
      total_pnl: number;
      last_updated: string | null;
    };
  };

  @ApiPropertyOptional({ description: '策略配置（不含代码）' })
  @Expose()
  config?: any;

  @ApiProperty({ description: '创建时间' })
  @Expose()
  created_at: Date;
}

/**
 * 策略详情响应 DTO（详情页）
 * 包含完整策略代码
 */
export class StrategyDetailResponseDto extends StrategyResponseDto {
  @ApiProperty({ description: '策略代码内容 (Python)' })
  @Expose()
  content: string;

  @ApiProperty({ description: '是否激活', example: true })
  @Expose()
  is_active: boolean;

  @ApiProperty({ description: '版本号', example: 1 })
  @Expose()
  version: number;

  @ApiProperty({ description: '更新时间' })
  @Expose()
  updated_at: Date;
}
