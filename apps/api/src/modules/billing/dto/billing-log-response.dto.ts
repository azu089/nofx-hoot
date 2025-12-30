import { ApiProperty } from '@nestjs/swagger';

/**
 * 计费日志响应 DTO
 */
export class BillingLogResponseDto {
  @ApiProperty({ description: '日志 ID' })
  id: string;

  @ApiProperty({ description: '用户 ID' })
  userId: string;

  @ApiProperty({ description: '唯一订单 ID（幂等性）' })
  uniqueOrderId: string;

  @ApiProperty({ description: '计费类型', enum: ['gas_fee', 'subscription', 'commission'] })
  billingType: string;

  @ApiProperty({ description: '金额' })
  amount: string;

  @ApiProperty({ description: '币种', default: 'USDT' })
  currency: string;

  @ApiProperty({ description: '关联类型', nullable: true })
  referenceType: string | null;

  @ApiProperty({ description: '关联 ID', nullable: true })
  referenceId: string | null;

  @ApiProperty({ description: '描述', nullable: true })
  description: string | null;

  @ApiProperty({ description: '状态', enum: ['completed', 'pending', 'failed'] })
  status: string;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;
}

/**
 * 计费日志列表响应 DTO
 */
export class BillingLogsListResponseDto {
  @ApiProperty({ type: [BillingLogResponseDto] })
  logs: BillingLogResponseDto[];

  @ApiProperty({ description: '总条数' })
  total: number;
}
