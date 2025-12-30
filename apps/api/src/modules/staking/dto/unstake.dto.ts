import { IsNotEmpty, IsString } from 'class-validator';

/**
 * 解押 DTO
 */
export class UnstakeDto {
  @IsString()
  @IsNotEmpty({ message: '质押记录 ID 不能为空' })
  stake_id: string;
}
