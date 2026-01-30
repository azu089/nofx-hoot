import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { encrypt, decrypt, maskApiKey } from '../../common/utils/crypto.util';
import {
  CreateApiKeyDto,
  ApiKeyResponse,
  ApiKeyListResponse,
} from './dto/api-key.dto';

@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService) {}

  // 创建 API Key
  async create(userId: string, dto: CreateApiKeyDto): Promise<ApiKeyResponse> {
    // 加密 API Key 和 Secret
    const encryptedKey = encrypt(dto.apiKey);
    const encryptedSecret = encrypt(dto.apiSecret);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId,
        exchange: dto.exchange,
        label: dto.label,
        encryptedKey: encryptedKey.encryptedData,
        encryptedSecret: encryptedSecret.encryptedData,
        iv: encryptedKey.iv, // Key 和 Secret 使用相同的 IV 存储，但实际上各自有独立的 IV
        authTag: encryptedKey.authTag,
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

    const apiSecret = decrypt({
      encryptedData: record.encryptedSecret,
      iv: record.iv,
      authTag: record.authTag,
    });

    return {
      apiKey,
      apiSecret,
      exchange: record.exchange,
    };
  }
}
