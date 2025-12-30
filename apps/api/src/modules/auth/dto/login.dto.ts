import { IsEmail, IsString, MinLength, IsOptional, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 设备指纹组件 DTO
 */
export class FingerprintComponentsDto {
  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  screenResolution?: string;

  @IsOptional()
  colorDepth?: number;

  @IsOptional()
  hardwareConcurrency?: number;

  @IsOptional()
  deviceMemory?: number;

  @IsOptional()
  @IsString()
  canvas?: string;

  @IsOptional()
  @IsString()
  webgl?: string;

  @IsOptional()
  touchSupport?: boolean;

  @IsOptional()
  cookiesEnabled?: boolean;

  @IsOptional()
  localStorage?: boolean;

  @IsOptional()
  sessionStorage?: boolean;

  @IsOptional()
  fonts?: string[];

  @IsOptional()
  plugins?: string[];
}

/**
 * 设备指纹 DTO
 */
export class FingerprintDto {
  @IsOptional()
  @IsString()
  hash?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FingerprintComponentsDto)
  components?: FingerprintComponentsDto;
}

/**
 * 用户登录 DTO
 */
export class LoginDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  @IsString({ message: '密码必须是字符串' })
  @MinLength(8, { message: '密码至少 8 位' })
  password: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => FingerprintDto)
  fingerprint?: FingerprintDto;
}
