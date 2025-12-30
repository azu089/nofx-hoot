/**
 * RevenueDistribution 实体
 * 对应数据库表: revenue_distributions
 * 平台收入分配记录（40% 运营 + 40% 回购 + 20% 储备）
 */
export interface RevenueDistribution {
  id: string;

  // 分配周期
  period_start: Date; // 周期开始
  period_end: Date; // 周期结束

  // 收入总额
  total_revenue: string; // 本周期总收入 (USDT, DECIMAL 返回为 string)

  // 分配明细
  operations_amount: string; // 40% 运营成本
  buyback_amount: string; // 40% 回购奖励池
  reserve_amount: string; // 20% 风险储备金

  // 回购执行
  buyback_executed: boolean;
  buyback_tx_hash?: string; // DEX 回购交易哈希
  tokens_bought: string; // 回购的 $QFI 数量 (DECIMAL 返回为 string)
  tokens_burned: string; // 销毁数量 (回购的 50%)
  tokens_distributed: string; // 分发给质押者数量 (回购的 50%)

  // 状态
  status: 'pending' | 'processing' | 'completed';

  // 审计字段
  created_at: Date;
  updated_at: Date;
}
