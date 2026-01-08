import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { TelegramGuard } from './telegram.guard';

describe('TelegramGuard', () => {
  let guard: TelegramGuard;

  const TEST_BOT_TOKEN = '8328612196:AAEDw1-RFFuAEo0-n_gm6dbXCONHkxKOM34';

  // 生成有效的 initData
  function generateValidInitData(telegramUser: any): string {
    const authDate = Math.floor(Date.now() / 1000);
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

  // 生成过期的 initData
  function generateExpiredInitData(telegramUser: any): string {
    const authDate = Math.floor(Date.now() / 1000) - 600; // 10 分钟前
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

  // 创建 mock ExecutionContext
  function createMockContext(initData: string | undefined): ExecutionContext {
    const mockRequest = {
      headers: {
        'x-telegram-init-data': initData,
      },
      telegramUser: undefined,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'TELEGRAM_BOT_TOKEN') return TEST_BOT_TOKEN;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    guard = module.get<TelegramGuard>(TelegramGuard);
  });

  // ==================== 正常路径 ====================

  describe('valid initData', () => {
    it('should allow request with valid initData', async () => {
      const telegramUser = {
        id: 123456789,
        first_name: 'Test',
        username: 'testuser',
      };
      const initData = generateValidInitData(telegramUser);
      const context = createMockContext(initData);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should attach telegram user to request', async () => {
      const telegramUser = {
        id: 123456789,
        first_name: 'Test',
        username: 'testuser',
      };
      const initData = generateValidInitData(telegramUser);
      const context = createMockContext(initData);

      await guard.canActivate(context);

      const request = context.switchToHttp().getRequest();
      expect(request.telegramUser).toBeDefined();
      expect(request.telegramUser.id).toBe(123456789);
      expect(request.telegramUser.username).toBe('testuser');
    });
  });

  // ==================== 异常路径 ====================

  describe('missing initData', () => {
    it('should throw UnauthorizedException when initData is missing', async () => {
      const context = createMockContext(undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(
        '缺少 Telegram 认证数据',
      );
    });

    it('should throw UnauthorizedException when initData is empty', async () => {
      const context = createMockContext('');

      await expect(guard.canActivate(context)).rejects.toThrow(
        '缺少 Telegram 认证数据',
      );
    });
  });

  describe('invalid signature', () => {
    it('should throw UnauthorizedException for invalid hash', async () => {
      const invalidInitData = 'auth_date=1234567890&user=%7B%22id%22%3A123%7D&hash=invalid_hash';
      const context = createMockContext(invalidInitData);

      await expect(guard.canActivate(context)).rejects.toThrow(
        'Telegram 认证失败',
      );
    });

    it('should throw UnauthorizedException for tampered data', async () => {
      const telegramUser = { id: 123456789, first_name: 'Test' };
      const validInitData = generateValidInitData(telegramUser);

      // 篡改用户 ID
      const tamperedInitData = validInitData.replace('123456789', '999999999');
      const context = createMockContext(tamperedInitData);

      await expect(guard.canActivate(context)).rejects.toThrow(
        'Telegram 认证失败',
      );
    });

    it('should throw UnauthorizedException for missing hash', async () => {
      const noHashInitData = 'auth_date=1234567890&user=%7B%22id%22%3A123%7D';
      const context = createMockContext(noHashInitData);

      await expect(guard.canActivate(context)).rejects.toThrow(
        'Telegram 认证失败',
      );
    });
  });

  describe('expired initData', () => {
    it('should throw UnauthorizedException for expired data', async () => {
      const telegramUser = { id: 123456789, first_name: 'Test' };
      const expiredInitData = generateExpiredInitData(telegramUser);
      const context = createMockContext(expiredInitData);

      await expect(guard.canActivate(context)).rejects.toThrow(
        'Telegram 认证失败',
      );
    });
  });

  // ==================== 边界路径 ====================

  describe('edge cases', () => {
    it('should handle user without username', async () => {
      const userWithoutUsername = {
        id: 123456789,
        first_name: 'Test',
      };
      const initData = generateValidInitData(userWithoutUsername);
      const context = createMockContext(initData);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      const request = context.switchToHttp().getRequest();
      expect(request.telegramUser.username).toBeUndefined();
    });

    it('should handle user with special characters in name', async () => {
      const userWithSpecialChars = {
        id: 123456789,
        first_name: '测试用户 🎉',
        username: 'test_user_123',
      };
      const initData = generateValidInitData(userWithSpecialChars);
      const context = createMockContext(initData);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      const request = context.switchToHttp().getRequest();
      expect(request.telegramUser.first_name).toBe('测试用户 🎉');
    });

    it('should handle very long user data', async () => {
      const longBioUser = {
        id: 123456789,
        first_name: 'A'.repeat(100),
        last_name: 'B'.repeat(100),
        username: 'testuser',
        language_code: 'en',
      };
      const initData = generateValidInitData(longBioUser);
      const context = createMockContext(initData);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle malformed JSON in user field', async () => {
      const authDate = Math.floor(Date.now() / 1000);
      const params = new URLSearchParams();
      params.append('auth_date', authDate.toString());
      params.append('user', '{invalid json}');

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
      const initData = params.toString();
      const context = createMockContext(initData);

      // 应该通过验证但 telegramUser 可能为 undefined
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  // ==================== Bot Token 配置测试 ====================

  describe('bot token configuration', () => {
    it('should throw UnauthorizedException when bot token not configured', async () => {
      // 创建没有 bot token 的 guard
      const moduleWithoutToken = await Test.createTestingModule({
        providers: [
          TelegramGuard,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
        ],
      }).compile();

      const guardWithoutToken = moduleWithoutToken.get<TelegramGuard>(TelegramGuard);

      const telegramUser = { id: 123456789, first_name: 'Test' };
      const initData = generateValidInitData(telegramUser);
      const context = createMockContext(initData);

      await expect(guardWithoutToken.canActivate(context)).rejects.toThrow(
        'Telegram 认证未配置',
      );
    });
  });
});
