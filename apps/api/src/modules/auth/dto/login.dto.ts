import { IsEmail, IsString, MinLength } from 'class-validator';

/**
 * 用户登录 DTO
 */
export class LoginDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  @IsString({ message: '密码必须是字符串' })
  @MinLength(8, { message: '密码至少 8 位' })
  password: string;
}
