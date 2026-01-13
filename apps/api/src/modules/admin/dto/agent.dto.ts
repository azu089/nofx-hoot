import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/**
 * 设置用户为代理商 DTO
 */
export class SetAgentDto {
  @ApiProperty({ description: '用户 ID', example: 'uuid' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: '是否为代理商', example: true })
  @IsBoolean()
  isAgent: boolean;

  @ApiPropertyOptional({
    description: '代理商佣金比例（0.01-0.50，即1%-50%）',
    example: 0.1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(0.50)
  commissionRate?: number;
}

/**
 * 更新代理商佣金比例 DTO
 */
export class UpdateAgentCommissionDto {
  @ApiProperty({ description: '代理商用户 ID', example: 'uuid' })
  @IsUUID()
  agentId: string;

  @ApiProperty({
    description: '佣金比例（0.01-0.50，即1%-50%）',
    example: 0.15,
  })
  @IsNumber()
  @Min(0.01)
  @Max(0.50)
  commissionRate: number;
}

/**
 * 代理商结算 DTO
 */
export class SettleAgentCommissionDto {
  @ApiProperty({ description: '代理商用户 ID', example: 'uuid' })
  @IsUUID()
  agentId: string;

  @ApiProperty({ description: '结算金额 (USDT)', example: '100.00' })
  @IsString()
  amount: string;

  @ApiPropertyOptional({ description: '备注说明', example: '2024年1月份佣金结算' })
  @IsOptional()
  @IsString()
  remark?: string;
}

/**
 * 查询代理商列表 DTO
 */
export class AgentListQueryDto {
  @ApiPropertyOptional({ description: '页码', example: 1, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', example: 20, default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: '搜索关键词（邮箱/ID）' })
  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * 代理商详情响应
 */
export class AgentDetailDto {
  @ApiProperty({ description: '用户 ID' })
  id: string;

  @ApiProperty({ description: '邮箱' })
  email: string;

  @ApiProperty({ description: '是否为代理商' })
  isAgent: boolean;

  @ApiProperty({ description: '佣金比例' })
  commissionRate: string;

  @ApiProperty({ description: '下级用户数' })
  referralCount: number;

  @ApiProperty({ description: '待结算佣金 (USDT)' })
  pendingCommission: string;

  @ApiProperty({ description: '已结算佣金 (USDT)' })
  settledCommission: string;

  @ApiProperty({ description: '总佣金 (USDT)' })
  totalCommission: string;

  @ApiProperty({ description: '注册时间' })
  createdAt: string;
}
