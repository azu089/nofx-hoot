/**
 * 管理后台 - 代理商管理服务
 * 代理商CRUD、佣金结算、统计
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import Decimal from 'decimal.js';

export interface CreateAgentDto {
  name: string;
  email: string;
  password: string;
  phone?: string;
  companyName?: string;
  level?: string;
  commissionRate?: number;
  settlementType?: string;
  walletAddress?: string;
}

export interface UpdateAgentDto {
  name?: string;
  phone?: string;
  companyName?: string;
  level?: string;
  commissionRate?: number;
  settlementType?: string;
  walletAddress?: string;
  status?: string;
  isActive?: boolean;
}

export interface AgentListDto {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  level?: string;
}

@Injectable()
export class AdminAgentService {
  private readonly logger = new Logger(AdminAgentService.name);

  constructor(private prisma: PrismaService) {}

  // 获取代理商列表
  async getAgents(dto: AgentListDto) {
    const { page = 1, limit = 20, search, status, level } = dto;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) where.status = status;
    if (level) where.level = level;

    const [agents, total] = await Promise.all([
      this.prisma.agent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { users: true, commissions: true },
          },
        },
      }),
      this.prisma.agent.count({ where }),
    ]);

    // 获取每个代理商的待结算佣金
    const agentIds = agents.map((a) => a.id);
    const pendingCommissions = await this.prisma.agentCommission.groupBy({
      by: ['agentId'],
      where: { agentId: { in: agentIds }, status: 'pending' },
      _sum: { commissionAmount: true },
    });

    const pendingMap = new Map(
      pendingCommissions.map((p) => [
        p.agentId,
        p._sum.commissionAmount?.toString() || '0',
      ]),
    );

    return {
      items: agents.map((a) => ({
        ...a,
        password: undefined,
        commissionRate: a.commissionRate.toString(),
        totalProfit: a.totalProfit.toString(),
        totalCommission: a.totalCommission.toString(),
        // 前端使用的字段名
        teamMemberCount: a._count.users,
        userCount: a._count.users,
        commissionCount: a._count.commissions,
        pendingCommission: pendingMap.get(a.id) || '0',
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 获取代理商详情
  async getAgentDetail(agentId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        users: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            nickname: true,
            usdtBalance: true,
            createdAt: true,
          },
        },
        commissions: {
          take: 50,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!agent) {
      throw new NotFoundException('代理商不存在');
    }

    // 获取待结算佣金
    const pendingCommission = await this.prisma.agentCommission.aggregate({
      where: { agentId, status: 'pending' },
      _sum: { commissionAmount: true },
    });

    // 获取本月佣金
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyCommission = await this.prisma.agentCommission.aggregate({
      where: {
        agentId,
        createdAt: { gte: startOfMonth },
      },
      _sum: { commissionAmount: true },
    });

    return {
      ...agent,
      password: undefined,
      commissionRate: agent.commissionRate.toString(),
      totalProfit: agent.totalProfit.toString(),
      totalCommission: agent.totalCommission.toString(),
      pendingCommission:
        pendingCommission._sum.commissionAmount?.toString() || '0',
      monthlyCommission:
        monthlyCommission._sum.commissionAmount?.toString() || '0',
      users: agent.users.map((u) => ({
        ...u,
        usdtBalance: u.usdtBalance.toString(),
      })),
      commissions: agent.commissions.map((c) => ({
        ...c,
        sourceAmount: c.sourceAmount.toString(),
        commissionRate: c.commissionRate.toString(),
        commissionAmount: c.commissionAmount.toString(),
      })),
    };
  }

  // 创建代理商
  async createAgent(dto: CreateAgentDto) {
    // 检查邮箱是否已存在
    const existing = await this.prisma.agent.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new BadRequestException('该邮箱已被注册');
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const agent = await this.prisma.agent.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        phone: dto.phone,
        companyName: dto.companyName,
        level: dto.level || 'bronze',
        commissionRate: dto.commissionRate || 0.1,
        settlementType: dto.settlementType || 'weekly',
        walletAddress: dto.walletAddress,
        status: 'pending',
        isActive: false,
      },
    });

    this.logger.log(`创建代理商: ${agent.id} - ${agent.name}`);

    return {
      ...agent,
      password: undefined,
    };
  }

  // 更新代理商
  async updateAgent(agentId: string, dto: UpdateAgentDto) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new NotFoundException('代理商不存在');
    }

    const updated = await this.prisma.agent.update({
      where: { id: agentId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.companyName !== undefined && { companyName: dto.companyName }),
        ...(dto.level && { level: dto.level }),
        ...(dto.commissionRate !== undefined && {
          commissionRate: dto.commissionRate,
        }),
        ...(dto.settlementType && { settlementType: dto.settlementType }),
        ...(dto.walletAddress !== undefined && {
          walletAddress: dto.walletAddress,
        }),
        ...(dto.status && { status: dto.status }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    this.logger.log(`更新代理商: ${agentId}`);

    return {
      ...updated,
      password: undefined,
    };
  }

  // 审核代理商
  async reviewAgent(
    agentId: string,
    action: 'approve' | 'reject',
    reason?: string,
  ) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new NotFoundException('代理商不存在');
    }

    if (agent.status !== 'pending') {
      throw new BadRequestException('该代理商已审核');
    }

    if (action === 'approve') {
      await this.prisma.agent.update({
        where: { id: agentId },
        data: {
          status: 'active',
          isActive: true,
        },
      });
      this.logger.log(`代理商审核通过: ${agentId}`);
      return { message: '代理商已审核通过' };
    } else {
      await this.prisma.agent.update({
        where: { id: agentId },
        data: {
          status: 'terminated',
          isActive: false,
        },
      });
      this.logger.log(`代理商审核拒绝: ${agentId}, 原因: ${reason || '无'}`);
      return { message: '代理商已拒绝' };
    }
  }

  // 获取代理商统计概览
  async getAgentStats() {
    const [
      totalAgents,
      activeAgents,
      pendingAgents,
      totalCommission,
      pendingCommission,
      monthlyCommission,
    ] = await Promise.all([
      this.prisma.agent.count(),
      this.prisma.agent.count({ where: { isActive: true } }),
      this.prisma.agent.count({ where: { status: 'pending' } }),
      this.prisma.agentCommission.aggregate({
        where: { status: 'settled' },
        _sum: { commissionAmount: true },
      }),
      this.prisma.agentCommission.aggregate({
        where: { status: 'pending' },
        _sum: { commissionAmount: true },
      }),
      this.prisma.agentCommission.aggregate({
        where: {
          createdAt: {
            gte: new Date(new Date().setDate(1)),
          },
        },
        _sum: { commissionAmount: true },
      }),
    ]);

    return {
      totalAgents,
      activeAgents,
      pendingAgents,
      totalCommission: totalCommission._sum.commissionAmount?.toString() || '0',
      pendingCommission:
        pendingCommission._sum.commissionAmount?.toString() || '0',
      monthlyCommission:
        monthlyCommission._sum.commissionAmount?.toString() || '0',
    };
  }

  // 结算代理商佣金
  async settleAgentCommission(agentId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new NotFoundException('代理商不存在');
    }

    // 获取待结算佣金
    const pendingCommissions = await this.prisma.agentCommission.findMany({
      where: { agentId, status: 'pending' },
    });

    if (pendingCommissions.length === 0) {
      throw new BadRequestException('没有待结算的佣金');
    }

    const totalAmount = pendingCommissions.reduce(
      (sum, c) => new Decimal(sum).plus(c.commissionAmount).toString(),
      '0',
    );

    // 创建结算批次
    const settlement = await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      // 创建结算记录
      const settlement = await tx.agentSettlement.create({
        data: {
          agentId,
          periodStart: pendingCommissions[0].createdAt,
          periodEnd: now,
          totalAmount: new Decimal(totalAmount),
          fee: 0,
          netAmount: new Decimal(totalAmount),
          settlementMethod: agent.walletAddress ? 'usdt' : 'bank',
          settlementAccount: agent.walletAddress || agent.bankAccount,
          status: 'pending',
        },
      });

      // 更新佣金状态
      await tx.agentCommission.updateMany({
        where: {
          id: { in: pendingCommissions.map((c) => c.id) },
        },
        data: {
          status: 'settled',
          settledAt: now,
          settlementId: settlement.id,
        },
      });

      // 更新代理商累计佣金
      await tx.agent.update({
        where: { id: agentId },
        data: {
          totalCommission: {
            increment: new Decimal(totalAmount),
          },
        },
      });

      return settlement;
    });

    this.logger.log(`代理商佣金结算: ${agentId}, 金额: ${totalAmount}`);

    return {
      message: '佣金结算成功',
      settlementId: settlement.id,
      totalAmount,
    };
  }

  // 获取代理商佣金记录
  async getAgentCommissions(
    agentId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    const [commissions, total] = await Promise.all([
      this.prisma.agentCommission.findMany({
        where: { agentId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.agentCommission.count({ where: { agentId } }),
    ]);

    return {
      items: commissions.map((c) => ({
        ...c,
        sourceAmount: c.sourceAmount.toString(),
        commissionRate: c.commissionRate.toString(),
        commissionAmount: c.commissionAmount.toString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ========== 代理商代币配额管理 ==========

  // 私募配额配置表
  private readonly quotaConfig: Record<
    string,
    { quota: number; price: number; vestingMonths: number }
  > = {
    bronze: { quota: 500000, price: 0.0007, vestingMonths: 6 }, // 50万 HOOT, 7折
    silver: { quota: 2000000, price: 0.0005, vestingMonths: 6 }, // 200万 HOOT, 5折
    gold: { quota: 5000000, price: 0.0003, vestingMonths: 9 }, // 500万 HOOT, 3折
    platinum: { quota: 10000000, price: 0.0002, vestingMonths: 12 }, // 1000万 HOOT, 2折
  };

  // 获取代币配额列表
  async getTokenQuotas(dto: {
    page?: number;
    limit?: number;
    agentId?: string;
    status?: string;
  }) {
    const { page = 1, limit = 20, agentId, status } = dto;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (agentId) where.agentId = agentId;
    if (status) where.status = status;

    const [quotas, total] = await Promise.all([
      this.prisma.agentTokenQuota.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          agent: { select: { id: true, name: true, email: true, level: true } },
        },
      }),
      this.prisma.agentTokenQuota.count({ where }),
    ]);

    return {
      items: quotas.map((q) => ({
        id: q.id,
        agent: q.agent,
        level: q.level,
        quotaAmount: q.quotaAmount.toString(),
        purchasePrice: q.purchasePrice.toString(),
        purchaseAmount: q.purchaseAmount.toString(),
        vestingMonths: q.vestingMonths,
        vestingStart: q.vestingStart,
        releasedAmount: q.releasedAmount.toString(),
        pendingAmount: q.quotaAmount.minus(q.releasedAmount).toString(),
        status: q.status,
        approvedBy: q.approvedBy,
        approvedAt: q.approvedAt,
        createdAt: q.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 创建代币配额
  async createTokenQuota(dto: { agentId: string; level: string }) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: dto.agentId },
    });
    if (!agent) throw new NotFoundException('代理商不存在');

    const config = this.quotaConfig[dto.level];
    if (!config) throw new BadRequestException('无效的配额等级');

    // 检查是否已有配额
    const existingQuota = await this.prisma.agentTokenQuota.findFirst({
      where: {
        agentId: dto.agentId,
        status: { in: ['pending', 'paid', 'active'] },
      },
    });
    if (existingQuota)
      throw new BadRequestException('该代理商已有进行中的配额');

    const quota = await this.prisma.agentTokenQuota.create({
      data: {
        agentId: dto.agentId,
        level: dto.level,
        quotaAmount: config.quota,
        purchasePrice: config.price,
        purchaseAmount: config.quota * config.price,
        vestingMonths: config.vestingMonths,
        status: 'pending',
      },
    });

    this.logger.log(`创建代币配额: agent=${dto.agentId}, level=${dto.level}`);
    return { message: '配额创建成功', quota };
  }

  // 审核代币配额
  async reviewTokenQuota(
    quotaId: string,
    action: 'approve' | 'reject',
    adminId: string,
  ) {
    const quota = await this.prisma.agentTokenQuota.findUnique({
      where: { id: quotaId },
    });
    if (!quota) throw new NotFoundException('配额不存在');
    if (quota.status !== 'paid')
      throw new BadRequestException('只能审核已付款的配额');

    if (action === 'approve') {
      await this.prisma.agentTokenQuota.update({
        where: { id: quotaId },
        data: {
          status: 'active',
          vestingStart: new Date(),
          approvedBy: adminId,
          approvedAt: new Date(),
        },
      });
      this.logger.log(`代币配额审核通过: ${quotaId}`);
      return { message: '配额已审核通过，开始释放' };
    } else {
      await this.prisma.agentTokenQuota.update({
        where: { id: quotaId },
        data: {
          status: 'revoked',
          approvedBy: adminId,
          approvedAt: new Date(),
        },
      });
      this.logger.log(`代币配额审核拒绝: ${quotaId}`);
      return { message: '配额已拒绝' };
    }
  }

  // ========== 代理商分红池管理 ==========

  // 获取分红池列表
  async getDividendPools(dto: {
    page?: number;
    limit?: number;
    status?: string;
  }) {
    const { page = 1, limit = 20, status } = dto;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [pools, total] = await Promise.all([
      this.prisma.agentDividendPool.findMany({
        where,
        skip,
        take: limit,
        orderBy: { periodStart: 'desc' },
        include: { _count: { select: { dividendRecords: true } } },
      }),
      this.prisma.agentDividendPool.count({ where }),
    ]);

    return {
      items: pools.map((p) => ({
        id: p.id,
        monthNumber: p.monthNumber,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        gasFeeTotal: p.gasFeeTotal.toString(),
        poolRate: p.poolRate.toString(),
        poolAmount: p.poolAmount.toString(),
        hootPrice: p.hootPrice?.toString() || null,
        hootAmount: p.hootAmount?.toString() || null,
        totalTradeVolume: p.totalTradeVolume.toString(),
        distributedAmount: p.distributedAmount.toString(),
        participantCount: p._count.dividendRecords,
        status: p.status,
        distributedAt: p.distributedAt,
        createdAt: p.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 创建分红池（月度）
  async createDividendPool(dto: { monthNumber: string; poolRate?: number }) {
    // 检查是否已存在
    const existing = await this.prisma.agentDividendPool.findUnique({
      where: { monthNumber: dto.monthNumber },
    });
    if (existing) throw new BadRequestException('该月分红池已存在');

    // 解析月份，计算周期
    const [year, month] = dto.monthNumber.split('-').map(Number);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59);

    // 获取该月燃油费总额
    const gasFees = await this.prisma.gasFeeRecord.aggregate({
      where: { createdAt: { gte: periodStart, lte: periodEnd } },
      _sum: { feeAmount: true },
    });

    const gasFeeTotal = gasFees._sum.feeAmount || new Decimal(0);
    const poolRate = new Decimal(dto.poolRate || 0.1);
    const poolAmount = gasFeeTotal.times(poolRate);

    const pool = await this.prisma.agentDividendPool.create({
      data: {
        periodStart,
        periodEnd,
        monthNumber: dto.monthNumber,
        gasFeeTotal,
        poolRate,
        poolAmount,
        status: 'pending',
      },
    });

    this.logger.log(`创建分红池: ${dto.monthNumber}, 金额: ${poolAmount}`);
    return { message: '分红池创建成功', pool };
  }

  // 分配分红池
  async distributeDividendPool(poolId: string, hootPrice: string) {
    const pool = await this.prisma.agentDividendPool.findUnique({
      where: { id: poolId },
    });
    if (!pool) throw new NotFoundException('分红池不存在');
    if (pool.status !== 'pending')
      throw new BadRequestException('只能分配待分配状态的分红池');

    const hootPriceDecimal = new Decimal(hootPrice);
    const hootAmount = pool.poolAmount.div(hootPriceDecimal);

    // 获取所有活跃代理商的交易量贡献
    const agentContributions = await this.prisma.$queryRaw<
      { agentId: string; totalVolume: string }[]
    >`
      SELECT u.agent_id as "agentId", COALESCE(SUM(p.amount * p.entry_price), 0) as "totalVolume"
      FROM users u
      JOIN positions p ON p.user_id = u.id
      WHERE u.agent_id IS NOT NULL
        AND p.created_at >= ${pool.periodStart}
        AND p.created_at <= ${pool.periodEnd}
      GROUP BY u.agent_id
    `;

    const totalVolume = agentContributions.reduce(
      (sum, c) => sum.plus(c.totalVolume || 0),
      new Decimal(0),
    );

    if (totalVolume.isZero()) {
      throw new BadRequestException('该周期没有符合条件的代理商贡献');
    }

    await this.prisma.$transaction(async (tx) => {
      // 创建分红记录
      for (const contrib of agentContributions) {
        const volume = new Decimal(contrib.totalVolume || 0);
        if (volume.isZero()) continue;

        const rate = volume.div(totalVolume);
        const dividendUsdt = pool.poolAmount.times(rate);
        const dividendHoot = hootAmount.times(rate);

        await tx.agentDividendRecord.create({
          data: {
            poolId,
            agentId: contrib.agentId,
            userTradeVolume: volume,
            contributionRate: rate,
            dividendUsdt,
            dividendHoot,
            status: 'paid',
            paidAt: new Date(),
          },
        });
      }

      // 更新分红池状态
      await tx.agentDividendPool.update({
        where: { id: poolId },
        data: {
          hootPrice: hootPriceDecimal,
          hootAmount,
          totalTradeVolume: totalVolume,
          distributedAmount: pool.poolAmount,
          participantCount: agentContributions.filter((c) =>
            new Decimal(c.totalVolume || 0).gt(0),
          ).length,
          status: 'distributed',
          distributedAt: new Date(),
        },
      });
    });

    this.logger.log(`分红池分配完成: ${poolId}, HOOT价格: ${hootPrice}`);
    return {
      message: '分红池分配完成',
      distributedTo: agentContributions.length,
    };
  }

  // 获取代币统计概览
  async getTokenStats() {
    const [quotaStats, poolStats] = await Promise.all([
      // 配额统计
      this.prisma.agentTokenQuota.aggregate({
        _sum: { quotaAmount: true, releasedAmount: true, purchaseAmount: true },
        _count: true,
      }),
      // 分红池统计
      this.prisma.agentDividendPool.aggregate({
        _sum: { poolAmount: true, distributedAmount: true },
        _count: true,
      }),
    ]);

    const activeQuotas = await this.prisma.agentTokenQuota.count({
      where: { status: 'active' },
    });
    const pendingQuotas = await this.prisma.agentTokenQuota.count({
      where: { status: 'paid' },
    });
    const distributedPools = await this.prisma.agentDividendPool.count({
      where: { status: 'distributed' },
    });

    return {
      quota: {
        total: quotaStats._count,
        active: activeQuotas,
        pending: pendingQuotas,
        totalQuotaAmount: quotaStats._sum.quotaAmount?.toString() || '0',
        totalReleasedAmount: quotaStats._sum.releasedAmount?.toString() || '0',
        totalPurchaseAmount: quotaStats._sum.purchaseAmount?.toString() || '0',
      },
      dividend: {
        totalPools: poolStats._count,
        distributedPools,
        totalPoolAmount: poolStats._sum.poolAmount?.toString() || '0',
        totalDistributedAmount:
          poolStats._sum.distributedAmount?.toString() || '0',
      },
    };
  }
}
