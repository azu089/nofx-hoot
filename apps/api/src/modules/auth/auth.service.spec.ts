import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

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
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
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
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('register', () => {
    // 正常路径
    it('should register a new user successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: mockUser.id,
        email: mockUser.email,
        nickname: mockUser.nickname,
        createdAt: mockUser.createdAt,
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');

      const result = await service.register({
        email: 'new@example.com',
        password: 'Password123',
      });

      expect(result.id).toBeDefined();
      expect(result.email).toBe(mockUser.email);
    });

    // 异常路径 - 邮箱已存在
    it('should throw ConflictException when email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'Password123',
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
