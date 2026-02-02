import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { encrypt, decrypt, maskApiKey } from '../../common/utils/crypto.util';
import {
  CreateApiKeyDto,
  UpdateApiKeyDto,
  ApiKeyResponse,
  ApiKeyListResponse,
} from './dto/api-key.dto';
import * as ccxt from 'ccxt';

@Injectable()
export class ApiKeysService {
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
      items: items.map((item) => ({
        id: item.id,
        exchange: item.exchange,
        label: item.label,
        maskedKey: '****' + item.encryptedKey.slice(-4), // 简单脱敏
        isActive: item.isActive,
        createdAt: item.createdAt,
      })),
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

    const updateData: any = {};

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
      const permissions: string[] = ['读取账户'];

      // 创建现货交易所实例
      const spotEx = new exchangeClass({
        apiKey,
        secret: apiSecret,
        enableRateLimit: true,
        options: { defaultType: 'spot' },
      });

      // 创建合约交易所实例
      // 注意：Binance 需要使用独立的 binanceusdm 类来访问 USDT-M 合约
      // 其他交易所使用 defaultType 设置即可
      const exchangeLower = exchange.toLowerCase();
      let futuresEx: ccxt.Exchange;

      if (exchangeLower === 'binance') {
        // Binance USDT-M 合约使用独立的交易所类
        // 这会自动使用 fapi.binance.com 端点
        futuresEx = new ccxt.binanceusdm({
          apiKey,
          secret: apiSecret,
          enableRateLimit: true,
        });
      } else if (exchangeLower === 'bybit') {
        // Bybit 使用 linear 类型
        futuresEx = new exchangeClass({
          apiKey,
          secret: apiSecret,
          enableRateLimit: true,
          options: { defaultType: 'linear' },
        });
      } else {
        // 其他交易所使用 swap 类型
        futuresEx = new exchangeClass({
          apiKey,
          secret: apiSecret,
          enableRateLimit: true,
          options: { defaultType: 'swap' },
        });
      }

      // ===== 第一步：并行获取余额和价格 =====
      const [spotResult, futuresResult, btcTickerResult, ethTickerResult] =
        await Promise.allSettled([
          // 现货余额
          spotEx.fetchBalance(),
          // 合约余额（需要先加载市场）
          futuresEx.loadMarkets().then(() => futuresEx.fetchBalance()),
          // BTC 价格
          spotEx.fetchTicker('BTC/USDT'),
          // ETH 价格
          spotEx.fetchTicker('ETH/USDT'),
        ]);

      // 解析价格
      const btcPrice =
        btcTickerResult.status === 'fulfilled'
          ? btcTickerResult.value.last || 0
          : 0;
      const ethPrice =
        ethTickerResult.status === 'fulfilled'
          ? ethTickerResult.value.last || 0
          : 0;

      // 处理现货余额
      if (spotResult.status === 'fulfilled') {
        const spotBalance = spotResult.value;
        for (const [symbol, total] of Object.entries(spotBalance.total)) {
          if ((total as number) > 0) {
            let usdValue = 0;
            if (['USDT', 'USD', 'BUSD', 'USDC'].includes(symbol)) {
              usdValue = total as number;
            } else if (symbol === 'BTC' && btcPrice > 0) {
              usdValue = (total as number) * btcPrice;
            } else if (symbol === 'ETH' && ethPrice > 0) {
              usdValue = (total as number) * ethPrice;
            }
            spotValue += usdValue;
            allBalances.push({
              symbol,
              free: spotBalance.free[symbol] || 0,
              total: total as number,
              type: 'spot',
              usdValue,
            });
          }
        }
      } else {
        console.log('获取现货余额失败:', spotResult.reason?.message);
      }

      // 处理合约余额
      if (futuresResult.status === 'fulfilled') {
        const futuresBalance = futuresResult.value;
        for (const [symbol, total] of Object.entries(futuresBalance.total)) {
          if ((total as number) > 0) {
            let usdValue = 0;
            if (['USDT', 'USD', 'BUSD', 'USDC'].includes(symbol)) {
              usdValue = total as number;
            }
            futuresValue += usdValue;
            allBalances.push({
              symbol,
              free: futuresBalance.free[symbol] || 0,
              total: total as number,
              type: 'futures',
              usdValue,
            });
          }
        }
      } else {
        console.log('获取合约余额失败:', futuresResult.reason?.message);
      }

      // ===== 第二步：并行检测交易权限 =====
      // 注意：即使余额获取失败，也尝试检测权限
      // 余额获取失败可能是因为：账户余额为0、网络问题、限流等
      // 这些不影响我们检测 API Key 是否有交易权限

      const [spotPermResult, futuresPermResult] = await Promise.allSettled([
        // 检查现货交易权限
        this.checkSpotTradePermission(spotEx),
        // 检查合约交易权限 - 始终尝试检测
        this.checkFuturesTradePermission(futuresEx),
      ]);

      if (
        spotPermResult.status === 'fulfilled' &&
        spotPermResult.value === true
      ) {
        permissions.push('现货交易');
      }
      if (
        futuresPermResult.status === 'fulfilled' &&
        futuresPermResult.value === true
      ) {
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
      console.log('合约权限检测: 加载市场失败:', e.message);
      // 如果是权限错误，直接返回 false
      if (isPermissionError(e)) {
        console.log('合约权限检测: 市场加载失败 - 无权限');
        return false;
      }
      // 其他错误，继续尝试
    }

    // 方法1: 尝试获取余额（最基础的操作）
    try {
      await futuresEx.fetchBalance();
      // 能获取余额，说明有基本的合约账户访问权限
      console.log('合约权限检测: fetchBalance 成功');
      return true;
    } catch (e: any) {
      if (isPermissionError(e)) {
        console.log('合约权限检测: fetchBalance 权限被拒绝');
        return false;
      }
      console.log('合约权限检测: fetchBalance 失败:', e.message);
    }

    // 方法2: 尝试获取持仓
    if (futuresEx.has['fetchPositions']) {
      try {
        await futuresEx.fetchPositions();
        console.log('合约权限检测: fetchPositions 成功');
        return true;
      } catch (e: any) {
        if (isPermissionError(e)) {
          console.log('合约权限检测: fetchPositions 权限被拒绝');
          return false;
        }
        console.log('合约权限检测: fetchPositions 失败:', e.message);
      }
    }

    // 方法3: 尝试获取订单列表
    try {
      // 使用常用的合约交易对
      const symbol = 'BTC/USDT:USDT';
      await futuresEx.fetchOpenOrders(symbol);
      console.log('合约权限检测: fetchOpenOrders 成功');
      return true;
    } catch (e: any) {
      if (isPermissionError(e)) {
        console.log('合约权限检测: fetchOpenOrders 权限被拒绝');
        return false;
      }
      console.log('合约权限检测: fetchOpenOrders 失败:', e.message);
    }

    // 如果所有方法都失败了但没有收到明确的权限拒绝
    // 保守起见返回 false，因为我们无法确认有权限
    console.log('合约权限检测: 所有方法失败，无法确认权限');
    return false;
  }
}
