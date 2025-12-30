import { Expose } from 'class-transformer';

/**
 * 佣金记录响应 DTO
 */
export class CommissionResponseDto {
  @Expose()
  id: string;

  @Expose()
  agent_id: string;

  @Expose()
  user_id: string;

  // 关联用户信息（可选）
  @Expose()
  user_email?: string;

  @Expose()
  source_type: string; // subscription / gas_fee

  @Expose()
  base_amount: string; // DECIMAL 字段

  @Expose()
  commission_rate: string; // DECIMAL 字段

  @Expose()
  commission_amount: string; // DECIMAL 字段

  @Expose()
  status: string; // pending / settled / paid

  @Expose()
  settled_at?: Date;

  @Expose()
  created_at: Date;
}
