import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  UserListDto,
  UpdateUserStatusDto,
  StrategyListDto,
  CreateStrategyDto,
  UpdateStrategyDto,
  WithdrawListDto,
  WithdrawActionDto,
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) {}

  // ==================== 用户管理 ====================

  // 获取用户列表
  async getUsers(dto: UserListDto) {
    const { page = 1, limit = 20, search } = dto;
    const skip = (page - 1) * limit;

    const where: any = {};

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
        select: {
          id: true,
          email: true,
          nickname: true,
          telegramId: true,
          telegramUsername: true,
          usdtBalance: true,
          hootBalance: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              apiKeys: true,
              subscriptions: true,
              positions: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users.map((u) => ({
        ...u,
        usdtBalance: u.usdtBalance?.toString() || '0',
        hootBalance: u.hootBalance?.toString() || '0',
        apiKeysCount: u._count.apiKeys,
        subscriptionsCount: u._count.subscriptions,
        positionsCount: u._count.positions,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 获取用户详情
  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        apiKeys: {
          select: {
            id: true,
            exchange: true,
            label: true,
            isActive: true,
            createdAt: true,
          },
        },
        subscriptions: {
          include: {
            strategy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        positions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return {
      ...user,
      password: undefined, // 不返回密码
      usdtBalance: user.usdtBalance?.toString() || '0',
      hootBalance: user.hootBalance?.toString() || '0',
      positions: user.positions.map((p) => ({
        ...p,
        entryPrice: p.entryPrice.toString(),
        amount: p.amount.toString(),
        closePrice: p.closePrice?.toString(),
        pnl: p.pnl?.toString(),
      })),
      transactions: user.transactions.map((t) => ({
        ...t,
        amount: t.amount.toString(),
      })),
    };
  }

  // 更新用户状态
  async updateUserStatus(userId: string, dto: UpdateUserStatusDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 记录操作日志
    this.logger.log(`管理员更新用户状态: ${userId} -> ${dto.status}, 原因: ${dto.reason || '无'}`);

    // TODO: 实际的状态字段需要根据 User model 调整
    // 目前 User model 没有 status 字段，这里仅作示例
    return {
      message: `用户状态已更新为 ${dto.status}`,
      userId,
      status: dto.status,
    };
  }

  // ==================== 策略管理 ====================

  // 获取策略列表
  async getStrategies(dto: StrategyListDto) {
    const { page = 1, limit = 20, search, status } = dto;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    const [strategies, total] = await Promise.all([
      this.prisma.strategy.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              subscriptions: true,
              signals: true,
            },
          },
        },
      }),
      this.prisma.strategy.count({ where }),
    ]);

    return {
      items: strategies.map((s) => ({
        ...s,
        subscribersCount: s._count.subscriptions,
        signalsCount: s._count.signals,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 创建策略
  async createStrategy(dto: CreateStrategyDto) {
    // 检查 freqtradeId 是否已存在
    const existing = await this.prisma.strategy.findUnique({
      where: { freqtradeId: dto.freqtradeId },
    });

    if (existing) {
      throw new BadRequestException('策略 ID 已存在');
    }

    const strategy = await this.prisma.strategy.create({
      data: {
        name: dto.name,
        description: dto.description,
        freqtradeId: dto.freqtradeId,
        isActive: true,
      },
    });

    this.logger.log(`创建策略: ${strategy.id} - ${strategy.name}`);
    return strategy;
  }

  // 更新策略
  async updateStrategy(strategyId: string, dto: UpdateStrategyDto) {
    const strategy = await this.prisma.strategy.findUnique({
      where: { id: strategyId },
    });

    if (!strategy) {
      throw new NotFoundException('策略不存在');
    }

    const updated = await this.prisma.strategy.update({
      where: { id: strategyId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    this.logger.log(`更新策略: ${strategyId}`);
    return updated;
  }

  // 删除策略（软删除）
  async deleteStrategy(strategyId: string) {
    const strategy = await this.prisma.strategy.findUnique({
      where: { id: strategyId },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    if (!strategy) {
      throw new NotFoundException('策略不存在');
    }

    if (strategy._count.subscriptions > 0) {
      throw new BadRequestException('该策略有活跃订阅，无法删除');
    }

    // 软删除：设置为不活跃
    await this.prisma.strategy.update({
      where: { id: strategyId },
      data: { isActive: false },
    });

    this.logger.log(`删除策略: ${strategyId}`);
    return { message: '策略已删除' };
  }

  // ==================== 提现审核 ====================

  // 获取提现列表
  async getWithdrawRequests(dto: WithdrawListDto) {
    const { page = 1, limit = 20, status } = dto;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    const [requests, total] = await Promise.all([
      this.prisma.withdrawRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              nickname: true,
            },
          },
        },
      }),
      this.prisma.withdrawRequest.count({ where }),
    ]);

    return {
      items: requests.map((r) => ({
        ...r,
        amount: r.amount.toString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 审核提现
  async processWithdraw(requestId: string, dto: WithdrawActionDto) {
    const request = await this.prisma.withdrawRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!request) {
      throw new NotFoundException('提现申请不存在');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('该申请已处理');
    }

    if (dto.action === 'approved') {
      // 审核通过
      await this.prisma.withdrawRequest.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          txHash: dto.txHash,
          processedAt: new Date(),
        },
      });

      this.logger.log(`提现审核通过: ${requestId}, txHash: ${dto.txHash}`);
      return { message: '提现已审核通过' };
    } else {
      // 审核拒绝 - 退还余额
      await this.prisma.$transaction(async (tx) => {
        // 更新申请状态
        await tx.withdrawRequest.update({
          where: { id: requestId },
          data: {
            status: 'rejected',
            processedAt: new Date(),
          },
        });

        // 退还余额
        if (request.asset === 'USDT') {
          await tx.user.update({
            where: { id: request.userId },
            data: {
              usdtBalance: {
                increment: request.amount,
              },
            },
          });
        } else if (request.asset === 'HOOT') {
          await tx.user.update({
            where: { id: request.userId },
            data: {
              hootBalance: {
                increment: request.amount,
              },
            },
          });
        }

        // 记录退款交易
        await tx.transaction.create({
          data: {
            userId: request.userId,
            type: 'refund',
            asset: request.asset,
            amount: request.amount,
            uniqueOrderId: `refund_${request.id}_${Date.now()}`,
            status: 'completed',
          },
        });
      });

      this.logger.log(`提现审核拒绝: ${requestId}, 原因: ${dto.reason || '无'}`);
      return { message: '提现已拒绝，余额已退还' };
    }
  }

  // ==================== 统计数据 ====================

  // 获取仪表盘统计
  async getDashboardStats() {
    const [
      totalUsers,
      activeStrategies,
      pendingWithdraws,
      todaySignals,
      totalPositions,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.strategy.count({ where: { isActive: true } }),
      this.prisma.withdrawRequest.count({ where: { status: 'pending' } }),
      this.prisma.signal.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      this.prisma.position.count({ where: { status: 'open' } }),
    ]);

    return {
      totalUsers,
      activeStrategies,
      pendingWithdraws,
      todaySignals,
      totalPositions,
    };
  }
}
