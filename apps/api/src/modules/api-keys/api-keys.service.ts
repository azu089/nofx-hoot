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
    // 1. 先验证 API Key 是否有效（网络错误时放行，让用户通过"验证"按钮自行确认）
    const validation = await this.validateApiKeyBeforeCreate(
      dto.exchange,
      dto.apiKey,
      dto.apiSecret,
      dto.passphrase,
    );

    if (!validation.valid && !validation.networkError) {
      throw new BadRequestException(
        validation.error || 'API Key 验证失败，请检查密钥是否正确',
      );
    }

    // 2. 验证通过后再加密存储
    const encryptedKey = encrypt(dto.apiKey);
    const encryptedSecret = encrypt(dto.apiSecret);

    // OKX 等交易所的 passphrase 加密存储
    let passphraseData: {
      encryptedPassphrase?: string;
      passphraseIv?: string;
      passphraseAuthTag?: string;
    } = {};
    if (dto.passphrase) {
      const encryptedPassphrase = encrypt(dto.passphrase);
      passphraseData = {
        encryptedPassphrase: encryptedPassphrase.encryptedData,
        passphraseIv: encryptedPassphrase.iv,
        passphraseAuthTag: encryptedPassphrase.authTag,
      };
    }

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
        ...passphraseData,
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
      // 验证新的 API Key（含 passphrase）
      const validation = await this.validateApiKeyBeforeCreate(
        record.exchange,
        dto.apiKey,
        dto.apiSecret,
        dto.passphrase,
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

    // 更新 passphrase（传空字符串表示清除）
    if (dto.passphrase !== undefined) {
      if (dto.passphrase === '') {
        updateData.encryptedPassphrase = null;
        updateData.passphraseIv = null;
        updateData.passphraseAuthTag = null;
      } else {
        const encryptedPassphrase = encrypt(dto.passphrase);
        updateData.encryptedPassphrase = encryptedPassphrase.encryptedData;
        updateData.passphraseIv = encryptedPassphrase.iv;
        updateData.passphraseAuthTag = encryptedPassphrase.authTag;
      }
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
  ): Promise<{ apiKey: string; apiSecret: string; exchange: string; passphrase?: string }> {
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

    // OKX 等交易所的 passphrase 解密（可选字段）
    let passphrase: string | undefined;
    if (record.encryptedPassphrase && record.passphraseIv && record.passphraseAuthTag) {
      passphrase = decrypt({
        encryptedData: record.encryptedPassphrase,
        iv: record.passphraseIv,
        authTag: record.passphraseAuthTag,
      });
    }

    return {
      apiKey,
      apiSecret,
      exchange: record.exchange,
      passphrase,
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
    passphrase?: string,
  ): Promise<{ valid: boolean; networkError?: boolean; error?: string }> {
    try {
      // 创建 CCXT 交易所实例
      const exchangeClass = ccxt[exchange.toLowerCase()];
      if (!exchangeClass) {
        return { valid: false, error: `不支持的交易所: ${exchange}` };
      }

      const ex = new exchangeClass({
        apiKey,
        secret: apiSecret,
        password: passphrase, // OKX 等交易所需要 passphrase（CCXT 内部字段为 password）
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
        return { valid: false, error: errorMessage };
      } else if (error instanceof ccxt.PermissionDenied) {
        errorMessage = 'API Key 权限不足，请确保开启了读取权限';
        return { valid: false, error: errorMessage };
      } else if (error instanceof ccxt.NetworkError) {
        // 网络问题不阻止保存，让用户通过"验证"按钮在网络恢复后自行确认
        this.logger.warn(`[ApiKeys] 创建前验证网络失败(${exchange})，放行保存: ${error.message}`);
        return { valid: false, networkError: true, error: '网络不稳定，已跳过连通性检查，请保存后点击"验证"确认' };
      } else if (error instanceof ccxt.ExchangeError) {
        errorMessage = `交易所返回错误: ${error.message}`;
        return { valid: false, error: errorMessage };
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
    balanceFetchError?: boolean;
    error?: string;
  }> {
    try {
      const { apiKey, apiSecret, exchange, passphrase } = await this.getDecryptedApiKey(
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

      // 创建现货交易所实例（passphrase 为 OKX 等交易所所需）
      // 注意：不设 httpProxy，让 CCXT 走系统默认网络（Shadowrocket TUN 模式自动代理）
      //   显式设 httpProxy 会强制走 127.0.0.1:1082 端口，若该端口断线则全部失败
      // fetchCurrencies: false — 禁止 CCXT Binance 调用 /sapi/v1/capital/config/getall
      const spotEx = new exchangeClass({
        apiKey,
        secret: apiSecret,
        password: passphrase,
        enableRateLimit: true,
        options: { defaultType: 'spot', fetchCurrencies: false },
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
        // Binance USDT-M 合约（fapi.binance.com），同样禁用 fetchCurrencies
        futuresEx = new ccxt.binanceusdm({
          apiKey,
          secret: apiSecret,
          enableRateLimit: true,
          options: { fetchCurrencies: false },
        });
      } else if (exchangeLower === 'bybit') {
        futuresEx = new exchangeClass({
          apiKey,
          secret: apiSecret,
          password: passphrase,
          enableRateLimit: true,
          options: { defaultType: 'linear' },
        });
      } else if (exchangeLower === 'okx') {
        futuresEx = new exchangeClass({
          apiKey,
          secret: apiSecret,
          password: passphrase,
          enableRateLimit: true,
          options: { defaultType: 'swap' },
        });
      } else if (exchangeLower === 'gate') {
        futuresEx = new exchangeClass({
          apiKey,
          secret: apiSecret,
          password: passphrase,
          enableRateLimit: true,
          options: { defaultType: 'swap' },
        });
      } else if (exchangeLower === 'bitget') {
        futuresEx = new exchangeClass({
          apiKey,
          secret: apiSecret,
          password: passphrase,
          enableRateLimit: true,
          options: { defaultType: 'swap' },
        });
      } else {
        futuresEx = new exchangeClass({
          apiKey,
          secret: apiSecret,
          password: passphrase,
          enableRateLimit: true,
          options: { defaultType: 'swap' },
        });
      }

      // ===== 第一步：并行获取余额和价格 =====
      // 有独立资金账户的交易所白名单（Gate.io funding→spot 会双重计算，Bitget 无映射）
      const fundingSupportedExchanges = ['binance', 'bybit', 'okx'];

      // 需要获取价格的代币列表（涵盖主流 + 常见 Binance 持仓）
      const priceSymbols = [
        'BTC', 'ETH', 'BNB', 'SOL',
        'XRP', 'ADA', 'DOGE', 'DOT', 'AVAX', 'LTC',
        'MATIC', 'POL', 'LINK', 'UNI', 'ATOM', 'XLM',
        'TRX', 'TON', 'SHIB', 'PEPE',
      ];

      const [balanceResults, priceResults] = await Promise.all([
        Promise.allSettled([
          // 现货余额：
          // Binance 专用路径：直接调用 /api/v3/account，绕过 loadMarkets 触发的 SAPI 私有端点链
          //   (loadMarkets 会调用 /sapi/v1/capital/config/getall、/sapi/v1/margin/allPairs、dapi/fapi exchangeInfo)
          // 其他交易所：标准 loadMarkets + fetchBalance 路径
          (async (): Promise<any> => {
            if (exchangeLower === 'binance') {
              // 直接调用 Binance REST /api/v3/account，无需 loadMarkets
              const accountRaw = await (spotEx as any).privateGetAccount();
              // 构建与 CCXT fetchBalance 兼容的 {total, free} 结构
              const total: Record<string, number> = {};
              const free: Record<string, number> = {};
              for (const item of (accountRaw.balances || [])) {
                const t = parseFloat(item.free) + parseFloat(item.locked);
                const f = parseFloat(item.free);
                if (t > 0) {
                  total[item.asset] = t;
                  free[item.asset] = f;
                }
              }
              this.logger.log(
                `[verifyApiKey] Binance privateGetAccount 成功 — 非零资产数: ${Object.keys(total).length}`,
              );
              return { total, free };
            }
            // 非 Binance：先 loadMarkets（可失败），再 fetchBalance
            try {
              await spotEx.loadMarkets();
            } catch (loadErr: any) {
              this.logger.warn(`[verifyApiKey] 现货 loadMarkets 失败: ${loadErr.message}，继续尝试 fetchBalance`);
              // 用占位符阻止 CCXT 在 fetchBalance 内部再次调用 loadMarkets
              if (!spotEx.markets || Object.keys(spotEx.markets).length === 0) {
                (spotEx as any).markets = { '_skip': {} };
                (spotEx as any).marketsById = {};
                (spotEx as any).symbols = [];
              }
            }
            return spotEx.fetchBalance();
          })(),
          // 合约余额（如果支持）
          // loadMarkets() 失败时用占位符绕过 CCXT 内部自动重加载检查，确保 fetchBalance() 仍能执行
          futuresEx
            ? (async (): Promise<any> => {
                try {
                  await futuresEx!.loadMarkets();
                } catch (loadErr: any) {
                  this.logger.warn(`[verifyApiKey] 合约 loadMarkets 失败: ${loadErr.message}，继续尝试 fetchBalance`);
                  // 用占位符阻止 CCXT 在 fetchBalance 内部再次调用 loadMarkets
                  if (!futuresEx!.markets || Object.keys(futuresEx!.markets).length === 0) {
                    (futuresEx as any).markets = { '_skip': {} };
                    (futuresEx as any).marketsById = {};
                    (futuresEx as any).symbols = [];
                  }
                }
                return futuresEx!.fetchBalance();
              })()
            : Promise.resolve(null),
          // 资金账户余额（仅 Binance/Bybit/OKX 有独立 funding 钱包）
          fundingSupportedExchanges.includes(exchangeLower)
            ? spotEx.fetchBalance({ type: 'funding' }).catch(() => null)
            : Promise.resolve(null),
        ]),
        Promise.allSettled(
          priceSymbols.map(sym => spotEx.fetchTicker(`${sym}/USDT`).catch(() => null))
        ),
      ]);

      const [spotResult, futuresResult, fundingResult] = balanceResults;

      // 解析价格 Map（symbol → USD 价格）
      const prices: Record<string, number> = {};
      priceSymbols.forEach((sym, i) => {
        const result = priceResults[i];
        if (result.status === 'fulfilled' && result.value?.last) {
          prices[sym] = result.value.last;
        }
      });

      // 稳定币集合（直接 1:1 计为 USD）— FDUSD 是 Binance 当前主流稳定币
      const STABLECOINS = new Set([
        'USDT', 'USD', 'BUSD', 'USDC', 'FDUSD', 'TUSD',
        'DAI', 'USDD', 'USDP', 'GUSD', 'SUSD', 'FRAX',
      ]);

      // USD 估值公用函数
      const calcUsdValue = (symbol: string, amount: number): number => {
        if (STABLECOINS.has(symbol)) return amount;
        const price = prices[symbol] || 0;
        return price > 0 ? amount * price : 0;
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
        this.logger.warn(`[verifyApiKey] 获取现货余额失败: ${(spotResult as PromiseRejectedResult).reason?.message}`);
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
        this.logger.warn(`[verifyApiKey] 获取合约余额失败: ${(futuresResult as PromiseRejectedResult).reason?.message}`);
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
      // 任一余额 fetch 失败时标记，供前端显示提示
      // 情况1: 现货 fetch 失败
      // 情况2: 合约 fetch 失败且现货为空（用户钱可能全在合约）
      const spotFailed = spotResult.status === 'rejected';
      const futuresFailed = futuresEx !== null && futuresResult.status === 'rejected';
      const balanceFetchError = spotFailed || (futuresFailed && allBalances.length === 0);

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
        balanceFetchError: balanceFetchError || undefined,
      };
    } catch (error: any) {
      // 解析 CCXT 错误及系统错误
      let errorMessage = error.message || '验证失败';
      if (error instanceof ccxt.AuthenticationError) {
        errorMessage = 'API Key 或 Secret 无效';
      } else if (error instanceof ccxt.PermissionDenied) {
        errorMessage = 'API Key 权限不足';
      } else if (error instanceof ccxt.NetworkError) {
        errorMessage = '网络连接失败，请稍后重试';
      } else if (
        error.message?.includes('Unsupported state') ||
        error.message?.includes('unable to authenticate') ||
        error.message?.includes('decrypt') ||
        error.message?.includes('decipher') ||
        error.message?.includes('ENCRYPTION_KEY')
      ) {
        // AES-GCM 解密失败 — 服务器重启或密钥变更导致无法读取已存储的 API Key
        errorMessage = '密钥解密失败，请重新绑定交易所 API Key';
        this.logger.error(`[verifyApiKey] 解密失败 (${error.message})`);
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

  /**
   * 从交易所获取真实盈亏统计（整个账户级别）
   * - todayPnl: 今日已实现盈亏（合约 income endpoint）
   * - unrealizedPnl: 当前未实现盈亏（合约 account）
   * - totalPnl: 近30天累计已实现盈亏
   */
  async getExchangePnlStats(
    userId: string,
    apiKeyId: string,
  ): Promise<{
    todayPnl: number;
    unrealizedPnl: number;
    weekPnl: number;
    monthPnl: number;
    todayRealizedPnl: number;
    weekRealizedPnl: number;
    monthRealizedPnl: number;
    todayFundingFee: number;
    todayCommission: number;
    monthFundingFee: number;
    monthCommission: number;
    error?: string;
  }> {
    try {
      const { apiKey, apiSecret, exchange, passphrase } = await this.getDecryptedApiKey(
        userId,
        apiKeyId,
      );

      const exchangeLower = exchange.toLowerCase();

      // 当前仅支持 Binance/OKX 合约盈亏查询
      const supportedExchanges = ['binance', 'okx', 'bybit'];
      if (!supportedExchanges.includes(exchangeLower)) {
        return {
          todayPnl: 0,
          unrealizedPnl: 0,
          weekPnl: 0,
          monthPnl: 0,
          todayRealizedPnl: 0,
          weekRealizedPnl: 0,
          monthRealizedPnl: 0,
          todayFundingFee: 0,
          todayCommission: 0,
          monthFundingFee: 0,
          monthCommission: 0,
          error: `${exchange} 暂不支持盈亏查询`,
        };
      }

      // 创建合约交易所实例
      const futuresClass = exchangeLower === 'binance' ? 'binanceusdm' : exchangeLower;
      const ExchangeClass = ccxt[futuresClass as keyof typeof ccxt] as any;
      const futuresEx: ccxt.Exchange = new ExchangeClass({
        apiKey,
        secret: apiSecret,
        ...(passphrase ? { password: passphrase } : {}),
        options: { defaultType: 'future' },
      });

      // 尝试加载市场（容忍失败）
      try {
        await futuresEx.loadMarkets();
      } catch {
        this.logger.debug('[pnl-stats] loadMarkets 失败，继续尝试');
      }

      // 时间范围
      const now = Date.now();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayStartTs = todayStart.getTime();
      const weekStartTs = todayStartTs - 7 * 24 * 60 * 60 * 1000;
      const monthStartTs = todayStartTs - 30 * 24 * 60 * 60 * 1000;

      // 并行查询：income（30天）+ account（未实现盈亏）
      const [incomeResult, accountResult] = await Promise.allSettled([
        this.fetchFuturesIncome(futuresEx, exchangeLower, monthStartTs, now),
        this.fetchFuturesUnrealizedPnl(futuresEx, exchangeLower),
      ]);

      // 解析 income 数据
      let todayPnl = 0;
      let weekPnl = 0;
      let monthPnl = 0;
      let todayRealizedPnl = 0;
      let weekRealizedPnl = 0;
      let monthRealizedPnl = 0;
      let todayFundingFee = 0;
      let todayCommission = 0;
      let monthFundingFee = 0;
      let monthCommission = 0;

      if (incomeResult.status === 'fulfilled') {
        const incomes = incomeResult.value;
        for (const item of incomes) {
          const amount = parseFloat(item.income || item.amount || '0');
          const ts = item.time || item.timestamp || 0;
          const type = (item.incomeType || item.type || '').toUpperCase();
          const isRealizedPnl = type === 'REALIZED_PNL' || type === 'REALIZED_PROFIT' || type === 'CLOSE_POSITION';
          const isFunding = type === 'FUNDING_FEE';
          const isCommission = type === 'COMMISSION' || type === 'FEE';

          // 全部收入累计（含资金费+手续费）
          if (ts >= monthStartTs) monthPnl += amount;
          if (ts >= weekStartTs) weekPnl += amount;
          if (ts >= todayStartTs) todayPnl += amount;

          // 纯已实现盈亏（仅平仓盈亏，不含资金费和手续费）
          if (isRealizedPnl) {
            if (ts >= monthStartTs) monthRealizedPnl += amount;
            if (ts >= weekStartTs) weekRealizedPnl += amount;
            if (ts >= todayStartTs) todayRealizedPnl += amount;
          }

          // 资金费率和手续费分类统计
          if (isFunding) {
            if (ts >= monthStartTs) monthFundingFee += amount;
            if (ts >= todayStartTs) todayFundingFee += amount;
          }
          if (isCommission) {
            if (ts >= monthStartTs) monthCommission += amount;
            if (ts >= todayStartTs) todayCommission += amount;
          }
        }
      } else {
        this.logger.warn(`[pnl-stats] 获取 income 失败: ${(incomeResult as PromiseRejectedResult).reason?.message}`);
      }

      // 解析未实现盈亏
      let unrealizedPnl = 0;
      if (accountResult.status === 'fulfilled') {
        unrealizedPnl = accountResult.value;
      } else {
        this.logger.warn(`[pnl-stats] 获取未实现盈亏失败: ${(accountResult as PromiseRejectedResult).reason?.message}`);
      }

      return {
        todayPnl: parseFloat(todayPnl.toFixed(4)),
        unrealizedPnl: parseFloat(unrealizedPnl.toFixed(4)),
        weekPnl: parseFloat(weekPnl.toFixed(4)),
        monthPnl: parseFloat(monthPnl.toFixed(4)),
        // 纯已实现盈亏（不含资金费和手续费）
        todayRealizedPnl: parseFloat(todayRealizedPnl.toFixed(4)),
        weekRealizedPnl: parseFloat(weekRealizedPnl.toFixed(4)),
        monthRealizedPnl: parseFloat(monthRealizedPnl.toFixed(4)),
        todayFundingFee: parseFloat(todayFundingFee.toFixed(4)),
        todayCommission: parseFloat(todayCommission.toFixed(4)),
        monthFundingFee: parseFloat(monthFundingFee.toFixed(4)),
        monthCommission: parseFloat(monthCommission.toFixed(4)),
      };
    } catch (error: any) {
      this.logger.error(`[pnl-stats] 交易所盈亏查询失败: ${error.message}`);
      return {
        todayPnl: 0,
        unrealizedPnl: 0,
        weekPnl: 0,
        monthPnl: 0,
        todayRealizedPnl: 0,
        weekRealizedPnl: 0,
        monthRealizedPnl: 0,
        todayFundingFee: 0,
        todayCommission: 0,
        monthFundingFee: 0,
        monthCommission: 0,
        error: error.message,
      };
    }
  }

  /**
   * 获取交易所真实交易历史（平仓成交记录）
   * 数据来源：CCXT fetchMyTrades → 过滤 realizedPnl != 0 的成交
   * 返回每笔平仓的真实价格、数量、PnL，与交易所完全一致
   */
  async getExchangeTradeHistory(
    userId: string,
    apiKeyId: string,
    query?: { startDate?: string; endDate?: string; limit?: number },
  ): Promise<{
    items: Array<{
      id: string;
      symbol: string;
      side: string;
      price: string;
      amount: string;
      pnl: string;
      fee: string;
      time: string;
      tradeId?: string;
    }>;
    total: number;
    source: 'exchange';
    error?: string;
  }> {
    try {
      const { apiKey, apiSecret, exchange, passphrase } = await this.getDecryptedApiKey(
        userId,
        apiKeyId,
      );

      const exchangeLower = exchange.toLowerCase();
      const supportedExchanges = ['binance', 'okx', 'bybit'];
      if (!supportedExchanges.includes(exchangeLower)) {
        return { items: [], total: 0, source: 'exchange', error: `${exchange} 暂不支持交易历史查询` };
      }

      // 创建合约交易所实例
      const futuresClass = exchangeLower === 'binance' ? 'binanceusdm' : exchangeLower;
      const ExchangeClass = ccxt[futuresClass as keyof typeof ccxt] as any;
      const futuresEx: ccxt.Exchange = new ExchangeClass({
        apiKey,
        secret: apiSecret,
        ...(passphrase ? { password: passphrase } : {}),
        options: { defaultType: 'future' },
      });

      try {
        await futuresEx.loadMarkets();
      } catch {
        this.logger.debug('[trade-history] loadMarkets 失败，继续尝试');
      }

      // 时间范围：默认 7 天（fetchMyTrades 数据量大，控制范围）
      const now = Date.now();
      const since = query?.startDate
        ? new Date(query.startDate).getTime()
        : now - 7 * 24 * 60 * 60 * 1000;

      // 获取所有成交记录（CCXT fetchMyTrades）
      const allTrades: any[] = [];
      let fetchSince = since;
      const fetchLimit = 1000; // Binance 单次最多 1000
      while (true) {
        const trades = await futuresEx.fetchMyTrades(undefined, fetchSince, fetchLimit);
        if (!trades || trades.length === 0) break;
        allTrades.push(...trades);
        if (trades.length < fetchLimit) break;
        // 下一页从最后一条之后开始
        fetchSince = trades[trades.length - 1].timestamp + 1;
        if (allTrades.length >= 5000) break; // 安全上限
      }

      // 过滤有 realizedPnl 的成交（= 平仓成交）
      const closeTrades = allTrades
        .filter((t: any) => {
          const pnl = parseFloat(t.info?.realizedPnl || '0');
          return Math.abs(pnl) > 0.0001; // 排除极小精度误差
        })
        .map((t: any) => {
          const pnl = parseFloat(t.info?.realizedPnl || '0');
          const feeCost = t.fee?.cost ?? 0;
          // positionSide: BOTH/LONG/SHORT；side: buy/sell
          // 平仓方向：sell 平多头 = long 被平仓；buy 平空头 = short 被平仓
          const positionSide = (t.info?.positionSide || 'BOTH').toUpperCase();
          let closedSide: string;
          if (positionSide === 'LONG') {
            closedSide = 'long';
          } else if (positionSide === 'SHORT') {
            closedSide = 'short';
          } else {
            // BOTH 模式：sell = 平多，buy = 平空
            closedSide = t.side === 'sell' ? 'long' : 'short';
          }
          return {
            id: String(t.id || t.info?.id || `trade_${t.timestamp}`),
            symbol: t.symbol || '',
            side: closedSide,
            price: String(t.price || '0'),
            amount: String(t.amount || '0'),
            pnl: pnl.toFixed(8),
            fee: typeof feeCost === 'number' ? feeCost.toFixed(8) : String(feeCost),
            time: new Date(t.timestamp).toISOString(),
            tradeId: String(t.id || ''),
          };
        })
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

      const limit = query?.limit || 50;
      const items = closeTrades.slice(0, limit);

      return {
        items,
        total: closeTrades.length,
        source: 'exchange',
      };
    } catch (error: any) {
      this.logger.error(`[trade-history] 交易所交易历史查询失败: ${error.message}`);
      return {
        items: [],
        total: 0,
        source: 'exchange',
        error: error.message,
      };
    }
  }

  /**
   * 获取合约 income 记录（REALIZED_PNL + FUNDING_FEE + COMMISSION）
   * Binance: fapiPrivateGetIncome
   * OKX/Bybit: fetchLedger 或类似端点
   */
  private async fetchFuturesIncome(
    ex: ccxt.Exchange,
    exchangeLower: string,
    startTime: number,
    endTime: number,
  ): Promise<any[]> {
    if (exchangeLower === 'binance') {
      // Binance USDM: /fapi/v1/income — 每次最多1000条，需分页
      const allIncomes: any[] = [];
      let currentStart = startTime;

      while (true) {
        const result = await (ex as any).fapiPrivateGetIncome({
          startTime: currentStart,
          endTime,
          limit: 1000,
        });
        if (!result || result.length === 0) break;
        allIncomes.push(...result);
        if (result.length < 1000) break;
        // 下一页从最后一条之后开始
        currentStart = parseInt(result[result.length - 1].time) + 1;
      }
      return allIncomes;
    }

    if (exchangeLower === 'okx') {
      // OKX: 用 fetchLedger 获取
      try {
        const entries = await ex.fetchLedger(undefined, startTime, 100, {
          instType: 'SWAP',
        });
        return entries.map((e: any) => ({
          income: String(e.amount || 0),
          time: e.timestamp,
          incomeType: e.type?.toUpperCase() || 'UNKNOWN',
        }));
      } catch {
        return [];
      }
    }

    if (exchangeLower === 'bybit') {
      // Bybit: 用 fetchLedger
      try {
        const entries = await ex.fetchLedger(undefined, startTime, 100);
        return entries.map((e: any) => ({
          income: String(e.amount || 0),
          time: e.timestamp,
          incomeType: e.type?.toUpperCase() || 'UNKNOWN',
        }));
      } catch {
        return [];
      }
    }

    return [];
  }

  /**
   * 获取合约未实现盈亏
   */
  private async fetchFuturesUnrealizedPnl(
    ex: ccxt.Exchange,
    exchangeLower: string,
  ): Promise<number> {
    if (exchangeLower === 'binance') {
      // Binance: fapiPrivateV2GetAccount → totalUnrealizedProfit
      const account = await (ex as any).fapiPrivateV2GetAccount();
      return parseFloat(account.totalUnrealizedProfit || '0');
    }

    // 通用：fetchPositions 后累加 unrealizedPnl
    try {
      const positions = await ex.fetchPositions();
      let total = 0;
      for (const pos of positions) {
        total += parseFloat(String(pos.unrealizedPnl || 0));
      }
      return total;
    } catch {
      return 0;
    }
  }
}
