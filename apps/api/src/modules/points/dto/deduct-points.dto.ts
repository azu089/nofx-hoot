import { IsNotEmpty, IsString, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 抵扣积分 DTO
 */
export class DeductPointsDto {
  @ApiProperty({ description: '用户 ID', example: 'user-uuid-xxx' })
  @IsNotEmpty({ message: '用户 ID 不能为空' })
  @IsString({ message: '用户 ID 必须是字符串' })
  userId: string;

  @ApiProperty({ description: '抵扣积分数量', example: '100.00000000' })
  @IsNotEmpty({ message: '积分数量不能为空' })
  @IsString({ message: '积分数量必须是字符串' })
  points: string;

  @ApiProperty({ description: '抵扣原因描述', example: '抵扣 VIP 订阅费' })
  @IsNotEmpty({ message: '抵扣原因不能为空' })
  @IsString({ message: '抵扣原因必须是字符串' })
  description: string;
}
