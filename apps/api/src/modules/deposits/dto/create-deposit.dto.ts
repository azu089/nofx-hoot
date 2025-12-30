import { IsNotEmpty, IsString, IsOptional, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 创建充值申请 DTO
 */
export class CreateDepositDto {
  @IsNotEmpty({ message: '金额不能为空' })
  @Type(() => Number)
  @Min(10, { message: '最低充值金额为 10 USDT' })
  amount: number;

  @IsString()
  @IsIn(['usdt_trc20', 'usdt_erc20', 'bank_transfer'], {
    message: '充值方式不正确',
  })
  method: string;

  @IsOptional()
  @IsString()
  proofImageUrl?: string; // 转账凭证截图 URL（可选）

  @IsOptional()
  @IsString()
  chain?: string; // 链类型（usdt_trc20/usdt_erc20 时需要）

  @IsOptional()
  @IsString()
  fromAddress?: string; // 转出地址（可选）

  @IsOptional()
  @IsString()
  txHash?: string; // 链上交易哈希（可选）
}
