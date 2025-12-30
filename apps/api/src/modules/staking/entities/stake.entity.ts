/**
 * Stake 实体
 * 对应数据库 stakes 表
 */
export class Stake {
  id: string;
  user_id: string;
  stake_type: 'A' | 'B';
  amount: string;
  start_time: Date;
  lock_period_days: number;
  end_time: Date;
  weight_multiplier: string;
  accumulated_reward: string;
  last_reward_at?: Date;
  status: 'active' | 'unstaked' | 'completed';
  early_unstake_at?: Date;
  penalty_amount?: string;
  created_at: Date;
  updated_at: Date;
}
