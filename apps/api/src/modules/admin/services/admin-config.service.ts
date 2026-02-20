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
  'llm_platform_config',
];

// LLM 平台配置默认值（与 llm.service.ts 中的 modelCosts 保持一致）
const LLM_PLATFORM_CONFIG_DEFAULT = {
  providers: {
    deepseek:   { apiKey: '', enabled: true,  displayName: 'DeepSeek' },
    openai:     { apiKey: '', enabled: true,  displayName: 'OpenAI' },
    openrouter: { apiKey: '', enabled: true,  displayName: 'OpenRouter (Claude/Gemini)' },
    qwen:       { apiKey: '', enabled: false, displayName: 'Qwen (通义千问)' },
    grok:       { apiKey: '', enabled: false, displayName: 'Grok (xAI)' },
    kimi:       { apiKey: '', enabled: false, displayName: 'Kimi (Moonshot)' },
  },
  modelCosts: {
    'deepseek-chat':             { input: 0.14, output: 0.28 },
    'gpt-4o-mini':               { input: 0.15, output: 0.60 },
    'claude-3-5-haiku-20241022': { input: 1.0,  output: 5.0 },
    'gemini-2.0-flash':          { input: 0.10, output: 0.40 },
    'qwen-plus':                 { input: 0.80, output: 2.0 },
    'grok-2':                    { input: 2.0,  output: 10.0 },
    'moonshot-v1-8k':            { input: 0.17, output: 0.17 },
  },
};

// 各 key 的硬编码默认值
const DEFAULT_CONFIGS: Record<string, unknown> = {
  airdrop_rewards: AIRDROP_REWARDS,
  airdrop_caps: AIRDROP_CAPS,
  vesting_config: VESTING_CONFIG,
  pwa_install_enabled: true,
  ecosystem_page_enabled: false,
  llm_platform_config: LLM_PLATFORM_CONFIG_DEFAULT,
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

    let value: unknown;
    if (config) {
      try {
        value = JSON.parse(config.value);
      } catch {
        value = config.value;
      }
    } else {
      // 返回硬编码默认值
      value = DEFAULT_CONFIGS[key] ?? null;
    }

    // LLM 配置：对 apiKey 字段脱敏后返回
    if (key === 'llm_platform_config' && value && typeof value === 'object') {
      return this.maskLlmConfig(value as Record<string, unknown>);
    }

    return value;
  }

  // 更新配置 + 写操作日志
  async updateConfig(key: string, value: unknown, adminId: string) {
    if (!ALLOWED_CONFIG_KEYS.includes(key)) {
      throw new BadRequestException(`不支持的配置项: ${key}`);
    }

    // LLM 配置：若传入的 apiKey 包含 ****，则保留 DB 中的原始值（不覆盖）
    if (key === 'llm_platform_config' && value && typeof value === 'object') {
      value = await this.preserveOriginalApiKeys(value as Record<string, unknown>);
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

  /** API Key 脱敏：前 8 位 + **** */
  private maskApiKey(key: string): string {
    if (!key) return '';
    if (key.length < 8) return '****';
    return key.slice(0, 8) + '****';
  }

  /** 对 LLM 配置中所有 provider 的 apiKey 进行脱敏 */
  private maskLlmConfig(config: Record<string, unknown>): Record<string, unknown> {
    const cfg = config as { providers?: Record<string, { apiKey?: string; [k: string]: unknown }> };
    if (!cfg.providers) return config;
    const masked = { ...config, providers: { ...cfg.providers } } as {
      providers: Record<string, { apiKey?: string; [k: string]: unknown }>;
      [k: string]: unknown;
    };
    for (const [name, providerCfg] of Object.entries(masked.providers)) {
      if (providerCfg?.apiKey !== undefined) {
        masked.providers[name] = { ...providerCfg, apiKey: this.maskApiKey(providerCfg.apiKey || '') };
      }
    }
    return masked;
  }

  /** 若传入的 apiKey 包含 ****，则从 DB 读取原值保留（防止前端脱敏值覆盖真实 Key） */
  private async preserveOriginalApiKeys(newConfig: Record<string, unknown>): Promise<Record<string, unknown>> {
    const existing = await this.prisma.platformConfig.findUnique({
      where: { key: 'llm_platform_config' },
    });

    let originalProviders: Record<string, { apiKey?: string }> = {};
    if (existing?.value) {
      try {
        const parsed = JSON.parse(existing.value) as { providers?: Record<string, { apiKey?: string }> };
        originalProviders = parsed?.providers || {};
      } catch { /* ignore */ }
    }

    const cfg = newConfig as { providers?: Record<string, { apiKey?: string; [k: string]: unknown }> };
    if (!cfg.providers) return newConfig;

    const result = { ...newConfig, providers: { ...cfg.providers } } as {
      providers: Record<string, { apiKey?: string; [k: string]: unknown }>;
      [k: string]: unknown;
    };
    for (const [name, providerCfg] of Object.entries(result.providers)) {
      if (providerCfg?.apiKey?.includes('****')) {
        // 保留 DB 中存储的原始 Key
        result.providers[name] = { ...providerCfg, apiKey: originalProviders[name]?.apiKey || '' };
      }
    }

    return result;
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
