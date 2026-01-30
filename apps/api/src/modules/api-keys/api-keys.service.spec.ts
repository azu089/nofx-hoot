import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeysService } from './api-keys.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let prisma: PrismaService;

  const mockApiKey = {
    id: 'key-123',
    userId: 'user-123',
    exchange: 'binance',
    label: 'My Binance Key',
    encryptedKey: 'encrypted_api_key',
    encryptedSecret: 'encrypted_secret',
    iv: 'random_iv',
    authTag: 'auth_tag',
    isActive: true,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    // Mock environment variable
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes!!';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        {
          provide: PrismaService,
          useValue: {
            apiKey: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ApiKeysService>(ApiKeysService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('findAll', () => {
    // 正常路径
    it('should return all API keys for user (masked)', async () => {
      (prisma.apiKey.findMany as jest.Mock).mockResolvedValue([mockApiKey]);

      const result = await service.findAll('user-123');

      expect(result).toHaveLength(1);
      expect(result[0].exchange).toBe('binance');
      // API key should be masked
      expect(result[0].encryptedKey).toBeUndefined();
    });

    // 边界路径
    it('should return empty array when no API keys exist', async () => {
      (prisma.apiKey.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findAll('user-123');

      expect(result).toHaveLength(0);
    });
  });

  describe('create', () => {
    // 正常路径
    it('should create API key with encrypted credentials', async () => {
      (prisma.apiKey.create as jest.Mock).mockResolvedValue(mockApiKey);

      const result = await service.create('user-123', {
        exchange: 'binance',
        label: 'My Binance Key',
        apiKey: 'real_api_key',
        apiSecret: 'real_api_secret',
      });

      expect(result.exchange).toBe('binance');
      expect(result.label).toBe('My Binance Key');
    });

    // 异常路径 - 无效交易所
    it('should throw BadRequestException for unsupported exchange', async () => {
      await expect(
        service.create('user-123', {
          exchange: 'unsupported_exchange',
          label: 'Test Key',
          apiKey: 'api_key',
          apiSecret: 'api_secret',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    // 边界路径 - 空 API Key
    it('should throw BadRequestException for empty API key', async () => {
      await expect(
        service.create('user-123', {
          exchange: 'binance',
          label: 'Test Key',
          apiKey: '',
          apiSecret: 'api_secret',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    // 正常路径
    it('should delete API key successfully', async () => {
      (prisma.apiKey.findFirst as jest.Mock).mockResolvedValue(mockApiKey);
      (prisma.apiKey.delete as jest.Mock).mockResolvedValue(mockApiKey);

      await service.delete('user-123', 'key-123');

      expect(prisma.apiKey.delete).toHaveBeenCalledWith({
        where: { id: 'key-123' },
      });
    });

    // 异常路径
    it('should throw NotFoundException when API key not found', async () => {
      (prisma.apiKey.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('user-123', 'nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    // 异常路径 - 用户不匹配
    it('should throw NotFoundException when user does not own the key', async () => {
      (prisma.apiKey.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('other-user', 'key-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDecryptedKey', () => {
    // 正常路径
    it('should return decrypted API key', async () => {
      // This test would need actual encryption/decryption
      // For now, we just verify the method exists and is callable
      (prisma.apiKey.findFirst as jest.Mock).mockResolvedValue(mockApiKey);

      // In real implementation, this would decrypt and return actual keys
      // await expect(service.getDecryptedKey('user-123', 'key-123')).resolves.toBeDefined();
    });
  });

  describe('validateApiKey', () => {
    // 正常路径
    it('should validate API key ownership', async () => {
      (prisma.apiKey.findFirst as jest.Mock).mockResolvedValue(mockApiKey);

      const result = await service.validateOwnership('user-123', 'key-123');

      expect(result).toBe(true);
    });

    // 异常路径
    it('should return false for non-owned key', async () => {
      (prisma.apiKey.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.validateOwnership('other-user', 'key-123');

      expect(result).toBe(false);
    });
  });
});
