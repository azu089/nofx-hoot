import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { AirdropService } from '../airdrop/airdrop.service';
import { ReferralService } from '../referral/referral.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

// Mock ioredis 防止测试创建真实 Redis 连接（AuthService 构造函数中连接 Redis）
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
    disconnect: jest.fn(),
  }));
});

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    password: 'hashedpassword',
    nickname: 'test',
    createdAt: new Date(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
  };

  const mockEmailService = {
    sendVerificationCode: jest.fn(),
    sendWelcomeEmail: jest.fn(),
  };

  const mockAirdropService = {
    processRegistrationAirdrop: jest.fn(),
  };

  const mockReferralService = {
    processReferral: jest.fn(),
    bindInviteCode: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: AirdropService, useValue: mockAirdropService },
        { provide: ReferralService, useValue: mockReferralService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('register', () => {
    // 正常路径
    it('should register a new user successfully', async () => {
      const createdUser = {
        id: mockUser.id,
        email: mockUser.email,
        nickname: mockUser.nickname,
        createdAt: mockUser.createdAt,
      };
      // 第1次 findUnique: 验证邀请码 → 返回邀请人
      // 第2次 findUnique: 检查邮箱是否已存在 → null
      // 第3次 findUnique: sendVerificationCode 查找用户 → 返回用户(含 emailVerified=false)
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce({ id: 'inviter-id' }) // 邀请人存在
        .mockResolvedValueOnce(null) // 邮箱不存在
        .mockResolvedValueOnce({ ...createdUser, emailVerified: false });
      mockPrismaService.user.create.mockResolvedValue(createdUser);
      mockPrismaService.user.update.mockResolvedValue(createdUser);
      mockEmailService.sendVerificationCode.mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');

      const result = await service.register({
        email: 'new@example.com',
        password: 'Password123',
        inviteCode: 'TEST123',
      });

      expect(result.id).toBeDefined();
      expect(result.email).toBe(mockUser.email);
    });

    // 异常路径 - 邮箱已存在
    it('should throw ConflictException when email already exists', async () => {
      // 第1次 findUnique: 验证邀请码 → 邀请人存在
      // 第2次 findUnique: 检查邮箱 → 已存在
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce({ id: 'inviter-id' })
        .mockResolvedValueOnce(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'Password123',
          inviteCode: 'TEST123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    // 正常路径
    it('should login successfully with valid credentials', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'test@example.com',
        password: 'Password123',
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.email).toBe(mockUser.email);
    });

    // 异常路径 - 用户不存在
    it('should throw UnauthorizedException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'Password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    // 异常路径 - 密码错误
    it('should throw UnauthorizedException when password is wrong', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'WrongPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    // 正常路径
    it('should return user profile', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        usdtBalance: '100',
        hootBalance: '50',
      });

      const result = await service.getProfile('user-123');

      expect(result.email).toBe(mockUser.email);
    });

    // 边界路径 - 用户不存在
    it('should throw when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('nonexistent')).rejects.toThrow();
    });
  });
});
