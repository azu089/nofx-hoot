import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumberString,
} from 'class-validator';

// 资产类型
export enum AssetType {
  USDT = 'usdt',
  CARD = 'card',
  POINTS = 'points',
  TOKEN = 'token',
}

// 兑换模式（积分兑换专用）
export enum ExchangeMode {
  STANDARD = 'standard', // 标准模式：20%立即 + 80%锁仓90天
  INSTANT = 'instant', // 急速模式：50%立即 + 50%销毁
}

/**
 * 获取兑换报价 DTO
 */
export class GetQuoteDto {
  @IsEnum(AssetType)
  @IsNotEmpty()
  from_asset: AssetType;

  @IsEnum(AssetType)
  @IsNotEmpty()
  to_asset: AssetType;

  @IsNumberString()
  @IsNotEmpty()
  amount: string;

  @IsEnum(ExchangeMode)
  @IsOptional()
  mode?: ExchangeMode;
}

/**
 * 兑换报价响应
 */
export class QuoteResponseDto {
  quote_id: string;
  from_asset: AssetType;
  from_amount: string;
  to_asset: AssetType;
  to_amount: string;
  exchange_rate: string;
  fee_rate: string;
  fee_amount: string;
  // USDT → 点卡套餐赠送
  bonus_rate?: string;
  bonus_amount?: string;
  expires_at: string;
  // 积分兑换专用
  instant_amount?: string;
  vesting_amount?: string;
  vesting_days?: number;
  burned_amount?: string;
}
