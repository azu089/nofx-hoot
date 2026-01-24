import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../common/services/crypto.service';
import { InstanceLogService } from '../instances/instance-log.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ApiKeyResponseDto, VerifyApiKeyResponseDto, ExchangeBalanceDto } from './dto/api-key-response.dto';

/**
 * API Keys 服务
 * 处理 API Key 的加密存储、验证等操作
 *
 * 安全要求：
 * - 密钥使用 AES-256-GCM 加密存储
 * - 禁止在日志中打印密钥原文
 * - 查询时不返回密钥
 */
@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);
  private readonly VPS_PROXY_PORT = 8081; // VPS 上的代理服务端口

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly httpService: HttpService,
    private readonly instanceLogService: InstanceLogService,
  ) {}

  /**
   * 创建 API Key（加密存储）
   * 将 apiKey 和 secretKey 合并加密存储到 encrypted_blob
   */
  async create(userId: string, dto: CreateApiKeyDto): Promise<ApiKeyResponseDto> {
    // 检查是否已存在相同交易所的 API Key
    const existing = await this.prisma.client.api_keys.findFirst({
      where: {
        user_id: userId,
        exchange: dto.exchange,
        is_active: true,
      },
    });

    if (existing) {
      throw new ConflictException(`该交易所已绑定 API Key，请先删除现有的`);
    }

    // 合并 API Key 和 Secret Key 后加密
    const combinedKeys = JSON.stringify({
      apiKey: dto.apiKey,
      secretKey: dto.secretKey,
    });
    const encrypted = this.cryptoService.encrypt(combinedKeys);

    // 存储到数据库（使用 Buffer 存储 Bytes 类型）
    const apiKey = await this.prisma.client.api_keys.create({
      data: {
        user_id: userId,
        exchange: dto.exchange,
        encrypted_blob: Buffer.from(encrypted.encryptedBlob, 'base64'),
        iv: Buffer.from(encrypted.iv, 'base64'),
        auth_tag: Buffer.from(encrypted.authTag, 'base64'),
        label: dto.label || null,
        is_active: true,
      },
    });

    this.logger.log(`用户 ${userId} 绑定 ${dto.exchange} API Key 成功`);

    // 记录系统日志
    await this.instanceLogService.info(
      userId,
      'api_key_bind',
      `绑定 ${dto.exchange} 交易所 API Key 成功`,
      { details: { exchange: dto.exchange, label: dto.label } },
    );

    return this.toResponseDto(apiKey);
  }

  /**
   * 获取用户的所有 API Keys
   */
  async findAllByUserId(userId: string): Promise<ApiKeyResponseDto[]> {
    const apiKeys = await this.prisma.client.api_keys.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });

    return apiKeys.map((key) => this.toResponseDto(key));
  }

  /**
   * 获取单个 API Key
   */
  async findById(id: string, userId: string): Promise<ApiKeyResponseDto> {
    const apiKey = await this.prisma.client.api_keys.findFirst({
      where: { id, user_id: userId },
    });

    if (!apiKey) {
      throw new NotFoundException('API Key 不存在');
    }

    return this.toResponseDto(apiKey);
  }

  /**
   * 删除 API Key
   * 前置条件：用户没有正在运行的策略实例
   */
  async delete(id: string, userId: string): Promise<void> {
    const apiKey = await this.prisma.client.api_keys.findFirst({
      where: { id, user_id: userId },
    });

    if (!apiKey) {
      throw new NotFoundException('API Key 不存在');
    }

    // 检查是否有正在运行的实例
    const runningInstance = await this.prisma.client.instances.findFirst({
      where: {
        user_id: userId,
        status: 'running',
      },
    });

    if (runningInstance) {
      throw new BadRequestException(
        '请先停止正在运行的策略，然后再删除 API Key',
      );
    }

    await this.prisma.client.api_keys.delete({
      where: { id },
    });

    this.logger.log(`用户 ${userId} 删除 ${apiKey.exchange} API Key`);

    // 记录系统日志
    await this.instanceLogService.info(
      userId,
      'api_key_delete',
      `删除 ${apiKey.exchange} 交易所 API Key`,
      { details: { exchange: apiKey.exchange } },
    );
  }

  /**
   * 验证 API Key（通过用户 VPS 调用交易所 API）
   *
   * 重要：API Key 验证必须在用户自己的 VPS 上执行，而不是主服务器
   * 原因：
   * 1. 主服务器 IP 可能被交易所封锁
   * 2. 用户需要在交易所白名单中添加自己 VPS 的 IP
   * 3. 符合单租户隔离的安全设计
   */
  async verify(id: string, userId: string): Promise<VerifyApiKeyResponseDto> {
    const apiKey = await this.prisma.client.api_keys.findFirst({
      where: { id, user_id: userId },
    });

    if (!apiKey) {
      throw new NotFoundException('API Key 不存在');
    }

    // 检查用户是否有活跃的 VPS 实例（包含 zombie 状态，因为 VPS 可能还在运行只是心跳超时）
    const instance = await this.prisma.client.instances.findFirst({
      where: {
        user_id: userId,
        status: { in: ['running', 'ready', 'zombie'] },
      },
    });

    if (!instance || !instance.ip_address) {
      throw new BadRequestException(
        '请先开通订阅并等待 VPS 就绪后再验证 API Key。VPS 就绪后，请在交易所 API 设置中将 VPS IP 添加到白名单。'
      );
    }

    // 如果 VPS 是僵尸状态，给出特殊提示
    if (instance.status === 'zombie') {
      this.logger.warn(`用户 ${userId} 的 VPS 处于僵尸状态，尝试继续验证...`);
    }

    try {
      // 解密获取密钥
      const decrypted = this.decryptKeys(apiKey);
      const vpsIp = instance.ip_address.toString();

      this.logger.log(`通过用户 VPS (${vpsIp}) 验证 API Key ${id} (${apiKey.exchange})`);

      // 通过 VPS 上的代理服务验证 API Key
      const verifyResult = await this.verifyViaVpsProxy(
        vpsIp,
        apiKey.exchange,
        decrypted.apiKey,
        decrypted.secretKey,
      );

      if (!verifyResult.valid) {
        return {
          valid: false,
          error: verifyResult.error || '验证失败',
        };
      }

      // 更新验证时间和权限（从代理服务返回的权限列表）
      const hasSpot = verifyResult.permissions?.includes('spot') ?? true;
      const hasFutures = verifyResult.permissions?.includes('futures') ?? false;

      await this.prisma.client.api_keys.update({
        where: { id },
        data: {
          last_verified_at: new Date(),
          permissions: { spot: hasSpot, futures: hasFutures, withdraw: false },
        },
      });

      this.logger.log(`API Key ${id} 验证成功，权限: spot=${hasSpot}, futures=${hasFutures}, USDT 余额: ${verifyResult.totalBalanceUsdt}`);

      // 记录系统日志 - 验证成功
      await this.instanceLogService.info(
        userId,
        'api_key_verify',
        `${apiKey.exchange} API Key 验证成功，USDT 余额: ${verifyResult.totalBalanceUsdt}`,
        {
          instanceId: instance.id,
          details: { exchange: apiKey.exchange, hasSpot, hasFutures },
        },
      );

      return verifyResult;
    } catch (error) {
      this.logger.error(`验证 API Key ${id} 失败: ${error.message}`);

      // 解析错误信息
      let errorMessage = '验证失败';
      const msg = error.message || '';

      if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT')) {
        errorMessage = 'VPS 代理服务未就绪，请稍后重试。如果持续失败，请联系客服。';
      } else if (msg.includes('Invalid API-key')) {
        errorMessage = 'API Key 无效，请检查是否正确';
      } else if (msg.includes('Signature')) {
        errorMessage = 'Secret Key 无效，请检查是否正确';
      } else if (msg.includes('IP') || msg.includes('restricted location')) {
        errorMessage = `IP 地址未授权。请在交易所 API 设置中将您的 VPS IP (${instance.ip_address}) 添加到白名单`;
      } else if (msg.includes('permission')) {
        errorMessage = 'API Key 权限不足，请开启现货交易权限';
      } else {
        errorMessage = `验证失败: ${msg}`;
      }

      // 记录系统日志 - 验证失败
      await this.instanceLogService.warn(
        userId,
        'api_key_verify',
        `${apiKey.exchange} API Key 验证失败: ${errorMessage}`,
        {
          instanceId: instance?.id,
          details: { exchange: apiKey.exchange, error: errorMessage },
        },
      );

      return {
        valid: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 通过 VPS 代理服务验证 API Key
   * VPS 上运行一个轻量代理服务，接收验证请求并在本地执行 ccxt 调用
   */
  private async verifyViaVpsProxy(
    vpsIp: string,
    exchange: string,
    apiKey: string,
    secretKey: string,
  ): Promise<VerifyApiKeyResponseDto> {
    const url = `http://${vpsIp}:${this.VPS_PROXY_PORT}/api/verify`;

    try {
      const response = await firstValueFrom(
        this.httpService.post<VerifyApiKeyResponseDto>(
          url,
          { exchange, apiKey, secretKey },
          { timeout: 30000 },
        ),
      );

      return response.data;
    } catch (error: any) {
      // 如果代理服务不可用，抛出错误
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error('ECONNREFUSED: VPS 代理服务未运行');
      }

      // 如果是 HTTP 错误响应，提取错误信息
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }

      throw error;
    }
  }

  /**
   * 获取用户绑定的所有交易所余额
   * 通过用户 VPS 代理服务获取余额
   */
  async getExchangeBalances(userId: string): Promise<{
    total: number;
    balances: Array<{
      exchange: string;
      apiKeyId: string;
      label: string;
      usdtBalance: number;
      isValid: boolean;
    }>;
  }> {
    // 获取用户所有激活的 API Key
    const apiKeys = await this.prisma.client.api_keys.findMany({
      where: {
        user_id: userId,
        is_active: true,
      },
    });

    if (apiKeys.length === 0) {
      return { total: 0, balances: [] };
    }

    // 检查用户是否有活跃的 VPS 实例
    const instance = await this.prisma.client.instances.findFirst({
      where: {
        user_id: userId,
        status: { in: ['running', 'ready'] },
      },
    });

    // 如果没有 VPS，返回未验证状态（不抛错，让页面正常显示）
    if (!instance || !instance.ip_address) {
      return {
        total: 0,
        balances: apiKeys.map((key) => ({
          exchange: key.exchange,
          apiKeyId: key.id,
          label: key.label || key.exchange,
          usdtBalance: 0,
          isValid: false,
        })),
      };
    }

    const vpsIp = instance.ip_address.toString();
    const balances: Array<{
      exchange: string;
      apiKeyId: string;
      label: string;
      usdtBalance: number;
      isValid: boolean;
    }> = [];
    let total = 0;

    // 通过 VPS 代理获取每个 API Key 的余额
    for (const apiKey of apiKeys) {
      try {
        const decrypted = this.decryptKeys(apiKey);
        const result = await this.getBalanceViaVpsProxy(
          vpsIp,
          apiKey.exchange,
          decrypted.apiKey,
          decrypted.secretKey,
        );

        balances.push({
          exchange: apiKey.exchange,
          apiKeyId: apiKey.id,
          label: apiKey.label || apiKey.exchange,
          usdtBalance: result.usdtBalance,
          isValid: true,
        });
        total += result.usdtBalance;
      } catch (error) {
        this.logger.warn(`通过 VPS 获取 ${apiKey.exchange} 余额失败: ${error.message}`);
        balances.push({
          exchange: apiKey.exchange,
          apiKeyId: apiKey.id,
          label: apiKey.label || apiKey.exchange,
          usdtBalance: 0,
          isValid: false,
        });
      }
    }

    return { total, balances };
  }

  /**
   * 通过 VPS 代理获取余额
   */
  private async getBalanceViaVpsProxy(
    vpsIp: string,
    exchange: string,
    apiKey: string,
    secretKey: string,
  ): Promise<{ usdtBalance: number }> {
    const url = `http://${vpsIp}:${this.VPS_PROXY_PORT}/api/balance`;

    try {
      const response = await firstValueFrom(
        this.httpService.post<{ usdtBalance: number }>(
          url,
          { exchange, apiKey, secretKey },
          { timeout: 30000 },
        ),
      );

      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message);
    }
  }

  /**
   * 获取解密后的 API Key（仅内部使用，用于 VPS 注入）
   */
  async getDecryptedKeys(id: string, userId: string): Promise<{
    apiKey: string;
    secretKey: string;
  }> {
    const apiKey = await this.prisma.client.api_keys.findFirst({
      where: { id, user_id: userId, is_active: true },
    });

    if (!apiKey) {
      throw new NotFoundException('API Key 不存在或已禁用');
    }

    return this.decryptKeys(apiKey);
  }

  /**
   * 解密密钥（内部方法）
   * 注意：Prisma 返回的 Bytes 类型是 Uint8Array，需要转换为 Buffer
   */
  private decryptKeys(apiKey: any): { apiKey: string; secretKey: string } {
    // Prisma 返回的 Bytes 类型是 Uint8Array，需要转换为 Buffer
    const blobBuffer = Buffer.from(apiKey.encrypted_blob);
    const ivBuffer = Buffer.from(apiKey.iv);
    const authTagBuffer = Buffer.from(apiKey.auth_tag);

    const encryptedBlob = blobBuffer.toString('base64');
    const iv = ivBuffer.toString('base64');
    const authTag = authTagBuffer.toString('base64');

    const decrypted = this.cryptoService.decrypt(encryptedBlob, iv, authTag);
    return JSON.parse(decrypted);
  }

  /**
   * 转换为响应 DTO（隐藏敏感字段）
   */
  private toResponseDto(apiKey: any): ApiKeyResponseDto {
    // 解析 permissions JSON
    let permissions: string[] | null = null;
    if (apiKey.permissions) {
      const perms = typeof apiKey.permissions === 'string' 
        ? JSON.parse(apiKey.permissions) 
        : apiKey.permissions;
      permissions = Object.entries(perms)
        .filter(([_, v]) => v === true)
        .map(([k]) => k);
    }

    // 生成遮罩显示的 API Key（基于 ID，不泄露真实密钥）
    // 格式：xxxx-****-xxxx（取 ID 前4位和后4位）
    const idClean = apiKey.id.replace(/-/g, '');
    const apiKeyMasked = `${idClean.slice(0, 4)}-****-${idClean.slice(-4)}`;

    return {
      id: apiKey.id,
      exchange: apiKey.exchange,
      label: apiKey.label,
      api_key_masked: apiKeyMasked,
      permissions,
      isActive: apiKey.is_active,
      is_valid: !!apiKey.last_verified_at, // 有验证时间则视为已验证
      lastVerifiedAt: apiKey.last_verified_at,
      createdAt: apiKey.created_at,
    };
  }
}
