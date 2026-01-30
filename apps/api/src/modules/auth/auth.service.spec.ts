import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock_jwt_token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);

    // 清理 mock
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'password123',
      nickname: 'TestUser',
    };

    // 正常路径
    it('应该成功注册新用户', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-123',
        email: registerDto.email,
        nickname: registerDto.nickname,
        createdAt: new Date(),
      });

      const result = await service.register(registerDto);

      expect(result.id).toBe('user-123');
      expect(result.email).toBe(registerDto.email);
      expect(result.nickname).toBe(registerDto.nickname);
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
    });

    // 异常路径
    it('邮箱已存在时应抛出 ConflictException', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: registerDto.email,
      });

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      await expect(service.register(registerDto)).rejects.toThrow('邮箱已被注册');
    });

    // 边界路径 - 无昵称
    it('无昵称时应使用邮箱前缀作为昵称', async () => {
      const dtoWithoutNickname = {
        email: 'user@test.com',
        password: 'password123',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockImplementation(({ data }) => ({
        id: 'user-456',
        email: data.email,
        nickname: data.nickname,
        createdAt: new Date(),
      }));

      await service.register(dtoWithoutNickname);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nickname: 'user', // 邮箱 @ 前的部分
        }),
        select: expect.any(Object),
      });
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockUser = {
      id: 'user-123',
      email: loginDto.email,
      password: 'hashed_password',
      nickname: 'TestUser',
    };

    // 正常路径
    it('应该成功登录并返回 token', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(result.accessToken).toBe('mock_jwt_token');
      expect(result.user.id).toBe(mockUser.id);
      expect(result.user.email).toBe(mockUser.email);
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
      });
    });

    // 异常路径 - 用户不存在
    it('用户不存在时应抛出 UnauthorizedException', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('邮箱或密码错误');
    });

    // 异常路径 - 密码错误
    it('密码错误时应抛出 UnauthorizedException', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('邮箱或密码错误');
    });
  });

  describe('getProfile', () => {
    // 正常路径
    it('应该返回用户信息', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        nickname: 'TestUser',
        createdAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getProfile('user-123');

      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
    });

    // 异常路径 - 用户不存在
    it('用户不存在时应抛出 UnauthorizedException', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('non-existent')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('generateBindCode', () => {
    // 正常路径
    it('应该生成 6 位绑定码', async () => {
      const result = await service.generateBindCode('user-123');

      expect(result.bindCode).toBeDefined();
      expect(result.bindCode.length).toBe(6);
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('bindTelegram', () => {
    const bindDto = {
      bindCode: 'ABC123',
      telegramId: '123456789',
      telegramUsername: 'testuser',
    };

    // 异常路径 - 绑定码无效
    it('绑定码无效时应抛出 BadRequestException', async () => {
      await expect(service.bindTelegram(bindDto)).rejects.toThrow(BadRequestException);
      await expect(service.bindTelegram(bindDto)).rejects.toThrow('绑定码无效或已过期');
    });

    // 正常路径 - 需要先生成绑定码
    it('应该成功绑定 Telegram', async () => {
      // 先生成绑定码
      const { bindCode } = await service.generateBindCode('user-123');

      mockPrismaService.user.findUnique.mockResolvedValueOnce(null); // Telegram ID 未绑定
      mockPrismaService.user.update.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        nickname: 'TestUser',
        usdtBalance: { toString: () => '100' },
        hootBalance: { toString: () => '50' },
      });

      const result = await service.bindTelegram({
        bindCode,
        telegramId: '123456789',
        telegramUsername: 'testuser',
      });

      expect(result.id).toBe('user-123');
    });

    // 异常路径 - Telegram 已绑定其他用户
    it('Telegram 已绑定时应抛出 ConflictException', async () => {
      const { bindCode } = await service.generateBindCode('user-123');

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'other-user',
        telegramId: '123456789',
      });

      await expect(
        service.bindTelegram({
          bindCode,
          telegramId: '123456789',
          telegramUsername: 'testuser',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getUserByTelegramId', () => {
    // 正常路径
    it('应该返回用户信息', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        nickname: 'TestUser',
        usdtBalance: { toString: () => '100.00000000' },
        hootBalance: { toString: () => '50.00000000' },
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getUserByTelegramId('123456789');

      expect(result?.id).toBe(mockUser.id);
      expect(result?.usdtBalance).toBe('100.00000000');
    });

    // 边界路径 - 用户不存在
    it('用户不存在时应返回 null', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.getUserByTelegramId('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('unbindTelegram', () => {
    // 正常路径
    it('应该成功解绑 Telegram', async () => {
      mockPrismaService.user.update.mockResolvedValue({});

      await service.unbindTelegram('user-123');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          telegramId: null,
          telegramUsername: null,
        },
      });
    });
  });
});
