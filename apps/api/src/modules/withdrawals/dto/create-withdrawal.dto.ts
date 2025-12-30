import { IsNotEmpty, IsString, Min, IsIn, IsOptional, Length } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 创建提现申请 DTO
 */
export class CreateWithdrawalDto {
  @IsNotEmpty({ message: '金额不能为空' })
  @Type(() => Number)
  @Min(50, { message: '最低提现金额为 50 USDT' })
  amount: number;

  @IsString()
  @IsIn(['TRC20', 'ERC20'], { message: '链类型不正确' })
  chain: string;

  @IsNotEmpty({ message: '收款地址不能为空' })
  @IsString()
  toAddress: string;

  /**
   * 2FA 验证码（6位数字）
   * 如果用户开启了 2FA，则必填
   */
  @IsOptional()
  @IsString()
  @Length(6, 6, { message: '2FA 验证码必须是 6 位数字' })
  totpCode?: string;
}
