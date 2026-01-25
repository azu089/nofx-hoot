import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigsService } from '../configs/configs.service';
import {
  TelegramDashboardDto,
  TelegramStrategiesResponseDto,
  TelegramStrategyItemDto,
  TelegramWalletDto,
  TelegramCheckinResponseDto,
  TelegramInviteDto,
  TelegramPanicDto,
  TelegramPanicResponseDto,
} from './dto/telegram-dashboard.dto';
import Decimal from 'decimal.js';

@Injectable()
export class TelegramApiService {
  private readonly logger = new Logger(TelegramApiService.name);
  private readonly telegramBotUsername: string;
  private readonly webAppUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly configsService: ConfigsService,
  ) {
    this.telegramBotUsername = this.configService.get<string>('TELEGRAM_BOT_USERNAME') || 'TIZOCCBot';
    this.webAppUrl = this.configService.get<string>('WEB_APP_URL') || 'https://tizo.cc/tg';
  }

  /**
   * 获取 Mini App 仪表盘数据
   */
  async getDashboard(userId: string): Promise<TelegramDashboardDto> {
    // 获取用户信息和钱包
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      include: { wallets: true },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 获取今日盈亏
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTrades = await this.prisma.client.trade_history.findMany({
      where: {
        user_id: userId,
        closed_at: { gte: today },
        status: 'closed',
      },
      select: { pnl: true },
    });

    const todayPnlAmount = todayTrades.reduce((sum: Decimal, trade: { pnl: any }) => {
      return sum.plus(new Decimal(trade.pnl?.toString() || '0'));
    }, new Decimal(0));

    // 计算今日盈亏百分比（基于 USDT 余额）
    const totalAsset = new Decimal(user.wallets?.usdt_balance?.toString() || '0');
    const todayPercentage = totalAsset.gt(0)
      ? todayPnlAmount.div(totalAsset).times(100).toFixed(2)
      : '0.00';

    // 获取活跃策略数
    const activeStrategies = await this.prisma.client.user_strategy_configs.count({
      where: {
        user_id: userId,
        is_active: true,
      },
    });

    // 获取 VPS 实例状态
    const instance = await this.prisma.client.instances.findFirst({
      where: {
        user_id: userId,
        status: { in: ['running', 'pending', 'provisioning'] },
      },
      orderBy: { created_at: 'desc' },
    });

    let instanceStatus: 'running' | 'stopped' | 'none' = 'none';
    if (instance) {
      instanceStatus = instance.status === 'running' ? 'running' : 'stopped';
    }

    // 获取最近公告
    const now = new Date();
    const announcement = await this.prisma.client.announcements.findFirst({
      where: {
        start_at: { lte: now },
        OR: [{ end_at: null }, { end_at: { gt: now } }],
      },
      orderBy: [{ is_pinned: 'desc' }, { display_order: 'asc' }, { created_at: 'desc' }],
      select: { id: true, title: true, type: true },
    });

    return {
      user: {
        id: user.id,
        email: user.email.includes('@telegram.local') ? undefined : user.email,
        telegramUsername: user.telegram_username || undefined,
        telegramFirstName: user.telegram_first_name || undefined,
        vipLevel: user.vip_level,
      },
      wallet: {
        usdtBalance: user.wallets?.usdt_balance?.toString() || '0',
        pointsBalance: user.wallets?.points_balance?.toString() || '0',
        tokenBalance: user.wallets?.token_balance?.toString() || '0',
      },
      todayPnl: {
        amount: todayPnlAmount.toFixed(8),
        percentage: todayPercentage,
        trades: todayTrades.length,
      },
      activeStrategies,
      instanceStatus,
      latestAnnouncement: announcement
        ? { id: announcement.id, title: announcement.title, type: announcement.type }
        : undefined,
    };
  }

  /**
   * 获取策略列表（简化版）
   */
  async getStrategies(userId: string): Promise<TelegramStrategiesResponseDto> {
    // 获取公开策略
    const strategies = await this.prisma.client.strategies.findMany({
      where: {
        is_public: true,
        is_active: true,
        review_status: 'approved',
      },
      orderBy: [{ tier: 'desc' }, { total_users: 'desc' }],
      take: 20,
      select: {
        id: true,
        name: true,
        description: true,
        backtest_win_rate: true,
        backtest_sharpe_ratio: true,
        backtest_max_drawdown: true,
        tier: true,
        total_users: true,
      },
    });

    // 获取用户订阅的策略 ID
    const userConfigs = await this.prisma.client.user_strategy_configs.findMany({
      where: { user_id: userId },
      select: { strategy_id: true },
    });
    const subscribedIds = new Set(userConfigs.map((c: { strategy_id: string }) => c.strategy_id));

    const items: TelegramStrategyItemDto[] = strategies.map((s: any) => ({
      id: s.id,
      name: s.name,
      description: s.description || undefined,
      winRate: s.backtest_win_rate?.toString() || '0',
      sharpeRatio: s.backtest_sharpe_ratio?.toString() || '0',
      maxDrawdown: s.backtest_max_drawdown?.toString() || '0',
      tier: s.tier,
      isSubscribed: subscribedIds.has(s.id),
      totalUsers: s.total_users,
    }));

    return {
      strategies: items,
      total: items.length,
      page: 1,
      limit: 20,
    };
  }

  /**
   * 获取钱包概览
   */
  async getWallet(userId: string): Promise<TelegramWalletDto> {
    const wallet = await this.prisma.client.wallets.findUnique({
      where: { user_id: userId },
    });

    if (!wallet) {
      throw new NotFoundException('钱包不存在');
    }

    // 从系统配置中获取充值地址
    const trc20Address = await this.configsService.getConfig('deposit.trc20_address');
    const erc20Address = await this.configsService.getConfig('deposit.erc20_address');
    const bep20Address = await this.configsService.getConfig('deposit.bep20_address');

    const depositAddresses = [
      { chain: 'TRC20', address: trc20Address || '' },
      { chain: 'ERC20', address: erc20Address || '' },
      { chain: 'BEP20', address: bep20Address || '' },
    ].filter(addr => addr.address); // 只返回已配置的地址

    return {
      usdtBalance: wallet.usdt_balance.toString(),
      usdtFrozen: wallet.usdt_frozen.toString(),
      cardBalance: wallet.card_balance.toString(),
      pointsBalance: wallet.points_balance.toString(),
      tokenBalance: wallet.token_balance.toString(),
      tokenLocked: wallet.token_locked.toString(),
      depositAddresses,
    };
  }

  /**
   * 签到
   */
  async checkin(userId: string): Promise<TelegramCheckinResponseDto> {
    // 检查今天是否已签到
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 使用 billing_logs 记录签到
    const existingCheckin = await this.prisma.client.billing_logs.findFirst({
      where: {
        user_id: userId,
        billing_type: 'checkin',
        created_at: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (existingCheckin) {
      return {
        success: false,
        pointsEarned: '0',
        streakDays: 0,
        alreadyCheckedIn: true,
        nextCheckinAt: tomorrow,
      };
    }

    // 计算连续签到天数
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const yesterdayCheckin = await this.prisma.client.billing_logs.findFirst({
      where: {
        user_id: userId,
        billing_type: 'checkin',
        created_at: {
          gte: yesterday,
          lt: today,
        },
      },
    });

    // 简单的连续签到奖励（基础 10 积分，连续签到每天 +2，最高 50）
    let streakDays = 1;
    if (yesterdayCheckin) {
      // 查询过去 30 天的签到记录来计算连续天数
      const past30Days = new Date(today);
      past30Days.setDate(past30Days.getDate() - 30);

      const recentCheckins = await this.prisma.client.billing_logs.findMany({
        where: {
          user_id: userId,
          billing_type: 'checkin',
          created_at: { gte: past30Days },
        },
        orderBy: { created_at: 'desc' },
      });

      // 计算连续天数
      for (let i = 0; i < recentCheckins.length - 1; i++) {
        const current = new Date(recentCheckins[i].created_at);
        const next = new Date(recentCheckins[i + 1].created_at);
        current.setHours(0, 0, 0, 0);
        next.setHours(0, 0, 0, 0);

        const diffDays = (current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays === 1) {
          streakDays++;
        } else {
          break;
        }
      }
    }

    const basePoints = new Decimal(10);
    const bonusPoints = new Decimal(Math.min((streakDays - 1) * 2, 40)); // 最高 +40
    const pointsEarned = basePoints.plus(bonusPoints);

    // 记录签到并发放积分
    await this.prisma.client.$transaction(async (tx: any) => {
      // 创建签到记录
      await tx.billing_logs.create({
        data: {
          user_id: userId,
          unique_order_id: `checkin_${userId}_${Date.now()}`,
          billing_type: 'checkin',
          amount: pointsEarned,
          currency: 'POINTS',
          description: `每日签到 (连续${streakDays}天)`,
          status: 'completed',
        },
      });

      // 增加积分
      await tx.wallets.update({
        where: { user_id: userId },
        data: {
          points_balance: { increment: pointsEarned },
        },
      });
    });

    this.logger.log(`用户 ${userId} 签到成功，获得 ${pointsEarned} 积分，连续 ${streakDays} 天`);

    return {
      success: true,
      pointsEarned: pointsEarned.toString(),
      streakDays,
      alreadyCheckedIn: false,
      nextCheckinAt: tomorrow,
    };
  }

  /**
   * 获取邀请信息
   */
  async getInvite(userId: string): Promise<TelegramInviteDto> {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { invite_code: true },
    });

    if (!user || !user.invite_code) {
      throw new NotFoundException('邀请码不存在');
    }

    // 统计邀请人数（简化处理）
    const totalInvited = 0;

    // 统计累计返佣
    const commissions = await this.prisma.client.agent_commissions.aggregate({
      where: {},
      _sum: { commission_amount: true },
    });

    const inviteCode = user.invite_code;
    const inviteLink = `${this.webAppUrl}/register?ref=${inviteCode}`;
    const telegramShareLink = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent('加入 QuantFi，开启量化交易之旅！')}`;

    return {
      inviteCode,
      inviteLink,
      telegramShareLink,
      totalInvited: 0, // 简化返回
      totalCommission: commissions._sum.commission_amount?.toString() || '0',
    };
  }

  /**
   * 启动策略
   */
  async startTrade(
    userId: string,
    configId: string,
  ): Promise<{ success: boolean; message: string }> {
    const config = await this.prisma.client.user_strategy_configs.findFirst({
      where: { id: configId, user_id: userId },
    });

    if (!config) {
      throw new NotFoundException('策略配置不存在');
    }

    if (config.is_active) {
      return { success: false, message: '策略已在运行中' };
    }

    await this.prisma.client.user_strategy_configs.update({
      where: { id: configId },
      data: { is_active: true },
    });

    this.logger.log(`用户 ${userId} 启动策略 ${configId}`);

    return { success: true, message: '策略已启动' };
  }

  /**
   * 停止策略
   */
  async stopTrade(
    userId: string,
    configId: string,
  ): Promise<{ success: boolean; message: string }> {
    const config = await this.prisma.client.user_strategy_configs.findFirst({
      where: { id: configId, user_id: userId },
    });

    if (!config) {
      throw new NotFoundException('策略配置不存在');
    }

    if (!config.is_active) {
      return { success: false, message: '策略未在运行' };
    }

    await this.prisma.client.user_strategy_configs.update({
      where: { id: configId },
      data: { is_active: false },
    });

    this.logger.log(`用户 ${userId} 停止策略 ${configId}`);

    return { success: true, message: '策略已停止' };
  }

  /**
   * 紧急平仓
   */
  async panic(
    userId: string,
    dto: TelegramPanicDto,
  ): Promise<TelegramPanicResponseDto> {
    if (!dto.confirm) {
      return {
        success: false,
        closedPositions: 0,
        stoppedStrategies: 0,
        error: '请确认紧急平仓操作',
      };
    }

    try {
      // 停止所有活跃策略
      const stoppedResult = await this.prisma.client.user_strategy_configs.updateMany({
        where: {
          user_id: userId,
          is_active: true,
          ...(dto.instanceId ? { instance_id: dto.instanceId } : {}),
        },
        data: { is_active: false },
      });

      // 注意：实际平仓需要调用交易所 API，这里只是停止策略
      // 实际实现需要集成交易模块

      this.logger.warn(`用户 ${userId} 执行紧急平仓，停止 ${stoppedResult.count} 个策略`);

      return {
        success: true,
        closedPositions: 0, // 实际需要调用交易模块
        stoppedStrategies: stoppedResult.count,
      };
    } catch (error) {
      this.logger.error(`用户 ${userId} 紧急平仓失败`, error);
      return {
        success: false,
        closedPositions: 0,
        stoppedStrategies: 0,
        error: error instanceof Error ? error.message : '平仓失败',
      };
    }
  }

  // ==================== 策略相关扩展 ====================

  /**
   * 获取策略详情
   */
  async getStrategyDetail(userId: string, strategyId: string) {
    const strategy = await this.prisma.client.strategies.findUnique({
      where: { id: strategyId },
      include: {
        uploader: {
          select: { id: true, email: true, telegram_username: true },
        },
      },
    });

    if (!strategy) {
      throw new NotFoundException('策略不存在');
    }

    // 检查用户是否已订阅
    const userConfig = await this.prisma.client.user_strategy_configs.findFirst({
      where: { user_id: userId, strategy_id: strategyId },
    });

    // 获取策略的实际表现数据
    const recentTrades = await this.prisma.client.trade_history.findMany({
      where: { strategy_id: strategyId, status: 'closed' },
      orderBy: { closed_at: 'desc' },
      take: 10,
      select: {
        symbol: true,
        side: true,
        pnl: true,
        closed_at: true,
      },
    });

    return {
      id: strategy.id,
      name: strategy.name,
      description: strategy.description,
      tier: strategy.tier,
      isPublic: strategy.is_public,
      isActive: strategy.is_active,
      // 回测数据
      backtestWinRate: strategy.backtest_win_rate?.toString() || '0',
      backtestSharpeRatio: strategy.backtest_sharpe_ratio?.toString() || '0',
      backtestMaxDrawdown: strategy.backtest_max_drawdown?.toString() || '0',
      backtestTotalTrades: strategy.backtest_total_trades || 0,
      // 实盘数据（使用 avg_win_rate）
      avgWinRate: strategy.avg_win_rate?.toString() || '0',
      avgSharpeRatio: strategy.avg_sharpe_ratio?.toString() || '0',
      // 用户数据
      totalUsers: strategy.total_users || 0,
      totalProfit: strategy.total_profit?.toString() || '0',
      // 订阅状态
      isSubscribed: !!userConfig,
      userConfig: userConfig
        ? {
            id: userConfig.id,
            stakeAmount: userConfig.stake_amount?.toString() || '0',
            isActive: userConfig.is_active,
          }
        : null,
      // 最近交易
      recentTrades: recentTrades.map((t: any) => ({
        symbol: t.symbol,
        side: t.side,
        pnl: t.pnl?.toString() || '0',
        closedAt: t.closed_at,
      })),
      // 作者信息
      author: strategy.uploader
        ? {
            id: strategy.uploader.id,
            username: strategy.uploader.telegram_username || strategy.uploader.email?.split('@')[0],
          }
        : null,
      createdAt: strategy.created_at,
      updatedAt: strategy.updated_at,
    };
  }

  /**
   * 订阅策略
   */
  async subscribeStrategy(userId: string, strategyId: string, stakeAmount?: string) {
    const strategy = await this.prisma.client.strategies.findUnique({
      where: { id: strategyId },
    });

    if (!strategy) {
      throw new NotFoundException('策略不存在');
    }

    if (!strategy.is_public || !strategy.is_active) {
      throw new BadRequestException('该策略不可订阅');
    }

    // 检查是否已订阅
    const existingConfig = await this.prisma.client.user_strategy_configs.findFirst({
      where: { user_id: userId, strategy_id: strategyId },
    });

    if (existingConfig) {
      throw new ConflictException('您已订阅该策略');
    }

    // 检查用户钱包余额
    const wallet = await this.prisma.client.wallets.findUnique({
      where: { user_id: userId },
    });

    const amount = new Decimal(stakeAmount || '100');
    if (wallet && new Decimal(wallet.usdt_balance.toString()).lt(amount)) {
      throw new BadRequestException('余额不足');
    }

    // 创建订阅配置
    const config = await this.prisma.client.user_strategy_configs.create({
      data: {
        user_id: userId,
        strategy_id: strategyId,
        stake_amount: amount,
        is_active: false, // 默认不激活，需要用户手动启动
      },
    });

    // 更新策略用户数
    await this.prisma.client.strategies.update({
      where: { id: strategyId },
      data: {
        total_users: { increment: 1 },
      },
    });

    this.logger.log(`用户 ${userId} 订阅策略 ${strategyId}，投入资金 ${amount}`);

    return {
      success: true,
      configId: config.id,
      message: '订阅成功，请在"我的策略"中启动',
    };
  }

  /**
   * 取消订阅策略
   */
  async unsubscribeStrategy(userId: string, strategyId: string) {
    const config = await this.prisma.client.user_strategy_configs.findFirst({
      where: { user_id: userId, strategy_id: strategyId },
    });

    if (!config) {
      throw new NotFoundException('未找到订阅配置');
    }

    if (config.is_active) {
      throw new BadRequestException('请先停止策略运行');
    }

    // 删除配置
    await this.prisma.client.user_strategy_configs.delete({
      where: { id: config.id },
    });

    // 更新策略用户数
    await this.prisma.client.strategies.update({
      where: { id: strategyId },
      data: {
        total_users: { decrement: 1 },
      },
    });

    this.logger.log(`用户 ${userId} 取消订阅策略 ${strategyId}`);

    return { success: true, message: '取消订阅成功' };
  }

  /**
   * 获取我的策略配置
   */
  async getMyStrategies(userId: string) {
    const configs = await this.prisma.client.user_strategy_configs.findMany({
      where: { user_id: userId },
      include: {
        strategies: {
          select: {
            id: true,
            name: true,
            tier: true,
            backtest_win_rate: true,
            avg_win_rate: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return {
      configs: configs.map((c: any) => ({
        id: c.id,
        strategyId: c.strategy_id,
        strategyName: c.strategies?.name || '未知策略',
        strategyTier: c.strategies?.tier || 'bronze',
        stakeAmount: c.stake_amount?.toString() || '0',
        isActive: c.is_active,
        winRate: c.strategies?.avg_win_rate?.toString() || c.strategies?.backtest_win_rate?.toString() || '0',
        leverage: c.leverage || 1,
        maxOpenTrades: c.max_open_trades || 3,
        createdAt: c.created_at,
      })),
      total: configs.length,
    };
  }

  // ==================== 交易历史 ====================

  /**
   * 获取交易历史
   */
  async getTrades(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [trades, total] = await Promise.all([
      this.prisma.client.trade_history.findMany({
        where: { user_id: userId },
        orderBy: { opened_at: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          symbol: true,
          side: true,
          entry_price: true,
          exit_price: true,
          quantity: true,
          pnl: true,
          pnl_percentage: true,
          status: true,
          opened_at: true,
          closed_at: true,
          strategies: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.client.trade_history.count({ where: { user_id: userId } }),
    ]);

    return {
      trades: trades.map((t: any) => ({
        id: t.id,
        symbol: t.symbol,
        side: t.side,
        entryPrice: t.entry_price?.toString() || '0',
        exitPrice: t.exit_price?.toString() || '0',
        quantity: t.quantity?.toString() || '0',
        pnl: t.pnl?.toString() || '0',
        pnlPercentage: t.pnl_percentage?.toString() || '0',
        status: t.status,
        strategyName: t.strategies?.name || '手动交易',
        openedAt: t.opened_at,
        closedAt: t.closed_at,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ==================== 账单记录 ====================

  /**
   * 获取账单记录
   */
  async getBillingHistory(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.client.billing_logs.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          billing_type: true,
          amount: true,
          currency: true,
          description: true,
          status: true,
          created_at: true,
        },
      }),
      this.prisma.client.billing_logs.count({ where: { user_id: userId } }),
    ]);

    return {
      bills: logs.map((l: any) => ({
        id: l.id,
        type: l.billing_type,
        amount: l.amount?.toString() || '0',
        currency: l.currency,
        description: l.description,
        status: l.status,
        createdAt: l.created_at,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ==================== 通知相关 ====================

  /**
   * 获取公告列表
   */
  async getAnnouncements() {
    const now = new Date();
    const announcements = await this.prisma.client.announcements.findMany({
      where: {
        start_at: { lte: now },
        OR: [{ end_at: null }, { end_at: { gt: now } }],
      },
      orderBy: [{ is_pinned: 'desc' }, { display_order: 'asc' }, { created_at: 'desc' }],
      take: 20,
      select: {
        id: true,
        title: true,
        content: true,
        type: true,
        is_pinned: true,
        created_at: true,
      },
    });

    return {
      announcements: announcements.map((a: any) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        type: a.type,
        isPinned: a.is_pinned,
        createdAt: a.created_at,
      })),
      total: announcements.length,
    };
  }

  /**
   * 获取用户通知（使用 billing_logs 中的系统消息）
   */
  async getNotifications(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    // 使用 billing_logs 作为通知来源（实际项目可能有专门的 notifications 表）
    const [logs, total] = await Promise.all([
      this.prisma.client.billing_logs.findMany({
        where: {
          user_id: userId,
          billing_type: { in: ['system', 'reward', 'penalty', 'checkin', 'referral'] },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          billing_type: true,
          description: true,
          created_at: true,
        },
      }),
      this.prisma.client.billing_logs.count({
        where: {
          user_id: userId,
          billing_type: { in: ['system', 'reward', 'penalty', 'checkin', 'referral'] },
        },
      }),
    ]);

    return {
      notifications: logs.map((l: any) => ({
        id: l.id,
        type: l.billing_type,
        message: l.description,
        createdAt: l.created_at,
        isRead: true, // 简化处理，实际需要已读状态
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ==================== 用户设置 ====================

  /**
   * 获取用户详细信息
   */
  async getProfile(userId: string) {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      include: {
        wallets: true,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 统计数据
    const [totalTrades, activeStrategies, totalPnl] = await Promise.all([
      this.prisma.client.trade_history.count({ where: { user_id: userId } }),
      this.prisma.client.user_strategy_configs.count({
        where: { user_id: userId, is_active: true },
      }),
      this.prisma.client.trade_history.aggregate({
        where: { user_id: userId, status: 'closed' },
        _sum: { pnl: true },
      }),
    ]);

    return {
      id: user.id,
      email: user.email.includes('@telegram.local') ? null : user.email,
      hasPassword: !!user.password_hash,
      telegramId: user.telegram_id?.toString() || null,
      telegramUsername: user.telegram_username,
      telegramFirstName: user.telegram_first_name,
      telegramPhotoUrl: user.telegram_photo_url,
      telegramLinkedAt: user.telegram_linked_at,
      vipLevel: user.vip_level,
      inviteCode: user.invite_code,
      role: user.role,
      status: user.status,
      // 钱包
      wallet: user.wallets
        ? {
            usdtBalance: user.wallets.usdt_balance?.toString() || '0',
            usdtFrozen: user.wallets.usdt_frozen?.toString() || '0',
            pointsBalance: user.wallets.points_balance?.toString() || '0',
            tokenBalance: user.wallets.token_balance?.toString() || '0',
          }
        : null,
      // 统计
      stats: {
        totalTrades,
        activeStrategies,
        totalPnl: totalPnl._sum.pnl?.toString() || '0',
      },
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at,
    };
  }

  /**
   * 绑定邮箱（Telegram 用户专用）
   */
  async bindEmail(userId: string, email: string, password: string) {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 检查是否是 Telegram 用户
    if (!user.email.includes('@telegram.local')) {
      throw new BadRequestException('该账户已绑定邮箱');
    }

    // 检查邮箱是否已被使用
    const existingUser = await this.prisma.client.users.findFirst({
      where: { email, id: { not: userId } },
    });

    if (existingUser) {
      throw new ConflictException('该邮箱已被其他账户使用');
    }

    // 密码加密
    const hashedPassword = await bcrypt.hash(password, 10);

    // 更新用户
    await this.prisma.client.users.update({
      where: { id: userId },
      data: {
        email,
        password_hash: hashedPassword,
      },
    });

    this.logger.log(`用户 ${userId} 绑定邮箱 ${email}`);

    return { success: true, message: '邮箱绑定成功' };
  }

  // ==================== 新手任务系统 ====================

  /**
   * 新手任务配置
   * 任务类型 -> 积分奖励
   */
  private readonly ONBOARDING_TASKS: Record<string, { points: number; description: string }> = {
    'bind-api': { points: 100, description: '绑定交易所 API' },
    'first-deposit': { points: 400, description: '首次点卡兑换 ≥50U' },
    'subscribe-strategy': { points: 300, description: '保存策略配置' },
    'start-bot': { points: 200, description: '机器人运行 24h' },
  };

  /**
   * 获取用户新手任务完成状态
   */
  async getOnboardingTasks(userId: string) {
    // 查询已完成的任务
    const completedTasks = await this.prisma.client.billing_logs.findMany({
      where: {
        user_id: userId,
        billing_type: 'onboarding_task',
      },
      select: {
        reference_id: true,
        amount: true,
        created_at: true,
      },
    });

    const completedTaskIds = new Set(completedTasks.map((t: any) => t.reference_id));

    // 构造任务列表
    const tasks = Object.entries(this.ONBOARDING_TASKS).map(([taskId, config]) => ({
      id: taskId,
      title: config.description,
      points: config.points,
      completed: completedTaskIds.has(taskId),
      completedAt: completedTasks.find((t: any) => t.reference_id === taskId)?.created_at || null,
    }));

    // 计算总积分和已获得积分
    const totalPoints = Object.values(this.ONBOARDING_TASKS).reduce((sum, t) => sum + t.points, 0);
    const earnedPoints = tasks.filter(t => t.completed).reduce((sum, t) => sum + t.points, 0);

    return {
      tasks,
      totalPoints,
      earnedPoints,
      completedCount: tasks.filter(t => t.completed).length,
      totalCount: tasks.length,
    };
  }

  /**
   * 完成新手任务并发放积分
   * @param userId 用户 ID
   * @param taskId 任务 ID（如 bind-api, first-deposit 等）
   */
  async completeOnboardingTask(userId: string, taskId: string) {
    // 验证任务类型
    const taskConfig = this.ONBOARDING_TASKS[taskId];
    if (!taskConfig) {
      throw new BadRequestException(`无效的任务类型: ${taskId}`);
    }

    // 检查任务是否已完成（幂等性）
    const existingTask = await this.prisma.client.billing_logs.findFirst({
      where: {
        user_id: userId,
        billing_type: 'onboarding_task',
        reference_id: taskId,
      },
    });

    if (existingTask) {
      return {
        success: false,
        message: '任务已完成',
        alreadyCompleted: true,
        pointsEarned: '0',
      };
    }

    // 根据任务类型验证条件是否满足
    const conditionMet = await this.checkTaskCondition(userId, taskId);
    if (!conditionMet) {
      return {
        success: false,
        message: '任务条件未满足',
        alreadyCompleted: false,
        pointsEarned: '0',
      };
    }

    const pointsEarned = new Decimal(taskConfig.points);

    // 使用事务：记录任务完成 + 发放积分
    await this.prisma.client.$transaction(async (tx: any) => {
      // 创建任务完成记录
      await tx.billing_logs.create({
        data: {
          user_id: userId,
          unique_order_id: `onboarding_${taskId}_${userId}_${Date.now()}`,
          billing_type: 'onboarding_task',
          reference_type: 'onboarding',
          reference_id: taskId,
          amount: pointsEarned,
          currency: 'POINTS',
          description: `新手任务奖励: ${taskConfig.description}`,
          status: 'completed',
        },
      });

      // 增加积分
      await tx.wallets.update({
        where: { user_id: userId },
        data: {
          points_balance: { increment: pointsEarned.toNumber() },
        },
      });
    });

    this.logger.log(`用户 ${userId} 完成新手任务 ${taskId}，获得 ${pointsEarned} 积分`);

    return {
      success: true,
      message: `任务完成，获得 ${pointsEarned} 积分`,
      alreadyCompleted: false,
      pointsEarned: pointsEarned.toString(),
    };
  }

  /**
   * 验证任务条件是否满足
   */
  private async checkTaskCondition(userId: string, taskId: string): Promise<boolean> {
    switch (taskId) {
      case 'bind-api': {
        // 检查是否绑定了 API Key
        const apiKeyCount = await this.prisma.client.api_keys.count({
          where: { user_id: userId, is_active: true },
        });
        return apiKeyCount > 0;
      }

      case 'first-deposit': {
        // 检查是否有点卡兑换 ≥50 USDT 的记录
        const cardPurchase = await this.prisma.client.billing_logs.findFirst({
          where: {
            user_id: userId,
            billing_type: 'card_purchase',
            status: 'completed',
            amount: { gte: 50 },
          },
        });
        return !!cardPurchase;
      }

      case 'subscribe-strategy': {
        // 检查是否订阅了策略
        const subscription = await this.prisma.client.user_strategy_configs.findFirst({
          where: { user_id: userId },
        });
        return !!subscription;
      }

      case 'start-bot': {
        // 检查最近 24 小时内是否有交易记录
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentTrade = await this.prisma.client.trade_history.findFirst({
          where: {
            user_id: userId,
            closed_at: { gte: oneDayAgo },
          },
        });
        return !!recentTrade;
      }

      default:
        return false;
    }
  }
}
