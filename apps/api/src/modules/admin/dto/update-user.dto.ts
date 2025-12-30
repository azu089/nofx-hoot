import { IsEmail, IsOptional, IsString, IsIn } from 'class-validator';

/**
 * 更新用户信息 DTO
 */
export class UpdateUserDto {
  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  email?: string;

  @IsOptional()
  @IsString()
  @IsIn(['active', 'banned', 'suspended'], { message: '状态值无效' })
  status?: string;
}
