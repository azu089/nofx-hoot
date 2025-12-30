import { ApiProperty } from '@nestjs/swagger';

/**
 * 积分余额响应 DTO
 */
export class PointsBalanceDto {
  @ApiProperty({ description: '可用积分' })
  available: string;

  @ApiProperty({ description: '冻结积分' })
  frozen: string;

  @ApiProperty({ description: '总积分' })
  total: string;
}

/**
 * 积分历史记录 DTO
 */
export class PointsHistoryDto {
  @ApiProperty({ description: '日志 ID' })
  id: string;

  @ApiProperty({ description: '用户 ID' })
  userId: string;

  @ApiProperty({ description: '唯一订单 ID' })
  uniqueOrderId: string;

  @ApiProperty({ description: '积分类型', enum: ['points_earn', 'points_deduct'] })
  billingType: string;

  @ApiProperty({ description: '积分数量（正数=获得，负数=扣除）' })
  amount: string;

  @ApiProperty({ description: '关联类型', nullable: true })
  referenceType: string | null;

  @ApiProperty({ description: '关联 ID', nullable: true })
  referenceId: string | null;

  @ApiProperty({ description: '描述' })
  description: string | null;

  @ApiProperty({ description: '状态', enum: ['completed', 'pending', 'failed'] })
  status: string;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;
}

/**
 * 积分历史列表响应 DTO
 */
export class PointsHistoryListDto {
  @ApiProperty({ type: [PointsHistoryDto] })
  history: PointsHistoryDto[];

  @ApiProperty({ description: '总条数' })
  total: number;
}
