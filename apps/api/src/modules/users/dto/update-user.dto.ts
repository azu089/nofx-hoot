import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

/**
 * 更新用户信息 DTO
 * 用于 PATCH /api/users/profile
 */
export class UpdateUserDto {
  /**
   * 新密码（可选）
   * 最少 8 位，最多 32 位
   */
  @IsOptional()
  @IsString()
  @MinLength(8, { message: '密码至少 8 位' })
  @MaxLength(32, { message: '密码最多 32 位' })
  password?: string;

  // 后续可扩展其他可更新字段
  // 例如：昵称、头像等
}
