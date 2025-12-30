import { IsNotEmpty, IsNumber, IsIn, Min } from 'class-validator';

/**
 * 积分兑换代币 DTO
 */
export class ExchangeTokenDto {
  @IsNotEmpty({ message: '兑换积分不能为空' })
  @IsNumber({}, { message: '兑换积分必须是数字' })
  @Min(1000, { message: '最少兑换 1000 积分（1 $QFI）' })
  points: number;

  @IsNotEmpty({ message: '兑换模式不能为空' })
  @IsIn(['standard', 'fast'], { message: '兑换模式只能是 standard 或 fast' })
  mode: 'standard' | 'fast';
}
