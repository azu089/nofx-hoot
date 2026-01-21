import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ConfigResponseDto, ConfigCategory } from './dto/config.dto';
import Decimal from 'decimal.js';

/**
 * 返佣比例类型
 * - subscription: 订阅费返佣（返积分给上级）
 * - card_purchase: 点卡购买返佣（返积分给上级）
 * - trade_points: 交易挖矿返佣（返积分给上级）
 * - gas_fee: 燃油费返佣（返 USDT 给上级，从盈利抽成中分配）
 */
export type ReferralRateType = 'subscription' | 'card_purchase' | 'trade_points' | 'gas_fee';

/**
 * 返佣比例返回格式
 */
export interface ReferralRates {
  l1: Decimal;
  l2: Decimal;
}

/**
 * 配置中心服务
 * 管理系统配置，支持 Redis 缓存
 */
@Injectable()
export class ConfigsService {
  private readonly logger = new Logger(ConfigsService.name);
  private readonly CACHE_KEY_PUBLIC = 'configs:public';
  private readonly CACHE_KEY_ALL = 'configs:all';
  private readonly CACHE_TTL = 300; // 5 分钟

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * 获取公开配置（前端用）
   */
  async getPublicConfigs(): Promise<Record<string, any>> {
    // 先查缓存
    const cached = await this.redis.get(this.CACHE_KEY_PUBLIC);
    if (cached) {
      return JSON.parse(cached);
    }

    // 查数据库
    const configs = await this.prisma.client.system_configs.findMany({
      where: { is_public: true },
    });

    // 转换为键值对
    const result: Record<string, any> = {};
    for (const config of configs) {
      result[config.config_key] = config.config_value;
    }

    // 写缓存
    await this.redis.set(this.CACHE_KEY_PUBLIC, JSON.stringify(result), this.CACHE_TTL);

    return result;
  }

  /**
   * 获取单个配置值
   */
  async getConfig(key: string): Promise<any> {
    const config = await this.prisma.client.system_configs.findUnique({
      where: { config_key: key },
    });

    if (!config) {
      return null;
    }

    return config.config_value;
  }

  /**
   * 获取所有配置（管理端）
   */
  async getAllConfigs(category?: ConfigCategory): Promise<ConfigResponseDto[]> {
    const where: any = {};
    if (category) {
      where.category = category;
    }

    const configs = await this.prisma.client.system_configs.findMany({
      where,
      orderBy: [{ category: 'asc' }, { config_key: 'asc' }],
    });

    return configs.map((config) => ({
      configKey: config.config_key,
      configValue: config.config_value,
      configType: config.config_type,
      category: config.category,
      label: config.label,
      description: config.description ?? undefined,
      isPublic: config.is_public,
      updatedAt: config.updated_at,
    }));
  }

  /**
   * 获取单个配置详情
   */
  async getConfigDetail(key: string): Promise<ConfigResponseDto> {
    const config = await this.prisma.client.system_configs.findUnique({
      where: { config_key: key },
    });

    if (!config) {
      throw new NotFoundException(`配置 ${key} 不存在`);
    }

    return {
      configKey: config.config_key,
      configValue: config.config_value,
      configType: config.config_type,
      category: config.category,
      label: config.label,
      description: config.description ?? undefined,
      isPublic: config.is_public,
      updatedAt: config.updated_at,
    };
  }

  /**
   * 更新配置
   */
  async updateConfig(
    key: string,
    value: any,
    updatedBy: string,
    options?: { description?: string; isPublic?: boolean },
  ): Promise<ConfigResponseDto> {
    const config = await this.prisma.client.system_configs.findUnique({
      where: { config_key: key },
    });

    if (!config) {
      throw new NotFoundException(`配置 ${key} 不存在`);
    }

    const updateData: any = {
      config_value: value,
      updated_by: updatedBy,
      updated_at: new Date(),
    };

    if (options?.description !== undefined) {
      updateData.description = options.description;
    }

    if (options?.isPublic !== undefined) {
      updateData.is_public = options.isPublic;
    }

    const updated = await this.prisma.client.system_configs.update({
      where: { config_key: key },
      data: updateData,
    });

    // 清除缓存
    await this.clearCache();

    this.logger.log(`配置 ${key} 已更新，操作人: ${updatedBy}`);

    return {
      configKey: updated.config_key,
      configValue: updated.config_value,
      configType: updated.config_type,
      category: updated.category,
      label: updated.label,
      description: updated.description ?? undefined,
      isPublic: updated.is_public,
      updatedAt: updated.updated_at,
    };
  }

  /**
   * 批量更新配置
   */
  async batchUpdateConfigs(
    configs: Record<string, any>,
    updatedBy: string,
  ): Promise<{ updated: number; failed: string[] }> {
    let updated = 0;
    const failed: string[] = [];

    for (const [key, value] of Object.entries(configs)) {
      try {
        await this.updateConfig(key, value, updatedBy);
        updated++;
      } catch (error) {
        failed.push(key);
        this.logger.error(`更新配置 ${key} 失败: ${error.message}`);
      }
    }

    return { updated, failed };
  }

  /**
   * 创建配置
   */
  async createConfig(
    key: string,
    value: any,
    type: string,
    category: string,
    label: string,
    options?: { description?: string; isPublic?: boolean },
  ): Promise<ConfigResponseDto> {
    const config = await this.prisma.client.system_configs.create({
      data: {
        config_key: key,
        config_value: value,
        config_type: type,
        category,
        label,
        description: options?.description,
        is_public: options?.isPublic ?? false,
      },
    });

    await this.clearCache();

    return {
      configKey: config.config_key,
      configValue: config.config_value,
      configType: config.config_type,
      category: config.category,
      label: config.label,
      description: config.description ?? undefined,
      isPublic: config.is_public,
      updatedAt: config.updated_at,
    };
  }

  /**
   * 初始化默认配置
   */
  async initDefaultConfigs(): Promise<{ created: number; skipped: number }> {
    const defaults = [
      // 计费配置
      { key: 'billing.gas_fee_rate', value: 0.2, type: 'number', category: 'billing', label: '燃油费比例', isPublic: true },
      { key: 'billing.withdraw_fee_rate', value: 0.01, type: 'number', category: 'billing', label: '提现手续费', isPublic: true },
      { key: 'billing.min_withdraw', value: 10, type: 'number', category: 'billing', label: '最低提现金额', isPublic: true },
      { key: 'billing.points_to_usdt', value: 1, type: 'number', category: 'billing', label: '积分兑换比例', isPublic: true },

      // VIP 配置
      { key: 'vip.level_1_price', value: 25, type: 'number', category: 'vip', label: 'VIP1 月费', isPublic: true },
      { key: 'vip.level_2_price', value: 50, type: 'number', category: 'vip', label: 'VIP2 月费', isPublic: true },
      { key: 'vip.level_3_price', value: 100, type: 'number', category: 'vip', label: 'VIP3 月费', isPublic: true },
      { key: 'vip.level_1_vps_spec', value: '1vCPU/1GB', type: 'string', category: 'vip', label: 'VIP1 VPS 规格', isPublic: true },
      { key: 'vip.level_2_vps_spec', value: '2vCPU/2GB', type: 'string', category: 'vip', label: 'VIP2 VPS 规格', isPublic: true },
      { key: 'vip.level_3_vps_spec', value: '2vCPU/4GB', type: 'string', category: 'vip', label: 'VIP3 VPS 规格', isPublic: true },

      // 功能开关
      { key: 'feature.registration_enabled', value: true, type: 'boolean', category: 'feature', label: '开放注册', isPublic: true },
      { key: 'feature.withdraw_enabled', value: true, type: 'boolean', category: 'feature', label: '允许提现', isPublic: true },
      { key: 'feature.trading_enabled', value: true, type: 'boolean', category: 'feature', label: '允许交易', isPublic: true },
      { key: 'feature.new_instance_enabled', value: true, type: 'boolean', category: 'feature', label: '允许创建实例', isPublic: true },
      { key: 'feature.agent_enabled', value: true, type: 'boolean', category: 'feature', label: '代理商系统', isPublic: true },
      { key: 'feature.staking_enabled', value: true, type: 'boolean', category: 'feature', label: '质押功能', isPublic: true },

      // 代理商配置
      { key: 'agent.level_1_rate', value: 0.1, type: 'number', category: 'agent', label: '代理商一级返佣比例', isPublic: false },
      { key: 'agent.level_2_rate', value: 0.05, type: 'number', category: 'agent', label: '代理商二级返佣比例', isPublic: false },
      { key: 'agent.min_withdraw', value: 50, type: 'number', category: 'agent', label: '最低提佣金额', isPublic: false },
      { key: 'agent.default_commission_rate', value: 0.1, type: 'number', category: 'agent', label: '代理商默认佣金比例', isPublic: false },

      // 邀请返佣配置（普通用户）
      { key: 'referral.subscription_l1_rate', value: 0.1, type: 'number', category: 'referral', label: '订阅费一级返佣比例', description: '被邀请人订阅时，一级邀请人获得积分比例', isPublic: false },
      { key: 'referral.subscription_l2_rate', value: 0.05, type: 'number', category: 'referral', label: '订阅费二级返佣比例', description: '被邀请人订阅时，二级邀请人获得积分比例', isPublic: false },
      { key: 'referral.card_purchase_l1_rate', value: 0.1, type: 'number', category: 'referral', label: '点卡购买一级返佣比例', description: '被邀请人购买点卡时，一级邀请人获得积分比例', isPublic: false },
      { key: 'referral.card_purchase_l2_rate', value: 0.05, type: 'number', category: 'referral', label: '点卡购买二级返佣比例', description: '被邀请人购买点卡时，二级邀请人获得积分比例', isPublic: false },
      { key: 'referral.trade_points_l1_rate', value: 0.05, type: 'number', category: 'referral', label: '交易挖矿一级返佣比例', description: '被邀请人交易挖矿获得积分时，一级邀请人获得比例', isPublic: false },
      { key: 'referral.trade_points_l2_rate', value: 0.025, type: 'number', category: 'referral', label: '交易挖矿二级返佣比例', description: '被邀请人交易挖矿获得积分时，二级邀请人获得比例', isPublic: false },
      { key: 'referral.gas_fee_l1_rate', value: 0.1, type: 'number', category: 'referral', label: '燃油费一级返佣比例', description: '被邀请人盈利扣燃油费时，一级邀请人获得 USDT 比例', isPublic: false },
      { key: 'referral.gas_fee_l2_rate', value: 0.05, type: 'number', category: 'referral', label: '燃油费二级返佣比例', description: '被邀请人盈利扣燃油费时，二级邀请人获得 USDT 比例', isPublic: false },

      // 积分兑换配置
      { key: 'exchange.points_to_qfi_rate', value: 1000, type: 'number', category: 'exchange', label: '积分兑换QFI比例', description: '1000积分=1QFI', isPublic: true },
      { key: 'exchange.points_to_usdt_rate', value: 1, type: 'number', category: 'exchange', label: '积分抵扣USDT比例', description: '1积分=1USDT', isPublic: true },
      { key: 'exchange.min_exchange_points', value: 100, type: 'number', category: 'exchange', label: '最低兑换积分', isPublic: true },

      // 代币价格配置
      { key: 'token.qfi_price', value: 0.5, type: 'number', category: 'token', label: 'QFI 代币价格（USDT）', description: '当前 QFI 代币价格，用于分红计算', isPublic: true },
    ];

    let created = 0;
    let skipped = 0;

    for (const config of defaults) {
      const existing = await this.prisma.client.system_configs.findUnique({
        where: { config_key: config.key },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await this.prisma.client.system_configs.create({
        data: {
          config_key: config.key,
          config_value: String(config.value),
          config_type: config.type,
          category: config.category,
          label: config.label,
          is_public: config.isPublic,
        },
      });
      created++;
    }

    this.logger.log(`初始化配置完成: 创建 ${created}, 跳过 ${skipped}`);

    return { created, skipped };
  }

  /**
   * 清除缓存
   */
  private async clearCache(): Promise<void> {
    await this.redis.del(this.CACHE_KEY_PUBLIC);
    await this.redis.del(this.CACHE_KEY_ALL);
  }

  // ===== 返佣配置统一入口 =====

  /**
   * 默认返佣比例（仅在配置不存在时使用）
   */
  private readonly DEFAULT_REFERRAL_RATES: Record<ReferralRateType, { l1: Decimal; l2: Decimal }> = {
    subscription: { l1: new Decimal('0.10'), l2: new Decimal('0.05') },
    card_purchase: { l1: new Decimal('0.10'), l2: new Decimal('0.05') },
    trade_points: { l1: new Decimal('0.05'), l2: new Decimal('0.025') },
    gas_fee: { l1: new Decimal('0.10'), l2: new Decimal('0.05') }, // 燃油费返佣（USDT）
  };

  /**
   * 返佣配置键映射
   */
  private readonly REFERRAL_CONFIG_KEYS: Record<ReferralRateType, { l1: string; l2: string }> = {
    subscription: {
      l1: 'referral.subscription_l1_rate',
      l2: 'referral.subscription_l2_rate',
    },
    card_purchase: {
      l1: 'referral.card_purchase_l1_rate',
      l2: 'referral.card_purchase_l2_rate',
    },
    trade_points: {
      l1: 'referral.trade_points_l1_rate',
      l2: 'referral.trade_points_l2_rate',
    },
    gas_fee: {
      l1: 'referral.gas_fee_l1_rate',
      l2: 'referral.gas_fee_l2_rate',
    },
  };

  /**
   * 获取返佣比例（统一入口）
   * 从系统配置读取，如果配置不存在则使用默认值
   *
   * @param type 返佣类型：subscription | card_purchase | trade_points
   * @returns 一级和二级返佣比例
   *
   * @example
   * const rates = await configsService.getReferralRates('subscription');
   * const commission = amount.times(rates.l1); // 一级返佣
   */
  async getReferralRates(type: ReferralRateType): Promise<ReferralRates> {
    const keys = this.REFERRAL_CONFIG_KEYS[type];
    const defaults = this.DEFAULT_REFERRAL_RATES[type];

    const [l1Rate, l2Rate] = await Promise.all([
      this.getConfig(keys.l1),
      this.getConfig(keys.l2),
    ]);

    return {
      l1: l1Rate !== null ? new Decimal(l1Rate) : defaults.l1,
      l2: l2Rate !== null ? new Decimal(l2Rate) : defaults.l2,
    };
  }

  /**
   * 获取积分兑换配置
   * @returns 积分兑换相关配置
   */
  async getExchangeRates(): Promise<{
    pointsToQfi: Decimal;
    pointsToUsdt: Decimal;
    minExchangePoints: Decimal;
  }> {
    const [qfiRate, usdtRate, minPoints] = await Promise.all([
      this.getConfig('exchange.points_to_qfi_rate'),
      this.getConfig('exchange.points_to_usdt_rate'),
      this.getConfig('exchange.min_exchange_points'),
    ]);

    return {
      pointsToQfi: qfiRate !== null ? new Decimal(qfiRate) : new Decimal('1000'),
      pointsToUsdt: usdtRate !== null ? new Decimal(usdtRate) : new Decimal('1'),
      minExchangePoints: minPoints !== null ? new Decimal(minPoints) : new Decimal('100'),
    };
  }

  /**
   * 获取 QFI 代币价格（USDT）
   * 用于分红计算等场景
   * @returns QFI 价格（默认 $0.50）
   */
  async getQFIPrice(): Promise<Decimal> {
    const price = await this.getConfig('token.qfi_price');
    return price !== null ? new Decimal(price) : new Decimal('0.5');
  }
}
