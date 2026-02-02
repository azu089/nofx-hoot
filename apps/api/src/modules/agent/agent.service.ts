/**
 * 代理商业务服务
 * 提供业绩统计、名下用户、佣金记录、提现等功能
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Decimal from 'decimal.js';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(private prisma: PrismaService) {}

  // 获取业绩概览
  async getDashboard(agentId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        name: true,
        level: true,
        commissionRate: true,
        totalUsers: true,
        totalProfit: true,
        totalCommission: true,
      },
    });

    // 获取名下用户数（通过 agentId 字段关联）
    const userCount = await this.prisma.user.count({
      where: { agentId },
    });

    // 获取本月业绩
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [monthlyCommissions, pendingCommissions, todayCommissions] =
      await Promise.all([
        // 本月佣金
        this.prisma.agentCommission.aggregate({
          where: {
            agentId,
            createdAt: { gte: startOfMonth },
          },
          _sum: { commissionAmount: true, sourceAmount: true },
          _count: true,
        }),
        // 待结算佣金
        this.prisma.agentCommission.aggregate({
          where: {
            agentId,
            status: 'pending',
          },
          _sum: { commissionAmount: true },
        }),
        // 今日佣金
        this.prisma.agentCommission.aggregate({
          where: {
            agentId,
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
          _sum: { commissionAmount: true, sourceAmount: true },
          _count: true,
        }),
      ]);

    // 获取活跃用户数（7天内有交易）
    const activeUsers = await this.prisma.user.count({
      where: {
        agentId,
        positions: {
          some: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        },
      },
    });

    return {
      agent: {
        name: agent?.name,
        level: agent?.level,
        commissionRate: agent?.commissionRate.toString(),
      },
      overview: {
        totalUsers: userCount,
        activeUsers,
        totalProfit: agent?.totalProfit.toString() || '0',
        totalCommission: agent?.totalCommission.toString() || '0',
      },
      monthly: {
        sourceAmount: monthlyCommissions._sum.sourceAmount?.toString() || '0',
        commissionAmount:
          monthlyCommissions._sum.commissionAmount?.toString() || '0',
        count: monthlyCommissions._count,
      },
      today: {
        sourceAmount: todayCommissions._sum.sourceAmount?.toString() || '0',
        commissionAmount:
          todayCommissions._sum.commissionAmount?.toString() || '0',
        count: todayCommissions._count,
      },
      pendingCommission:
        pendingCommissions._sum.commissionAmount?.toString() || '0',
    };
  }

  // 获取名下用户列表
  async getUsers(
    agentId: string,
    page: number = 1,
    limit: number = 20,
    search?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: any = { agentId };
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { nickname: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              subscriptions: true,
              positions: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    // 获取每个用户产生的佣金
    const userIds = users.map((u) => u.id);
    const commissionStats = await this.prisma.agentCommission.groupBy({
      by: ['userId'],
      where: {
        agentId,
        userId: { in: userIds },
      },
      _sum: { commissionAmount: true, sourceAmount: true },
      _count: true,
    });

    const commissionMap = new Map(
      commissionStats.map((c) => [
        c.userId,
        {
          sourceAmount: c._sum.sourceAmount?.toString() || '0',
          commissionAmount: c._sum.commissionAmount?.toString() || '0',
          count: c._count,
        },
      ]),
    );

    return {
      items: users.map((u) => ({
        id: u.id,
        email: u.email,
        nickname: u.nickname,
        usdtBalance: u.usdtBalance.toString(),
        subscriptionCount: u._count.subscriptions,
        positionCount: u._count.positions,
        contribution: commissionMap.get(u.id) || {
          sourceAmount: '0',
          commissionAmount: '0',
          count: 0,
        },
        createdAt: u.createdAt,
        lastActiveAt: u.updatedAt, // 使用 updatedAt 作为最后活跃时间
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 获取佣金记录
  async getCommissions(
    agentId: string,
    page: number = 1,
    limit: number = 50,
    status?: string,
    type?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: any = { agentId };
    if (status) where.status = status;
    if (type) where.type = type;

    const [commissions, total] = await Promise.all([
      this.prisma.agentCommission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.agentCommission.count({ where }),
    ]);

    // 获取用户信息
    const userIds = [...new Set(commissions.map((c) => c.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, nickname: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      items: commissions.map((c) => ({
        id: c.id,
        user: userMap.get(c.userId) || {
          id: c.userId,
          email: '未知',
          nickname: '未知',
        },
        type: c.type,
        sourceAmount: c.sourceAmount.toString(),
        commissionRate: c.commissionRate.toString(),
        commissionAmount: c.commissionAmount.toString(),
        status: c.status,
        settledAt: c.settledAt,
        createdAt: c.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 获取结算记录
  async getSettlements(agentId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [settlements, total] = await Promise.all([
      this.prisma.agentSettlement.findMany({
        where: { agentId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.agentSettlement.count({ where: { agentId } }),
    ]);

    return {
      items: settlements.map((s) => ({
        id: s.id,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
        totalAmount: s.totalAmount.toString(),
        fee: s.fee.toString(),
        netAmount: s.netAmount.toString(),
        settlementMethod: s.settlementMethod,
        status: s.status,
        txHash: s.txHash,
        remark: s.remark,
        processedAt: s.processedAt,
        createdAt: s.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 发起提现申请
  async requestWithdrawal(
    agentId: string,
    data: {
      amount: string;
      settlementMethod: string;
      settlementAccount?: string;
    },
  ) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        walletAddress: true,
      },
    });

    // 获取待结算佣金
    const pendingCommissions = await this.prisma.agentCommission.aggregate({
      where: {
        agentId,
        status: 'pending',
      },
      _sum: { commissionAmount: true },
    });

    const pendingAmount = new Decimal(
      pendingCommissions._sum.commissionAmount?.toString() || '0',
    );
    const requestAmount = new Decimal(data.amount);

    if (requestAmount.gt(pendingAmount)) {
      throw new BadRequestException(
        `提现金额超过可用余额，当前可提现: ${pendingAmount.toString()} USDT`,
      );
    }

    if (requestAmount.lt(10)) {
      throw new BadRequestException('最低提现金额为 10 USDT');
    }

    // 确定结算账户
    const settlementAccount = data.settlementAccount || agent?.walletAddress;
    if (!settlementAccount) {
      throw new BadRequestException('请先设置结算账户');
    }

    // 创建结算申请
    const now = new Date();
    const settlement = await this.prisma.agentSettlement.create({
      data: {
        agentId,
        periodStart: new Date(now.getFullYear(), now.getMonth(), 1),
        periodEnd: now,
        totalAmount: requestAmount,
        fee: new Decimal(0),
        netAmount: requestAmount,
        settlementMethod: data.settlementMethod,
        settlementAccount,
        status: 'pending',
      },
    });

    this.logger.log(`代理商提现申请: ${agentId}, 金额: ${data.amount}`);

    return {
      message: '提现申请已提交，请等待审核',
      settlement: {
        id: settlement.id,
        amount: settlement.totalAmount.toString(),
        status: settlement.status,
      },
    };
  }

  // 获取统计趋势（近30天）
  async getStatsTrend(agentId: string) {
    const days = 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // 获取每日佣金
    const dailyCommissions = await this.prisma.$queryRaw<
      { date: Date; amount: string; count: number }[]
    >`
      SELECT
        DATE(created_at) as date,
        SUM(commission_amount) as amount,
        COUNT(*) as count
      FROM agent_commissions
      WHERE agent_id = ${agentId}
        AND created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // 获取每日新增用户
    const dailyUsers = await this.prisma.$queryRaw<
      { date: Date; count: number }[]
    >`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM users
      WHERE agent_id = ${agentId}
        AND created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    return {
      commissions: dailyCommissions.map((d) => ({
        date: d.date,
        amount: d.amount?.toString() || '0',
        count: Number(d.count),
      })),
      users: dailyUsers.map((d) => ({
        date: d.date,
        count: Number(d.count),
      })),
    };
  }

  // ========== 代币收益相关 ==========

  // 获取代币资产概览
  async getTokenAssets(agentId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, name: true, level: true },
    });

    // 获取私募配额
    const quotas = await this.prisma.agentTokenQuota.findMany({
      where: { agentId, status: { in: ['active', 'completed'] } },
    });

    // 计算配额统计
    const quotaStats = quotas.reduce(
      (acc, q) => ({
        totalQuota: acc.totalQuota.plus(q.quotaAmount),
        releasedAmount: acc.releasedAmount.plus(q.releasedAmount),
        pendingAmount: acc.pendingAmount.plus(
          q.quotaAmount.minus(q.releasedAmount),
        ),
        totalCost: acc.totalCost.plus(q.purchaseAmount),
      }),
      {
        totalQuota: new Decimal(0),
        releasedAmount: new Decimal(0),
        pendingAmount: new Decimal(0),
        totalCost: new Decimal(0),
      },
    );

    // 获取分红记录
    const dividends = await this.prisma.agentDividendRecord.findMany({
      where: { agentId },
    });

    // 计算分红统计
    const dividendStats = dividends.reduce(
      (acc, d) => ({
        totalHoot: acc.totalHoot.plus(d.dividendHoot),
        totalUsdt: acc.totalUsdt.plus(d.dividendUsdt),
        paidHoot:
          d.status === 'paid'
            ? acc.paidHoot.plus(d.dividendHoot)
            : acc.paidHoot,
        pendingHoot:
          d.status === 'pending'
            ? acc.pendingHoot.plus(d.dividendHoot)
            : acc.pendingHoot,
      }),
      {
        totalHoot: new Decimal(0),
        totalUsdt: new Decimal(0),
        paidHoot: new Decimal(0),
        pendingHoot: new Decimal(0),
      },
    );

    // 当前 HOOT 价格（模拟，实际需要从市场获取）
    const hootPrice = new Decimal('0.01');

    // 计算总代币和价值
    const totalHoot = quotaStats.releasedAmount.plus(dividendStats.paidHoot);
    const pendingHoot = quotaStats.pendingAmount.plus(
      dividendStats.pendingHoot,
    );
    const totalValue = totalHoot.plus(pendingHoot).times(hootPrice);

    return {
      agent: { id: agent?.id, name: agent?.name, level: agent?.level },
      // 私募配额
      quota: {
        totalQuota: quotaStats.totalQuota.toString(),
        releasedAmount: quotaStats.releasedAmount.toString(),
        pendingAmount: quotaStats.pendingAmount.toString(),
        totalCost: quotaStats.totalCost.toString(),
        currentValue: quotaStats.totalQuota.times(hootPrice).toString(),
      },
      // 分红
      dividend: {
        totalHoot: dividendStats.totalHoot.toString(),
        totalUsdt: dividendStats.totalUsdt.toString(),
        paidHoot: dividendStats.paidHoot.toString(),
        pendingHoot: dividendStats.pendingHoot.toString(),
        currentValue: dividendStats.totalHoot.times(hootPrice).toString(),
      },
      // 汇总
      summary: {
        totalHoot: totalHoot.toString(),
        pendingHoot: pendingHoot.toString(),
        totalInvestment: quotaStats.totalCost.toString(),
        currentValue: totalValue.toString(),
        hootPrice: hootPrice.toString(),
        profitRate: quotaStats.totalCost.gt(0)
          ? totalValue
              .minus(quotaStats.totalCost)
              .div(quotaStats.totalCost)
              .times(100)
              .toFixed(2)
          : '0',
      },
    };
  }

  // 获取私募配额列表
  async getTokenQuotas(agentId: string) {
    const quotas = await this.prisma.agentTokenQuota.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: quotas.map((q) => ({
        id: q.id,
        level: q.level,
        quotaAmount: q.quotaAmount.toString(),
        purchasePrice: q.purchasePrice.toString(),
        purchaseAmount: q.purchaseAmount.toString(),
        vestingMonths: q.vestingMonths,
        vestingStart: q.vestingStart,
        releasedAmount: q.releasedAmount.toString(),
        pendingAmount: q.quotaAmount.minus(q.releasedAmount).toString(),
        releaseProgress: q.quotaAmount.gt(0)
          ? q.releasedAmount.div(q.quotaAmount).times(100).toFixed(2)
          : '0',
        status: q.status,
        createdAt: q.createdAt,
        approvedAt: q.approvedAt,
      })),
      total: quotas.length,
    };
  }

  // 获取分红记录
  async getDividendRecords(
    agentId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      this.prisma.agentDividendRecord.findMany({
        where: { agentId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          pool: {
            select: {
              monthNumber: true,
              gasFeeTotal: true,
              poolAmount: true,
              hootPrice: true,
              totalTradeVolume: true,
            },
          },
        },
      }),
      this.prisma.agentDividendRecord.count({ where: { agentId } }),
    ]);

    return {
      items: records.map((r) => ({
        id: r.id,
        month: r.pool.monthNumber,
        userTradeVolume: r.userTradeVolume.toString(),
        contributionRate: new Decimal(r.contributionRate).times(100).toFixed(4),
        dividendUsdt: r.dividendUsdt.toString(),
        dividendHoot: r.dividendHoot.toString(),
        hootPrice: r.pool.hootPrice?.toString() || '0',
        status: r.status,
        paidAt: r.paidAt,
        createdAt: r.createdAt,
        poolInfo: {
          gasFeeTotal: r.pool.gasFeeTotal.toString(),
          poolAmount: r.pool.poolAmount.toString(),
          totalTradeVolume: r.pool.totalTradeVolume.toString(),
        },
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
