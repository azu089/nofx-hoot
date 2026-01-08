import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

/**
 * 管理员审核策略 DTO - Phase 16.5
 */
export class AdminReviewStrategyDto {
  @ApiProperty({
    description: '审核操作',
    enum: ['approve', 'reject'],
    example: 'approve',
  })
  @IsEnum(['approve', 'reject'])
  @IsNotEmpty()
  action: 'approve' | 'reject';

  @ApiProperty({
    description: '拒绝原因（仅 action=reject 时需要）',
    required: false,
    example: '策略代码存在安全隐患，请修改后重新提交',
  })
  @IsString()
  @IsOptional()
  rejectReason?: string;
}

/**
 * 待审核策略列表查询参数 DTO
 */
export class PendingStrategiesQueryDto {
  @ApiProperty({ description: '页码', required: false, default: 1 })
  page?: number = 1;

  @ApiProperty({ description: '每页数量', required: false, default: 20 })
  limit?: number = 20;
}
