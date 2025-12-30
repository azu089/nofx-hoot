import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterAgentDto } from './dto/register-agent.dto';
import { BindUserDto } from './dto/bind-user.dto';
import { WithdrawCommissionDto } from './dto/withdraw-commission.dto';
import {
  AgentResponseDto,
  AgentStatsDto,
  ReferralUserDto,
} from './dto/agent-response.dto';
import { CommissionResponseDto } from './dto/commission-response.dto';
import Decimal from 'decimal.js';
import { randomBytes } from 'crypto';

/**
 * 代理商服务
 * 处理代理商注册、邀请码生成、用户绑定、返佣计算、佣金提现等业务逻辑
 *
 * 注意事项：
 * - 邀请码格式: 6位大写字母+数字（如 A1B2C3）
 * - 返佣比例默认 10%（可配置）
 * - 所有金额计算使用 decimal.js
 * - 返佣记录创建后立即累计到代理商统计数据
 * - 提现需要创建 withdrawal 记录（待审核）
 */
@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  // 默认返佣比例 (10%)
  private readonly DEFAULT_COMMISSION_RATE = new Decimal('0.10');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 生成唯一邀请码
   * 格式: 6位大写字母+数字（如 A1B2C3）
   */
  private async generateInviteCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去除易混淆字符 I/O/0/1
    let code: string;
    let exists = true;

    // 循环直到生成唯一码
    while (exists) {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // 检查唯一性
      const agent = await this.prisma.client.agents.findUnique({
        where: { code },
      });
      exists = !!agent;
    }

    return code!;
  }

  /**
   * 代理商注册
   * @param dto 注册信息
   */
  async register(dto: RegisterAgentDto): Promise<AgentResponseDto> {
    this.logger.log(`代理商注册: ${dto.email}`);

    // 检查邮箱是否已注册
    const existing = await this.prisma.client.agents.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('该邮箱已注册为代理商');
    }

    // 生成邀请码
    const code = await this.generateInviteCode();

    // 创建代理商
    const agent = await this.prisma.client.agents.create({
      data: {
        code,
        name: dto.name,
        email: dto.email,
        level: 1, // 默认一级代理
        commission_rate: this.DEFAULT_COMMISSION_RATE.toString(),
        status: 'active',
      },
    });

    this.logger.log(`代理商注册成功: ${agent.email}, 邀请码: ${agent.code}`);

    return {
      id: agent.id,
      code: agent.code,
      name: agent.name,
      email: agent.email,
      commission_rate: agent.commission_rate.toString(),
      total_users: agent.total_users,
      total_commission: agent.total_commission.toString(),
      status: agent.status,
      created_at: agent.created_at,
      updated_at: agent.updated_at,
    };
  }

  /**
   * 获取代理商邀请码
   * @param agentId 代理商 ID
   */
  async getInviteCode(agentId: string): Promise<string> {
    const agent = await this.prisma.client.agents.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new NotFoundException('代理商不存在');
    }

    if (agent.status !== 'active') {
      throw new BadRequestException('代理商状态异常，无法使用邀请码');
    }

    return agent.code;
  }

  /**
   * 绑定用户到代理商
   * @param userId 用户 ID
   * @param dto 绑定信息
   */
  async bindUser(userId: string, dto: BindUserDto): Promise<void> {
    this.logger.log(`绑定用户 ${userId} 到邀请码 ${dto.inviteCode}`);

    // 查找代理商
    const agent = await this.prisma.client.agents.findUnique({
      where: { code: dto.inviteCode },
    });

    if (!agent) {
      throw new NotFoundException('邀请码不存在');
    }

    if (agent.status !== 'active') {
      throw new BadRequestException('该代理商已被禁用');
    }

    // 查找用户
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    if (user.agent_id) {
      throw new BadRequestException('用户已绑定代理商，无法重复绑定');
    }

    // 绑定用户
    await this.prisma.client.$transaction(async (tx) => {
      // 更新用户的代理商 ID
      await tx.users.update({
        where: { id: userId },
        data: { agent_id: agent.id },
      });

      // 更新代理商的用户数统计
      await tx.agents.update({
        where: { id: agent.id },
        data: {
          total_users: { increment: 1 },
        },
      });
    });

    this.logger.log(`用户 ${userId} 绑定到代理商 ${agent.id} 成功`);
  }

  /**
   * 计算并记录返佣
   * 当用户产生计费时调用（订阅费/燃油费）
   *
   * @param userId 用户 ID
   * @param amount 计费金额
   * @param sourceType 返佣来源类型
   * @param sourceId 关联的 billing_log ID
   */
  async calculateCommission(
    userId: string,
    amount: string,
    sourceType: 'subscription' | 'gas_fee',
    sourceId?: string,
  ): Promise<void> {
    // 查找用户的代理商
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      include: {
        agents: true,
      },
    });

    if (!user || !user.agent_id || !user.agents) {
      // 用户未绑定代理商，跳过返佣
      this.logger.debug(`用户 ${userId} 未绑定代理商，跳过返佣`);
      return;
    }

    const agent = user.agents;

    if (agent.status !== 'active') {
      this.logger.warn(`代理商 ${agent.id} 状态异常，跳过返佣`);
      return;
    }

    // 计算返佣金额 = 消费金额 * 返佣比例
    const baseAmount = new Decimal(amount);
    const commissionRate = new Decimal(agent.commission_rate);
    const commissionAmount = baseAmount.times(commissionRate).toDecimalPlaces(8);

    this.logger.log(
      `用户 ${userId} ${sourceType} 消费 ${baseAmount}, 返佣 ${commissionAmount} (${commissionRate.times(100)}%)`,
    );

    // 事务：创建返佣记录 + 更新代理商统计
    await this.prisma.client.$transaction(async (tx) => {
      // 创建返佣记录
      await tx.agent_commissions.create({
        data: {
          agent_id: agent.id,
          user_id: userId,
          source_type: sourceType,
          source_id: sourceId,
          base_amount: baseAmount.toString(),
          commission_rate: commissionRate.toString(),
          commission_amount: commissionAmount.toString(),
          status: 'pending', // 待结算
        },
      });

      // 更新代理商累计返佣金额
      const currentTotal = new Decimal(agent.total_commission);
      const newTotal = currentTotal.plus(commissionAmount);

      await tx.agents.update({
        where: { id: agent.id },
        data: {
          total_commission: newTotal.toString(),
        },
      });
    });

    this.logger.log(`代理商 ${agent.id} 返佣记录创建成功`);
  }

  /**
   * 佣金提现（创建提现记录）
   * @param agentId 代理商 ID
   * @param dto 提现信息
   */
  async withdraw(agentId: string, dto: WithdrawCommissionDto): Promise<{
    id: string;
    agentId: string;
    amount: string;
    fee: string;
    netAmount: string;
    status: string;
    createdAt: Date;
  }> {
    this.logger.log(`代理商 ${agentId} 申请提现: ${dto.amount} USDT`);

    const withdrawAmount = new Decimal(dto.amount);

    // 检查金额
    if (withdrawAmount.lte(0)) {
      throw new BadRequestException('提现金额必须大于0');
    }

    // 最小提现金额 10 USDT
    if (withdrawAmount.lt(10)) {
      throw new BadRequestException('最低提现金额为 10 USDT');
    }

    // 查找代理商
    const agent = await this.prisma.client.agents.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new NotFoundException('代理商不存在');
    }

    if (agent.status !== 'active') {
      throw new BadRequestException('代理商状态异常，无法提现');
    }

    // 计算可提现金额（待结算 + 已结算但未支付）
    const commissions = await this.prisma.client.agent_commissions.findMany({
      where: {
        agent_id: agentId,
        status: { in: ['pending', 'settled'] },
      },
    });

    let availableAmount = new Decimal(0);
    for (const commission of commissions) {
      availableAmount = availableAmount.plus(new Decimal(commission.commission_amount));
    }

    this.logger.log(`代理商可提现金额: ${availableAmount.toString()}`);

    // 检查余额
    if (withdrawAmount.gt(availableAmount)) {
      throw new BadRequestException(
        `可提现金额不足，当前可提现: ${availableAmount.toString()} USDT`,
      );
    }

    // 提现手续费 (0% 暂时免手续费)
    const feeRate = new Decimal('0');
    const fee = withdrawAmount.times(feeRate).toDecimalPlaces(8);
    const netAmount = withdrawAmount.minus(fee);

    // 创建提现记录
    const withdrawal = await this.prisma.client.agent_withdrawals.create({
      data: {
        agent_id: agentId,
        amount: withdrawAmount.toString(),
        fee: fee.toString(),
        status: 'pending',
        wallet_address: dto.walletAddress,
        chain: dto.chain || 'TRC20',
      },
    });

    this.logger.log(`代理商 ${agentId} 提现申请成功，ID: ${withdrawal.id}`);

    return {
      id: withdrawal.id,
      agentId,
      amount: withdrawAmount.toString(),
      fee: fee.toString(),
      netAmount: netAmount.toString(),
      status: 'pending',
      createdAt: withdrawal.created_at,
    };
  }

  /**
   * 获取代理商提现历史
   * @param agentId 代理商 ID
   * @param limit 限制条数
   */
  async getWithdrawals(agentId: string, limit: number = 50): Promise<any[]> {
    const withdrawals = await this.prisma.client.agent_withdrawals.findMany({
      where: { agent_id: agentId },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return withdrawals.map((w) => ({
      id: w.id,
      amount: w.amount.toString(),
      fee: w.fee.toString(),
      netAmount: new Decimal(w.amount).minus(w.fee).toString(),
      status: w.status,
      walletAddress: w.wallet_address,
      chain: w.chain,
      txHash: w.tx_hash,
      rejectReason: w.reject_reason,
      createdAt: w.created_at,
      reviewedAt: w.reviewed_at,
    }));
  }

  /**
   * 获取佣金记录列表
   * @param agentId 代理商 ID
   * @param limit 限制条数
   */
  async getCommissions(
    agentId: string,
    limit: number = 50,
  ): Promise<CommissionResponseDto[]> {
    const commissions = await this.prisma.client.agent_commissions.findMany({
      where: { agent_id: agentId },
      include: {
        users: {
          select: { email: true },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return commissions.map((commission) => ({
      id: commission.id,
      agent_id: commission.agent_id,
      user_id: commission.user_id,
      user_email: commission.users?.email,
      source_type: commission.source_type,
      base_amount: commission.base_amount.toString(),
      commission_rate: commission.commission_rate.toString(),
      commission_amount: commission.commission_amount.toString(),
      status: commission.status,
      settled_at: commission.settled_at ?? undefined,
      created_at: commission.created_at,
    }));
  }

  /**
   * 获取下级用户列表
   * @param agentId 代理商 ID
   */
  async getReferrals(agentId: string): Promise<ReferralUserDto[]> {
    // 查找该代理商的所有用户
    const users = await this.prisma.client.users.findMany({
      where: { agent_id: agentId },
      select: {
        id: true,
        email: true,
        vip_level: true,
        created_at: true,
      },
    });

    // 查询每个用户的贡献统计
    const result: ReferralUserDto[] = [];

    for (const user of users) {
      // 查询该用户的所有返佣记录
      const commissions = await this.prisma.client.agent_commissions.findMany({
        where: {
          agent_id: agentId,
          user_id: user.id,
        },
      });

      let totalSpent = new Decimal(0);
      let totalCommission = new Decimal(0);

      for (const commission of commissions) {
        totalSpent = totalSpent.plus(new Decimal(commission.base_amount));
        totalCommission = totalCommission.plus(new Decimal(commission.commission_amount));
      }

      result.push({
        id: user.id,
        email: user.email,
        vip_level: user.vip_level,
        created_at: user.created_at,
        totalSpent: totalSpent.toString(),
        totalCommission: totalCommission.toString(),
      });
    }

    return result;
  }

  /**
   * 获取代理商统计数据
   * @param agentId 代理商 ID
   */
  async getStats(agentId: string): Promise<AgentStatsDto> {
    // 查找代理商
    const agent = await this.prisma.client.agents.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new NotFoundException('代理商不存在');
    }

    // 查询所有返佣记录
    const commissions = await this.prisma.client.agent_commissions.findMany({
      where: { agent_id: agentId },
    });

    let pendingCommission = new Decimal(0);
    let paidCommission = new Decimal(0);

    for (const commission of commissions) {
      const amount = new Decimal(commission.commission_amount);
      if (commission.status === 'pending' || commission.status === 'settled') {
        pendingCommission = pendingCommission.plus(amount);
      } else if (commission.status === 'paid') {
        paidCommission = paidCommission.plus(amount);
      }
    }

    // 查询已提现申请中的金额（已申请但未完成的提现）
    const pendingWithdrawals = await this.prisma.client.agent_withdrawals.findMany({
      where: {
        agent_id: agentId,
        status: { in: ['pending', 'approved'] },
      },
    });

    let withdrawingAmount = new Decimal(0);
    for (const w of pendingWithdrawals) {
      withdrawingAmount = withdrawingAmount.plus(new Decimal(w.amount));
    }

    // 可提现金额 = 待结算佣金 - 提现中金额
    const withdrawableCommission = pendingCommission.minus(withdrawingAmount);

    // 本月统计（UTC）
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const monthlyCommissions = await this.prisma.client.agent_commissions.findMany({
      where: {
        agent_id: agentId,
        created_at: { gte: monthStart },
      },
    });

    const monthlyUsers = await this.prisma.client.users.count({
      where: {
        agent_id: agentId,
        created_at: { gte: monthStart },
      },
    });

    let monthlyCommission = new Decimal(0);
    for (const commission of monthlyCommissions) {
      monthlyCommission = monthlyCommission.plus(new Decimal(commission.commission_amount));
    }

    // 今日统计（UTC）
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const todayCommissions = await this.prisma.client.agent_commissions.findMany({
      where: {
        agent_id: agentId,
        created_at: { gte: todayStart },
      },
    });

    const todayUsers = await this.prisma.client.users.count({
      where: {
        agent_id: agentId,
        created_at: { gte: todayStart },
      },
    });

    let todayCommission = new Decimal(0);
    for (const commission of todayCommissions) {
      todayCommission = todayCommission.plus(new Decimal(commission.commission_amount));
    }

    return {
      totalUsers: agent.total_users,
      totalCommission: agent.total_commission.toString(),
      pendingCommission: pendingCommission.toString(),
      withdrawableCommission: withdrawableCommission.toString(),
      paidCommission: paidCommission.toString(),
      monthlyUsers,
      monthlyCommission: monthlyCommission.toString(),
      todayUsers,
      todayCommission: todayCommission.toString(),
    };
  }

  /**
   * 获取代理商信息
   * @param agentId 代理商 ID
   */
  async getProfile(agentId: string): Promise<AgentResponseDto> {
    const agent = await this.prisma.client.agents.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new NotFoundException('代理商不存在');
    }

    return {
      id: agent.id,
      code: agent.code,
      name: agent.name,
      email: agent.email,
      commission_rate: agent.commission_rate.toString(),
      total_users: agent.total_users,
      total_commission: agent.total_commission.toString(),
      status: agent.status,
      created_at: agent.created_at,
      updated_at: agent.updated_at,
    };
  }
}
