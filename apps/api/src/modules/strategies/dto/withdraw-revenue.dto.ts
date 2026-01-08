import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsIn, IsOptional, Matches } from 'class-validator';

/**
 * 策略收益提现 DTO
 */
export class WithdrawRevenueDto {
  @ApiProperty({
    description: '提现金额（USDT）',
    example: '100.00',
  })
  @IsNotEmpty({ message: '提现金额不能为空' })
  @IsString()
  @Matches(/^\d+(\.\d{1,8})?$/, {
    message: '金额格式不正确，最多支持 8 位小数',
  })
  amount: string;

  @ApiProperty({
    description: '链类型',
    enum: ['TRC20', 'ERC20', 'BEP20'],
    example: 'TRC20',
  })
  @IsNotEmpty({ message: '链类型不能为空' })
  @IsIn(['TRC20', 'ERC20', 'BEP20'], {
    message: '链类型必须是 TRC20、ERC20 或 BEP20',
  })
  chain: string;

  @ApiProperty({
    description: '收款地址',
    example: 'TYourTestAddress123456789',
  })
  @IsNotEmpty({ message: '收款地址不能为空' })
  @IsString()
  toAddress: string;

  @ApiProperty({
    description: '2FA 验证码（如已开启 2FA）',
    required: false,
    example: '123456',
  })
  @IsOptional()
  @IsString()
  totpCode?: string;
}
