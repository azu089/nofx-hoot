import {
  Injectable,
  NotFoundException,
  BadRequestException,
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
      // 【Bug #7 修复】总实例数（排除已销毁）
      this.prisma.client.instances.count({
        where: { status: { notIn: ['destroyed'] } },
      }),
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
      // 检查是否是有效的 UUID 格式
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search);
      if (isUUID) {
        where.id = search;
      } else {
        where.email = { contains: search, mode: 'insensitive' };
      }
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
            select: {
              usdt_balance: true,
              points_balance: true,
              card_balance: true,
              token_balance: true,
            },
          }),
          // 【Bug #5 修复】排除已销毁实例
          this.prisma.client.instances.count({
            where: {
              user_id: user.id,
              status: { notIn: ['destroyed'] },
            },
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
          pointsBalance: wallet?.points_balance
            ? new Decimal(wallet.points_balance.toString()).toFixed(2)
            : '0.00',
          cardBalance: wallet?.card_balance
            ? new Decimal(wallet.card_balance.toString()).toFixed(2)
            : '0.00',
          tokenBalance: wallet?.token_balance
            ? new Decimal(wallet.token_balance.toString()).toFixed(2)
            : '0.00',
          status: user.status,
          instanceCount,
          totalTrades: tradesCount,
          createdAt: user.created_at.toISOString().split('T')[0],
          lastLogin: user.updated_at ? user.updated_at.toISOString() : null,
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
   * 获取返佣统计数据
   */
  async getReferralStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 查询返佣记录
    const [
      todayCommissions,
      monthCommissions,
      totalCommissions,
      activeReferrers,
    ] = await Promise.all([
      // 今日返佣
      this.prisma.client.user_commissions.findMany({
        where: {
          created_at: { gte: todayStart },
          status: 'settled',
        },
      }),
      // 本月返佣
      this.prisma.client.user_commissions.findMany({
        where: {
          created_at: { gte: monthStart },
          status: 'settled',
        },
      }),
      // 累计返佣
      this.prisma.client.user_commissions.findMany({
        where: { status: 'settled' },
      }),
      // 有邀请记录的用户数（活跃邀请人）- 统计有返佣记录的独立邀请人
      this.prisma.client.user_commissions.groupBy({
        by: ['referrer_id'],
        where: { status: 'settled' },
      }).then((groups: any[]) => groups.length),
    ]);

    // 计算各时间段返佣总额
    const calculateTotal = (commissions: any[]) => {
      return commissions.reduce(
        (sum, c) => sum.plus(new Decimal(c.commission_amount.toString())),
        new Decimal(0),
      );
    };

    const todayTotal = calculateTotal(todayCommissions);
    const monthTotal = calculateTotal(monthCommissions);
    const total = calculateTotal(totalCommissions);

    // 按类型统计
    const byType = {
      subscription: { count: 0, amount: new Decimal(0) },
      card_purchase: { count: 0, amount: new Decimal(0) },
      trade_points: { count: 0, amount: new Decimal(0) },
      gas_fee: { count: 0, amount: new Decimal(0) },
    };

    for (const c of totalCommissions) {
      const type = c.source_type as keyof typeof byType;
      if (byType[type]) {
        byType[type].count++;
        byType[type].amount = byType[type].amount.plus(
          new Decimal(c.commission_amount.toString()),
        );
      }
    }

    return {
      today: todayTotal.toString(),
      month: monthTotal.toString(),
      total: total.toString(),
      activeReferrers,
      byType: {
        subscription: {
          count: byType.subscription.count,
          amount: byType.subscription.amount.toString(),
        },
        card_purchase: {
          count: byType.card_purchase.count,
          amount: byType.card_purchase.amount.toString(),
        },
        trade_points: {
          count: byType.trade_points.count,
          amount: byType.trade_points.amount.toString(),
        },
        gas_fee: {
          count: byType.gas_fee.count,
          amount: byType.gas_fee.amount.toString(),
        },
      },
    };
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
    // 【Bug #7 修复】统计各状态实例数量（排除已销毁）
    const [running, stopped, total] = await Promise.all([
      this.prisma.client.instances.count({ where: { status: 'running' } }),
      this.prisma.client.instances.count({ where: { status: 'stopped' } }),
      this.prisma.client.instances.count({
        where: { status: { notIn: ['destroyed'] } },
      }),
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
      // 【Bug #5 修复】排除已销毁实例
      this.prisma.client.instances.count({
        where: { user_id: userId, status: { notIn: ['destroyed'] } },
      }),
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

        // 【Bug #2 修复】从 config 中提取 type 和 riskLevel
        const config = s.config as Record<string, unknown> || {};

        return {
          id: s.id,
          name: s.name,
          description: s.description,
          content: s.content, // 策略代码，编辑时需要
          code: s.content, // 前端使用 code 字段
          type: (config.type as string) || 'grid',
          riskLevel: (config.riskLevel as string) || 'medium',
          ownerType: s.owner_type,
          isPublic: s.is_public,
          isActive: s.is_active,
          status: s.is_active ? 'active' : 'inactive',
          reviewStatus: s.review_status,
          // 【Bug #3 修复】返回性能指标
          winRate: s.backtest_win_rate ? Number(s.backtest_win_rate) : null,
          maxDrawdown: s.backtest_max_drawdown ? Number(s.backtest_max_drawdown) : null,
          sharpeRatio: s.backtest_sharpe_ratio ? Number(s.backtest_sharpe_ratio) : null,
          monthlyReturn: s.backtest_total_return ? Number(s.backtest_total_return) : null,
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
    // 【Bug #3 修复】将 type 和 riskLevel 保存到 config
    const config = dto.config ? JSON.parse(dto.config) : {};
    if (dto.type) config.type = dto.type;
    if (dto.riskLevel) config.riskLevel = dto.riskLevel;

    const strategy = await this.prisma.client.strategies.create({
      data: {
        name: dto.name,
        description: dto.description || null,
        content: dto.content,
        config,
        owner_type: 'platform',
        owner_id: null,
        is_public: dto.isPublic ?? true,
        is_active: dto.isActive ?? true,
        // 【Bug #1 修复】后台创建的策略直接通过审核
        review_status: 'approved',
        reviewed_by: adminId,
        reviewed_at: new Date(),
        // 【Bug #3 修复】保存性能指标
        backtest_win_rate: dto.winRate ?? null,
        backtest_max_drawdown: dto.maxDrawdown ?? null,
        backtest_sharpe_ratio: dto.sharpeRatio ?? null,
        backtest_total_return: dto.monthlyReturn ?? null,
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

    // 【Bug #2 修复】从 config 中提取 type 和 riskLevel
    const config = strategy.config as Record<string, unknown> || {};

    return {
      id: strategy.id,
      name: strategy.name,
      description: strategy.description,
      content: strategy.content,
      code: strategy.content, // 前端使用 code 字段
      config: strategy.config,
      type: (config.type as string) || 'grid',
      riskLevel: (config.riskLevel as string) || 'medium',
      ownerType: strategy.owner_type,
      isPublic: strategy.is_public,
      isActive: strategy.is_active,
      status: strategy.is_active ? 'active' : 'inactive',
      reviewStatus: strategy.review_status,
      performanceStats: strategy.performance_stats,
      // 【Bug #3 修复】返回性能指标
      winRate: strategy.backtest_win_rate ? Number(strategy.backtest_win_rate) : null,
      maxDrawdown: strategy.backtest_max_drawdown ? Number(strategy.backtest_max_drawdown) : null,
      sharpeRatio: strategy.backtest_sharpe_ratio ? Number(strategy.backtest_sharpe_ratio) : null,
      monthlyReturn: strategy.backtest_total_return ? Number(strategy.backtest_total_return) : null,
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

    // 【Bug #3 修复】合并现有 config 与新的 type/riskLevel
    let configUpdate = undefined;
    if (dto.config || dto.type || dto.riskLevel) {
      const existingConfig = (strategy.config as Record<string, unknown>) || {};
      const newConfig = dto.config ? JSON.parse(dto.config) : {};
      configUpdate = {
        ...existingConfig,
        ...newConfig,
        ...(dto.type && { type: dto.type }),
        ...(dto.riskLevel && { riskLevel: dto.riskLevel }),
      };
    }

    const updated = await this.prisma.client.strategies.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.content && { content: dto.content }),
        ...(configUpdate && { config: configUpdate }),
        ...(dto.isPublic !== undefined && { is_public: dto.isPublic }),
        ...(dto.isActive !== undefined && { is_active: dto.isActive }),
        // 【Bug #3 修复】更新性能指标
        ...(dto.winRate !== undefined && { backtest_win_rate: dto.winRate }),
        ...(dto.maxDrawdown !== undefined && { backtest_max_drawdown: dto.maxDrawdown }),
        ...(dto.sharpeRatio !== undefined && { backtest_sharpe_ratio: dto.sharpeRatio }),
        ...(dto.monthlyReturn !== undefined && { backtest_total_return: dto.monthlyReturn }),
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

    // 【Bug #4 修复】上架时同步更新 review_status 和 is_public
    const updateData: Record<string, unknown> = {
      is_active: newStatus,
      updated_at: new Date(),
    };

    if (newStatus === true) {
      // 上架时确保审核通过且公开
      updateData.review_status = 'approved';
      updateData.is_public = true;
      updateData.reviewed_by = adminId;
      updateData.reviewed_at = new Date();
    } else {
      // 下架时设为私有
      updateData.is_public = false;
    }

    await this.prisma.client.strategies.update({
      where: { id },
      data: updateData,
    });

    await this.logAudit(adminId, 'toggle_strategy', 'strategy', id, {
      name: strategy.name,
      isActive: newStatus,
    });

    return { success: true, strategyId: id, isActive: newStatus };
  }

  // ==================== 策略审核 (Phase 16) ====================

  /**
   * 获取待审核策略列表
   */
  async getPendingStrategies(params: { page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const [strategies, total] = await Promise.all([
      this.prisma.client.strategies.findMany({
        where: {
          owner_type: 'user', // 只查用户上传的策略
          review_status: {
            in: ['pending', 'flagged'], // 待审核或需人工审核
          },
        },
        select: {
          id: true,
          name: true,
          description: true,
          owner_type: true,
          uploader_id: true,
          review_status: true,
          auto_check_passed: true,
          auto_check_warnings: true,
          created_at: true,
          updated_at: true,
        },
        orderBy: [
          { review_status: 'asc' }, // flagged 优先
          { created_at: 'asc' }, // 早提交的优先
        ],
        skip,
        take: limit,
      }),
      this.prisma.client.strategies.count({
        where: {
          owner_type: 'user',
          review_status: {
            in: ['pending', 'flagged'],
          },
        },
      }),
    ]);

    return {
      strategies,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 审核通过策略
   */
  async approveStrategy(id: string, adminId: string) {
    const strategy = await this.prisma.client.strategies.findUnique({
      where: { id },
    });

    if (!strategy) {
      throw new NotFoundException('策略不存在');
    }

    if (strategy.review_status === 'approved') {
      throw new BadRequestException('策略已通过审核');
    }

    await this.prisma.client.strategies.update({
      where: { id },
      data: {
        review_status: 'approved',
        reviewed_by: adminId,
        reviewed_at: new Date(),
        is_public: true, // 审核通过自动上架
        is_active: true,
      },
    });

    await this.logAudit(adminId, 'approve_strategy', 'strategy', id, {
      name: strategy.name,
      uploaderId: strategy.uploader_id,
    });

    return { success: true, strategyId: id, status: 'approved' };
  }

  /**
   * 拒绝策略
   */
  async rejectStrategy(id: string, adminId: string, reason: string) {
    const strategy = await this.prisma.client.strategies.findUnique({
      where: { id },
    });

    if (!strategy) {
      throw new NotFoundException('策略不存在');
    }

    if (strategy.review_status === 'rejected') {
      throw new BadRequestException('策略已被拒绝');
    }

    await this.prisma.client.strategies.update({
      where: { id },
      data: {
        review_status: 'rejected',
        reject_reason: reason,
        reviewed_by: adminId,
        reviewed_at: new Date(),
        is_public: false, // 拒绝后下架
        is_active: false,
      },
    });

    await this.logAudit(adminId, 'reject_strategy', 'strategy', id, {
      name: strategy.name,
      uploaderId: strategy.uploader_id,
      reason,
    });

    return { success: true, strategyId: id, status: 'rejected', reason };
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

  // ==================== 充值管理 ====================

  /**
   * 获取充值列表
   */
  async getDeposits(params: { page?: number; limit?: number; status?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (params.status) {
      where.status = params.status;
    }

    const [deposits, total, pendingCount] = await Promise.all([
      this.prisma.client.deposits.findMany({
        where,
        include: {
          users_deposits_user_idTousers: {
            select: { id: true, email: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.client.deposits.count({ where }),
      this.prisma.client.deposits.count({ where: { status: 'pending' } }),
    ]);

    return {
      data: deposits.map((d) => ({
        id: d.id,
        userId: d.user_id,
        userEmail: d.users_deposits_user_idTousers?.email || 'unknown',
        amount: d.amount.toString(),
        currency: d.currency,
        method: d.method,
        chain: d.chain,
        fromAddress: d.from_address,
        txHash: d.tx_hash,
        proofImageUrl: d.proof_image_url,
        status: d.status,
        rejectReason: d.reject_reason,
        reviewedBy: d.reviewed_by,
        reviewedAt: d.reviewed_at,
        createdAt: d.created_at,
      })),
      total,
      pending: pendingCount,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 审核通过充值
   */
  async approveDeposit(depositId: string, adminId: string) {
    const deposit = await this.prisma.client.deposits.findUnique({
      where: { id: depositId },
      include: { users_deposits_user_idTousers: { select: { email: true } } },
    });

    if (!deposit) {
      throw new NotFoundException('充值记录不存在');
    }

    if (deposit.status !== 'pending') {
      throw new BadRequestException(`充值记录状态为 ${deposit.status}，无法审核`);
    }

    // 使用事务：更新充值状态 + 增加用户余额
    await this.prisma.client.$transaction(async (tx) => {
      // 1. 更新充值记录状态
      await tx.deposits.update({
        where: { id: depositId },
        data: {
          status: 'approved',
          reviewed_by: adminId,
          reviewed_at: new Date(),
        },
      });

      // 2. 增加用户余额
      await tx.wallets.update({
        where: { user_id: deposit.user_id },
        data: {
          usdt_balance: {
            increment: deposit.amount,
          },
          updated_at: new Date(),
        },
      });

      // 3. 记录计费日志
      await tx.billing_logs.create({
        data: {
          user_id: deposit.user_id,
          unique_order_id: `deposit_approve_${deposit.id}_${Date.now()}`,
          billing_type: 'deposit',
          amount: deposit.amount,
          currency: deposit.currency,
          reference_type: 'deposit',
          reference_id: deposit.id,
          description: `充值审核通过：${deposit.method}`,
          status: 'completed',
        },
      });
    });

    await this.logAudit(adminId, 'approve_deposit', 'deposit', depositId, {
      userId: deposit.user_id,
      userEmail: deposit.users_deposits_user_idTousers?.email,
      amount: deposit.amount.toString(),
      method: deposit.method,
    });

    this.logger.log(
      `管理员 ${adminId} 审核通过充值 ${depositId}，金额：${deposit.amount}`,
    );

    return { success: true, depositId };
  }

  /**
   * 拒绝充值
   */
  async rejectDeposit(depositId: string, adminId: string, reason?: string) {
    const deposit = await this.prisma.client.deposits.findUnique({
      where: { id: depositId },
      include: { users_deposits_user_idTousers: { select: { email: true } } },
    });

    if (!deposit) {
      throw new NotFoundException('充值记录不存在');
    }

    if (deposit.status !== 'pending') {
      throw new BadRequestException(`充值记录状态为 ${deposit.status}，无法审核`);
    }

    await this.prisma.client.deposits.update({
      where: { id: depositId },
      data: {
        status: 'rejected',
        reviewed_by: adminId,
        reviewed_at: new Date(),
        reject_reason: reason || '未通过审核',
      },
    });

    await this.logAudit(adminId, 'reject_deposit', 'deposit', depositId, {
      userId: deposit.user_id,
      userEmail: deposit.users_deposits_user_idTousers?.email,
      amount: deposit.amount.toString(),
      reason,
    });

    this.logger.log(
      `管理员 ${adminId} 拒绝充值 ${depositId}，原因：${reason || '未通过审核'}`,
    );

    return { success: true, depositId };
  }

  // ==================== 手动余额调整 ====================

  /**
   * 手动调整用户余额
   */
  async adjustBalance(
    adminId: string,
    userId: string,
    data: {
      type: 'add' | 'deduct';
      amount: string;
      reason: string;
    },
  ) {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const wallet = await this.prisma.client.wallets.findUnique({
      where: { user_id: userId },
    });

    if (!wallet) {
      throw new NotFoundException('用户钱包不存在');
    }

    const amount = new Decimal(data.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('金额必须大于0');
    }

    const currentBalance = new Decimal(wallet.usdt_balance.toString());

    // 如果是扣款，检查余额是否足够
    if (data.type === 'deduct' && currentBalance.lt(amount)) {
      // 管理员操作：记录日志但不在响应中暴露用户余额
      this.logger.warn(`管理员扣款失败：用户余额不足`, {
        userId,
        currentBalance: currentBalance.toString(),
        deductAmount: amount.toString(),
      });
      throw new BadRequestException('用户余额不足，无法扣款');
    }

    const newBalance = data.type === 'add'
      ? currentBalance.plus(amount)
      : currentBalance.minus(amount);

    await this.prisma.client.$transaction(async (tx) => {
      // 1. 更新钱包余额
      await tx.wallets.update({
        where: { user_id: userId },
        data: {
          usdt_balance: newBalance.toString(),
          updated_at: new Date(),
        },
      });

      // 2. 记录计费日志
      await tx.billing_logs.create({
        data: {
          user_id: userId,
          unique_order_id: `admin_adjust_${adminId}_${userId}_${Date.now()}`,
          billing_type: data.type === 'add' ? 'admin_add' : 'admin_deduct',
          amount: data.type === 'add' ? amount.toString() : amount.negated().toString(),
          currency: 'USDT',
          reference_type: 'admin_adjustment',
          reference_id: adminId,
          description: `管理员${data.type === 'add' ? '加款' : '扣款'}：${data.reason}`,
          status: 'completed',
        },
      });
    });

    await this.logAudit(adminId, 'adjust_balance', 'wallet', userId, {
      userId,
      userEmail: user.email,
      type: data.type,
      amount: amount.toString(),
      reason: data.reason,
      previousBalance: currentBalance.toString(),
      newBalance: newBalance.toString(),
    });

    this.logger.log(
      `管理员 ${adminId} ${data.type === 'add' ? '加款' : '扣款'} 用户 ${userId} 金额 ${amount}，原因：${data.reason}`,
    );

    return {
      success: true,
      userId,
      previousBalance: currentBalance.toString(),
      newBalance: newBalance.toString(),
      adjustment: data.type === 'add' ? `+${amount}` : `-${amount}`,
    };
  }

  /**
   * 获取余额调整记录
   */
  async getBalanceAdjustments(params: { page?: number; limit?: number; userId?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      billing_type: {
        in: ['admin_add', 'admin_deduct'],
      },
    };

    if (params.userId) {
      where.user_id = params.userId;
    }

    const [logs, total] = await Promise.all([
      this.prisma.client.billing_logs.findMany({
        where,
        include: {
          users: {
            select: { id: true, email: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.client.billing_logs.count({ where }),
    ]);

    return {
      data: logs.map((log) => ({
        id: log.id,
        userId: log.user_id,
        userEmail: log.users?.email || 'unknown',
        type: log.billing_type === 'admin_add' ? 'add' : 'deduct',
        amount: new Decimal(log.amount.toString()).abs().toString(),
        reason: log.description,
        operatorId: log.reference_id,
        createdAt: log.created_at,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ==================== 代理商管理 ====================

  /**
   * 获取代理商列表
   */
  async getAgents(params: { page?: number; limit?: number; search?: string; status?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params.status) {
      where.status = params.status;
    }

    const [agents, total] = await Promise.all([
      this.prisma.client.agents.findMany({
        where,
        include: {
          _count: {
            select: { users: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.client.agents.count({ where }),
    ]);

    return {
      data: agents.map((agent) => ({
        id: agent.id,
        code: agent.code,
        name: agent.name,
        email: agent.email,
        level: agent.level,
        commissionRate: agent.commission_rate.toString(),
        totalUsers: agent.total_users,
        actualUsers: agent._count.users,
        totalCommission: agent.total_commission.toString(),
        status: agent.status,
        parentAgentId: agent.parent_agent_id,
        createdAt: agent.created_at,
        updatedAt: agent.updated_at,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 获取代理商详情
   */
  async getAgentDetail(agentId: string) {
    const agent = await this.prisma.client.agents.findUnique({
      where: { id: agentId },
      include: {
        _count: {
          select: { users: true, agent_commissions: true, agent_withdrawals: true },
        },
      },
    });

    if (!agent) {
      throw new NotFoundException('代理商不存在');
    }

    // 获取最近的佣金和提现记录
    const [recentCommissions, recentWithdrawals, pendingWithdrawals] = await Promise.all([
      this.prisma.client.agent_commissions.findMany({
        where: { agent_id: agentId },
        orderBy: { created_at: 'desc' },
        take: 5,
        include: {
          users: { select: { email: true } },
        },
      }),
      this.prisma.client.agent_withdrawals.findMany({
        where: { agent_id: agentId },
        orderBy: { created_at: 'desc' },
        take: 5,
      }),
      this.prisma.client.agent_withdrawals.count({
        where: { agent_id: agentId, status: 'pending' },
      }),
    ]);

    return {
      id: agent.id,
      code: agent.code,
      name: agent.name,
      email: agent.email,
      level: agent.level,
      commissionRate: agent.commission_rate.toString(),
      totalUsers: agent.total_users,
      actualUsers: agent._count.users,
      totalCommission: agent.total_commission.toString(),
      status: agent.status,
      parentAgentId: agent.parent_agent_id,
      createdAt: agent.created_at,
      updatedAt: agent.updated_at,
      stats: {
        totalCommissions: agent._count.agent_commissions,
        totalWithdrawals: agent._count.agent_withdrawals,
        pendingWithdrawals,
      },
      recentCommissions: recentCommissions.map((c) => ({
        id: c.id,
        userId: c.user_id,
        userEmail: c.users?.email || 'unknown',
        amount: c.commission_amount.toString(),
        source: c.source_type,
        status: c.status,
        createdAt: c.created_at,
      })),
      recentWithdrawals: recentWithdrawals.map((w) => ({
        id: w.id,
        amount: w.amount.toString(),
        status: w.status,
        createdAt: w.created_at,
      })),
    };
  }

  /**
   * 更新代理商配置
   */
  async updateAgent(
    adminId: string,
    agentId: string,
    data: {
      commissionRate?: string;
      status?: string;
      name?: string;
    },
  ) {
    const agent = await this.prisma.client.agents.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new NotFoundException('代理商不存在');
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (data.commissionRate !== undefined) {
      const rate = new Decimal(data.commissionRate);
      if (rate.lt(0) || rate.gt(1)) {
        throw new BadRequestException('佣金比例必须在 0 到 1 之间');
      }
      updateData.commission_rate = rate.toString();
    }

    if (data.status !== undefined) {
      if (!['active', 'suspended', 'pending'].includes(data.status)) {
        throw new BadRequestException('无效的状态值');
      }
      updateData.status = data.status;
    }

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    const updated = await this.prisma.client.agents.update({
      where: { id: agentId },
      data: updateData,
    });

    await this.logAudit(adminId, 'update_agent', 'agent', agentId, {
      agentCode: agent.code,
      changes: data,
      previousCommissionRate: agent.commission_rate.toString(),
      previousStatus: agent.status,
    });

    this.logger.log(`管理员 ${adminId} 更新代理商 ${agentId} 配置`);

    return {
      success: true,
      agent: {
        id: updated.id,
        code: updated.code,
        name: updated.name,
        commissionRate: updated.commission_rate.toString(),
        status: updated.status,
      },
    };
  }

  /**
   * 将用户设置为代理商
   * 1. 检查用户是否存在
   * 2. 检查是否已经是代理商
   * 3. 生成唯一邀请码
   * 4. 在 agents 表中创建记录
   */
  async promoteUserToAgent(
    adminId: string,
    userId: string,
    data: {
      name: string;
      commissionRate?: string;
    },
  ) {
    // 1. 查找用户
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 2. 检查是否已经是代理商
    const existingAgent = await this.prisma.client.agents.findUnique({
      where: { email: user.email },
    });

    if (existingAgent) {
      throw new BadRequestException('该用户已经是代理商');
    }

    // 3. 生成唯一邀请码 (6位大写字母+数字)
    let code: string;
    let isUnique = false;
    while (!isUnique) {
      code = this.generateAgentCode();
      const existing = await this.prisma.client.agents.findUnique({
        where: { code },
      });
      isUnique = !existing;
    }

    // 4. 设置佣金比例
    const commissionRate = data.commissionRate
      ? new Decimal(data.commissionRate)
      : new Decimal('0.10'); // 默认 10%

    if (commissionRate.lt(0) || commissionRate.gt(1)) {
      throw new BadRequestException('佣金比例必须在 0 到 1 之间');
    }

    // 5. 创建代理商记录
    const agent = await this.prisma.client.agents.create({
      data: {
        code: code!,
        name: data.name,
        email: user.email,
        level: 1,
        commission_rate: commissionRate.toString(),
        total_users: 0,
        total_commission: 0,
        status: 'active',
      },
    });

    // 6. 记录审计日志
    await this.logAudit(adminId, 'promote_to_agent', 'user', userId, {
      userEmail: user.email,
      agentId: agent.id,
      agentCode: agent.code,
      commissionRate: commissionRate.toString(),
    });

    this.logger.log(`管理员 ${adminId} 将用户 ${userId} (${user.email}) 设置为代理商`);

    return {
      success: true,
      agent: {
        id: agent.id,
        code: agent.code,
        name: agent.name,
        email: agent.email,
        commissionRate: agent.commission_rate.toString(),
        status: agent.status,
      },
    };
  }

  /**
   * 生成代理商邀请码
   */
  private generateAgentCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * 检查用户是否为代理商
   */
  async checkUserAgentStatus(userId: string) {
    // 查找用户
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 查找代理商记录
    const agent = await this.prisma.client.agents.findUnique({
      where: { email: user.email },
      select: {
        id: true,
        code: true,
        name: true,
        commission_rate: true,
        total_users: true,
        status: true,
      },
    });

    if (!agent) {
      return { isAgent: false };
    }

    return {
      isAgent: true,
      agent: {
        id: agent.id,
        code: agent.code,
        name: agent.name,
        commissionRate: agent.commission_rate.toString(),
        totalUsers: agent.total_users,
        status: agent.status,
      },
    };
  }

  /**
   * 撤销代理商身份
   */
  async revokeAgentStatus(adminId: string, userId: string) {
    // 查找用户
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 查找代理商记录
    const agent = await this.prisma.client.agents.findUnique({
      where: { email: user.email },
    });

    if (!agent) {
      throw new BadRequestException('该用户不是代理商');
    }

    // 检查是否有下级用户
    const usersCount = await this.prisma.client.users.count({
      where: { agent_id: agent.id },
    });

    if (usersCount > 0) {
      throw new BadRequestException(`该代理商有 ${usersCount} 个下级用户，无法撤销身份`);
    }

    // 删除代理商记录
    await this.prisma.client.agents.delete({
      where: { id: agent.id },
    });

    // 记录审计日志
    await this.logAudit(adminId, 'revoke_agent', 'user', userId, {
      userEmail: user.email,
      agentId: agent.id,
      agentCode: agent.code,
    });

    this.logger.log(`管理员 ${adminId} 撤销了用户 ${userId} (${user.email}) 的代理商身份`);

    return {
      success: true,
      message: '代理商身份已撤销',
    };
  }

  // ==================== 用户密码重置 ====================

  /**
   * 重置用户密码
   */
  async resetUserPassword(adminId: string, userId: string, newPassword?: string) {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 如果未提供新密码，生成随机密码
    const password = newPassword || this.generateRandomPassword();

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    await this.prisma.client.users.update({
      where: { id: userId },
      data: {
        password_hash: hashedPassword,
        updated_at: new Date(),
      },
    });

    await this.logAudit(adminId, 'reset_password', 'user', userId, {
      userEmail: user.email,
      isRandomPassword: !newPassword,
    });

    this.logger.log(`管理员 ${adminId} 重置用户 ${userId} (${user.email}) 的密码`);

    return {
      success: true,
      userId,
      email: user.email,
      // 只在使用随机密码时返回密码
      temporaryPassword: !newPassword ? password : undefined,
    };
  }

  /**
   * 生成随机密码
   */
  private generateRandomPassword(length = 12): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  // ==================== 质押管理 ====================

  /**
   * 获取质押统计
   */
  async getStakingStats() {
    const [activeStakes, totalStaked, totalRewards] = await Promise.all([
      this.prisma.client.stakes.count({ where: { status: 'active' } }),
      this.prisma.client.stakes.aggregate({
        where: { status: 'active' },
        _sum: { amount: true },
      }),
      this.prisma.client.stakes.aggregate({
        _sum: { accumulated_reward: true },
      }),
    ]);

    // 按类型统计
    const typeStats = await this.prisma.client.stakes.groupBy({
      by: ['stake_type'],
      where: { status: 'active' },
      _count: true,
      _sum: { amount: true },
    });

    return {
      activeStakes,
      totalStaked: totalStaked._sum.amount?.toString() || '0',
      totalRewards: totalRewards._sum.accumulated_reward?.toString() || '0',
      byType: typeStats.map((t) => ({
        type: t.stake_type,
        count: t._count,
        amount: t._sum.amount?.toString() || '0',
      })),
    };
  }

  /**
   * 获取质押列表
   */
  async getStakes(params: {
    page?: number;
    limit?: number;
    status?: string;
    stakeType?: string;
    userId?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (params.status) {
      where.status = params.status;
    }

    if (params.stakeType) {
      where.stake_type = params.stakeType;
    }

    if (params.userId) {
      where.user_id = params.userId;
    }

    const [stakes, total] = await Promise.all([
      this.prisma.client.stakes.findMany({
        where,
        include: {
          users: { select: { id: true, email: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.client.stakes.count({ where }),
    ]);

    return {
      data: stakes.map((s) => ({
        id: s.id,
        userId: s.user_id,
        userEmail: s.users?.email || 'unknown',
        stakeType: s.stake_type,
        amount: s.amount.toString(),
        startTime: s.start_time,
        endTime: s.end_time,
        lockPeriodDays: s.lock_period_days,
        weightMultiplier: s.weight_multiplier.toString(),
        accumulatedReward: s.accumulated_reward.toString(),
        claimableReward: s.claimable_reward.toString(),
        status: s.status,
        earlyUnstakeAt: s.early_unstake_at,
        penaltyAmount: s.penalty_amount?.toString() || '0',
        createdAt: s.created_at,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ==================== 交易报表导出 ====================

  /**
   * 获取交易报表数据
   */
  async getTradeReport(params: {
    startDate?: string;
    endDate?: string;
    userId?: string;
  }) {
    const where: Record<string, unknown> = {};

    if (params.startDate || params.endDate) {
      where.opened_at = {};
      if (params.startDate) {
        (where.opened_at as Record<string, unknown>).gte = new Date(params.startDate);
      }
      if (params.endDate) {
        (where.opened_at as Record<string, unknown>).lte = new Date(params.endDate);
      }
    }

    if (params.userId) {
      where.user_id = params.userId;
    }

    const trades = await this.prisma.client.trade_history.findMany({
      where,
      include: {
        users: { select: { email: true } },
      },
      orderBy: { opened_at: 'desc' },
      take: 10000, // 限制最大导出数量
    });

    type TradeRecord = (typeof trades)[number];

    // 计算统计数据
    const stats = {
      totalTrades: trades.length,
      totalVolume: trades.reduce((sum: number, t: TradeRecord) => sum + parseFloat(t.quantity?.toString() || '0'), 0),
      totalPnl: trades.reduce((sum: number, t: TradeRecord) => sum + parseFloat(t.pnl?.toString() || '0'), 0),
      totalFees: trades.reduce((sum: number, t: TradeRecord) => sum + parseFloat(t.gas_fee?.toString() || '0'), 0),
      winCount: trades.filter((t: TradeRecord) => parseFloat(t.pnl?.toString() || '0') > 0).length,
      lossCount: trades.filter((t: TradeRecord) => parseFloat(t.pnl?.toString() || '0') < 0).length,
    };

    return {
      stats,
      trades: trades.map((t: TradeRecord) => ({
        id: t.id,
        userId: t.user_id,
        userEmail: t.users?.email || 'unknown',
        instanceId: t.instance_id,
        symbol: t.symbol,
        side: t.side,
        quantity: t.quantity?.toString() || '0',
        price: t.entry_price?.toString() || '0',
        pnl: t.pnl?.toString() || '0',
        fee: t.gas_fee?.toString() || '0',
        createdAt: t.opened_at,
      })),
    };
  }

  /**
   * 获取收入报表数据
   */
  async getRevenueReport(params: {
    startDate?: string;
    endDate?: string;
    billingType?: string;
  }) {
    const where: Record<string, unknown> = {
      status: 'completed',
    };

    if (params.startDate || params.endDate) {
      where.created_at = {};
      if (params.startDate) {
        (where.created_at as Record<string, unknown>).gte = new Date(params.startDate);
      }
      if (params.endDate) {
        (where.created_at as Record<string, unknown>).lte = new Date(params.endDate);
      }
    }

    if (params.billingType) {
      where.billing_type = params.billingType;
    }

    const billings = await this.prisma.client.billing_logs.findMany({
      where,
      include: {
        users: { select: { email: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 10000,
    });

    // 按类型统计
    const byType: Record<string, { count: number; amount: number }> = {};
    billings.forEach((b) => {
      const type = b.billing_type;
      if (!byType[type]) {
        byType[type] = { count: 0, amount: 0 };
      }
      byType[type].count++;
      byType[type].amount += parseFloat(b.amount?.toString() || '0');
    });

    return {
      stats: {
        totalRecords: billings.length,
        totalRevenue: billings.reduce((sum, b) => sum + parseFloat(b.amount?.toString() || '0'), 0),
        byType: Object.entries(byType).map(([type, data]) => ({
          type,
          count: data.count,
          amount: data.amount.toFixed(8),
        })),
      },
      records: billings.map((b) => ({
        id: b.id,
        userId: b.user_id,
        userEmail: b.users?.email || 'unknown',
        type: b.billing_type,
        amount: b.amount?.toString() || '0',
        description: b.description || '',
        createdAt: b.created_at,
      })),
    };
  }

  // ==================== 用户级代理商管理（is_agent 字段）====================
  // TODO: 需要在 Prisma Schema 中添加 is_agent 和 agent_commission_rate 字段后恢复
  // 以下方法已注释：setUserAgentStatus, updateUserAgentCommissionRate, getUserAgents, settleUserAgentCommission, getAgentReferrals
  // 详见 git history 或备份

  // ==================== 质押权重分布 ====================

  /**
   * 获取全网质押权重分布
   */
  async getStakingWeights() {
    // 获取所有活跃质押
    const stakes = await this.prisma.client.stakes.findMany({
      where: { status: 'active' },
      include: {
        users: { select: { id: true, email: true } },
      },
    });

    // 计算每个用户的权重
    const userWeights: Record<string, {
      userId: string;
      email: string;
      stakeType: 'A' | 'B';
      totalAmount: Decimal;
      totalWeight: Decimal;
      stakesCount: number;
    }> = {};

    let totalWeight = new Decimal(0);
    let totalStaked = new Decimal(0);
    let typeAWeight = new Decimal(0);
    let typeBWeight = new Decimal(0);
    let typeAStaked = new Decimal(0);
    let typeBStaked = new Decimal(0);

    stakes.forEach((stake) => {
      const amount = new Decimal(stake.amount?.toString() || '0');
      const weight = new Decimal(stake.weight_multiplier?.toString() || '1');
      const stakeWeight = amount.times(weight);

      totalWeight = totalWeight.plus(stakeWeight);
      totalStaked = totalStaked.plus(amount);

      if (stake.stake_type === 'A') {
        typeAWeight = typeAWeight.plus(stakeWeight);
        typeAStaked = typeAStaked.plus(amount);
      } else {
        typeBWeight = typeBWeight.plus(stakeWeight);
        typeBStaked = typeBStaked.plus(amount);
      }

      const userId = stake.user_id;
      if (!userWeights[userId]) {
        userWeights[userId] = {
          userId,
          email: stake.users?.email || 'unknown',
          stakeType: stake.stake_type as 'A' | 'B',
          totalAmount: new Decimal(0),
          totalWeight: new Decimal(0),
          stakesCount: 0,
        };
      }
      userWeights[userId].totalAmount = userWeights[userId].totalAmount.plus(amount);
      userWeights[userId].totalWeight = userWeights[userId].totalWeight.plus(stakeWeight);
      userWeights[userId].stakesCount++;
    });

    // 转换为数组并计算百分比
    const distribution = Object.values(userWeights)
      .map((u) => ({
        userId: u.userId,
        email: u.email,
        stakeType: u.stakeType,
        totalAmount: u.totalAmount.toFixed(8),
        totalWeight: u.totalWeight.toFixed(8),
        weightPercentage: totalWeight.isZero()
          ? '0'
          : u.totalWeight.div(totalWeight).times(100).toFixed(4),
        stakesCount: u.stakesCount,
      }))
      .sort((a, b) => parseFloat(b.weightPercentage) - parseFloat(a.weightPercentage));

    return {
      totalWeight: totalWeight.toFixed(8),
      totalStaked: totalStaked.toFixed(8),
      typeAWeight: typeAWeight.toFixed(8),
      typeBWeight: typeBWeight.toFixed(8),
      typeAStaked: typeAStaked.toFixed(8),
      typeBStaked: typeBStaked.toFixed(8),
      totalStakers: Object.keys(userWeights).length,
      distribution,
    };
  }

  // ==================== 交易明细 ====================

  /**
   * 获取全网交易明细
   */
  async getFinanceRecords(params: {
    page: number;
    pageSize: number;
    type?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { page, pageSize, type, search, startDate, endDate } = params;

    const where: any = {};

    // 类型筛选
    if (type && type !== 'all') {
      where.billing_type = type;
    }

    // 日期筛选
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) {
        where.created_at.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.created_at.lte = end;
      }
    }

    // 搜索（需要先查用户）
    let userIds: string[] | undefined;
    if (search) {
      const users = await this.prisma.client.users.findMany({
        where: {
          email: { contains: search, mode: 'insensitive' },
        },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
      if (userIds.length === 0) {
        return { records: [], total: 0, page, pageSize, totalPages: 0 };
      }
      where.user_id = { in: userIds };
    }

    // 查询总数
    const total = await this.prisma.client.billing_logs.count({ where });

    // 查询记录
    const records = await this.prisma.client.billing_logs.findMany({
      where,
      include: {
        users: { select: { email: true } },
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      records: records.map((r) => ({
        id: r.id,
        userId: r.user_id,
        userEmail: r.users?.email || 'unknown',
        type: r.billing_type,
        amount: r.amount?.toString() || '0',
        currency: r.currency || 'USDT',
        description: r.description || '',
        reference_id: r.reference_id || '',
        status: r.status || 'completed',
        created_at: r.created_at,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ==================== Telegram Bot 配置 ====================

  /**
   * 获取 TG Bot 配置
   */
  async getTelegramConfig() {
    const configs = await this.prisma.client.system_configs.findMany({
      where: {
        config_key: { startsWith: 'tg_bot.' },
      },
    });

    const result: Record<string, any> = {};
    configs.forEach((c) => {
      const key = c.config_key.replace('tg_bot.', '');
      try {
        result[key] = JSON.parse(c.config_value);
      } catch {
        result[key] = c.config_value;
      }
    });

    return result;
  }

  /**
   * 更新 TG Bot 配置
   */
  async updateTelegramConfig(config: Record<string, any>, adminId: string) {
    const updates: { key: string; value: string }[] = [];

    for (const [key, value] of Object.entries(config)) {
      const configKey = `tg_bot.${key}`;
      const configValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      updates.push({ key: configKey, value: configValue });
    }

    // 批量更新或插入
    for (const { key, value } of updates) {
      await this.prisma.client.system_configs.upsert({
        where: { config_key: key },
        update: {
          config_value: value,
          updated_at: new Date(),
          updated_by: adminId,
        },
        create: {
          config_key: key,
          config_value: value,
          config_type: 'string',
          category: 'telegram',
          label: key.replace('tg_bot.', ''),
          is_public: false,
          description: `Telegram Bot 配置: ${key}`,
          updated_by: adminId,
        },
      });
    }

    // 清除缓存
    // TODO: 调用 Redis 清除 tg_bot_config 缓存

    this.logger.log(`管理员 ${adminId} 更新了 TG Bot 配置`);
  }

  /**
   * 重载 TG Bot 配置（清除缓存，触发重新加载）
   */
  async reloadTelegramConfig() {
    // TODO: 调用 TelegramBotService.reloadConfig()
    // 目前只记录日志
    this.logger.log('TG Bot 配置重载请求已发送');
  }
}
