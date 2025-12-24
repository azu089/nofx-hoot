import { Exclude, Expose } from 'class-transformer';

/**
 * 用户响应 DTO（脱敏）
 * 排除敏感字段：password_hash, two_factor_secret, device_fingerprints
 */
export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  two_factor_enabled: boolean;

  @Expose()
  vip_level: number;

  @Expose()
  vip_expires_at: Date | null;

  @Expose()
  agent_id: string | null;

  @Expose()
  invite_code: string | null;

  @Expose()
  status: string;

  @Expose()
  last_login_at: Date | null;

  @Expose()
  last_login_ip: string | null;

  @Expose()
  created_at: Date;

  @Expose()
  updated_at: Date;

  // 排除敏感字段（即使数据库返回也不会序列化）
  @Exclude()
  password_hash: string;

  @Exclude()
  two_factor_secret: string | null;

  @Exclude()
  device_fingerprints: any;
}
