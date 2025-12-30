import {
  Injectable,
  NotFoundException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminUsersQueryDto } from './dto/admin-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateVipDto } from './dto/update-vip.dto';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/announcement.dto';
import { CreateStrategyDto, UpdateStrategyDto } from './dto/strategy.dto';
import Decimal from 'decimal.js';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

/**
 * 管理员服务
 * 负责管理员后台相关操作
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取平台统计数据
   */
  async getStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 并行查询各项统计
    const [
      totalUsers,
      newUsersThisWeek,
      totalInstances,
      runningInstances,
      todayBillingLogs,
      monthBillingLogs,
      todayTrades,
    ] = await Promise.all([
      // 总用户数
      this.prisma.client.users.count(),
      // 本周新增用户
      this.prisma.client.users.count({
        where: { created_at: { gte: weekStart } },
      }),
      // 总实例数
      this.prisma.client.instances.count(),
      // 运行中的实例
      this.prisma.client.instances.count({
        where: { status: 'running' },
      }),
      // 今日计费日志（收入）
      this.prisma.client.billing_logs.findMany({
        where: {
          created_at: { gte: todayStart },
          billing_type: { in: ['subscription', 'gas_fee', 'deposit'] },
        },
      }),
      // 本月计费日志（收入）
      this.prisma.client.billing_logs.findMany({
        where: {
          created_at: { gte: monthStart },
          billing_type: { in: ['subscription', 'gas_fee', 'deposit'] },
        },
      }),
      // 今日交易数
      this.prisma.client.trade_history.count({
        where: { created_at: { gte: todayStart } },
      }),
    ]);

    // 计算收入
    const todayRevenue = todayBillingLogs.reduce(
      (sum: Decimal, log) => sum.plus(new Decimal(log.amount.toString()).abs()),
      new Decimal(0)
    );
    const monthRevenue = monthBillingLogs.reduce(
      (sum: Decimal, log) => sum.plus(new Decimal(log.amount.toString()).abs()),
      new Decimal(0)
    );

    // 计算活跃用户（今天有登录或交易记录的用户）
    const activeToday = await this.prisma.client.users.count({
      where: { updated_at: { gte: todayStart } },
    });

    // 计算交易成功率（假设 pnl > 0 为盈利交易）
    const profitableTrades = await this.prisma.client.trade_history.count({
      where: {
        created_at: { gte: todayStart },
        pnl: { gt: 0 },
      },
    });
    const successRate = todayTrades > 0
      ? parseFloat(((profitableTrades / todayTrades) * 100).toFixed(1))
      : 0;

    return {
      users: {
        total: totalUsers,
        activeToday,
        newThisWeek: newUsersThisWeek,
      },
      instances: {
        total: totalInstances,
        running: runningInstances,
        stopped: totalInstances - runningInstances,
      },
      revenue: {
        today: todayRevenue.toFixed(2),
        thisMonth: monthRevenue.toFixed(2),
        total: monthRevenue.toFixed(2), // 暂时用月收入代替
      },
      trades: {
        today: todayTrades,
        successRate,
      },
    };
  }

  /**
   * 获取最近活动
   */
  async getRecentActivities(limit: number = 10) {
    // 查询最近的各类活动
    const [recentUsers, recentInstances, recentWithdrawals] = await Promise.all([
      // 最近注册用户
      this.prisma.client.users.findMany({
        take: 5,
        orderBy: { created_at: 'desc' },
        select: { id: true, email: true, created_at: true },
      }),
      // 最近创建的实例
      this.prisma.client.instances.findMany({
        take: 5,
        orderBy: { created_at: 'desc' },
        select: { id: true, user_id: true, created_at: true },
      }),
      // 最近提现申请
      this.prisma.client.withdrawals.findMany({
        take: 5,
        orderBy: { created_at: 'desc' },
        select: { id: true, amount: true, created_at: true, status: true },
      }),
    ]);

    // 合并并排序
    const activities = [
      ...recentUsers.map((u) => ({
        id: u.id,
        type: 'user',
        action: '新用户注册',
        user: this.maskEmail(u.email),
        time: this.formatTimeAgo(u.created_at),
        createdAt: u.created_at,
      })),
      ...recentInstances.map((i) => ({
        id: i.id,
        type: 'instance',
        action: 'VPS 创建',
        user: i.user_id.slice(0, 8) + '***',
        time: this.formatTimeAgo(i.created_at),
        createdAt: i.created_at,
      })),
      ...recentWithdrawals.map((w) => ({
        id: w.id,
        type: 'withdraw',
        action: '提现申请',
        amount: `${new Decimal(w.amount.toString()).toFixed(2)} USDT`,
        time: this.formatTimeAgo(w.created_at),
        createdAt: w.created_at,
      })),
    ];

    // 按时间排序
    activities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return activities.slice(0, limit).map(({ createdAt, ...rest }) => rest);
  }

  /**
   * 获取系统告警
   */
  async getAlerts() {
    const alerts: Array<{ id: number; level: string; message: string; time: string }> = [];

    // 检查心跳异常的 VPS
    const zombieInstances = await this.prisma.client.instances.count({
      where: {
        status: 'running',
        last_heartbeat: {
          lt: new Date(Date.now() - 15 * 60 * 1000), // 15分钟无心跳
        },
      },
    });

    if (zombieInstances > 0) {
      alerts.push({
        id: 1,
        level: 'warning',
        message: `${zombieInstances} 个 VPS 心跳异常`,
        time: '刚刚',
      });
    }

    // 检查待审核提现
    const pendingWithdrawals = await this.prisma.client.withdrawals.count({
      where: { status: 'pending' },
    });

    if (pendingWithdrawals > 0) {
      alerts.push({
        id: 2,
        level: 'info',
        message: `${pendingWithdrawals} 笔提现待审核`,
        time: '刚刚',
      });
    }

    return alerts;
  }

  /**
   * 获取用户列表
   */
  async getUsers(query: AdminUsersQueryDto) {
    const { page = 1, limit = 20, search, status } = query;
    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { id: { contains: search } },
      ];
    }
    if (status && status !== 'all') {
      where.status = status;
    }

    // 并行查询用户列表和总数
    const [users, total] = await Promise.all([
      this.prisma.client.users.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.client.users.count({ where }),
    ]);

    // 获取每个用户的钱包、实例和交易数
    const usersWithTrades = await Promise.all(
      users.map(async (user) => {
        const [wallet, instanceCount, tradesCount] = await Promise.all([
          this.prisma.client.wallets.findFirst({
            where: { user_id: user.id },
            select: { usdt_balance: true },
          }),
          this.prisma.client.instances.count({
            where: { user_id: user.id },
          }),
          this.prisma.client.trade_history.count({
            where: { user_id: user.id },
          }),
        ]);

        return {
          id: user.id,
          email: user.email,
          vipLevel: user.vip_level,
          balance: wallet?.usdt_balance
            ? new Decimal(wallet.usdt_balance.toString()).toFixed(2)
            : '0.00',
          status: user.status,
          instanceCount,
          totalTrades: tradesCount,
          createdAt: user.created_at.toISOString().split('T')[0],
          lastLogin: this.formatTimeAgo(user.updated_at),
        };
      })
    );

    return {
      data: usersWithTrades,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 封禁用户
   */
  async banUser(userId: string, adminId: string) {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const newStatus = user.status === 'banned' ? 'active' : 'banned';

    await this.prisma.client.users.update({
      where: { id: userId },
      data: { status: newStatus, updated_at: new Date() },
    });

    await this.logAudit(adminId, newStatus === 'banned' ? 'ban_user' : 'unban_user', 'user', userId, {
      oldStatus: user.status,
      newStatus,
    });

    this.logger.log(
      `管理员 ${adminId} ${newStatus === 'banned' ? '封禁' : '解禁'} 用户 ${userId}`
    );

    return { success: true, newStatus };
  }

  /**
   * 重置用户密码
   */
  async resetPassword(userId: string, adminId: string) {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 生成临时密码
    const tempPassword = crypto.randomBytes(4).toString('hex'); // 8位随机密码
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    await this.prisma.client.users.update({
      where: { id: userId },
      data: { password_hash: passwordHash, updated_at: new Date() },
    });

    await this.logAudit(adminId, 'reset_password', 'user', userId, {
      email: user.email,
    });

    this.logger.log(`管理员 ${adminId} 重置用户 ${userId} 密码`);

    return { success: true, tempPassword };
  }

  /**
   * 获取财务统计
   */
  async getFinanceStats(period: string = 'month') {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default: // month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // 查询各类收支
    const billingLogs = await this.prisma.client.billing_logs.findMany({
      where: { created_at: { gte: startDate } },
    });

    // 分类汇总
    let subscriptionRevenue = new Decimal(0);
    let gasFeeRevenue = new Decimal(0);
    let depositTotal = new Decimal(0);
    let withdrawalTotal = new Decimal(0);

    for (const log of billingLogs) {
      const amount = new Decimal(log.amount.toString());
      switch (log.billing_type) {
        case 'subscription':
          subscriptionRevenue = subscriptionRevenue.plus(amount.abs());
          break;
        case 'gas_fee':
          gasFeeRevenue = gasFeeRevenue.plus(amount.abs());
          break;
        case 'deposit':
          depositTotal = depositTotal.plus(amount.abs());
          break;
        case 'withdrawal':
          withdrawalTotal = withdrawalTotal.plus(amount.abs());
          break;
      }
    }

    // 计算总收入和总支出
    const totalRevenue = subscriptionRevenue.plus(gasFeeRevenue).plus(depositTotal);
    const totalExpense = withdrawalTotal;
    const netProfit = totalRevenue.minus(totalExpense);

    // 收入分配 (40% 运营 + 40% 回购 + 20% 储备)
    const operations = totalRevenue.times(0.4);
    const buyback = totalRevenue.times(0.4);
    const reserve = totalRevenue.times(0.2);

    return {
      totalRevenue: totalRevenue.toFixed(2),
      totalExpense: totalExpense.toFixed(2),
      netProfit: netProfit.toFixed(2),
      growthRate: 15.5, // 暂时固定值，后续可计算环比
      breakdown: {
        subscription: subscriptionRevenue.toFixed(2),
        gasFee: gasFeeRevenue.toFixed(2),
        deposit: depositTotal.toFixed(2),
        withdrawal: `-${withdrawalTotal.toFixed(2)}`,
      },
      revenueDistribution: {
        operations: operations.toFixed(2),
        buyback: buyback.toFixed(2),
        reserve: reserve.toFixed(2),
      },
    };
  }

  /**
   * 获取财务交易记录
   */
  async getFinanceTransactions(page?: number, limit: number = 20) {
    const pageNum = page || 1;
    const skip = (pageNum - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.client.billing_logs.findMany({
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          users: { select: { email: true } },
        },
      }),
      this.prisma.client.billing_logs.count(),
    ]);

    const data = logs.map((log) => {
      const amount = new Decimal(log.amount.toString());
      const isPositive = amount.gt(0);

      return {
        id: log.id,
        type: log.billing_type,
        amount: `${isPositive ? '+' : ''}${amount.toFixed(2)}`,
        user: log.users?.email || 'N/A',
        time: log.created_at.toISOString().replace('T', ' ').slice(0, 16),
        status: 'completed',
      };
    });

    return { data, total };
  }

  // ==================== VPS 监控 ====================

  /**
   * 获取 VPS 实例列表
   */
  async getInstances(query: { page?: number; limit?: number; status?: string }) {
    const { page = 1, limit = 20, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    const [instances, total] = await Promise.all([
      this.prisma.client.instances.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          users: { select: { email: true } },
        },
      }),
      this.prisma.client.instances.count({ where }),
    ]);

    const now = new Date();
    const data = instances.map((inst) => {
      const lastHeartbeat = inst.last_heartbeat;
      const heartbeatAgo = lastHeartbeat
        ? Math.floor((now.getTime() - lastHeartbeat.getTime()) / 60000)
        : null;

      return {
        id: inst.id,
        userId: inst.user_id,
        userEmail: inst.users?.email || 'N/A',
        status: inst.status,
        ip: inst.ip_address,
        lastHeartbeat: heartbeatAgo !== null ? `${heartbeatAgo} 分钟前` : '无',
        isZombie: heartbeatAgo !== null && heartbeatAgo > 15,
        createdAt: inst.created_at.toISOString().split('T')[0],
      };
    });

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 停止 VPS 实例
   */
  async stopInstance(instanceId: string, adminId: string) {
    const instance = await this.prisma.client.instances.findUnique({
      where: { id: instanceId },
    });

    if (!instance) {
      throw new NotFoundException('实例不存在');
    }

    if (instance.status === 'stopped') {
      throw new ForbiddenException('实例已停止');
    }

    await this.prisma.client.instances.update({
      where: { id: instanceId },
      data: { status: 'stopped', updated_at: new Date() },
    });

    await this.logAudit(adminId, 'stop_instance', 'instance', instanceId, {
      oldStatus: instance.status,
    });

    this.logger.log(`管理员 ${adminId} 停止实例 ${instanceId}`);

    return { success: true, instanceId, newStatus: 'stopped' };
  }

  // ==================== 提现审核 ====================

  /**
   * 获取待审核提现列表
   */
  async getWithdrawals(query: { page?: number; limit?: number; status?: string }) {
    const { page = 1, limit = 20, status = 'pending' } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    const [withdrawals, total] = await Promise.all([
      this.prisma.client.withdrawals.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          users_withdrawals_user_idTousers: { select: { email: true } },
        },
      }),
      this.prisma.client.withdrawals.count({ where }),
    ]);

    const data = withdrawals.map((w) => ({
      id: w.id,
      userId: w.user_id,
      userEmail: w.users_withdrawals_user_idTousers?.email || 'N/A',
      amount: new Decimal(w.amount.toString()).toFixed(2),
      address: w.to_address,
      chain: w.chain || 'TRC20',
      status: w.status,
      createdAt: w.created_at.toISOString().replace('T', ' ').slice(0, 16),
    }));

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 批准提现
   */
  async approveWithdrawal(withdrawalId: string, adminId: string, txHash?: string) {
    const withdrawal = await this.prisma.client.withdrawals.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundException('提现记录不存在');
    }

    if (withdrawal.status !== 'pending') {
      throw new ForbiddenException(`无法批准状态为 ${withdrawal.status} 的提现`);
    }

    await this.prisma.client.withdrawals.update({
      where: { id: withdrawalId },
      data: {
        status: 'approved',
        tx_hash: txHash || null,
        reviewed_by: adminId,
        reviewed_at: new Date(),
        updated_at: new Date(),
      },
    });

    await this.logAudit(adminId, 'approve_withdrawal', 'withdrawal', withdrawalId, {
      amount: withdrawal.amount.toString(),
      txHash,
    });

    this.logger.log(`管理员 ${adminId} 批准提现 ${withdrawalId}`);

    return { success: true, withdrawalId, newStatus: 'approved' };
  }

  /**
   * 拒绝提现
   */
  async rejectWithdrawal(withdrawalId: string, adminId: string, reason?: string) {
    const withdrawal = await this.prisma.client.withdrawals.findUnique({
      where: { id: withdrawalId },
      include: { users_withdrawals_user_idTousers: true },
    });

    if (!withdrawal) {
      throw new NotFoundException('提现记录不存在');
    }

    if (withdrawal.status !== 'pending') {
      throw new ForbiddenException(`无法拒绝状态为 ${withdrawal.status} 的提现`);
    }

    // 使用事务：拒绝提现并退还余额
    await this.prisma.client.$transaction(async (tx) => {
      // 更新提现状态
      await tx.withdrawals.update({
        where: { id: withdrawalId },
        data: {
          status: 'rejected',
          reject_reason: reason || null,
          reviewed_by: adminId,
          reviewed_at: new Date(),
          updated_at: new Date(),
        },
      });

      // 退还用户余额
      await tx.wallets.updateMany({
        where: { user_id: withdrawal.user_id },
        data: {
          usdt_balance: {
            increment: withdrawal.amount,
          },
        },
      });
    });

    await this.logAudit(adminId, 'reject_withdrawal', 'withdrawal', withdrawalId, {
      amount: withdrawal.amount.toString(),
      reason: reason || '无',
    });

    this.logger.log(`管理员 ${adminId} 拒绝提现 ${withdrawalId}，原因: ${reason || '无'}`);

    return { success: true, withdrawalId, newStatus: 'rejected' };
  }

  // ==================== Kill Switch ====================

  /**
   * 获取 Kill Switch 状态
   */
  async getKillSwitchStatus() {
    // 统计各状态实例数量
    const [running, stopped, total] = await Promise.all([
      this.prisma.client.instances.count({ where: { status: 'running' } }),
      this.prisma.client.instances.count({ where: { status: 'stopped' } }),
      this.prisma.client.instances.count(),
    ]);

    // 获取最近一次 kill switch 操作记录
    const lastKillSwitch = await this.prisma.client.admin_audit_logs.findFirst({
      where: { action: 'kill_switch' },
      orderBy: { created_at: 'desc' },
      select: {
        admin_id: true,
        details: true,
        created_at: true,
      },
    });

    return {
      enabled: false, // Kill Switch 默认处于待命状态
      runningInstances: running,
      stoppedInstances: stopped,
      totalInstances: total,
      lastTriggered: lastKillSwitch
        ? {
            adminId: lastKillSwitch.admin_id,
            reason: (lastKillSwitch.details as { reason?: string })?.reason || '',
            stoppedCount: (lastKillSwitch.details as { stoppedCount?: number })?.stoppedCount || 0,
            triggeredAt: lastKillSwitch.created_at.toISOString(),
          }
        : null,
    };
  }

  /**
   * 紧急停机 - 停止所有运行中的 VPS
   */
  async killSwitch(adminId: string, reason: string) {
    // 获取所有运行中的实例
    const runningInstances = await this.prisma.client.instances.findMany({
      where: { status: 'running' },
      select: { id: true },
    });

    if (runningInstances.length === 0) {
      return { success: true, stoppedCount: 0, message: '没有运行中的实例' };
    }

    // 批量停止
    const result = await this.prisma.client.instances.updateMany({
      where: { status: 'running' },
      data: { status: 'stopped', updated_at: new Date() },
    });

    await this.logAudit(adminId, 'kill_switch', undefined, undefined, {
      stoppedCount: result.count,
      reason,
    });

    this.logger.warn(
      `⚠️ KILL SWITCH 触发！管理员 ${adminId} 停止了 ${result.count} 个实例，原因: ${reason}`
    );

    return {
      success: true,
      stoppedCount: result.count,
      message: `已紧急停止 ${result.count} 个 VPS 实例`,
    };
  }

  // ==================== 用户详情相关 ====================

  /**
   * 获取用户详情
   */
  async getUserDetail(userId: string) {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      include: {
        wallets: true,
        agents: { select: { name: true, code: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const [instanceCount, tradesCount, stakingTotal] = await Promise.all([
      this.prisma.client.instances.count({ where: { user_id: userId } }),
      this.prisma.client.trade_history.count({ where: { user_id: userId } }),
      this.prisma.client.stakes.aggregate({
        where: { user_id: userId, status: 'active' },
        _sum: { amount: true },
      }),
    ]);

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      vipLevel: user.vip_level,
      vipExpiresAt: user.vip_expires_at?.toISOString() || null,
      status: user.status,
      twoFactorEnabled: user.two_factor_enabled,
      agentId: user.agent_id,
      agentName: user.agents?.name || null,
      agentCode: user.agents?.code || null,
      wallet: user.wallets
        ? {
            usdtBalance: new Decimal(user.wallets.usdt_balance.toString()).toFixed(2),
            pointsBalance: new Decimal(user.wallets.points_balance.toString()).toFixed(2),
            tokenBalance: new Decimal(user.wallets.token_balance.toString()).toFixed(2),
          }
        : null,
      stats: {
        instanceCount,
        tradesCount,
        stakingTotal: stakingTotal._sum.amount
          ? new Decimal(stakingTotal._sum.amount.toString()).toFixed(2)
          : '0.00',
      },
      createdAt: user.created_at.toISOString(),
      lastLoginAt: user.last_login_at?.toISOString() || null,
      lastLoginIp: user.last_login_ip?.toString() || null,
    };
  }

  /**
   * 更新用户信息
   */
  async updateUser(userId: string, dto: UpdateUserDto, adminId: string) {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 如果要修改邮箱，检查是否重复
    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.client.users.findUnique({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ForbiddenException('邮箱已被使用');
      }
    }

    const updated = await this.prisma.client.users.update({
      where: { id: userId },
      data: {
        ...(dto.email && { email: dto.email }),
        ...(dto.status && { status: dto.status }),
        updated_at: new Date(),
      },
    });

    await this.logAudit(adminId, 'update_user', 'user', userId, {
      changes: dto,
    });

    return { success: true, userId: updated.id };
  }

  /**
   * 调整 VIP 等级
   */
  async updateVipLevel(userId: string, dto: UpdateVipDto, adminId: string) {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const updated = await this.prisma.client.users.update({
      where: { id: userId },
      data: {
        vip_level: dto.vipLevel,
        ...(dto.vipExpiresAt && { vip_expires_at: new Date(dto.vipExpiresAt) }),
        updated_at: new Date(),
      },
    });

    await this.logAudit(adminId, 'update_vip', 'user', userId, {
      oldLevel: user.vip_level,
      newLevel: dto.vipLevel,
      expiresAt: dto.vipExpiresAt,
    });

    return {
      success: true,
      userId: updated.id,
      vipLevel: updated.vip_level,
      vipExpiresAt: updated.vip_expires_at?.toISOString() || null,
    };
  }

  /**
   * 获取用户交易历史
   */
  async getUserTrades(userId: string, query: { page: number; limit: number }) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [trades, total] = await Promise.all([
      this.prisma.client.trade_history.findMany({
        where: { user_id: userId },
        skip,
        take: limit,
        orderBy: { opened_at: 'desc' },
      }),
      this.prisma.client.trade_history.count({ where: { user_id: userId } }),
    ]);

    const data = trades.map((t) => ({
      id: t.id,
      exchange: t.exchange,
      symbol: t.symbol,
      side: t.side,
      quantity: new Decimal(t.quantity.toString()).toFixed(8),
      entryPrice: t.entry_price ? new Decimal(t.entry_price.toString()).toFixed(8) : null,
      exitPrice: t.exit_price ? new Decimal(t.exit_price.toString()).toFixed(8) : null,
      pnl: t.pnl ? new Decimal(t.pnl.toString()).toFixed(2) : null,
      status: t.status,
      openedAt: t.opened_at.toISOString(),
      closedAt: t.closed_at?.toISOString() || null,
    }));

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  /**
   * 获取用户 VPS 列表
   */
  async getUserInstances(userId: string) {
    const instances = await this.prisma.client.instances.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });

    return instances.map((inst) => ({
      id: inst.id,
      status: inst.status,
      region: inst.region,
      ipAddress: inst.ip_address?.toString() || null,
      lastHeartbeat: inst.last_heartbeat?.toISOString() || null,
      createdAt: inst.created_at.toISOString(),
    }));
  }

  /**
   * 获取用户钱包流水
   */
  async getUserBilling(userId: string, query: { page: number; limit: number }) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.client.billing_logs.findMany({
        where: { user_id: userId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.client.billing_logs.count({ where: { user_id: userId } }),
    ]);

    const data = logs.map((log) => ({
      id: log.id,
      type: log.billing_type,
      amount: new Decimal(log.amount.toString()).toFixed(2),
      description: log.description,
      createdAt: log.created_at.toISOString(),
    }));

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  /**
   * 获取用户登录日志
   */
  async getUserLoginLogs(userId: string, query: { page: number; limit: number }) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.client.login_logs.findMany({
        where: { user_id: userId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.client.login_logs.count({ where: { user_id: userId } }),
    ]);

    const data = logs.map((log) => ({
      id: log.id,
      ipAddress: log.ip_address?.toString() || null,
      userAgent: log.user_agent,
      deviceType: log.device_type,
      browser: log.browser,
      os: log.os,
      location: log.location,
      loginStatus: log.login_status,
      failureReason: log.failure_reason,
      createdAt: log.created_at.toISOString(),
    }));

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ==================== 公告管理 ====================

  /**
   * 获取公告列表
   */
  async getAnnouncements(query: { page: number; limit: number }) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [announcements, total] = await Promise.all([
      this.prisma.client.announcements.findMany({
        skip,
        take: limit,
        orderBy: [{ is_pinned: 'desc' }, { created_at: 'desc' }],
      }),
      this.prisma.client.announcements.count(),
    ]);

    const data = announcements.map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      type: a.type,
      isPinned: a.is_pinned,
      startAt: a.start_at.toISOString(),
      endAt: a.end_at?.toISOString() || null,
      createdAt: a.created_at.toISOString(),
    }));

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  /**
   * 创建公告
   */
  async createAnnouncement(dto: CreateAnnouncementDto, adminId: string) {
    const announcement = await this.prisma.client.announcements.create({
      data: {
        title: dto.title,
        content: dto.content,
        type: dto.type || 'info',
        is_pinned: dto.isPinned || false,
        start_at: dto.startAt ? new Date(dto.startAt) : new Date(),
        end_at: dto.endAt ? new Date(dto.endAt) : null,
      },
    });

    await this.logAudit(adminId, 'create_announcement', 'announcement', announcement.id, {
      title: dto.title,
    });

    return {
      id: announcement.id,
      title: announcement.title,
      createdAt: announcement.created_at.toISOString(),
    };
  }

  /**
   * 更新公告
   */
  async updateAnnouncement(id: string, dto: UpdateAnnouncementDto, adminId: string) {
    const announcement = await this.prisma.client.announcements.findUnique({
      where: { id },
    });

    if (!announcement) {
      throw new NotFoundException('公告不存在');
    }

    const updated = await this.prisma.client.announcements.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.content && { content: dto.content }),
        ...(dto.type && { type: dto.type }),
        ...(dto.isPinned !== undefined && { is_pinned: dto.isPinned }),
        ...(dto.startAt && { start_at: new Date(dto.startAt) }),
        ...(dto.endAt && { end_at: new Date(dto.endAt) }),
        updated_at: new Date(),
      },
    });

    await this.logAudit(adminId, 'update_announcement', 'announcement', id, { changes: dto });

    return { id: updated.id, title: updated.title };
  }

  /**
   * 删除公告
   */
  async deleteAnnouncement(id: string, adminId: string) {
    const announcement = await this.prisma.client.announcements.findUnique({
      where: { id },
    });

    if (!announcement) {
      throw new NotFoundException('公告不存在');
    }

    await this.prisma.client.announcements.delete({ where: { id } });

    await this.logAudit(adminId, 'delete_announcement', 'announcement', id, {
      title: announcement.title,
    });

    return { success: true };
  }

  // ==================== 策略管理 ====================

  /**
   * 获取策略列表（含订阅数）
   */
  async getStrategies(query: { page: number; limit: number }) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [strategies, total] = await Promise.all([
      this.prisma.client.strategies.findMany({
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.client.strategies.count(),
    ]);

    // 查询每个策略的订阅数
    const data = await Promise.all(
      strategies.map(async (s) => {
        const subscriberCount = await this.prisma.client.user_strategy_configs.count({
          where: { strategy_id: s.id, is_active: true },
        });

        return {
          id: s.id,
          name: s.name,
          description: s.description,
          ownerType: s.owner_type,
          isPublic: s.is_public,
          isActive: s.is_active,
          subscriberCount,
          version: s.version,
          createdAt: s.created_at.toISOString(),
        };
      })
    );

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  /**
   * 创建策略
   */
  async createStrategy(dto: CreateStrategyDto, adminId: string) {
    const strategy = await this.prisma.client.strategies.create({
      data: {
        name: dto.name,
        description: dto.description || null,
        content: dto.content,
        config: dto.config ? JSON.parse(dto.config) : {},
        owner_type: 'system',
        owner_id: null,
        is_public: dto.isPublic ?? true,
        is_active: dto.isActive ?? true,
      },
    });

    await this.logAudit(adminId, 'create_strategy', 'strategy', strategy.id, {
      name: dto.name,
    });

    return {
      id: strategy.id,
      name: strategy.name,
      createdAt: strategy.created_at.toISOString(),
    };
  }

  /**
   * 获取策略详情
   */
  async getStrategyDetail(id: string) {
    const strategy = await this.prisma.client.strategies.findUnique({
      where: { id },
    });

    if (!strategy) {
      throw new NotFoundException('策略不存在');
    }

    const subscriberCount = await this.prisma.client.user_strategy_configs.count({
      where: { strategy_id: id, is_active: true },
    });

    return {
      id: strategy.id,
      name: strategy.name,
      description: strategy.description,
      content: strategy.content,
      config: strategy.config,
      ownerType: strategy.owner_type,
      isPublic: strategy.is_public,
      isActive: strategy.is_active,
      performanceStats: strategy.performance_stats,
      subscriberCount,
      version: strategy.version,
      createdAt: strategy.created_at.toISOString(),
      updatedAt: strategy.updated_at.toISOString(),
    };
  }

  /**
   * 更新策略
   */
  async updateStrategy(id: string, dto: UpdateStrategyDto, adminId: string) {
    const strategy = await this.prisma.client.strategies.findUnique({
      where: { id },
    });

    if (!strategy) {
      throw new NotFoundException('策略不存在');
    }

    const updated = await this.prisma.client.strategies.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.content && { content: dto.content }),
        ...(dto.config && { config: JSON.parse(dto.config) }),
        ...(dto.isPublic !== undefined && { is_public: dto.isPublic }),
        ...(dto.isActive !== undefined && { is_active: dto.isActive }),
        updated_at: new Date(),
      },
    });

    await this.logAudit(adminId, 'update_strategy', 'strategy', id, { changes: dto });

    return { id: updated.id, name: updated.name };
  }

  /**
   * 删除策略
   */
  async deleteStrategy(id: string, adminId: string) {
    const strategy = await this.prisma.client.strategies.findUnique({
      where: { id },
    });

    if (!strategy) {
      throw new NotFoundException('策略不存在');
    }

    // 检查是否有用户正在使用
    const activeUsers = await this.prisma.client.user_strategy_configs.count({
      where: { strategy_id: id, is_active: true },
    });

    if (activeUsers > 0) {
      throw new ForbiddenException(`该策略有 ${activeUsers} 个用户正在使用，无法删除`);
    }

    await this.prisma.client.strategies.delete({ where: { id } });

    await this.logAudit(adminId, 'delete_strategy', 'strategy', id, {
      name: strategy.name,
    });

    return { success: true };
  }

  /**
   * 上架/下架策略
   */
  async toggleStrategy(id: string, adminId: string) {
    const strategy = await this.prisma.client.strategies.findUnique({
      where: { id },
    });

    if (!strategy) {
      throw new NotFoundException('策略不存在');
    }

    const newStatus = !strategy.is_active;

    await this.prisma.client.strategies.update({
      where: { id },
      data: { is_active: newStatus, updated_at: new Date() },
    });

    await this.logAudit(adminId, 'toggle_strategy', 'strategy', id, {
      name: strategy.name,
      isActive: newStatus,
    });

    return { success: true, strategyId: id, isActive: newStatus };
  }

  // ==================== 审计日志 ====================

  /**
   * 记录审计日志
   */
  private async logAudit(
    adminId: string,
    action: string,
    targetType?: string,
    targetId?: string,
    details?: any,
  ) {
    try {
      await this.prisma.client.admin_audit_logs.create({
        data: {
          admin_id: adminId,
          action,
          target_type: targetType || null,
          target_id: targetId || null,
          details: details || {},
          ip_address: null, // 可从请求上下文获取
        },
      });
    } catch (error) {
      this.logger.error(`记录审计日志失败: ${error.message}`, error.stack);
    }
  }

  /**
   * 获取审计日志
   */
  async getAuditLogs(query: { page: number; limit: number; action?: string }) {
    const { page, limit, action } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (action) {
      where.action = action;
    }

    const [logs, total] = await Promise.all([
      this.prisma.client.admin_audit_logs.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          users: { select: { email: true } },
        },
      }),
      this.prisma.client.admin_audit_logs.count({ where }),
    ]);

    const data = logs.map((log) => ({
      id: log.id,
      adminEmail: log.users.email,
      action: log.action,
      targetType: log.target_type,
      targetId: log.target_id,
      details: log.details,
      ipAddress: log.ip_address?.toString() || null,
      createdAt: log.created_at.toISOString(),
    }));

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ==================== 辅助方法 ====================

  // 辅助方法
  private maskEmail(email: string): string {
    const [name, domain] = email.split('@');
    const masked = name.slice(0, 3) + '***';
    return `${masked}@${domain}`;
  }

  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    return `${days} 天前`;
  }

  // ==================== 代理商提现审核 ====================

  /**
   * 获取代理商提现列表
   */
  async getAgentWithdrawals(query: { page?: number; limit?: number; status?: string }) {
    const { page = 1, limit = 20, status = 'pending' } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    const [withdrawals, total] = await Promise.all([
      this.prisma.client.agent_withdrawals.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          agents: { select: { name: true, email: true, code: true } },
        },
      }),
      this.prisma.client.agent_withdrawals.count({ where }),
    ]);

    const data = withdrawals.map((w) => ({
      id: w.id,
      agentId: w.agent_id,
      agentName: w.agents?.name || 'N/A',
      agentEmail: w.agents?.email || 'N/A',
      agentCode: w.agents?.code || 'N/A',
      amount: new Decimal(w.amount.toString()).toFixed(2),
      fee: new Decimal(w.fee.toString()).toFixed(2),
      netAmount: new Decimal(w.amount.toString()).minus(w.fee.toString()).toFixed(2),
      walletAddress: w.wallet_address,
      chain: w.chain || 'TRC20',
      status: w.status,
      txHash: w.tx_hash,
      rejectReason: w.reject_reason,
      createdAt: w.created_at.toISOString().replace('T', ' ').slice(0, 16),
      reviewedAt: w.reviewed_at?.toISOString().replace('T', ' ').slice(0, 16) || null,
    }));

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  /**
   * 批准代理商提现
   */
  async approveAgentWithdrawal(withdrawalId: string, adminId: string, txHash?: string) {
    const withdrawal = await this.prisma.client.agent_withdrawals.findUnique({
      where: { id: withdrawalId },
      include: { agents: true },
    });

    if (!withdrawal) {
      throw new NotFoundException('代理商提现记录不存在');
    }

    if (withdrawal.status !== 'pending') {
      throw new ForbiddenException(`无法批准状态为 ${withdrawal.status} 的提现`);
    }

    // 使用事务：更新提现状态 + 标记佣金为已支付
    await this.prisma.client.$transaction(async (tx) => {
      // 更新提现状态
      await tx.agent_withdrawals.update({
        where: { id: withdrawalId },
        data: {
          status: 'completed',
          tx_hash: txHash || null,
          reviewed_by: adminId,
          reviewed_at: new Date(),
          updated_at: new Date(),
        },
      });

      // 标记对应金额的佣金为已支付
      const amountToMark = new Decimal(withdrawal.amount.toString());
      let remaining = amountToMark;

      // 获取待结算的佣金记录（按创建时间排序）
      const pendingCommissions = await tx.agent_commissions.findMany({
        where: {
          agent_id: withdrawal.agent_id,
          status: { in: ['pending', 'settled'] },
        },
        orderBy: { created_at: 'asc' },
      });

      // 逐条标记为已支付
      for (const commission of pendingCommissions) {
        if (remaining.lte(0)) break;

        const commissionAmount = new Decimal(commission.commission_amount.toString());
        if (commissionAmount.lte(remaining)) {
          await tx.agent_commissions.update({
            where: { id: commission.id },
            data: { status: 'paid', settled_at: new Date() },
          });
          remaining = remaining.minus(commissionAmount);
        }
      }
    });

    await this.logAudit(adminId, 'approve_agent_withdrawal', 'agent_withdrawal', withdrawalId, {
      agentId: withdrawal.agent_id,
      amount: withdrawal.amount.toString(),
      txHash,
    });

    this.logger.log(`管理员 ${adminId} 批准代理商提现 ${withdrawalId}`);

    return { success: true, withdrawalId };
  }

  /**
   * 拒绝代理商提现
   */
  async rejectAgentWithdrawal(withdrawalId: string, adminId: string, reason?: string) {
    const withdrawal = await this.prisma.client.agent_withdrawals.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundException('代理商提现记录不存在');
    }

    if (withdrawal.status !== 'pending') {
      throw new ForbiddenException(`无法拒绝状态为 ${withdrawal.status} 的提现`);
    }

    // 更新提现状态为拒绝（佣金保持原状，可重新申请）
    await this.prisma.client.agent_withdrawals.update({
      where: { id: withdrawalId },
      data: {
        status: 'rejected',
        reject_reason: reason || null,
        reviewed_by: adminId,
        reviewed_at: new Date(),
        updated_at: new Date(),
      },
    });

    await this.logAudit(adminId, 'reject_agent_withdrawal', 'agent_withdrawal', withdrawalId, {
      agentId: withdrawal.agent_id,
      amount: withdrawal.amount.toString(),
      reason,
    });

    this.logger.log(`管理员 ${adminId} 拒绝代理商提现 ${withdrawalId}，原因: ${reason || '无'}`);

    return { success: true, withdrawalId };
  }
}
