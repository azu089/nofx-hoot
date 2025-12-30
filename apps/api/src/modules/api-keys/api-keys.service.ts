import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../common/services/crypto.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ApiKeyResponseDto, VerifyApiKeyResponseDto } from './dto/api-key-response.dto';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
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
   */
  async delete(id: string, userId: string): Promise<void> {
    const apiKey = await this.prisma.client.api_keys.findFirst({
      where: { id, user_id: userId },
    });

    if (!apiKey) {
      throw new NotFoundException('API Key 不存在');
    }

    await this.prisma.client.api_keys.delete({
      where: { id },
    });

    this.logger.log(`用户 ${userId} 删除 ${apiKey.exchange} API Key`);
  }

  /**
   * 验证 API Key（调用交易所 API）
   */
  async verify(id: string, userId: string): Promise<VerifyApiKeyResponseDto> {
    const apiKey = await this.prisma.client.api_keys.findFirst({
      where: { id, user_id: userId },
    });

    if (!apiKey) {
      throw new NotFoundException('API Key 不存在');
    }

    try {
      // 解密获取密钥
      const decrypted = this.decryptKeys(apiKey);

      // TODO: 调用交易所 API 验证（后续实现）
      // 目前模拟验证成功
      this.logger.log(`验证 API Key ${id} (${apiKey.exchange})`);

      // 更新验证时间和权限
      await this.prisma.client.api_keys.update({
        where: { id },
        data: {
          last_verified_at: new Date(),
          permissions: { spot: true, futures: true, withdraw: false },
        },
      });

      return {
        valid: true,
        permissions: ['spot', 'futures'],
      };
    } catch (error) {
      this.logger.error(`验证 API Key ${id} 失败: ${error.message}`);

      return {
        valid: false,
        error: error.message,
      };
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

    return {
      id: apiKey.id,
      exchange: apiKey.exchange,
      label: apiKey.label,
      permissions,
      isActive: apiKey.is_active,
      lastVerifiedAt: apiKey.last_verified_at,
      createdAt: apiKey.created_at,
    };
  }
}
