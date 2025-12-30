import { Expose } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 用户策略配置响应 DTO
 */
export class StrategyConfigResponseDto {
  @ApiProperty({ description: '配置 ID', example: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ description: '用户 ID', example: 'uuid' })
  @Expose()
  user_id: string;

  @ApiProperty({ description: '策略 ID', example: 'uuid' })
  @Expose()
  strategy_id: string;

  @ApiPropertyOptional({ description: 'VPS 实例 ID', example: 'uuid' })
  @Expose()
  instance_id: string | null;

  @ApiProperty({ description: '投入金额 (USDT)', example: '100.00000000' })
  @Expose()
  stake_amount: string; // Prisma Decimal 返回 string

  @ApiProperty({ description: '最大同时持仓数', example: 3 })
  @Expose()
  max_open_trades: number;

  @ApiProperty({ description: '杠杆倍数', example: 1 })
  @Expose()
  leverage: number;

  @ApiProperty({ description: '止损比例', example: '-0.1000' })
  @Expose()
  stoploss: string; // Prisma Decimal 返回 string

  @ApiProperty({ description: '是否启用移动止损', example: false })
  @Expose()
  trailing_stop: boolean;

  @ApiPropertyOptional({ description: '移动止损触发点', example: '0.0100' })
  @Expose()
  trailing_stop_positive: string | null;

  @ApiProperty({ description: '黑名单', example: ['DOGE/USDT'], type: [String] })
  @Expose()
  blacklist: string[];

  @ApiPropertyOptional({ description: '自定义配置', example: {} })
  @Expose()
  custom_config: any;

  @ApiProperty({ description: '是否激活', example: true })
  @Expose()
  is_active: boolean;

  @ApiProperty({ description: '创建时间' })
  @Expose()
  created_at: Date;

  @ApiProperty({ description: '更新时间' })
  @Expose()
  updated_at: Date;

  // 关联策略信息（可选）
  @ApiPropertyOptional({ description: '关联的策略信息' })
  @Expose()
  strategy?: {
    id: string;
    name: string;
    description: string | null;
  };
}
