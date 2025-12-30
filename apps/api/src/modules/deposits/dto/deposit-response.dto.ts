import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * 充值记录响应 DTO
 */
export class DepositResponseDto {
  id: string;
  userId: string;
  amount: string;
  currency: string;
  method: string;
  chain?: string;
  fromAddress?: string;
  txHash?: string;
  blockNumber?: string;
  confirmations?: number;
  proofImageUrl?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  status: string; // pending/approved/rejected
  rejectReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 充值审核 DTO
 */
export class ReviewDepositDto {
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  rejectReason?: string;
}
