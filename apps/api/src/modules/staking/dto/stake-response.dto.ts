/**
 * 质押记录响应 DTO
 *
 * 双轨质押系统（白皮书 v5.0 第 3.3 节）：
 *
 * A 类（积分质押）：
 * - 资产来源：points_balance（积分余额）
 * - 权重：固定 1.0x
 * - 解押惩罚：扣除 50% 本金（销毁）
 *
 * B 类（代币质押）：
 * - 资产来源：token_balance（代币余额）
 * - 权重：1.0x-3.0x（随时间递增）
 * - 解押惩罚：仅 3% 手续费（无论是否到期）
 */
export class StakeResponseDto {
  id: string;
  stake_type: 'A' | 'B';
  amount: string;
  start_time: Date;
  lock_period_days: number;
  end_time: Date;
  weight_multiplier: string;
  accumulated_reward: string;
  claimable_reward: string; // 待领取收益
  status: 'active' | 'unstaked' | 'completed';
  early_unstake_at?: Date;
  penalty_amount?: string;
  created_at: Date;

  /**
   * 是否可解押
   * 始终为 true（但有不同惩罚规则）
   */
  can_unstake: boolean;

  /**
   * 解押惩罚金额预览
   * - A 类: 50% 本金（销毁）
   * - B 类: 3% 手续费
   */
  early_penalty?: string;

  /**
   * 解押返还金额预览
   * - A 类: 50% 本金
   * - B 类: 97% 本金
   */
  return_preview?: string;
}

/**
 * 质押列表响应 DTO
 */
export class StakeListResponseDto {
  stakes: StakeResponseDto[];
  total_staked: string; // 总质押金额
  total_reward: string; // 总累计收益
}

/**
 * 收益统计响应 DTO
 */
export class RewardStatsResponseDto {
  total_accumulated: string; // 累计总收益
  claimable: string; // 可领取收益
  claimed: string; // 已领取收益
  staked_amount: string; // 质押中金额
  average_weight: string; // 平均权重
}
