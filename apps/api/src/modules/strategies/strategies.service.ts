import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
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
   */
  async findAll() {
    const strategies = await this.prisma.client.strategies.findMany({
      where: {
        is_public: true,
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        owner_type: true,
        is_public: true,
        performance_stats: true,
        config: true,
        created_at: true,
        // 不返回 content（策略代码）
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return strategies;
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
      throw new BadRequestException('该策略已有活跃配置，请先停用或删除现有配置');
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
}
