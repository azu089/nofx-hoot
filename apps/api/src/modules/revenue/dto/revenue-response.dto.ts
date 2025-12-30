/**
 * 收入分配响应 DTO
 */
export class RevenueResponseDto {
  /** 分配记录 ID */
  id: string;

  /** 周期开始时间 */
  periodStart: Date;

  /** 周期结束时间 */
  periodEnd: Date;

  /** 总收入（USDT） */
  totalRevenue: string;

  /** 运营费用 40% */
  operationsAmount: string;

  /** 回购费用 40% */
  buybackAmount: string;

  /** 储备金 20% */
  reserveAmount: string;

  /** 回购代币数量 */
  tokensBought: string;

  /** 销毁代币数量（回购的 50%） */
  tokensBurned: string;

  /** 分配给质押者的代币数量（回购的 50%） */
  tokensDistributed: string;

  /** 分配状态 */
  status: 'pending' | 'completed' | 'failed';

  /** 创建时间 */
  createdAt: Date;

  /** 备注 */
  remarks?: string;
}
