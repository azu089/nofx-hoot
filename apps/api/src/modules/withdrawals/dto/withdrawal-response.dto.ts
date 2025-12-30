import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * 提现记录响应 DTO
 */
export class WithdrawalResponseDto {
  id: string;
  userId: string;
  amount: string;
  currency: string;
  fee: string;
  chain: string;
  toAddress: string;
  txHash?: string;
  status: string; // pending/approved/rejected/completed
  reviewedBy?: string;
  reviewedAt?: Date;
  rejectReason?: string;
  twoFactorVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 提现审核 DTO
 */
export class ReviewWithdrawalDto {
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  txHash?: string; // 审核通过时填写链上交易哈希

  @IsOptional()
  @IsString()
  rejectReason?: string; // 拒绝时填写原因
}
