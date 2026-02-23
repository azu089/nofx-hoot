import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { encrypt, decrypt, maskApiKey } from '../../common/utils/crypto.util';
import {
  CreateApiKeyDto,
  CreateDexCredentialDto,
  UpdateApiKeyDto,
  ApiKeyResponse,
  ApiKeyListResponse,
  SUPPORTED_DEX_EXCHANGES,
} from './dto/api-key.dto';
import * as ccxt from 'ccxt';

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);
  constructor(private prisma: PrismaService) {}

  // 创建 API Key（先验证再存储）
  async create(userId: string, dto: CreateApiKeyDto): Promise<ApiKeyResponse> {
    // 1. 先验证 API Key 是否有效
    const validation = await this.validateApiKeyBeforeCreate(
      dto.exchange,
      dto.apiKey,
      dto.apiSecret,
    );

    if (!validation.valid) {
      throw new BadRequestException(
        validation.error || 'API Key 验证失败，请检查密钥是否正确',
      );
    }

    // 2. 验证通过后再加密存储
    const encryptedKey = encrypt(dto.apiKey);
    const encryptedSecret = encrypt(dto.apiSecret);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId,
        exchange: dto.exchange,
        label: dto.label,
        encryptedKey: encryptedKey.encryptedData,
        encryptedSecret: encryptedSecret.encryptedData,
        iv: encryptedKey.iv,
        authTag: encryptedKey.authTag,
        secretIv: encryptedSecret.iv,
        secretAuthTag: encryptedSecret.authTag,
      },
    });

    return {
      id: apiKey.id,
      exchange: apiKey.exchange,
      label: apiKey.label,
      maskedKey: maskApiKey(dto.apiKey),
      isActive: apiKey.isActive,
      createdAt: apiKey.createdAt,
    };
  }

  // 创建 DEX 凭证（钱包地址 + 加密私钥）
  async createDexCredential(
    userId: string,
    dto: CreateDexCredentialDto,
  ): Promise<ApiKeyResponse> {
    // 1. 验证交易所专属必填字段
    switch (dto.exchange) {
      case 'hyperliquid':
        if (!dto.walletAddress || !dto.privateKey) {
          throw new BadRequestException(
            'Hyperliquid 需要提供钱包地址和 Agent 私钥',
          );
        }
        break;
      case 'lighter':
        if (
          !dto.walletAddress ||
          !dto.privateKey ||
          !dto.lighterApiKeyPrivateKey ||
          dto.lighterApiKeyIndex === undefined
        ) {
          throw new BadRequestException(
            'Lighter 需要提供钱包地址、钱包私钥、API Key 私钥和 Key 索引',
          );
        }
        break;
      case 'aster':
        if (
          !dto.asterUserAddress ||
          !dto.asterSignerAddress ||
          !dto.privateKey
        ) {
          throw new BadRequestException(
            'Aster 需要提供用户钱包地址、签名钱包地址和签名私钥',
          );
        }
        break;
      default:
        throw new BadRequestException(`Unsupported DEX exchange: ${dto.exchange}`);
    }

    // 2. 构建存储数据（使用 Prisma.ApiKeyUncheckedCreateInput 构建动态字段）
    const data: Prisma.ApiKeyUncheckedCreateInput = {
      userId,
      exchange: dto.exchange,
      label: dto.label,
      encryptedKey: '',   // DEX 凭证不使用 API Key，填空字符串占位
      encryptedSecret: '',
      iv: '',
      authTag: '',
      authType: 'wallet',
      isTestnet: dto.isTestnet || false,
    };

    // 钱包地址（公开，不加密）
    if (dto.walletAddress) {
      data.walletAddress = dto.walletAddress;
    }
    // Aster 的用户钱包地址存到 walletAddress
    if (dto.asterUserAddress) {
      data.walletAddress = dto.asterUserAddress;
    }
    if (dto.asterSignerAddress) {
      data.asterSignerAddress = dto.asterSignerAddress;
    }

    // 3. 加密主私钥（Agent 私钥 / 钱包私钥 / 签名私钥）
    if (dto.privateKey) {
      const encrypted = encrypt(dto.privateKey);
      data.encryptedPrivateKey = encrypted.encryptedData;
      data.privateKeyIv = encrypted.iv;
      data.privateKeyAuthTag = encrypted.authTag;
    }

    // 4. 加密 Lighter API Key 私钥
    if (dto.lighterApiKeyPrivateKey) {
      const encrypted = encrypt(dto.lighterApiKeyPrivateKey);
      data.lighterApiKeyEncrypted = encrypted.encryptedData;
      data.lighterApiKeyIv = encrypted.iv;
      data.lighterApiKeyAuthTag = encrypted.authTag;
      data.lighterApiKeyIndex = dto.lighterApiKeyIndex;
    }

    const record = await this.prisma.apiKey.create({ data });

    const displayAddress =
      dto.walletAddress || dto.asterUserAddress || '';

    return {
      id: record.id,
      exchange: record.exchange,
      label: record.label,
      maskedKey: displayAddress ? maskApiKey(displayAddress) : '****',
      isActive: record.isActive,
      createdAt: record.createdAt,
      authType: 'wallet',
      isTestnet: dto.isTestnet || false,
      walletAddress: displayAddress,
    };
  }

  // 获取用户的 API Key 列表
  async findAll(userId: string): Promise<ApiKeyListResponse> {
    const [items, total] = await Promise.all([
      this.prisma.apiKey.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.apiKey.count({ where: { userId } }),
    ]);

    return {
      items: items.map((item) => {
        const isDex = item.authType === 'wallet';
        return {
          id: item.id,
          exchange: item.exchange,
          label: item.label,
          maskedKey: isDex
            ? item.walletAddress
              ? maskApiKey(item.walletAddress)
              : '****'
            : '****' + item.encryptedKey.slice(-4),
          isActive: item.isActive,
          createdAt: item.createdAt,
          authType: item.authType || 'api_key',
          isTestnet: item.isTestnet || false,
          walletAddress: isDex ? (item.walletAddress || undefined) : undefined,
        };
      }),
      total,
    };
  }

  // 更新 API Key
  async update(
    userId: string,
    id: string,
    dto: UpdateApiKeyDto,
  ): Promise<ApiKeyResponse> {
    const record = await this.prisma.apiKey.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException('API Key 不存在');
    }

    if (record.userId !== userId) {
      throw new ForbiddenException('无权修改此 API Key');
    }

    const updateData: Prisma.ApiKeyUpdateInput = {};

    // 更新 label
    if (dto.label !== undefined) {
      updateData.label = dto.label;
    }

    // 如果提供了新的 API Key 和 Secret，需要先验证再更新
    if (dto.apiKey && dto.apiSecret) {
      // 验证新的 API Key
      const validation = await this.validateApiKeyBeforeCreate(
        record.exchange,
        dto.apiKey,
        dto.apiSecret,
      );

      if (!validation.valid) {
        throw new BadRequestException(validation.error || 'API Key 验证失败');
      }

      // 加密新的 API Key 和 Secret
      const encryptedKey = encrypt(dto.apiKey);
      const encryptedSecret = encrypt(dto.apiSecret);

      updateData.encryptedKey = encryptedKey.encryptedData;
      updateData.iv = encryptedKey.iv;
      updateData.authTag = encryptedKey.authTag;
      updateData.encryptedSecret = encryptedSecret.encryptedData;
      updateData.secretIv = encryptedSecret.iv;
      updateData.secretAuthTag = encryptedSecret.authTag;
    }

    // 只有有更新内容时才执行更新
    if (Object.keys(updateData).length === 0) {
      // 没有更新内容，直接返回原数据
      return {
        id: record.id,
        exchange: record.exchange,
        label: record.label,
        maskedKey: '****' + record.encryptedKey.slice(-4),
        isActive: record.isActive,
        createdAt: record.createdAt,
      };
    }

    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: updateData,
    });

    return {
      id: updated.id,
      exchange: updated.exchange,
      label: updated.label,
      maskedKey: dto.apiKey
        ? maskApiKey(dto.apiKey)
        : '****' + updated.encryptedKey.slice(-4),
      isActive: updated.isActive,
      createdAt: updated.createdAt,
    };
  }

  // 删除 API Key
  async delete(userId: string, id: string): Promise<void> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id },
    });

    if (!apiKey) {
      throw new NotFoundException('API Key 不存在');
    }

    if (apiKey.userId !== userId) {
      throw new ForbiddenException('无权删除此 API Key');
    }

    await this.prisma.apiKey.delete({ where: { id } });
  }

  // 内部方法：获取解密后的 API Key（供交易模块使用）
  async getDecryptedApiKey(
    userId: string,
    apiKeyId: string,
  ): Promise<{ apiKey: string; apiSecret: string; exchange: string }> {
    const record = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
    });

    if (!record) {
      throw new NotFoundException('API Key 不存在');
    }

    if (record.userId !== userId) {
      throw new ForbiddenException('无权使用此 API Key');
    }

    if (!record.isActive) {
      throw new ForbiddenException('API Key 已禁用');
    }

    // 解密
    const apiKey = decrypt({
      encryptedData: record.encryptedKey,
      iv: record.iv,
      authTag: record.authTag,
    });

    // Secret 使用独立的 IV 和 authTag（兼容旧数据）
    const apiSecret = decrypt({
      encryptedData: record.encryptedSecret,
      iv: record.secretIv || record.iv,
      authTag: record.secretAuthTag || record.authTag,
    });

    return {
      apiKey,
      apiSecret,
      exchange: record.exchange,
    };
  }

  // 内部方法：获取解密后的 DEX 凭证（供适配器工厂使用）
  async getDecryptedDexCredential(
    userId: string,
    apiKeyId: string,
  ): Promise<{
    exchange: string;
    walletAddress?: string;
    privateKey?: string;
    lighterApiKeyPrivateKey?: string;
    lighterApiKeyIndex?: number;
    asterSignerAddress?: string;
    isTestnet: boolean;
  }> {
    const record = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
    });

    if (!record) {
      throw new NotFoundException('DEX 凭证不存在');
    }

    if (record.userId !== userId) {
      throw new ForbiddenException('无权使用此 DEX 凭证');
    }

    if (!record.isActive) {
      throw new ForbiddenException('DEX 凭证已禁用');
    }

    if (record.authType !== 'wallet') {
      throw new BadRequestException('此记录不是 DEX 凭证');
    }

    const result: {
      exchange: string;
      walletAddress?: string;
      isTestnet: boolean;
      privateKey?: string;
      lighterApiKeyPrivateKey?: string;
      lighterApiKeyIndex?: number;
      asterSignerAddress?: string;
    } = {
      exchange: record.exchange,
      walletAddress: record.walletAddress || undefined,
      isTestnet: record.isTestnet,
    };

    // 解密主私钥
    if (record.encryptedPrivateKey && record.privateKeyIv && record.privateKeyAuthTag) {
      result.privateKey = decrypt({
        encryptedData: record.encryptedPrivateKey,
        iv: record.privateKeyIv,
        authTag: record.privateKeyAuthTag,
      });
    }

    // 解密 Lighter API Key 私钥
    if (record.lighterApiKeyEncrypted && record.lighterApiKeyIv && record.lighterApiKeyAuthTag) {
      result.lighterApiKeyPrivateKey = decrypt({
        encryptedData: record.lighterApiKeyEncrypted,
        iv: record.lighterApiKeyIv,
        authTag: record.lighterApiKeyAuthTag,
      });
      result.lighterApiKeyIndex = record.lighterApiKeyIndex ?? undefined;
    }

    // Aster 签名钱包地址（公开，无需解密）
    if (record.asterSignerAddress) {
      result.asterSignerAddress = record.asterSignerAddress;
    }

    return result;
  }

  // 创建前验证 API Key（不需要先存储）
  private async validateApiKeyBeforeCreate(
    exchange: string,
    apiKey: string,
    apiSecret: string,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // 创建 CCXT 交易所实例
      const exchangeClass = ccxt[exchange.toLowerCase()];
      if (!exchangeClass) {
        return { valid: false, error: `不支持的交易所: ${exchange}` };
      }

      const ex = new exchangeClass({
        apiKey,
        secret: apiSecret,
        enableRateLimit: true,
        timeout: 10000, // 10秒超时
        options: {
          defaultType: 'spot',
        },
      });

      // 尝试获取账户余额来验证 API Key 是否有效
      await ex.fetchBalance();

      return { valid: true };
    } catch (error: any) {
      // 解析 CCXT 错误
      let errorMessage = 'API Key 验证失败';
      if (error instanceof ccxt.AuthenticationError) {
        errorMessage = 'API Key 或 Secret 无效，请检查是否正确';
      } else if (error instanceof ccxt.PermissionDenied) {
        errorMessage = 'API Key 权限不足，请确保开启了读取权限';
      } else if (error instanceof ccxt.NetworkError) {
        errorMessage = '网络连接失败，请稍后重试';
      } else if (error instanceof ccxt.ExchangeError) {
        errorMessage = `交易所返回错误: ${error.message}`;
      }

      return { valid: false, error: errorMessage };
    }
  }

  // 验证 API Key 并获取余额（现货 + 合约）- 优化版：并行执行
  async verifyApiKey(
    userId: string,
    apiKeyId: string,
  ): Promise<{
    valid: boolean;
    permissions: string[];
    balances: {
      symbol: string;
      free: number;
      total: number;
      type: string;
      usdValue?: number;
    }[];
    totalUsdValue: number;
    spotValue: number;
    futuresValue: number;
    freeUsdValue: number;
    spotFreeValue: number;
    futuresFreeValue: number;
    error?: string;
  }> {
    try {
      const { apiKey, apiSecret, exchange } = await this.getDecryptedApiKey(
        userId,
        apiKeyId,
      );

      // 创建 CCXT 交易所实例
      const exchangeClass = ccxt[exchange.toLowerCase()];
      if (!exchangeClass) {
        throw new BadRequestException(`不支持的交易所: ${exchange}`);
      }

      const allBalances: {
        symbol: string;
        free: number;
        total: number;
        type: string;
        usdValue?: number;
      }[] = [];
      let spotValue = 0;
      let futuresValue = 0;
      let spotFreeValue = 0;
      let futuresFreeValue = 0;
      const permissions: string[] = ['读取账户'];

      // 创建现货交易所实例
      const spotEx = new exchangeClass({
        apiKey,
        secret: apiSecret,
        enableRateLimit: true,
        options: { defaultType: 'spot' },
      });

      // 创建合约交易所实例
      // 注意：不同交易所有不同的合约配置方式
      const exchangeLower = exchange.toLowerCase();
      let futuresEx: ccxt.Exchange | null = null;

      // 不支持合约的交易所
      const spotOnlyExchanges = ['coinbase', 'kraken'];

      if (spotOnlyExchanges.includes(exchangeLower)) {
        // 这些交易所不支持合约，跳过合约配置
        futuresEx = null;
        this.logger.debug(`${exchange} 不支持合约交易`);
      } else if (exchangeLower === 'binance') {
        // Binance USDT-M 合约使用独立的交易所类
        // 这会自动使用 fapi.binance.com 端点
        futuresEx = new ccxt.binanceusdm({
          apiKey,
          secret: apiSecret,
          enableRateLimit: true,
        });
      } else if (exchangeLower === 'bybit') {
        // Bybit 使用 linear 类型 (USDT 永续)
        futuresEx = new exchangeClass({
          apiKey,
          secret: apiSecret,
          enableRateLimit: true,
          options: { defaultType: 'linear' },
        });
      } else if (exchangeLower === 'okx') {
        // OKX 使用 swap 类型
        futuresEx = new exchangeClass({
          apiKey,
          secret: apiSecret,
          enableRateLimit: true,
          options: { defaultType: 'swap' },
        });
      } else if (exchangeLower === 'gate') {
        // Gate.io 使用 swap 类型
        futuresEx = new exchangeClass({
          apiKey,
          secret: apiSecret,
          enableRateLimit: true,
          options: { defaultType: 'swap' },
        });
      } else if (exchangeLower === 'bitget') {
        // Bitget 使用 swap 类型
        futuresEx = new exchangeClass({
          apiKey,
          secret: apiSecret,
          enableRateLimit: true,
          options: { defaultType: 'swap' },
        });
      } else {
        // 其他交易所默认使用 swap 类型
        futuresEx = new exchangeClass({
          apiKey,
          secret: apiSecret,
          enableRateLimit: true,
          options: { defaultType: 'swap' },
        });
      }

      // ===== 第一步：并行获取余额和价格 =====
      // 有独立资金账户的交易所白名单（Gate.io funding→spot 会双重计算，Bitget 无映射）
      const fundingSupportedExchanges = ['binance', 'bybit', 'okx'];

      const fetchPromises: Promise<any>[] = [
        // 现货余额
        spotEx.fetchBalance(),
        // 合约余额（如果支持）
        futuresEx
          ? futuresEx.loadMarkets().then(() => futuresEx!.fetchBalance())
          : Promise.resolve(null),
        // 资金账户余额（仅 Binance/Bybit/OKX 有独立 funding 钱包）
        fundingSupportedExchanges.includes(exchangeLower)
          ? spotEx.fetchBalance({ type: 'funding' }).catch(() => null)
          : Promise.resolve(null),
        // 主流币价格
        spotEx.fetchTicker('BTC/USDT'),
        spotEx.fetchTicker('ETH/USDT'),
        spotEx.fetchTicker('BNB/USDT').catch(() => null),
        spotEx.fetchTicker('SOL/USDT').catch(() => null),
      ];

      const [spotResult, futuresResult, fundingResult, btcTickerResult, ethTickerResult, bnbTickerResult, solTickerResult] =
        await Promise.allSettled(fetchPromises);

      // 解析价格
      const btcPrice =
        btcTickerResult.status === 'fulfilled'
          ? btcTickerResult.value.last || 0
          : 0;
      const ethPrice =
        ethTickerResult.status === 'fulfilled'
          ? ethTickerResult.value.last || 0
          : 0;
      const bnbPrice =
        bnbTickerResult.status === 'fulfilled' && bnbTickerResult.value
          ? bnbTickerResult.value.last || 0
          : 0;
      const solPrice =
        solTickerResult.status === 'fulfilled' && solTickerResult.value
          ? solTickerResult.value.last || 0
          : 0;

      // USD 估值公用函数（消除重复）
      const calcUsdValue = (symbol: string, amount: number): number => {
        if (['USDT', 'USD', 'BUSD', 'USDC'].includes(symbol)) return amount;
        if (symbol === 'BTC' && btcPrice > 0) return amount * btcPrice;
        if (symbol === 'ETH' && ethPrice > 0) return amount * ethPrice;
        if (symbol === 'BNB' && bnbPrice > 0) return amount * bnbPrice;
        if (symbol === 'SOL' && solPrice > 0) return amount * solPrice;
        return 0;
      };

      // 处理现货余额
      if (spotResult.status === 'fulfilled') {
        const spotBalance = spotResult.value;
        for (const [symbol, total] of Object.entries(spotBalance.total)) {
          if ((total as number) > 0) {
            const usdValue = calcUsdValue(symbol, total as number);
            const freeAmt = spotBalance.free[symbol] || 0;
            spotValue += usdValue;
            spotFreeValue += calcUsdValue(symbol, freeAmt);
            allBalances.push({
              symbol,
              free: freeAmt,
              total: total as number,
              type: 'spot',
              usdValue,
            });
          }
        }
      } else {
        this.logger.debug('获取现货余额失败:', spotResult.reason?.message);
      }

      // 处理合约余额（仅当交易所支持合约时）
      if (futuresEx && futuresResult.status === 'fulfilled' && futuresResult.value) {
        const futuresBalance = futuresResult.value;
        for (const [symbol, total] of Object.entries(futuresBalance.total)) {
          if ((total as number) > 0) {
            const usdValue = calcUsdValue(symbol, total as number);
            const freeAmt = futuresBalance.free[symbol] || 0;
            futuresValue += usdValue;
            futuresFreeValue += calcUsdValue(symbol, freeAmt);
            allBalances.push({
              symbol,
              free: freeAmt,
              total: total as number,
              type: 'futures',
              usdValue,
            });
          }
        }
      } else if (futuresEx && futuresResult.status === 'rejected') {
        this.logger.debug('获取合约余额失败:', futuresResult.reason?.message);
      }

      // 处理资金账户余额（Funding）— 仅 Binance/Bybit/OKX
      if (fundingResult.status === 'fulfilled' && fundingResult.value) {
        const fundingBalance = fundingResult.value;
        for (const [symbol, total] of Object.entries(fundingBalance.total)) {
          if ((total as number) > 0) {
            const amount = total as number;
            const usdValue = calcUsdValue(symbol, amount);
            const existing = allBalances.find(b => b.symbol === symbol);
            if (existing) {
              // 合并到已有记录，同步更新 usdValue
              existing.total += amount;
              existing.free += fundingBalance.free[symbol] || 0;
              existing.usdValue = (existing.usdValue || 0) + usdValue;
              spotValue += usdValue;
            } else {
              spotValue += usdValue;
              allBalances.push({
                symbol,
                free: fundingBalance.free[symbol] || 0,
                total: amount,
                type: 'funding',
                usdValue,
              });
            }
          }
        }
      }

      // ===== 第二步：并行检测交易权限 =====
      // 注意：即使余额获取失败，也尝试检测权限
      // 余额获取失败可能是因为：账户余额为0、网络问题、限流等
      // 这些不影响我们检测 API Key 是否有交易权限

      // 构建权限检测请求
      const permissionPromises: Promise<boolean>[] = [
        // 检查现货交易权限
        this.checkSpotTradePermission(spotEx),
      ];

      // 只有支持合约的交易所才检测合约权限
      if (futuresEx) {
        permissionPromises.push(this.checkFuturesTradePermission(futuresEx));
      }

      const permResults = await Promise.allSettled(permissionPromises);

      // 处理现货权限
      if (permResults[0].status === 'fulfilled' && permResults[0].value === true) {
        permissions.push('现货交易');
      }

      // 处理合约权限（仅当交易所支持合约时）
      if (futuresEx && permResults[1]?.status === 'fulfilled' && permResults[1].value === true) {
        permissions.push('合约交易');
      }

      const totalUsdValue = spotValue + futuresValue;

      return {
        valid: true,
        permissions,
        balances: allBalances,
        totalUsdValue,
        spotValue,
        futuresValue,
        freeUsdValue: spotFreeValue + futuresFreeValue,
        spotFreeValue,
        futuresFreeValue,
      };
    } catch (error: any) {
      // 解析 CCXT 错误
      let errorMessage = error.message || '验证失败';
      if (error instanceof ccxt.AuthenticationError) {
        errorMessage = 'API Key 或 Secret 无效';
      } else if (error instanceof ccxt.PermissionDenied) {
        errorMessage = 'API Key 权限不足';
      } else if (error instanceof ccxt.NetworkError) {
        errorMessage = '网络连接失败，请稍后重试';
      }

      return {
        valid: false,
        permissions: [],
        balances: [],
        totalUsdValue: 0,
        spotValue: 0,
        futuresValue: 0,
        freeUsdValue: 0,
        spotFreeValue: 0,
        futuresFreeValue: 0,
        error: errorMessage,
      };
    }
  }

  // 检查现货交易权限
  private async checkSpotTradePermission(
    spotEx: ccxt.Exchange,
  ): Promise<boolean> {
    try {
      await spotEx.fetchOpenOrders('BTC/USDT');
      return true;
    } catch (e1: any) {
      if (e1 instanceof ccxt.PermissionDenied) {
        return false;
      }
      // 尝试无参数调用
      try {
        await spotEx.fetchOpenOrders();
        return true;
      } catch (e2: any) {
        // 如果不是权限错误，假设有权限
        return !(e2 instanceof ccxt.PermissionDenied);
      }
    }
  }

  // 检查合约交易权限
  // 策略：
  // 1. 先尝试直接获取余额/持仓
  // 2. 如果遇到 PermissionDenied 或 Binance -2015 错误，确定无权限
  // 3. 其他错误（网络、超时等）不确定，默认假设有权限
  private async checkFuturesTradePermission(
    futuresEx: ccxt.Exchange,
  ): Promise<boolean> {
    // 检查是否是明确的"无权限"错误
    const isPermissionError = (e: any): boolean => {
      // CCXT 的 PermissionDenied 错误
      if (e instanceof ccxt.PermissionDenied) return true;
      // Binance 特定的错误码
      // -2015: Invalid API-key, IP, or permissions for action
      // -1002: 无效的 API key
      // -1003: 请求过多（限流）- 这不是权限问题
      if (e.message?.includes('-2015')) return true;
      if (e.message?.includes('-1002')) return true;
      return false;
    };

    // 确保市场数据已加载
    try {
      if (!futuresEx.markets || Object.keys(futuresEx.markets).length === 0) {
        await futuresEx.loadMarkets();
      }
    } catch (e: any) {
      this.logger.debug('合约权限检测: 加载市场失败:', e.message);
      // 如果是权限错误，直接返回 false
      if (isPermissionError(e)) {
        this.logger.debug('合约权限检测: 市场加载失败 - 无权限');
        return false;
      }
      // 其他错误，继续尝试
    }

    // 方法1: 尝试获取余额（最基础的操作）
    try {
      await futuresEx.fetchBalance();
      // 能获取余额，说明有基本的合约账户访问权限
      this.logger.debug('合约权限检测: fetchBalance 成功');
      return true;
    } catch (e: any) {
      if (isPermissionError(e)) {
        this.logger.debug('合约权限检测: fetchBalance 权限被拒绝');
        return false;
      }
      this.logger.debug('合约权限检测: fetchBalance 失败:', e.message);
    }

    // 方法2: 尝试获取持仓
    if (futuresEx.has['fetchPositions']) {
      try {
        await futuresEx.fetchPositions();
        this.logger.debug('合约权限检测: fetchPositions 成功');
        return true;
      } catch (e: any) {
        if (isPermissionError(e)) {
          this.logger.debug('合约权限检测: fetchPositions 权限被拒绝');
          return false;
        }
        this.logger.debug('合约权限检测: fetchPositions 失败:', e.message);
      }
    }

    // 方法3: 尝试获取订单列表
    try {
      // 使用常用的合约交易对
      const symbol = 'BTC/USDT:USDT';
      await futuresEx.fetchOpenOrders(symbol);
      this.logger.debug('合约权限检测: fetchOpenOrders 成功');
      return true;
    } catch (e: any) {
      if (isPermissionError(e)) {
        this.logger.debug('合约权限检测: fetchOpenOrders 权限被拒绝');
        return false;
      }
      this.logger.debug('合约权限检测: fetchOpenOrders 失败:', e.message);
    }

    // 如果所有方法都失败了但没有收到明确的权限拒绝
    // 保守起见返回 false，因为我们无法确认有权限
    this.logger.debug('合约权限检测: 所有方法失败，无法确认权限');
    return false;
  }
}
