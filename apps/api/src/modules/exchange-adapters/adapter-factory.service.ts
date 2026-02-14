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

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { ExchangeAdapter } from './types/adapter.interface';
import { SUPPORTED_CEX, SUPPORTED_DEX } from './types/exchange.types';
import { CcxtAdapter } from './adapters/ccxt.adapter';
import { LighterAdapter } from './adapters/lighter.adapter';
import { AsterAdapter } from './adapters/aster.adapter';

@Injectable()
export class AdapterFactoryService {
  private readonly logger = new Logger(AdapterFactoryService.name);

  constructor(
    private prisma: PrismaService,
    private apiKeysService: ApiKeysService,
  ) {}

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
    // 1. 查询 API Key 记录
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

    // 2. 根据 authType + exchange 分发
    if (authType === 'wallet') {
      return this.createDexAdapter(userId, apiKeyId, exchange);
    } else {
      return this.createCexAdapter(userId, apiKeyId, exchange);
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
