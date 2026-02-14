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
  UpdateUserInfoDto,
  AdjustBalanceDto,
  ResetPasswordDto,
  StrategyListDto,
  CreateStrategyDto,
  UpdateStrategyDto,
  WithdrawListDto,
  WithdrawActionDto,
} from './dto/admin.dto';
import * as bcrypt from 'bcrypt';
import Decimal from 'decimal.js';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) {}

  // ==================== 用户管理 ====================

  // 获取用户列表
  async getUsers(dto: UserListDto) {
    const { page = 1, limit = 20, search, bindTelegram, bindWallet } = dto;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { nickname: { contains: search, mode: 'insensitive' } },
        { telegramUsername: { contains: search, mode: 'insensitive' } },
        { walletAddress: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 绑定状态筛选
    if (bindTelegram === true) {
      where.telegramId = { not: null };
    } else if (bindTelegram === false) {
      where.telegramId = null;
    }

    if (bindWallet === true) {
      where.walletAddress = { not: null };
    } else if (bindWallet === false) {
      where.walletAddress = null;
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
          walletAddress: true,
          emailVerified: true,
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

    // 更新用户状态
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: dto.status },
    });

    // 记录操作日志
    this.logger.log(
      `管理员更新用户状态: ${userId} -> ${dto.status}, 原因: ${dto.reason || '无'}`,
    );

    return {
      message: `用户状态已更新为 ${dto.status}`,
      userId,
      status: dto.status,
    };
  }

  // 更新用户信息
  async updateUserInfo(userId: string, dto: UpdateUserInfoDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const updateData: any = {};
    if (dto.nickname !== undefined) updateData.nickname = dto.nickname;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        nickname: true,
        updatedAt: true,
      },
    });

    this.logger.log(`管理员更新用户信息: ${userId}`);

    return {
      message: '用户信息已更新',
      user: updated,
    };
  }

  // 调整用户资产
  async adjustUserBalance(
    userId: string,
    dto: AdjustBalanceDto,
    adminId: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const amount = new Decimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('金额必须大于0');
    }

    const balanceField = dto.asset === 'usdt' ? 'usdtBalance' : 'hootBalance';
    const currentBalance = new Decimal(user[balanceField]?.toString() || '0');

    let newBalance: Decimal;
    if (dto.action === 'add') {
      newBalance = currentBalance.plus(amount);
    } else {
      if (currentBalance.lt(amount)) {
        throw new BadRequestException('余额不足，无法扣减');
      }
      newBalance = currentBalance.minus(amount);
    }

    // 使用事务更新余额并记录交易
    const result = await this.prisma.$transaction(async (tx) => {
      // 更新余额
      await tx.user.update({
        where: { id: userId },
        data: { [balanceField]: newBalance.toString() },
      });

      // 记录交易
      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: dto.action === 'add' ? 'admin_credit' : 'admin_debit',
          asset: dto.asset.toUpperCase(),
          amount:
            dto.action === 'add' ? amount.toString() : amount.neg().toString(),
          uniqueOrderId: `admin_adjust_${userId}_${Date.now()}`,
          status: 'completed',
          remark: JSON.stringify({
            reason: dto.reason,
            adminId,
            previousBalance: currentBalance.toString(),
            newBalance: newBalance.toString(),
          }),
        },
      });

      return transaction;
    });

    this.logger.log(
      `管理员调整用户资产: ${userId}, ${dto.asset} ${dto.action} ${dto.amount}, 原因: ${dto.reason}`,
    );

    return {
      message: `${dto.asset.toUpperCase()} ${dto.action === 'add' ? '增加' : '扣减'}成功`,
      previousBalance: currentBalance.toString(),
      newBalance: newBalance.toString(),
      transactionId: result.id,
    };
  }

  // 重置用户密码
  async resetUserPassword(userId: string, dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 生成新密码（如果未提供）
    const newPassword = dto.newPassword || this.generateRandomPassword();
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    this.logger.log(`管理员重置用户密码: ${userId}`);

    // TODO: 发送邮件通知用户新密码
    // await this.emailService.sendPasswordResetEmail(user.email, newPassword);

    return {
      message: '密码已重置',
      // 仅在自动生成密码时返回（实际生产中应通过邮件发送）
      ...(dto.newPassword ? {} : { newPassword }),
    };
  }

  // 生成随机密码
  private generateRandomPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  // 解绑用户 Telegram
  async unbindUserTelegram(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    if (!user.telegramId) {
      throw new BadRequestException('用户未绑定 Telegram');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        telegramId: null,
        telegramUsername: null,
      },
    });

    this.logger.log(`管理员解绑用户 Telegram: ${userId}`);

    return {
      message: '已解绑 Telegram',
      userId,
    };
  }

  // 解绑用户钱包
  async unbindUserWallet(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    if (!user.walletAddress) {
      throw new BadRequestException('用户未绑定钱包');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        walletAddress: null,
      },
    });

    this.logger.log(`管理员解绑用户钱包: ${userId}`);

    return {
      message: '已解绑钱包',
      userId,
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

  // 获取单个策略详情
  async getStrategyById(strategyId: string) {
    const strategy = await this.prisma.strategy.findUnique({
      where: { id: strategyId },
      include: {
        _count: {
          select: {
            subscriptions: true,
            signals: true,
          },
        },
        subscriptions: {
          take: 20,
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
        },
        signals: {
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!strategy) {
      throw new NotFoundException('策略不存在');
    }

    return {
      ...strategy,
      subscribersCount: strategy._count.subscriptions,
      signalsCount: strategy._count.signals,
      // 格式化订阅用户列表
      subscribers: strategy.subscriptions.map((sub) => ({
        id: sub.id,
        userId: sub.userId,
        username: sub.user.nickname || sub.user.email,
        email: sub.user.email,
        subscribedAt: sub.createdAt,
        capital: sub.amountPerTrade.toString(),
        isActive: sub.isActive,
      })),
      // 格式化信号历史
      recentSignals: strategy.signals.map((sig) => ({
        id: sig.id,
        symbol: sig.symbol,
        side: sig.side,
        price: sig.price?.toString(),
        createdAt: sig.createdAt,
      })),
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
        riskLevel: dto.riskLevel || 'medium',
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
        ...(dto.riskLevel && { riskLevel: dto.riskLevel }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.tags && { tags: dto.tags }),
        ...(dto.nameI18n && { nameI18n: dto.nameI18n }),
        ...(dto.descriptionI18n && { descriptionI18n: dto.descriptionI18n }),
        ...(dto.tagsI18n && { tagsI18n: dto.tagsI18n }),
        // 统计字段（管理员手动调整）
        ...(dto.return7d !== undefined && { return7d: dto.return7d }),
        ...(dto.return30d !== undefined && { return30d: dto.return30d }),
        ...(dto.return90d !== undefined && { return90d: dto.return90d }),
        ...(dto.maxDrawdown !== undefined && { maxDrawdown: dto.maxDrawdown }),
        ...(dto.winRate !== undefined && { winRate: dto.winRate }),
        ...(dto.totalTrades !== undefined && { totalTrades: dto.totalTrades }),
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

      this.logger.log(
        `提现审核拒绝: ${requestId}, 原因: ${dto.reason || '无'}`,
      );
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

  // ==================== 交易记录管理 ====================

  /**
   * 获取交易记录列表（充值/提现/手续费等）
   */
  async getTransactions(params: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    userId?: string;
    search?: string;
  }) {
    const { page = 1, limit = 20, type, status, userId, search } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (search) {
      where.OR = [
        { uniqueOrderId: { contains: search, mode: 'insensitive' } },
        { txHash: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { nickname: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
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
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items: transactions.map((t) => ({
        id: t.id,
        userId: t.userId,
        username: t.user?.nickname || t.user?.email || '-',
        type: t.type,
        asset: t.asset,
        amount: t.amount?.toString() || '0',
        status: t.status,
        txHash: t.txHash,
        uniqueOrderId: t.uniqueOrderId,
        remark: t.remark,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 获取交易记录统计
   */
  async getTransactionStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalDeposits,
      todayDeposits,
      pendingDeposits,
      totalWithdrawals,
      pendingWithdrawals,
    ] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { type: 'deposit', status: 'completed' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.transaction.aggregate({
        where: {
          type: 'deposit',
          status: 'completed',
          createdAt: { gte: today },
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.transaction.count({
        where: { type: 'deposit', status: 'pending' },
      }),
      this.prisma.transaction.aggregate({
        where: { type: 'withdraw', status: 'completed' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.withdrawRequest.count({
        where: { status: 'pending' },
      }),
    ]);

    return {
      totalDeposits: {
        amount: totalDeposits._sum.amount?.toString() || '0',
        count: totalDeposits._count,
      },
      todayDeposits: {
        amount: todayDeposits._sum.amount?.toString() || '0',
        count: todayDeposits._count,
      },
      pendingDeposits,
      totalWithdrawals: {
        amount: totalWithdrawals._sum.amount?.toString() || '0',
        count: totalWithdrawals._count,
      },
      pendingWithdrawals,
    };
  }

  // ==================== 持仓管理 ====================

  /**
   * 获取持仓列表
   */
  async getPositions(params: {
    page?: number;
    limit?: number;
    status?: string;
    userId?: string;
    exchange?: string;
    symbol?: string;
  }) {
    const { page = 1, limit = 20, status, userId, exchange, symbol } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (exchange) where.exchange = exchange;
    if (symbol) where.symbol = { contains: symbol, mode: 'insensitive' };

    const [positions, total] = await Promise.all([
      this.prisma.position.findMany({
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
          subscription: {
            select: {
              strategy: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.position.count({ where }),
    ]);

    return {
      items: positions.map((p) => ({
        id: p.id,
        userId: p.userId,
        username: p.user?.nickname || p.user?.email || '-',
        strategyId: p.subscription?.strategy?.id || null,
        strategyName: p.subscription?.strategy?.name || '-',
        exchange: p.exchange,
        symbol: p.symbol,
        side: p.side,
        entryPrice: p.entryPrice?.toString() || '0',
        amount: p.amount?.toString() || '0',
        status: p.status,
        exitPrice: p.exitPrice?.toString() || null,
        pnl: p.pnl?.toString() || null,
        realizedPnl: p.realizedPnl?.toString() || null,
        closeReason: p.closeReason,
        closedAt: p.closedAt,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 获取持仓统计
   */
  async getPositionStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [openPositions, todayClosed, totalPnl, todayPnl] = await Promise.all([
      this.prisma.position.count({ where: { status: 'open' } }),
      this.prisma.position.count({
        where: { status: 'closed', closedAt: { gte: today } },
      }),
      this.prisma.position.aggregate({
        where: { status: 'closed' },
        _sum: { realizedPnl: true },
      }),
      this.prisma.position.aggregate({
        where: { status: 'closed', closedAt: { gte: today } },
        _sum: { realizedPnl: true },
      }),
    ]);

    return {
      openPositions,
      todayClosed,
      totalPnl: totalPnl._sum.realizedPnl?.toString() || '0',
      todayPnl: todayPnl._sum.realizedPnl?.toString() || '0',
    };
  }

  // ==================== 订单管理（信号执行记录）====================

  /**
   * 获取订单列表（SignalExecution）
   */
  async getOrders(params: {
    page?: number;
    limit?: number;
    status?: string;
    userId?: string;
    exchange?: string;
    search?: string;
  }) {
    const { page = 1, limit = 20, status, userId, exchange, search } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (exchange) where.exchange = exchange;
    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { orderId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.signalExecution.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          signal: {
            include: {
              strategy: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.signalExecution.count({ where }),
    ]);

    // 获取用户信息
    const userIds = [...new Set(orders.map((o) => o.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, nickname: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      items: orders.map((o) => {
        const user = userMap.get(o.userId);
        return {
          id: o.id,
          signalId: o.signalId,
          userId: o.userId,
          username: user?.nickname || user?.email || '-',
          strategyId: o.signal?.strategy?.id || null,
          strategyName: o.signal?.strategy?.name || '-',
          symbol: o.signal?.symbol || '-',
          side: o.signal?.side || '-',
          signalPrice: o.signal?.price?.toString() || '0',
          exchange: o.exchange || '-',
          orderId: o.orderId || null,
          executedPrice: o.executedPrice?.toString() || null,
          executedAmount: o.executedAmount?.toString() || null,
          status: o.status,
          errorCode: o.errorCode,
          errorMessage: o.errorMessage,
          skipReason: o.skipReason,
          queuedAt: o.queuedAt,
          startedAt: o.startedAt,
          completedAt: o.completedAt,
          createdAt: o.createdAt,
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 获取订单统计
   */
  async getOrderStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      todayOrders,
      successOrders,
      failedOrders,
      pendingOrders,
    ] = await Promise.all([
      this.prisma.signalExecution.count(),
      this.prisma.signalExecution.count({
        where: { createdAt: { gte: today } },
      }),
      this.prisma.signalExecution.count({
        where: { status: 'success' },
      }),
      this.prisma.signalExecution.count({
        where: { status: 'failed' },
      }),
      this.prisma.signalExecution.count({
        where: { status: { in: ['pending', 'queued', 'executing'] } },
      }),
    ]);

    const successRate =
      totalOrders > 0 ? (successOrders / totalOrders) * 100 : 0;

    return {
      totalOrders,
      todayOrders,
      successOrders,
      failedOrders,
      pendingOrders,
      successRate: successRate.toFixed(1),
    };
  }

  // ==================== 信号监控 ====================

  /**
   * 获取信号列表
   */
  async getSignals(params: {
    page?: number;
    limit?: number;
    strategyId?: string;
    status?: string;
  }) {
    const { page = 1, limit = 20, strategyId, status } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (strategyId) where.strategyId = strategyId;

    const [signals, total] = await Promise.all([
      this.prisma.signal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          strategy: {
            select: { id: true, name: true },
          },
          _count: {
            select: { executions: true },
          },
        },
      }),
      this.prisma.signal.count({ where }),
    ]);

    // 获取每个信号的执行统计
    const items = await Promise.all(
      signals.map(async (signal) => {
        const execStats = await this.prisma.signalExecution.groupBy({
          by: ['status'],
          where: { signalId: signal.id },
          _count: true,
        });

        const statusCounts = execStats.reduce(
          (acc, s) => {
            acc[s.status] = s._count;
            return acc;
          },
          {} as Record<string, number>,
        );

        return {
          id: signal.id,
          strategyId: signal.strategyId,
          strategyName: signal.strategy?.name || '-',
          symbol: signal.symbol,
          side: signal.side,
          price: signal.price?.toString() || '0',
          subscriberCount: signal.subscriberCount,
          executedCount: signal.executedCount,
          failedCount: signal.failedCount,
          distributedAt: signal.distributedAt,
          createdAt: signal.createdAt,
          statusCounts,
        };
      }),
    );

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * 获取信号监控统计
   */
  async getSignalStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      todaySignals,
      totalExecutions,
      successExecutions,
      runningStrategies,
      errorStrategies,
    ] = await Promise.all([
      this.prisma.signal.count({ where: { createdAt: { gte: today } } }),
      this.prisma.signalExecution.count({
        where: { createdAt: { gte: today } },
      }),
      this.prisma.signalExecution.count({
        where: { createdAt: { gte: today }, status: 'success' },
      }),
      this.prisma.strategy.count({ where: { isActive: true } }),
      this.prisma.strategy.count({ where: { isActive: false } }),
    ]);

    const successRate =
      totalExecutions > 0 ? (successExecutions / totalExecutions) * 100 : 100;

    return {
      todaySignals,
      totalExecutions,
      successExecutions,
      successRate: successRate.toFixed(1),
      runningStrategies,
      errorStrategies,
    };
  }

  /**
   * 获取策略运行状态
   */
  async getStrategyRunStatus() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const strategies = await this.prisma.strategy.findMany({
      include: {
        _count: {
          select: { subscriptions: true, signals: true },
        },
        signals: {
          where: { createdAt: { gte: today } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return strategies.map((s) => {
      const lastSignal = s.signals[0];
      return {
        id: s.id,
        name: s.name,
        isActive: s.isActive,
        subscribers: s._count.subscriptions,
        todaySignals: s._count.signals,
        lastSignalAt: lastSignal?.createdAt || null,
      };
    });
  }

  // ==================== 风控管理 ====================

  /**
   * 获取风控概览
   */
  async getRiskOverview() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [openPositions, todayClosedPositions, totalExposure, lossPositions] =
      await Promise.all([
        this.prisma.position.count({ where: { status: 'open' } }),
        this.prisma.position.count({
          where: { status: 'closed', closedAt: { gte: today } },
        }),
        this.prisma.position.aggregate({
          where: { status: 'open' },
          _sum: { amount: true },
        }),
        this.prisma.position.count({
          where: {
            status: 'closed',
            closedAt: { gte: today },
            realizedPnl: { lt: 0 },
          },
        }),
      ]);

    // 获取触发止损的次数
    const stopLossCount = await this.prisma.position.count({
      where: {
        closedAt: { gte: today },
        closeReason: 'stop_loss',
      },
    });

    // 获取黑天鹅触发次数
    const blackSwanCount = await this.prisma.position.count({
      where: {
        closedAt: { gte: today },
        closeReason: 'black_swan',
      },
    });

    return {
      openPositions,
      todayClosedPositions,
      totalExposure: totalExposure._sum.amount?.toString() || '0',
      lossPositions,
      stopLossCount,
      blackSwanCount,
    };
  }

  /**
   * 获取风控事件列表
   */
  async getRiskEvents(params: { page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    // 获取触发风控的仓位（止损、黑天鹅、日亏损限制）
    const where = {
      closeReason: { in: ['stop_loss', 'black_swan', 'daily_loss_limit'] },
    };

    const [events, total] = await Promise.all([
      this.prisma.position.findMany({
        where,
        skip,
        take: limit,
        orderBy: { closedAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, nickname: true } },
        },
      }),
      this.prisma.position.count({ where }),
    ]);

    return {
      items: events.map((e) => ({
        id: e.id,
        userId: e.userId,
        username: e.user?.nickname || e.user?.email || '-',
        exchange: e.exchange,
        symbol: e.symbol,
        side: e.side,
        entryPrice: e.entryPrice?.toString() || '0',
        exitPrice: e.exitPrice?.toString() || '0',
        amount: e.amount?.toString() || '0',
        pnl: e.realizedPnl?.toString() || '0',
        closeReason: e.closeReason,
        closedAt: e.closedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ==================== 账单管理 ====================

  /**
   * 获取账单列表（BillingLog）
   */
  async getBillingLogs(params: {
    page?: number;
    limit?: number;
    type?: string;
    userId?: string;
  }) {
    const { page = 1, limit = 20, type, userId } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (type) where.type = type;
    if (userId) where.userId = userId;

    const [logs, total] = await Promise.all([
      this.prisma.billingLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.billingLog.count({ where }),
    ]);

    // 获取用户信息（BillingLog 没有 user 关系，需单独查询）
    const userIds = [...new Set(logs.map((log) => log.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, nickname: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      items: logs.map((log) => {
        const user = userMap.get(log.userId);
        return {
          id: log.id,
          uniqueOrderId: log.uniqueOrderId,
          userId: log.userId,
          username: user?.nickname || user?.email || '-',
          type: log.type,
          amount: log.amount?.toString() || '0',
          strategyId: null,
          strategyName: '-',
          status: log.status,
          remark: log.description || '',
          createdAt: log.createdAt,
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 获取账单统计
   * 注：amount 字段为 String 类型，需手动计算总和
   */
  async getBillingStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 获取所有已完成的账单记录
    const allCompleted = await this.prisma.billingLog.findMany({
      where: { status: 'completed' },
      select: { amount: true, type: true, createdAt: true },
    });

    // 手动计算各项统计（amount 为 Decimal 类型）
    const totalRevenue = allCompleted.reduce(
      (sum, log) => sum + parseFloat(log.amount?.toString() || '0'),
      0,
    );

    const todayRevenue = allCompleted
      .filter((log) => log.createdAt >= today)
      .reduce((sum, log) => sum + parseFloat(log.amount?.toString() || '0'), 0);

    const subscriptionRevenue = allCompleted
      .filter((log) => log.type === 'subscription')
      .reduce((sum, log) => sum + parseFloat(log.amount?.toString() || '0'), 0);

    const gasFeeRevenue = allCompleted
      .filter((log) => log.type === 'gas_fee')
      .reduce((sum, log) => sum + parseFloat(log.amount?.toString() || '0'), 0);

    return {
      totalRevenue: totalRevenue.toFixed(2),
      todayRevenue: todayRevenue.toFixed(2),
      subscriptionRevenue: subscriptionRevenue.toFixed(2),
      gasFeeRevenue: gasFeeRevenue.toFixed(2),
    };
  }

  // ==================== 权重配置 ====================

  /**
   * 获取生态权重配置
   */
  async getEcosystemWeights() {
    // 从平台配置中获取权重配置
    const config = await this.prisma.platformConfig.findUnique({
      where: { key: 'ecosystem_weights' },
    });

    const defaultWeights = {
      stakeLock30: { weight: 1.0, description: '30天锁定' },
      stakeLock90: { weight: 1.5, description: '90天锁定' },
      stakeLock180: { weight: 2.0, description: '180天锁定' },
      stakeLock365: { weight: 3.0, description: '365天锁定' },
      tradingVolume: { multiplier: 0.001, description: '交易量加成' },
      referralBonus: { multiplier: 0.1, description: '推荐奖励' },
    };

    if (config?.value) {
      try {
        return JSON.parse(config.value);
      } catch {
        return defaultWeights;
      }
    }
    return defaultWeights;
  }

  /**
   * 更新生态权重配置
   */
  async updateEcosystemWeights(weights: any) {
    await this.prisma.platformConfig.upsert({
      where: { key: 'ecosystem_weights' },
      create: { id: 'ecosystem_weights', key: 'ecosystem_weights', value: JSON.stringify(weights) },
      update: { value: JSON.stringify(weights) },
    });
    return weights;
  }

  // ==================== 管理员管理 ====================

  /**
   * 获取管理员列表
   */
  async getAdminList(params: { page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const [admins, total] = await Promise.all([
      this.prisma.admin.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      this.prisma.admin.count(),
    ]);

    return {
      items: admins,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ==================== 系统监控 ====================

  /**
   * 获取系统监控数据
   */
  async getSystemMonitor() {
    const [
      totalUsers,
      activeUsers,
      totalStrategies,
      activeStrategies,
      openPositions,
      pendingWithdraws,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({
        where: {
          updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.strategy.count(),
      this.prisma.strategy.count({ where: { isActive: true } }),
      this.prisma.position.count({ where: { status: 'open' } }),
      this.prisma.withdrawRequest.count({ where: { status: 'pending' } }),
    ]);

    return {
      totalUsers,
      activeUsers,
      totalStrategies,
      activeStrategies,
      openPositions,
      pendingWithdraws,
      serverTime: new Date().toISOString(),
    };
  }
}
