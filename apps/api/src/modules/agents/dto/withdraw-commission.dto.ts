import { IsString, IsNotEmpty, Matches, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 佣金提现 DTO
 */
export class WithdrawCommissionDto {
  @ApiProperty({ description: '提现金额', example: '100.00000000' })
  @IsString()
  @IsNotEmpty({ message: '提现金额不能为空' })
  @Matches(/^\d+(\.\d{1,8})?$/, { message: '金额格式不正确（最多8位小数）' })
  amount: string;

  @ApiProperty({ description: '钱包地址', example: 'TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' })
  @IsString()
  @IsOptional()
  walletAddress?: string;

  @ApiProperty({ description: '链类型', example: 'TRC20', default: 'TRC20' })
  @IsString()
  @IsOptional()
  chain?: string;
}
