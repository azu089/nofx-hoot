/**
 * Agent 实体
 * 对应数据库表: agents
 * 代理商基本信息与层级关系
 */
export interface Agent {
  id: string;

  // 基本信息
  code: string; // 代理商邀请码
  name: string; // 代理商名称
  email: string; // 代理商邮箱

  // 层级关系
  parent_agent_id?: string; // 上级代理商 ID
  level: number; // 代理层级 (1=一级, 2=二级...)

  // 返佣配置
  commission_rate: string; // 返佣比例 (DECIMAL 返回为 string)

  // 统计数据
  total_users: number; // 累计邀请用户数
  total_commission: string; // 累计返佣金额 (DECIMAL 返回为 string)

  // 状态
  status: 'active' | 'suspended' | 'terminated';

  // 审计字段
  created_at: Date;
  updated_at: Date;
}
