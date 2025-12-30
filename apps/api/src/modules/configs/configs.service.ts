import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ConfigResponseDto, ConfigCategory } from './dto/config.dto';

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
      { key: 'agent.level_1_rate', value: 0.1, type: 'number', category: 'agent', label: '一级返佣比例', isPublic: false },
      { key: 'agent.level_2_rate', value: 0.05, type: 'number', category: 'agent', label: '二级返佣比例', isPublic: false },
      { key: 'agent.min_withdraw', value: 50, type: 'number', category: 'agent', label: '最低提佣金额', isPublic: false },
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
          config_value: config.value,
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
}
