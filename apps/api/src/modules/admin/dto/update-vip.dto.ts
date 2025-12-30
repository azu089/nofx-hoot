import { IsInt, Min, Max, IsOptional, IsDateString } from 'class-validator';

/**
 * 调整 VIP 等级 DTO
 */
export class UpdateVipDto {
  @IsInt({ message: 'VIP 等级必须是整数' })
  @Min(0, { message: 'VIP 等级不能小于 0' })
  @Max(5, { message: 'VIP 等级不能大于 5' })
  vipLevel: number;

  @IsOptional()
  @IsDateString({}, { message: '过期时间格式不正确' })
  vipExpiresAt?: string;
}
