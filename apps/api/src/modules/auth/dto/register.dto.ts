import { IsEmail, IsString, MaxLength, IsOptional, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsStrongPassword } from '../../../common/validators/password-strength.validator';
import { FingerprintDto } from './login.dto';

/**
 * 用户注册 DTO
 */
export class RegisterDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  @IsString({ message: '密码必须是字符串' })
  @IsStrongPassword({
    minLength: 8,
    maxLength: 32,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecialChar: false,
  })
  password: string;

  @IsOptional()
  @IsString({ message: '邀请码必须是字符串' })
  @MaxLength(20, { message: '邀请码最多 20 位' })
  inviteCode?: string;

  @IsOptional()
  @IsBoolean({ message: '必须同意服务条款' })
  acceptTerms?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => FingerprintDto)
  fingerprint?: FingerprintDto;
}
