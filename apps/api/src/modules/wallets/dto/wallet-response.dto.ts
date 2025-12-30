import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 钱包响应 DTO
 * 返回用户钱包信息（所有金额字段为字符串，对应数据库 DECIMAL 类型）
 */
export class WalletResponseDto {
  @Expose()
  id: string;

  @Expose()
  user_id: string;

  @Expose()
  usdt_balance: string;

  @Expose()
  usdt_frozen: string;

  @Expose()
  card_balance: string; // 点卡余额

  @Expose()
  points_balance: string;

  @Expose()
  points_frozen: string;

  @Expose()
  token_balance: string;

  @Expose()
  token_locked: string;

  @Expose()
  token_vesting: string;

  @Expose()
  created_at: Date;

  @Expose()
  updated_at: Date;
}

/**
 * 余额概览 DTO
 * 返回用户各类资产的可用/冻结/总计
 */
export class BalanceOverviewDto {
  usdt: {
    available: string; // 可用 USDT
    frozen: string; // 冻结 USDT
    total: string; // 总计
  };

  card: {
    available: string; // 点卡余额（用于支付燃油费）
  };

  points: {
    available: string; // 可用积分
    frozen: string; // 冻结积分
    total: string; // 总计
  };

  token: {
    available: string; // 可用 Token
    locked: string; // 锁定 Token（质押）
    vesting: string; // 释放中 Token
    total: string; // 总计
  };
}

/**
 * 购买点卡请求 DTO
 */
export class PurchaseCardDto {
  @ApiProperty({ description: '购买金额（USDT）', example: '100.00000000' })
  @IsNotEmpty({ message: '购买金额不能为空' })
  @IsString()
  amount: string;
}
