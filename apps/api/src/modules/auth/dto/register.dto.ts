import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

/**
 * 用户注册 DTO
 */
export class RegisterDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  @IsString({ message: '密码必须是字符串' })
  @MinLength(8, { message: '密码至少 8 位' })
  @MaxLength(32, { message: '密码最多 32 位' })
  password: string;

  @IsOptional()
  @IsString({ message: '邀请码必须是字符串' })
  @MaxLength(20, { message: '邀请码最多 20 位' })
  inviteCode?: string;
}
