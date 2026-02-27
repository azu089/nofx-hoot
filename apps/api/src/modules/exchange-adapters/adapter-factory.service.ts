/**
 * AdapterFactory — 适配器工厂服务
 *
 * 根据 ApiKey 记录的 authType + exchange 创建正确的 ExchangeAdapter 实例
 *
 * 映射关系：
 *   authType=api_key + exchange=binance     → CcxtAdapter (binanceusdm)
 *   authType=api_key + exchange=okx         → CcxtAdapter (okx)
 *   authType=api_key + exchange=bybit       → CcxtAdapter (bybit)
 *   authType=api_key + exchange=gate        → CcxtAdapter (gate)
 *   authType=api_key + exchange=bitget      → CcxtAdapter (bitget)
 *   authType=wallet  + exchange=hyperliquid → CcxtAdapter (hyperliquid, CCXT 原生支持)
 *   authType=wallet  + exchange=lighter     → LighterAdapter
 *   authType=wallet  + exchange=aster       → AsterAdapter
 */

import { Injectable, Logger, BadRequestException, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { ExchangeAdapter } from './types/adapter.interface';
import { SUPPORTED_CEX, SUPPORTED_DEX } from './types/exchange.types';
import { CcxtAdapter } from './adapters/ccxt.adapter';
import { LighterAdapter } from './adapters/lighter.adapter';
import { AsterAdapter } from './adapters/aster.adapter';

/** 缓存条目 */
interface CachedAdapter {
  adapter: ExchangeAdapter;
  lastUsed: number;
  /** 防止并发创建同一适配器 */
  initPromise?: Promise<ExchangeAdapter>;
}

/** 适配器缓存 TTL（10 分钟） */
const ADAPTER_CACHE_TTL = 10 * 60 * 1000;
/** 缓存清理间隔（2 分钟） */
const CLEANUP_INTERVAL = 2 * 60 * 1000;

@Injectable()
export class AdapterFactoryService implements OnModuleDestroy {
  private readonly logger = new Logger(AdapterFactoryService.name);

  /** userId:apiKeyId → CachedAdapter */
  private readonly adapterCache = new Map<string, CachedAdapter>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private prisma: PrismaService,
    private apiKeysService: ApiKeysService,
  ) {
    // 定期清理过期适配器
    this.cleanupTimer = setInterval(() => this.evictStale(), CLEANUP_INTERVAL);
  }

  async onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    // 销毁所有缓存的适配器
    const disposePromises: Promise<void>[] = [];
    for (const [key, cached] of this.adapterCache) {
      disposePromises.push(
        cached.adapter.dispose().catch((e: Error) =>
          this.logger.warn(`销毁适配器 ${key} 失败: ${e.message}`),
        ),
      );
    }
    await Promise.all(disposePromises);
    this.adapterCache.clear();
    this.logger.log(`已销毁 ${disposePromises.length} 个缓存适配器`);
  }

  /** 清除过期适配器 */
  private evictStale() {
    const now = Date.now();
    for (const [key, cached] of this.adapterCache) {
      if (now - cached.lastUsed > ADAPTER_CACHE_TTL) {
        cached.adapter.dispose().catch((e: Error) =>
          this.logger.warn(`清理适配器 ${key} 失败: ${e.message}`),
        );
        this.adapterCache.delete(key);
        this.logger.debug(`适配器缓存过期: ${key}`);
      }
    }
  }

  /** 手动移除某个适配器缓存（凭证变更时调用） */
  async invalidateAdapter(userId: string, apiKeyId: string): Promise<void> {
    const cacheKey = `${userId}:${apiKeyId}`;
    const cached = this.adapterCache.get(cacheKey);
    if (cached) {
      await cached.adapter.dispose().catch(() => {});
      this.adapterCache.delete(cacheKey);
      this.logger.log(`适配器缓存已失效: ${cacheKey.slice(0, 20)}...`);
    }
  }

  /**
   * 根据 userId + apiKeyId 创建适配器实例
   *
   * @param userId 用户 ID（权限校验）
   * @param apiKeyId API Key / DEX 凭证 ID
   * @returns 已初始化的 ExchangeAdapter 实例
   */
  async createAdapter(
    userId: string,
    apiKeyId: string,
  ): Promise<ExchangeAdapter> {
    const cacheKey = `${userId}:${apiKeyId}`;

    // 1. 检查缓存
    const cached = this.adapterCache.get(cacheKey);
    if (cached) {
      // 如果正在初始化中，等待初始化完成
      if (cached.initPromise) {
        return cached.initPromise;
      }
      // 验证缓存适配器是否仍可用（防止 dispose 后残留引用）
      if (cached.adapter && cached.adapter.isReady()) {
        cached.lastUsed = Date.now();
        this.logger.debug(`适配器缓存命中: ${cacheKey.slice(0, 20)}...`);
        return cached.adapter;
      }
      // 适配器已失效，清理并重新创建
      this.adapterCache.delete(cacheKey);
      this.logger.warn(`缓存适配器已失效，重新创建: ${cacheKey.slice(0, 20)}...`);
    }

    // 2. 查询 API Key 记录
    const record = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
    });

    if (!record) {
      throw new BadRequestException('API Key / DEX 凭证不存在');
    }

    if (record.userId !== userId) {
      throw new BadRequestException('无权使用此凭证');
    }

    if (!record.isActive) {
      throw new BadRequestException('凭证已禁用');
    }

    const exchange = record.exchange.toLowerCase();
    const authType = record.authType || 'api_key';

    this.logger.log(
      `创建适配器: exchange=${exchange}, authType=${authType}, userId=${userId.slice(0, 8)}...`,
    );

    // 3. 创建并缓存（使用 initPromise 防止并发重复创建）
    const initPromise = (async () => {
      let adapter: ExchangeAdapter;
      if (authType === 'wallet') {
        adapter = await this.createDexAdapter(userId, apiKeyId, exchange);
      } else {
        adapter = await this.createCexAdapter(userId, apiKeyId, exchange);
      }

      // 初始化完成，更新缓存条目
      const entry = this.adapterCache.get(cacheKey);
      if (entry) {
        entry.adapter = adapter;
        entry.initPromise = undefined;
      }
      return adapter;
    })();

    // 先占位缓存条目（含 initPromise）
    this.adapterCache.set(cacheKey, {
      adapter: null as any, // 初始化完成后替换
      lastUsed: Date.now(),
      initPromise,
    });

    try {
      const adapter = await initPromise;
      return adapter;
    } catch (error) {
      // 初始化失败，移除缓存占位
      this.adapterCache.delete(cacheKey);
      throw error;
    }
  }

  /**
   * 创建 CEX 适配器（CCXT）
   */
  private async createCexAdapter(
    userId: string,
    apiKeyId: string,
    exchange: string,
  ): Promise<ExchangeAdapter> {
    // 验证是 CEX 交易所
    if (!SUPPORTED_CEX.includes(exchange as any)) {
      throw new BadRequestException(`不支持的 CEX 交易所: ${exchange}`);
    }

    // 获取解密后的 API Key
    const credentials = await this.apiKeysService.getDecryptedApiKey(
      userId,
      apiKeyId,
    );

    const adapter = new CcxtAdapter({
      exchangeType: exchange,
      apiKey: credentials.apiKey,
      apiSecret: credentials.apiSecret,
      // OKX 等交易所需要 passphrase（CCXT 内部字段名为 password）
      passphrase: credentials.passphrase,
      isTestnet: false,
    });

    await adapter.initialize();
    return adapter;
  }

  /**
   * 创建 DEX 适配器
   */
  private async createDexAdapter(
    userId: string,
    apiKeyId: string,
    exchange: string,
  ): Promise<ExchangeAdapter> {
    // 验证是 DEX 交易所
    if (!SUPPORTED_DEX.includes(exchange as any)) {
      throw new BadRequestException(`不支持的 DEX 交易所: ${exchange}`);
    }

    // 获取解密后的 DEX 凭证
    const credentials = await this.apiKeysService.getDecryptedDexCredential(
      userId,
      apiKeyId,
    );

    switch (exchange) {
      case 'hyperliquid': {
        // Hyperliquid 使用 CCXT 原生支持
        const adapter = new CcxtAdapter({
          exchangeType: 'hyperliquid',
          walletAddress: credentials.walletAddress,
          privateKey: credentials.privateKey,
          isTestnet: credentials.isTestnet,
        });
        await adapter.initialize();
        return adapter;
      }

      case 'lighter': {
        if (!credentials.walletAddress) {
          throw new BadRequestException('Lighter 需要钱包地址');
        }
        if (!credentials.lighterApiKeyPrivateKey && !credentials.privateKey) {
          throw new BadRequestException('Lighter 需要 API Key 私钥');
        }
        const adapter = new LighterAdapter({
          walletAddress: credentials.walletAddress,
          apiKeyPrivateKey: (credentials.lighterApiKeyPrivateKey || credentials.privateKey)!,
          apiKeyIndex: credentials.lighterApiKeyIndex || 0,
          isTestnet: credentials.isTestnet,
        });
        await adapter.initialize();
        return adapter;
      }

      case 'aster': {
        if (!credentials.walletAddress) {
          throw new BadRequestException('Aster 需要钱包地址');
        }
        if (!credentials.privateKey) {
          throw new BadRequestException('Aster 需要签名私钥');
        }
        const adapter = new AsterAdapter({
          userAddress: credentials.walletAddress,
          signerAddress: credentials.asterSignerAddress || credentials.walletAddress,
          privateKey: credentials.privateKey,
          isTestnet: credentials.isTestnet,
        });
        await adapter.initialize();
        return adapter;
      }

      default:
        throw new BadRequestException(`未知的 DEX 交易所: ${exchange}`);
    }
  }
}
