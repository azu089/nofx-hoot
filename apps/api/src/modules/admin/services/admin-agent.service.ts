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

    return {
      items: agents.map((a) => ({
        ...a,
        password: undefined,
        commissionRate: a.commissionRate.toString(),
        totalProfit: a.totalProfit.toString(),
        totalCommission: a.totalCommission.toString(),
        userCount: a._count.users,
        commissionCount: a._count.commissions,
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
      pendingCommission: pendingCommission._sum.commissionAmount?.toString() || '0',
      monthlyCommission: monthlyCommission._sum.commissionAmount?.toString() || '0',
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
        commissionRate: dto.commissionRate || 0.10,
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
        ...(dto.commissionRate !== undefined && { commissionRate: dto.commissionRate }),
        ...(dto.settlementType && { settlementType: dto.settlementType }),
        ...(dto.walletAddress !== undefined && { walletAddress: dto.walletAddress }),
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
  async reviewAgent(agentId: string, action: 'approve' | 'reject', reason?: string) {
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
      pendingCommission: pendingCommission._sum.commissionAmount?.toString() || '0',
      monthlyCommission: monthlyCommission._sum.commissionAmount?.toString() || '0',
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
  async getAgentCommissions(agentId: string, page: number = 1, limit: number = 20) {
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
}
