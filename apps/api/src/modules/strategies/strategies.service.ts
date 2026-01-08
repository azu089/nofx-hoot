import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStrategyConfigDto } from './dto/create-strategy-config.dto';
import { UpdateStrategyConfigDto } from './dto/update-strategy-config.dto';
import Decimal from 'decimal.js';

/**
 * 策略服务
 * 处理交易策略相关业务逻辑
 */
@Injectable()
export class StrategiesService {
  private readonly logger = new Logger(StrategiesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取所有公开策略列表
   * 不需要认证，任何人都可以查看
   * @param query 筛选和排序参数
   */
  async findAll(query?: {
    type?: string;
    source?: string;
    sort?: string;
  }) {
    // 构建查询条件
    const where: any = {
      is_public: true,
      is_active: true,
    };

    // 来源筛选
    if (query?.source === 'official') {
      where.owner_type = 'system';
    } else if (query?.source === 'community') {
      where.owner_type = 'user';
    }

    const strategies = await this.prisma.client.strategies.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        owner_type: true,
        is_public: true,
        performance_stats: true,
        config: true,
        created_at: true,
        tier: true,
        total_users: true,
        backtest_total_return: true,
        backtest_max_drawdown: true,
        backtest_win_rate: true,
        backtest_total_trades: true,
        backtest_sharpe_ratio: true,
        // 不返回 content（策略代码）
      },
    });

    // 策略类型筛选（从 config JSON 中筛选）
    let filtered = strategies;
    if (query?.type && query.type !== 'all') {
      filtered = strategies.filter((s) => {
        const config = s.config as any;
        return config?.strategyType === query.type;
      });
    }

    // 计算综合评分并排序
    const withScore = filtered.map((s) => ({
      ...s,
      _score: this.calculateStrategyScore(s),
    }));

    // 排序
    switch (query?.sort) {
      case 'popular':
        withScore.sort((a, b) => (b.total_users || 0) - (a.total_users || 0));
        break;
      case 'returns':
        withScore.sort((a, b) => {
          const aReturn = Number(a.backtest_total_return) || 0;
          const bReturn = Number(b.backtest_total_return) || 0;
          return bReturn - aReturn;
        });
        break;
      case 'drawdown':
        withScore.sort((a, b) => {
          const aDrawdown = Math.abs(Number(a.backtest_max_drawdown) || 100);
          const bDrawdown = Math.abs(Number(b.backtest_max_drawdown) || 100);
          return aDrawdown - bDrawdown; // 回撤越小越好
        });
        break;
      case 'newest':
        withScore.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
      case 'recommended':
      default:
        // 综合推荐：按评分排序
        withScore.sort((a, b) => b._score - a._score);
        break;
    }

    // 移除内部评分字段
    return withScore.map(({ _score, ...rest }) => rest);
  }

  /**
   * 计算策略综合评分（0-100分）
   * 用于综合推荐排序
   */
  private calculateStrategyScore(strategy: {
    tier?: string | null;
    total_users?: number | null;
    backtest_total_return?: any;
    backtest_max_drawdown?: any;
  }): number {
    let score = 0;

    // 1. 等级分 (0-30)
    const tierScores: Record<string, number> = {
      diamond: 30,
      platinum: 25,
      gold: 20,
      silver: 15,
      bronze: 10,
    };
    score += tierScores[strategy.tier || ''] || 0;

    // 2. 人气分 (0-25)
    const users = strategy.total_users || 0;
    score += Math.min(users / 40, 25); // 1000人 = 满分

    // 3. 收益分 (0-25)
    const roi = Number(strategy.backtest_total_return) || 0;
    score += Math.min(roi / 4, 25); // 100% = 满分

    // 4. 稳定分 (0-20)
    const drawdown = Math.abs(Number(strategy.backtest_max_drawdown) || 0);
    score += Math.max(20 - drawdown, 0); // 回撤越小分越高

    return score;
  }

  /**
   * 获取策略详情（包含代码）
   * @param id 策略 ID
   */
  async findById(id: string) {
    const strategy = await this.prisma.client.strategies.findUnique({
      where: { id },
    });

    if (!strategy) {
      throw new NotFoundException('策略不存在');
    }

    // 私有策略不对外公开
    if (!strategy.is_public && strategy.owner_type === 'user') {
      throw new ForbiddenException('无权限访问该策略');
    }

    return strategy;
  }

  /**
   * 获取用户已订阅的策略列表
   * 返回用户配置过的所有策略（去重）
   * @param userId 用户 ID
   */
  async findUserSubscribedStrategies(userId: string) {
    // 查询用户的所有策略配置，获取关联的策略
    const configs = await this.prisma.client.user_strategy_configs.findMany({
      where: { user_id: userId },
      include: {
        strategies: {
          select: {
            id: true,
            name: true,
            description: true,
            owner_type: true,
            is_public: true,
            performance_stats: true,
            config: true,
            created_at: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // 去重并返回策略列表（一个策略可能有多个配置）
    const strategiesMap = new Map();
    for (const config of configs) {
      if (config.strategies && !strategiesMap.has(config.strategies.id)) {
        strategiesMap.set(config.strategies.id, config.strategies);
      }
    }

    return Array.from(strategiesMap.values());
  }

  /**
   * 获取用户的策略配置列表
   * @param userId 用户 ID
   */
  async findUserStrategies(userId: string) {
    const configs = await this.prisma.client.user_strategy_configs.findMany({
      where: { user_id: userId },
      include: {
        strategies: {
          select: {
            id: true,
            name: true,
            description: true,
            is_public: true,
            owner_type: true,
            content: true, // 上架时需要策略代码
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // 转换为响应格式
    return configs.map((config) => ({
      ...config,
      stake_amount: config.stake_amount.toString(),
      stoploss: config.stoploss.toString(),
      trailing_stop_positive: config.trailing_stop_positive?.toString() || null,
      blacklist: Array.isArray(config.blacklist) ? config.blacklist : [],
      custom_config: config.custom_config || {},
      strategy: config.strategies,
    }));
  }

  /**
   * 创建用户策略配置
   * @param userId 用户 ID
   * @param dto 创建 DTO
   */
  async createUserConfig(userId: string, dto: CreateStrategyConfigDto) {
    // 验证策略是否存在
    const strategy = await this.prisma.client.strategies.findUnique({
      where: { id: dto.strategy_id },
    });

    if (!strategy) {
      throw new NotFoundException('策略不存在');
    }

    // 验证投入金额
    const stakeAmount = new Decimal(dto.stake_amount);
    if (stakeAmount.lte(0)) {
      throw new BadRequestException('投入金额必须大于 0');
    }

    // 检查用户是否已有该策略的活跃配置
    const existingConfig = await this.prisma.client.user_strategy_configs.findFirst({
      where: {
        user_id: userId,
        strategy_id: dto.strategy_id,
        is_active: true,
      },
    });

    if (existingConfig) {
      if (dto.force) {
        // 强制覆盖：先停用旧配置
        await this.prisma.client.user_strategy_configs.update({
          where: { id: existingConfig.id },
          data: { is_active: false },
        });
        this.logger.log(`用户 ${userId} 强制覆盖策略配置: ${existingConfig.id}`);
      } else {
        throw new BadRequestException(
          '该策略已有活跃配置。可选操作：1) 编辑现有配置 2) 使用 force 参数覆盖 3) 先删除现有配置',
        );
      }
    }

    // 创建配置
    const config = await this.prisma.client.user_strategy_configs.create({
      data: {
        user_id: userId,
        strategy_id: dto.strategy_id,
        instance_id: dto.instance_id || null,
        stake_amount: dto.stake_amount,
        max_open_trades: dto.max_open_trades,
        leverage: dto.leverage,
        stoploss: dto.stoploss,
        trailing_stop: dto.trailing_stop || false,
        trailing_stop_positive: dto.trailing_stop_positive || null,
        blacklist: dto.blacklist || [],
        custom_config: dto.custom_config || {},
      },
      include: {
        strategies: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    this.logger.log(`用户 ${userId} 创建策略配置: ${config.id}`);

    return {
      ...config,
      stake_amount: config.stake_amount.toString(),
      stoploss: config.stoploss.toString(),
      trailing_stop_positive: config.trailing_stop_positive?.toString() || null,
      blacklist: Array.isArray(config.blacklist) ? config.blacklist : [],
      custom_config: config.custom_config || {},
      strategy: config.strategies,
    };
  }

  /**
   * 更新用户策略配置
   * @param id 配置 ID
   * @param userId 用户 ID
   * @param dto 更新 DTO
   */
  async updateUserConfig(id: string, userId: string, dto: UpdateStrategyConfigDto) {
    // 查找配置
    const config = await this.prisma.client.user_strategy_configs.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException('策略配置不存在');
    }

    // 验证所有权
    if (config.user_id !== userId) {
      throw new ForbiddenException('无权限修改该配置');
    }

    // 验证投入金额（如果有更新）
    if (dto.stake_amount) {
      const stakeAmount = new Decimal(dto.stake_amount);
      if (stakeAmount.lte(0)) {
        throw new BadRequestException('投入金额必须大于 0');
      }
    }

    // 更新配置
    const updated = await this.prisma.client.user_strategy_configs.update({
      where: { id },
      data: {
        instance_id: dto.instance_id !== undefined ? dto.instance_id : config.instance_id,
        stake_amount: dto.stake_amount || config.stake_amount,
        max_open_trades: dto.max_open_trades ?? config.max_open_trades,
        leverage: dto.leverage ?? config.leverage,
        stoploss: dto.stoploss ?? config.stoploss,
        trailing_stop: dto.trailing_stop ?? config.trailing_stop,
        trailing_stop_positive: dto.trailing_stop_positive !== undefined
          ? dto.trailing_stop_positive
          : (config.trailing_stop_positive as any),
        blacklist: dto.blacklist !== undefined ? dto.blacklist as any : config.blacklist,
        custom_config: dto.custom_config !== undefined ? dto.custom_config as any : config.custom_config,
      },
      include: {
        strategies: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    this.logger.log(`用户 ${userId} 更新策略配置: ${id}`);

    // 安全类型转换
    const blacklistArray = Array.isArray(updated.blacklist) ? updated.blacklist : [];
    const customConfigObj = typeof updated.custom_config === 'object' && updated.custom_config !== null
      ? updated.custom_config
      : {};

    return {
      id: updated.id,
      user_id: updated.user_id,
      strategy_id: updated.strategy_id,
      instance_id: updated.instance_id,
      stake_amount: updated.stake_amount.toString(),
      max_open_trades: updated.max_open_trades,
      leverage: updated.leverage,
      stoploss: updated.stoploss.toString(),
      trailing_stop: updated.trailing_stop,
      trailing_stop_positive: updated.trailing_stop_positive?.toString() || null,
      blacklist: blacklistArray as string[],
      custom_config: customConfigObj,
      is_active: updated.is_active,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
      strategy: updated.strategies,
    };
  }

  /**
   * 删除用户策略配置
   * @param id 配置 ID
   * @param userId 用户 ID
   */
  async deleteUserConfig(id: string, userId: string) {
    // 查找配置
    const config = await this.prisma.client.user_strategy_configs.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException('策略配置不存在');
    }

    // 验证所有权
    if (config.user_id !== userId) {
      throw new ForbiddenException('无权限删除该配置');
    }

    // 删除配置
    await this.prisma.client.user_strategy_configs.delete({
      where: { id },
    });

    this.logger.log(`用户 ${userId} 删除策略配置: ${id}`);

    return { message: '策略配置已删除' };
  }

  /**
   * 生成 Freqtrade 配置文件
   * @param configId 用户策略配置 ID
   * @returns Freqtrade 配置 JSON
   */
  async generateFreqtradeConfig(configId: string) {
    const config = await this.prisma.client.user_strategy_configs.findUnique({
      where: { id: configId },
      include: {
        strategies: true,
        users: {
          include: {
            api_keys: {
              where: { is_active: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!config) {
      throw new NotFoundException('策略配置不存在');
    }

    // 注意：实际生产环境中，API Key 需要解密
    // 这里仅返回配置结构示例
    const freqtradeConfig = {
      strategy: config.strategies.name,
      stake_currency: 'USDT',
      stake_amount: config.stake_amount.toString(),
      max_open_trades: config.max_open_trades,

      exchange: {
        name: 'binance', // 从 api_keys 表读取
        key: '{{API_KEY}}', // 实际需解密
        secret: '{{API_SECRET}}', // 实际需解密
        ccxt_config: {
          enableRateLimit: true,
        },
        ccxt_async_config: {
          enableRateLimit: true,
        },
      },

      // 风控参数
      trading_mode: 'futures',
      margin_mode: 'isolated',
      leverage: config.leverage,
      stoploss: config.stoploss.toNumber(),
      trailing_stop: config.trailing_stop,
      trailing_stop_positive: config.trailing_stop_positive?.toNumber() || null,

      // 黑名单
      exchange_blacklist: Array.isArray(config.blacklist) ? config.blacklist : [],

      // 其他配置
      dry_run: false,
      dry_run_wallet: 1000,

      // 自定义配置合并
      ...(typeof config.custom_config === 'object' && config.custom_config !== null
        ? config.custom_config
        : {}),
    };

    return freqtradeConfig;
  }

  // ==================== Phase 16: 社区策略市场方法 ====================

  /**
   * 创建用户上传的策略
   * Phase 16.5
   */
  async createUserStrategy(data: {
    userId: string;
    name: string;
    description?: string;
    content: string;
    backtestData: any;
  }) {
    this.logger.log(`用户 ${data.userId} 上传策略: ${data.name}`);

    return await this.prisma.client.strategies.create({
      data: {
        name: data.name,
        description: data.description,
        content: data.content,
        owner_type: 'user',
        uploader_id: data.userId,
        is_public: false, // 默认不公开，审核通过后才公开
        is_active: false, // 默认未激活，审核通过后激活
        revenue_share_enabled: true, // 启用收益分成
        review_status: 'pending', // 待审核
        // 保存回测数据
        backtest_data: data.backtestData,
        backtest_total_return: data.backtestData.totalReturn,
        backtest_max_drawdown: data.backtestData.maxDrawdown,
        backtest_sharpe_ratio: data.backtestData.sharpeRatio,
        backtest_win_rate: data.backtestData.winRate,
        backtest_total_trades: data.backtestData.totalTrades,
        backtest_period_start: new Date(data.backtestData.startDate),
        backtest_period_end: new Date(data.backtestData.endDate),
        has_backtest: true,
      },
    });
  }

  /**
   * 更新策略审核状态
   * Phase 16.5
   */
  async updateReviewStatus(
    strategyId: string,
    data: {
      review_status: string;
      auto_check_passed: boolean;
      auto_check_warnings: string[];
    },
  ) {
    this.logger.log(`更新策略审核状态: ${strategyId} -> ${data.review_status}`);

    return await this.prisma.client.strategies.update({
      where: { id: strategyId },
      data: {
        review_status: data.review_status,
        auto_check_passed: data.auto_check_passed,
        auto_check_warnings: data.auto_check_warnings,
        // 如果审核通过，激活并公开策略
        ...(data.review_status === 'approved' && {
          is_active: true,
          is_public: true,
        }),
      },
    });
  }

  /**
   * 提交策略上架申请
   * 用户将自己的私有策略提交到市场审核
   * @param strategyId 策略 ID
   * @param userId 用户 ID
   * @param description 可选的策略描述更新
   * @param autoCheckResult 前端自动检测结果（用于记录）
   */
  async submitStrategyForReview(
    strategyId: string,
    userId: string,
    description?: string,
    autoCheckResult?: {
      backtestReturn: number | null;
      backtestWinRate: number | null;
      backtestDrawdown: number | null;
    },
  ) {
    this.logger.log(`用户 ${userId} 提交策略上架申请: ${strategyId}`);

    // 1. 查找策略
    const strategy = await this.prisma.client.strategies.findUnique({
      where: { id: strategyId },
    });

    if (!strategy) {
      throw new NotFoundException('策略不存在');
    }

    // 2. 验证权限 - 策略必须属于当前用户
    if (strategy.uploader_id !== userId) {
      throw new ForbiddenException('无权操作此策略');
    }

    // 3. 验证策略状态 - 只有草稿或已拒绝的策略可以重新提交
    const allowedStatuses = ['draft', 'rejected', null];
    if (!allowedStatuses.includes(strategy.review_status)) {
      throw new ConflictException(
        `策略当前状态为「${this.getStatusLabel(strategy.review_status || 'unknown')}」，无法重复提交`,
      );
    }

    // 4. 更新策略状态为待审核，同时更新描述和记录检测结果
    const updateData: Record<string, unknown> = {
      review_status: 'pending_review',
      auto_check_passed: true, // 前端检测通过才能提交
    };

    // 如果有新描述，更新描述
    if (description && description.trim()) {
      updateData.description = description.trim();
    }

    // 记录前端自动检测结果（存入 auto_check_warnings 字段，复用现有字段）
    if (autoCheckResult) {
      updateData.auto_check_warnings = {
        type: 'listing_check',
        submittedAt: new Date().toISOString(),
        result: autoCheckResult,
      };
    }

    await this.prisma.client.strategies.update({
      where: { id: strategyId },
      data: updateData,
    });

    this.logger.log(`策略 ${strategyId} 已提交审核，检测结果: ${JSON.stringify(autoCheckResult)}`);

    return {
      strategyId,
      reviewStatus: 'pending_review',
      message: '策略已提交审核，我们将在 1-3 个工作日内完成审核',
      nextStep: '请耐心等待审核结果，审核通过后策略将自动上架到策略市场',
    };
  }

  /**
   * 获取审核状态的中文标签
   */
  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      draft: '草稿',
      pending_review: '待审核',
      backtest_running: '回测中',
      backtest_passed: '回测通过',
      backtest_failed: '回测失败',
      trial: '试运行中',
      approved: '已上架',
      rejected: '已拒绝',
      flagged: '待人工审核',
    };
    return labels[status] || status;
  }

  /**
   * 查找用户上传的策略列表
   * Phase 16.5
   */
  async findUserUploadedStrategies(userId: string) {
    this.logger.log(`查询用户上传的策略列表: ${userId}`);

    const strategies = await this.prisma.client.strategies.findMany({
      where: {
        uploader_id: userId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        review_status: true,
        auto_check_passed: true,
        auto_check_warnings: true,
        tier: true,
        revenue_share_rate: true,
        total_users: true,
        total_profit: true,
        avg_win_rate: true,
        backtest_total_return: true,
        backtest_win_rate: true,
        backtest_max_drawdown: true,
        backtest_sharpe_ratio: true,
        is_active: true,
        is_public: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // 转换为前端期望的 camelCase 格式
    return strategies.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      reviewStatus: s.review_status,
      autoCheckPassed: s.auto_check_passed,
      autoCheckWarnings: s.auto_check_warnings,
      tier: s.tier,
      revenueShareRate: s.revenue_share_rate?.toString() || null,
      revenueShareEnabled: s.revenue_share_rate !== null,
      totalUsers: s.total_users || 0,
      totalProfit: s.total_profit?.toString() || '0',
      avgWinRate: s.avg_win_rate?.toString() || null,
      backtestTotalReturn: s.backtest_total_return?.toString() || null,
      backtestWinRate: s.backtest_win_rate?.toString() || null,
      backtestMaxDrawdown: s.backtest_max_drawdown?.toString() || null,
      backtestSharpeRatio: s.backtest_sharpe_ratio?.toString() || null,
      isActive: s.is_active,
      isPublic: s.is_public,
      createdAt: s.created_at?.toISOString() || null,
      updatedAt: s.updated_at?.toISOString() || null,
    }));
  }

  /**
   * 根据策略 ID 查找单个策略（内部方法）
   * Phase 16.5
   */
  async findOne(strategyId: string) {
    return await this.prisma.client.strategies.findUnique({
      where: { id: strategyId },
    });
  }

  /**
   * 计算用户的策略收益统计
   * Phase 16.5
   */
  async calculateUserRevenueStats(userId: string) {
    this.logger.log(`计算用户策略收益统计: ${userId}`);

    // 查询所有收益记录
    const revenueLogs = await this.prisma.client.strategy_revenue_logs.findMany(
      {
        where: {
          uploader_id: userId,
        },
        include: {
          strategy: {
            select: {
              id: true,
              name: true,
              tier: true,
            },
          },
        },
      },
    );

    // 计算总收益
    let totalRevenue = new Decimal(0);
    let pendingRevenue = new Decimal(0);
    let settledRevenue = new Decimal(0);

    const revenueByStrategyMap = new Map<
      string,
      {
        strategyId: string;
        strategyName: string;
        revenue: Decimal;
        users: Set<string>;
        tier: string;
      }
    >();

    for (const log of revenueLogs) {
      const amount = new Decimal(log.revenue_amount);
      totalRevenue = totalRevenue.plus(amount);

      if (log.status === 'settled') {
        settledRevenue = settledRevenue.plus(amount);
      } else {
        pendingRevenue = pendingRevenue.plus(amount);
      }

      // 按策略分组统计
      if (!revenueByStrategyMap.has(log.strategy_id)) {
        revenueByStrategyMap.set(log.strategy_id, {
          strategyId: log.strategy_id,
          strategyName: log.strategy.name,
          revenue: new Decimal(0),
          users: new Set<string>(),
          tier: log.strategy.tier || 'bronze',
        });
      }

      const strategyStats = revenueByStrategyMap.get(log.strategy_id)!;
      strategyStats.revenue = strategyStats.revenue.plus(amount);
      strategyStats.users.add(log.user_id);
    }

    // 转换为数组
    const revenueByStrategy = Array.from(revenueByStrategyMap.values()).map(
      (item) => ({
        strategyId: item.strategyId,
        strategyName: item.strategyName,
        revenue: item.revenue.toString(),
        users: item.users.size,
        tier: item.tier,
      }),
    );

    return {
      totalRevenue: totalRevenue.toString(),
      pendingRevenue: pendingRevenue.toString(),
      settledRevenue: settledRevenue.toString(),
      revenueByStrategy,
    };
  }

  /**
   * 查找用户的收益明细
   * Phase 16.5
   */
  async findUserRevenueLogs(
    userId: string,
    query: { page?: number; limit?: number; strategyId?: string },
  ) {
    this.logger.log(`查询用户收益明细: ${userId}`);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      uploader_id: userId,
    };

    if (query.strategyId) {
      where.strategy_id = query.strategyId;
    }

    const [logs, total] = await Promise.all([
      this.prisma.client.strategy_revenue_logs.findMany({
        where,
        include: {
          strategy: {
            select: {
              name: true,
            },
          },
          user: {
            select: {
              email: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          created_at: 'desc',
        },
      }),
      this.prisma.client.strategy_revenue_logs.count({ where }),
    ]);

    return {
      logs: logs.map((log) => ({
        id: log.id,
        strategyName: log.strategy.name,
        userName: log.user.email.replace(/(.{2}).*(@.*)/, '$1***$2'), // 脱敏
        baseAmount: log.base_amount.toString(),
        revenueAmount: log.revenue_amount.toString(),
        revenueShareRate: log.revenue_share_rate.toString(),
        status: log.status,
        createdAt: log.created_at,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 创建策略收益提现申请
   * Phase 16.9 - 从策略分成收益中提现
   */
  async createRevenueWithdrawal(
    userId: string,
    dto: {
      amount: string;
      chain: string;
      toAddress: string;
      totpCode?: string;
    },
  ) {
    this.logger.log(`创建策略收益提现: 用户=${userId}, 金额=${dto.amount}`);

    // 1. 检查用户 2FA 状态
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: {
        two_factor_enabled: true,
        two_factor_secret: true,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 2. 如果用户开启了 2FA，必须验证（可选实现，暂时跳过）
    let twoFactorVerified = false;
    if (user.two_factor_enabled && dto.totpCode) {
      // TODO: 集成 TOTP 验证
      // const isValid = this.totpService.verify(totpCode, user.two_factor_secret);
      // if (!isValid) throw new ForbiddenException('2FA 验证码错误');
      twoFactorVerified = true;
    }

    // 3. 计算手续费（固定 1%，最低 1 USDT）
    const WITHDRAWAL_FEE_RATE = new Decimal(0.01);
    const MIN_FEE = new Decimal(1);
    const amountDecimal = new Decimal(dto.amount);
    let fee = amountDecimal.times(WITHDRAWAL_FEE_RATE);
    if (fee.lt(MIN_FEE)) {
      fee = MIN_FEE;
    }

    // 4. 使用事务：创建提现记录 + 标记收益记录为待提现
    const withdrawal = await this.prisma.client.$transaction(async (tx) => {
      // 创建提现记录
      const newWithdrawal = await tx.withdrawals.create({
        data: {
          user_id: userId,
          amount: amountDecimal.toString(),
          currency: 'USDT',
          fee: fee.toString(),
          chain: dto.chain,
          to_address: dto.toAddress,
          status: 'pending',
          two_factor_verified: twoFactorVerified,
          withdrawal_type: 'strategy_revenue', // 标记为策略收益提现
        },
      });

      // 计算需要扣除的总金额（包含手续费）
      const totalAmount = amountDecimal.plus(fee);

      // 将已结算的收益标记为已提现（按金额累计）
      let remaining = totalAmount;
      const logsToUpdate = await tx.strategy_revenue_logs.findMany({
        where: {
          uploader_id: userId,
          status: 'settled',
          withdrawn: false, // 未提现的
        },
        orderBy: { created_at: 'asc' }, // 先进先出
      });

      for (const log of logsToUpdate) {
        if (remaining.lte(0)) break;

        const logAmount = new Decimal(log.revenue_amount);
        if (logAmount.lte(remaining)) {
          // 整条记录标记为已提现
          await tx.strategy_revenue_logs.update({
            where: { id: log.id },
            data: { withdrawn: true, withdrawal_id: newWithdrawal.id },
          });
          remaining = remaining.minus(logAmount);
        } else {
          // 单条记录金额大于提现金额，标记为部分提现
          // 将这条记录关联到提现申请
          await tx.strategy_revenue_logs.update({
            where: { id: log.id },
            data: { withdrawn: true, withdrawal_id: newWithdrawal.id },
          });
          remaining = new Decimal(0);
          break;
        }
      }

      return newWithdrawal;
    });

    this.logger.log(
      `策略收益提现创建成功: id=${withdrawal.id}, 金额=${dto.amount}, 手续费=${fee}`,
    );

    return {
      id: withdrawal.id,
      amount: withdrawal.amount.toString(),
      fee: withdrawal.fee.toString(),
      chain: withdrawal.chain,
      status: withdrawal.status,
    };
  }
}
