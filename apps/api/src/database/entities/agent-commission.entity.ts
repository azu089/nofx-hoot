/**
 * AgentCommission 实体
 * 对应数据库表: agent_commissions
 * 代理商返佣记录
 */
export interface AgentCommission {
  id: string;

  agent_id: string; // 代理商 ID
  user_id: string; // 贡献用户 ID

  // 返佣来源
  source_type: 'subscription' | 'gas_fee'; // 订阅费 / 燃油费
  source_id?: string; // 关联的 billing_log ID

  // 金额
  base_amount: string; // 用户消费金额 (DECIMAL 返回为 string)
  commission_rate: string; // 返佣比例
  commission_amount: string; // 返佣金额

  // 状态
  status: 'pending' | 'settled' | 'paid'; // 待结算 / 已结算 / 已支付
  settled_at?: Date;

  // 审计字段
  created_at: Date;
}
