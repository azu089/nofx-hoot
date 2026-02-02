import { IsString, IsBoolean, IsOptional, IsIn } from 'class-validator';

/**
 * 会员订阅 DTO
 */

// 购买会员请求
export class PurchaseMembershipDto {
  @IsString()
  @IsIn(['monthly', 'quarterly', 'yearly'])
  planCode: string;

  @IsString()
  @IsIn(['USDT', 'POINT'])
  @IsOptional()
  paymentAsset?: string = 'USDT';

  @IsBoolean()
  @IsOptional()
  autoRenew?: boolean = false;
}

// 会员套餐响应
export class MembershipPlanResponse {
  id: string;
  code: string;
  name: string;
  price: string;
  durationDays: number;
  originalPrice?: string;
  discountPercent?: number | null;
  monthlyPrice: string; // 折合月费
  maxStrategies: number;
}

// 会员状态响应
export class MembershipStatusResponse {
  isMember: boolean;
  status: 'none' | 'active' | 'expired';
  currentPlan?: {
    code: string;
    name: string;
    expireAt: Date;
    daysRemaining: number;
  };
  canSubscribeStrategies: boolean;
}

// 会员订阅记录响应
export class MembershipSubscriptionResponse {
  id: string;
  planCode: string;
  planName: string;
  amount: string;
  paymentAsset: string;
  startAt: Date;
  expireAt: Date;
  status: string;
  isRenewal: boolean;
  createdAt: Date;
}
