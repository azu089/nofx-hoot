import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length, Matches, IsOptional } from 'class-validator';

/**
 * 启用 2FA 请求 DTO
 */
export class EnableTotpDto {
  @ApiProperty({
    description: 'TOTP 6位验证码',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: '验证码不能为空' })
  @Length(6, 6, { message: '验证码必须是6位数字' })
  @Matches(/^\d{6}$/, { message: '验证码必须是6位数字' })
  token: string;

  @ApiProperty({
    description: 'TOTP 密钥 (从 setup 接口获取)',
    example: 'JBSWY3DPEHPK3PXP',
  })
  @IsString()
  @IsNotEmpty({ message: '密钥不能为空' })
  secret: string;
}

/**
 * 验证 2FA 请求 DTO
 */
export class VerifyTotpDto {
  @ApiProperty({
    description: 'TOTP 6位验证码',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: '验证码不能为空' })
  @Length(6, 6, { message: '验证码必须是6位数字' })
  @Matches(/^\d{6}$/, { message: '验证码必须是6位数字' })
  token: string;
}

/**
 * 禁用 2FA 请求 DTO
 */
export class DisableTotpDto {
  @ApiProperty({
    description: 'TOTP 6位验证码',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: '验证码不能为空' })
  @Length(6, 6, { message: '验证码必须是6位数字' })
  @Matches(/^\d{6}$/, { message: '验证码必须是6位数字' })
  token: string;

  @ApiProperty({
    description: '当前密码 (安全验证)',
    example: 'mypassword123',
  })
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  password: string;
}

/**
 * 2FA 设置响应 DTO
 */
export class TotpSetupResponseDto {
  @ApiProperty({
    description: 'TOTP 密钥 (Base32 编码)',
    example: 'JBSWY3DPEHPK3PXP',
  })
  secret: string;

  @ApiProperty({
    description: 'TOTP URI (用于导入到 Authenticator)',
    example: 'otpauth://totp/QuantFi:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=QuantFi',
  })
  uri: string;

  @ApiProperty({
    description: '二维码 (Base64 Data URL)',
    example: 'data:image/png;base64,...',
  })
  qrCode: string;
}

/**
 * 2FA 状态响应 DTO
 */
export class TotpStatusResponseDto {
  @ApiProperty({
    description: '是否已启用 2FA',
    example: true,
  })
  enabled: boolean;

  @ApiPropertyOptional({
    description: '启用时间',
    example: '2025-12-26T10:00:00.000Z',
  })
  enabledAt?: Date;
}

/**
 * 登录需要 2FA 响应 DTO
 */
export class TotpRequiredResponseDto {
  @ApiProperty({
    description: '是否需要 2FA 验证',
    example: true,
  })
  totpRequired: boolean;

  @ApiProperty({
    description: '临时令牌 (用于完成 2FA 验证)',
    example: 'temp_abc123...',
  })
  tempToken: string;
}
