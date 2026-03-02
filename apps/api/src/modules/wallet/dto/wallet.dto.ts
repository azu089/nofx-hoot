import {
  IsString,
  IsNumber,
  IsPositive,
  IsIn,
  IsOptional,
  MaxLength,
  IsEthereumAddress,
} from 'class-validator';

// 支持的资产类型
export const SUPPORTED_ASSETS = ['USDT', 'HOOT'] as const;
export type SupportedAsset = (typeof SUPPORTED_ASSETS)[number];

// 支持的链（BSC/ETH/POLYGON 为 EVM 链，TRON 为非 EVM 链）
export const SUPPORTED_CHAINS = ['BSC', 'ETH', 'POLYGON', 'TRON'] as const;
export type SupportedChain = (typeof SUPPORTED_CHAINS)[number];

// 余额响应
export class BalanceResponse {
  usdt: string;
  hoot: string;
  point: string; // 点卡余额
}

// 兑换 DTO
export class ExchangeDto {
  @IsIn(['USDT', 'HOOT', 'POINT'], { message: '不支持的来源资产' })
  fromAsset: 'USDT' | 'HOOT' | 'POINT';

  @IsIn(['USDT', 'HOOT', 'POINT'], { message: '不支持的目标资产' })
  toAsset: 'USDT' | 'HOOT' | 'POINT';

  @IsNumber()
  @IsPositive({ message: '兑换金额必须大于0' })
  amount: number;
}

// 交易记录响应
export class TransactionResponse {
  id: string;
  type: string;
  asset: string;
  amount: string;
  status: string;
  txHash?: string;
  remark?: string;
  createdAt: Date;
}

// 交易记录列表响应
export class TransactionListResponse {
  items: TransactionResponse[];
  total: number;
  page: number;
  pageSize: number;
}

// 提现申请 DTO
export class CreateWithdrawDto {
  @IsIn(SUPPORTED_ASSETS, { message: '不支持的资产类型' })
  asset: SupportedAsset;

  @IsNumber()
  @IsPositive({ message: '提现金额必须大于0' })
  amount: number;

  @IsIn(SUPPORTED_CHAINS, { message: '不支持的链' })
  chain: SupportedChain;

  @IsString()
  @MaxLength(100)
  address: string; // 提现地址
}

// 提现申请响应
export class WithdrawRequestResponse {
  id: string;
  asset: string;
  amount: string;
  fee: string;
  chain: string;
  address: string;
  status: string;
  txHash?: string;
  createdAt: Date;
}

// 充值地址请求 DTO
export class GetDepositAddressDto {
  @IsIn(SUPPORTED_CHAINS, { message: '不支持的链' })
  chain: SupportedChain;

  @IsIn(SUPPORTED_ASSETS, { message: '不支持的资产类型' })
  asset: SupportedAsset;

  @IsOptional()
  @IsString()
  refresh?: string;
}

// 充值地址响应
export class DepositAddressResponse {
  chain: string;
  asset: string;
  address: string;
}

// 查询参数
export class TransactionQueryDto {
  @IsOptional()
  @IsIn(['deposit', 'withdraw', 'fee', 'reward', 'referral', 'exchange', 'membership', 'gas_fee'])
  type?: string;

  @IsOptional()
  @IsIn([...SUPPORTED_ASSETS, 'POINT'])
  asset?: string;

  @IsOptional()
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  locale?: string; // 前端自动传递的语言参数，后端可忽略
}
