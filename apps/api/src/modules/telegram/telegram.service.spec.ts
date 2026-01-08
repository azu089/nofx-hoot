import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as crypto from 'crypto';
import { TelegramService } from './telegram.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('TelegramService', () => {
  let service: TelegramService;
  let prismaService: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;

  // 测试用 Bot Token
  const TEST_BOT_TOKEN = '8328612196:AAEDw1-RFFuAEo0-n_gm6dbXCONHkxKOM34';

  // 生成有效的 initData
  function generateValidInitData(telegramUser: any, overrides: any = {}): string {
    const authDate = Math.floor(Date.now() / 1000);
    const userJson = JSON.stringify(telegramUser);

    const params = new URLSearchParams();
    params.append('auth_date', authDate.toString());
    params.append('user', userJson);
    if (overrides.query_id) params.append('query_id', overrides.query_id);

    // 按字母顺序排列并构建数据检查字符串
    const dataCheckArr: string[] = [];
    params.forEach((value, key) => {
      dataCheckArr.push(`${key}=${value}`);
    });
    dataCheckArr.sort();
    const dataCheckString = dataCheckArr.join('\n');

    // 计算 HMAC-SHA256 签名
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(TEST_BOT_TOKEN)
      .digest();

    const hash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    params.append('hash', hash);

    return params.toString();
  }

  // 生成过期的 initData
  function generateExpiredInitData(telegramUser: any): string {
    const authDate = Math.floor(Date.now() / 1000) - 600; // 10 分钟前（已过期）
    const userJson = JSON.stringify(telegramUser);

    const params = new URLSearchParams();
    params.append('auth_date', authDate.toString());
    params.append('user', userJson);

    const dataCheckArr: string[] = [];
    params.forEach((value, key) => {
      dataCheckArr.push(`${key}=${value}`);
    });
    dataCheckArr.sort();
    const dataCheckString = dataCheckArr.join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(TEST_BOT_TOKEN)
      .digest();

    const hash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    params.append('hash', hash);

    return params.toString();
  }

  beforeEach(async () => {
    // 创建 mock PrismaService
    const mockPrismaClient = {
      users: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      telegram_login_logs: {
        create: jest.fn(),
      },
    };

    prismaService = {
      client: mockPrismaClient,
    } as any;

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'TELEGRAM_BOT_TOKEN') return TEST_BOT_TOKEN;
              return undefined;
            }),
          },
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
      ],
    }).compile();

    service = module.get<TelegramService>(TelegramService);
  });

  describe('authenticate', () => {
    const mockTelegramUser = {
      id: 123456789,
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
      language_code: 'en',
    };

    // ==================== 正常路径 ====================

    it('should authenticate new Telegram user and create account', async () => {
      const initData = generateValidInitData(mockTelegramUser);

      // Mock: 用户不存在
      (prismaService.client.users.findUnique as jest.Mock).mockResolvedValue(null);

      // Mock: 创建用户成功
      const createdUser = {
        id: 'new-user-uuid',
        email: `tg_${mockTelegramUser.id}@telegram.local`,
        telegram_id: BigInt(mockTelegramUser.id),
        telegram_username: mockTelegramUser.username,
        telegram_first_name: mockTelegramUser.first_name,
        vip_level: 0,
        wallets: { usdt_balance: 0 },
      };
      (prismaService.client.users.create as jest.Mock).mockResolvedValue(createdUser);
      (prismaService.client.telegram_login_logs.create as jest.Mock).mockResolvedValue({});

      const result = await service.authenticate({ initData }, '127.0.0.1');

      expect(result.isNewUser).toBe(true);
      expect(result.userId).toBe('new-user-uuid');
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.refreshToken).toBe('mock-jwt-token');
      expect(prismaService.client.users.create).toHaveBeenCalled();
    });

    it('should authenticate existing Telegram user', async () => {
      const initData = generateValidInitData(mockTelegramUser);

      // Mock: 用户已存在
      const existingUser = {
        id: 'existing-user-uuid',
        email: `tg_${mockTelegramUser.id}@telegram.local`,
        telegram_id: BigInt(mockTelegramUser.id),
        telegram_username: mockTelegramUser.username,
        telegram_first_name: mockTelegramUser.first_name,
        vip_level: 1,
        wallets: { usdt_balance: 100 },
      };
      (prismaService.client.users.findUnique as jest.Mock).mockResolvedValue(existingUser);
      (prismaService.client.users.update as jest.Mock).mockResolvedValue(existingUser);
      (prismaService.client.telegram_login_logs.create as jest.Mock).mockResolvedValue({});

      const result = await service.authenticate({ initData }, '127.0.0.1');

      expect(result.isNewUser).toBe(false);
      expect(result.userId).toBe('existing-user-uuid');
      expect(prismaService.client.users.update).toHaveBeenCalled();
    });

    // ==================== 异常路径 ====================

    it('should throw UnauthorizedException for invalid signature', async () => {
      const invalidInitData = 'auth_date=1234567890&user=%7B%22id%22%3A123%7D&hash=invalid_hash';

      (prismaService.client.telegram_login_logs.create as jest.Mock).mockResolvedValue({});

      await expect(service.authenticate({ initData: invalidInitData })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for expired initData', async () => {
      const expiredInitData = generateExpiredInitData(mockTelegramUser);

      (prismaService.client.telegram_login_logs.create as jest.Mock).mockResolvedValue({});

      await expect(service.authenticate({ initData: expiredInitData })).rejects.toThrow(
        '认证数据已过期',
      );
    });

    it('should throw UnauthorizedException when hash is missing', async () => {
      const noHashInitData = 'auth_date=1234567890&user=%7B%22id%22%3A123%7D';

      (prismaService.client.telegram_login_logs.create as jest.Mock).mockResolvedValue({});

      await expect(service.authenticate({ initData: noHashInitData })).rejects.toThrow(
        '缺少签名哈希',
      );
    });

    // ==================== 边界路径 ====================

    it('should handle user without username', async () => {
      const userWithoutUsername = {
        id: 987654321,
        first_name: 'NoUsername',
      };
      const initData = generateValidInitData(userWithoutUsername);

      (prismaService.client.users.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.client.users.create as jest.Mock).mockResolvedValue({
        id: 'new-user-uuid',
        email: `tg_${userWithoutUsername.id}@telegram.local`,
        telegram_id: BigInt(userWithoutUsername.id),
        telegram_username: null,
        telegram_first_name: userWithoutUsername.first_name,
        vip_level: 0,
        wallets: {},
      });
      (prismaService.client.telegram_login_logs.create as jest.Mock).mockResolvedValue({});

      const result = await service.authenticate({ initData });

      expect(result.isNewUser).toBe(true);
      expect(prismaService.client.users.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            telegram_username: null,
          }),
        }),
      );
    });

    it('should handle empty initData', async () => {
      (prismaService.client.telegram_login_logs.create as jest.Mock).mockResolvedValue({});

      await expect(service.authenticate({ initData: '' })).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('linkTelegram', () => {
    const mockTelegramUser = {
      id: 123456789,
      first_name: 'Test',
      username: 'testuser',
    };

    // ==================== 正常路径 ====================

    it('should link Telegram account to existing user', async () => {
      const initData = generateValidInitData(mockTelegramUser);
      const userId = 'existing-user-uuid';

      // Mock: Telegram 未被其他用户绑定
      (prismaService.client.users.findUnique as jest.Mock).mockResolvedValue(null);

      // Mock: 绑定成功
      (prismaService.client.users.update as jest.Mock).mockResolvedValue({
        id: userId,
        telegram_id: BigInt(mockTelegramUser.id),
        telegram_username: mockTelegramUser.username,
        telegram_first_name: mockTelegramUser.first_name,
        telegram_linked_at: new Date(),
      });
      (prismaService.client.telegram_login_logs.create as jest.Mock).mockResolvedValue({});

      const result = await service.linkTelegram(userId, initData);

      expect(result.isLinked).toBe(true);
      expect(result.telegramUsername).toBe(mockTelegramUser.username);
    });

    // ==================== 异常路径 ====================

    it('should throw ConflictException when Telegram already linked to another user', async () => {
      const initData = generateValidInitData(mockTelegramUser);
      const userId = 'current-user-uuid';

      // Mock: Telegram 已被其他用户绑定
      (prismaService.client.users.findUnique as jest.Mock).mockResolvedValue({
        id: 'another-user-uuid',
        telegram_id: BigInt(mockTelegramUser.id),
      });

      await expect(service.linkTelegram(userId, initData)).rejects.toThrow(
        '该 Telegram 账户已绑定其他用户',
      );
    });

    // ==================== 边界路径 ====================

    it('should allow relinking same Telegram to same user', async () => {
      const initData = generateValidInitData(mockTelegramUser);
      const userId = 'same-user-uuid';

      // Mock: Telegram 已绑定到同一用户
      (prismaService.client.users.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        telegram_id: BigInt(mockTelegramUser.id),
      });

      (prismaService.client.users.update as jest.Mock).mockResolvedValue({
        id: userId,
        telegram_id: BigInt(mockTelegramUser.id),
        telegram_username: mockTelegramUser.username,
        telegram_first_name: mockTelegramUser.first_name,
        telegram_linked_at: new Date(),
      });
      (prismaService.client.telegram_login_logs.create as jest.Mock).mockResolvedValue({});

      const result = await service.linkTelegram(userId, initData);

      expect(result.isLinked).toBe(true);
    });
  });

  describe('unlinkTelegram', () => {
    // ==================== 正常路径 ====================

    it('should unlink Telegram when user has email login', async () => {
      const userId = 'user-uuid';

      (prismaService.client.users.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        email: 'user@example.com',
        password_hash: 'hashed_password',
        telegram_id: BigInt(123456789),
      });

      (prismaService.client.users.update as jest.Mock).mockResolvedValue({
        id: userId,
        telegram_id: null,
      });

      const result = await service.unlinkTelegram(userId);

      expect(result.isLinked).toBe(false);
    });

    // ==================== 异常路径 ====================

    it('should throw UnauthorizedException when user not found', async () => {
      (prismaService.client.users.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.unlinkTelegram('non-existent-uuid')).rejects.toThrow('用户不存在');
    });

    it('should throw ConflictException when user has no other login method', async () => {
      const userId = 'telegram-only-user';

      (prismaService.client.users.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        email: 'tg_123@telegram.local',
        password_hash: '',
        telegram_id: BigInt(123456789),
      });

      await expect(service.unlinkTelegram(userId)).rejects.toThrow(
        '请先绑定邮箱后再解绑 Telegram',
      );
    });
  });

  describe('getLinkStatus', () => {
    // ==================== 正常路径 ====================

    it('should return linked status when user has Telegram linked', async () => {
      const userId = 'user-uuid';

      (prismaService.client.users.findUnique as jest.Mock).mockResolvedValue({
        telegram_id: BigInt(123456789),
        telegram_username: 'testuser',
        telegram_first_name: 'Test',
        telegram_linked_at: new Date(),
      });

      const result = await service.getLinkStatus(userId);

      expect(result.isLinked).toBe(true);
      expect(result.telegramUsername).toBe('testuser');
    });

    it('should return not linked status when user has no Telegram', async () => {
      const userId = 'user-uuid';

      (prismaService.client.users.findUnique as jest.Mock).mockResolvedValue({
        telegram_id: null,
        telegram_username: null,
        telegram_first_name: null,
        telegram_linked_at: null,
      });

      const result = await service.getLinkStatus(userId);

      expect(result.isLinked).toBe(false);
      expect(result.telegramUsername).toBeUndefined();
    });

    // ==================== 异常路径 ====================

    it('should throw when user not found', async () => {
      (prismaService.client.users.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getLinkStatus('non-existent')).rejects.toThrow('用户不存在');
    });
  });

  // ==================== 签名验证测试 ====================

  describe('initData signature verification', () => {
    it('should verify valid signature correctly', async () => {
      const telegramUser = {
        id: 123456789,
        first_name: 'Test',
        username: 'testuser',
      };
      const initData = generateValidInitData(telegramUser);

      // 如果签名无效，authenticate 会抛出异常
      (prismaService.client.users.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.client.users.create as jest.Mock).mockResolvedValue({
        id: 'new-user-uuid',
        email: `tg_${telegramUser.id}@telegram.local`,
        telegram_id: BigInt(telegramUser.id),
        vip_level: 0,
        wallets: {},
      });
      (prismaService.client.telegram_login_logs.create as jest.Mock).mockResolvedValue({});

      // 如果没有抛出异常，说明签名验证通过
      await expect(service.authenticate({ initData })).resolves.toBeDefined();
    });

    it('should reject tampered data', async () => {
      const telegramUser = {
        id: 123456789,
        first_name: 'Test',
      };
      const validInitData = generateValidInitData(telegramUser);

      // 篡改数据：修改用户 ID
      const tamperedInitData = validInitData.replace('123456789', '999999999');

      (prismaService.client.telegram_login_logs.create as jest.Mock).mockResolvedValue({});

      await expect(service.authenticate({ initData: tamperedInitData })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject wrong bot token signature', async () => {
      // 使用不同的 bot token 生成签名
      const authDate = Math.floor(Date.now() / 1000);
      const telegramUser = { id: 123456789, first_name: 'Test' };
      const userJson = JSON.stringify(telegramUser);

      const params = new URLSearchParams();
      params.append('auth_date', authDate.toString());
      params.append('user', userJson);

      const dataCheckArr: string[] = [];
      params.forEach((value, key) => {
        dataCheckArr.push(`${key}=${value}`);
      });
      dataCheckArr.sort();
      const dataCheckString = dataCheckArr.join('\n');

      // 使用错误的 bot token
      const wrongToken = '0000000000:WRONG_TOKEN';
      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(wrongToken)
        .digest();

      const hash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      params.append('hash', hash);
      const wrongSignatureInitData = params.toString();

      (prismaService.client.telegram_login_logs.create as jest.Mock).mockResolvedValue({});

      await expect(service.authenticate({ initData: wrongSignatureInitData })).rejects.toThrow(
        '签名验证失败',
      );
    });
  });
});
