import { IsString, IsNotEmpty } from 'class-validator';

/**
 * 执行兑换 DTO
 */
export class ConvertDto {
  @IsString()
  @IsNotEmpty()
  quote_id: string;
}

/**
 * 兑换结果响应
 */
export class ConvertResponseDto {
  success: boolean;
  transaction_id: string;
  from_asset: string;
  from_amount: string;
  to_asset: string;
  to_amount: string;
  new_from_balance: string;
  new_to_balance: string;
}
