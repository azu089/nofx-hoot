import { IsEmail, IsString, IsEnum, Length } from 'class-validator';

/**
 * 验证码类型
 */
export enum VerificationCodeType {
  REGISTER = 'register',
  RESET_PASSWORD = 'reset_password',
  LOGIN = 'login',
}

/**
 * 发送验证码 DTO
 */
export class SendVerificationCodeDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  @IsEnum(VerificationCodeType, { message: '验证码类型不正确' })
  type: VerificationCodeType;
}

/**
 * 验证验证码 DTO
 */
export class VerifyCodeDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  @IsString({ message: '验证码必须是字符串' })
  @Length(6, 6, { message: '验证码必须是6位数字' })
  code: string;

  @IsEnum(VerificationCodeType, { message: '验证码类型不正确' })
  type: VerificationCodeType;
}

/**
 * 发送验证码响应
 */
export class SendCodeResponseDto {
  success: boolean;
  message: string;
  retryAfter?: number;
}
