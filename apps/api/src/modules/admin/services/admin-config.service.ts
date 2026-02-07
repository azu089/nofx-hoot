/**
 * 管理后台 - 系统配置管理服务
 * 读写 PlatformConfig 表（key-value），记录变更历史
 */
import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AIRDROP_REWARDS,
  AIRDROP_CAPS,
  VESTING_CONFIG,
} from '../../airdrop/dto/airdrop.dto';

// 允许管理的配置 key 白名单
const ALLOWED_CONFIG_KEYS = [
  'airdrop_rewards',
  'airdrop_caps',
  'vesting_config',
  'pwa_install_enabled',
  'ecosystem_page_enabled',
];

// 各 key 的硬编码默认值
const DEFAULT_CONFIGS: Record<string, unknown> = {
  airdrop_rewards: AIRDROP_REWARDS,
  airdrop_caps: AIRDROP_CAPS,
  vesting_config: VESTING_CONFIG,
  pwa_install_enabled: true,
  ecosystem_page_enabled: false,
};

@Injectable()
export class AdminConfigService {
  private readonly logger = new Logger(AdminConfigService.name);

  constructor(private prisma: PrismaService) {}

  // 获取配置（DB 优先，硬编码兜底）
  async getConfig(key: string) {
    if (!ALLOWED_CONFIG_KEYS.includes(key)) {
      throw new BadRequestException(`不支持的配置项: ${key}`);
    }

    const config = await this.prisma.platformConfig.findUnique({
      where: { key },
    });

    if (config) {
      try {
        return JSON.parse(config.value);
      } catch {
        return config.value;
      }
    }

    // 返回硬编码默认值
    return DEFAULT_CONFIGS[key] ?? null;
  }

  // 更新配置 + 写操作日志
  async updateConfig(key: string, value: unknown, adminId: string) {
    if (!ALLOWED_CONFIG_KEYS.includes(key)) {
      throw new BadRequestException(`不支持的配置项: ${key}`);
    }

    const valueStr = JSON.stringify(value);

    // 读取旧值用于日志
    const oldConfig = await this.prisma.platformConfig.findUnique({
      where: { key },
    });
    const oldValue = oldConfig?.value || JSON.stringify(DEFAULT_CONFIGS[key]);

    // Upsert 配置
    await this.prisma.platformConfig.upsert({
      where: { key },
      update: {
        value: valueStr,
        updatedBy: adminId,
      },
      create: {
        id: key, // 用 key 作为 id
        key,
        value: valueStr,
        description: `系统配置: ${key}`,
        updatedBy: adminId,
      },
    });

    // 写操作日志
    await this.prisma.adminOperationLog.create({
      data: {
        adminId,
        action: 'update',
        module: 'config',
        targetId: key,
        description: `更新配置: ${key}`,
        details: JSON.stringify({
          key,
          oldValue,
          newValue: valueStr,
        }),
        ipAddress: '',
      },
    });

    this.logger.log(`配置更新: ${key} by admin ${adminId}`);
    return { success: true, key };
  }

  // 获取配置变更历史
  async getConfigHistory(limit: number = 20) {
    const logs = await this.prisma.adminOperationLog.findMany({
      where: {
        module: 'config',
        action: 'update',
      },
      include: {
        admin: {
          select: { id: true, username: true, nickname: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id,
      key: log.targetId,
      description: log.description,
      details: log.details ? JSON.parse(log.details as string) : null,
      admin: log.admin,
      createdAt: log.createdAt,
    }));
  }
}
