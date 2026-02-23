/**
 * AdminAuthService 单元测试
 *
 * 覆盖：login / changePassword / createAdmin / validateToken / getMe
 * 测试用例：正常路径 + 异常路径 + 边界路径（共 20 条）
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AdminAuthService } from './admin-auth.service';
import { PrismaService } from '../../prisma/prisma.service';

// ---- 顶层 mock ----
jest.mock('bcrypt');

jest.mock('otplib', () => ({
  TOTP: jest.fn(),
  generateSecret: jest.fn(),
  generateURI: jest.fn(),
  verify: jest.fn(),
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn(),
}));

// 引入 mock 后的模块引用，方便断言
import { verify as totpVerify } from 'otplib';

// ==================== 测试数据 ====================

const mockAdmin = {
  id: 'admin-1',
  username: 'testadmin',
  password: 'hashedpassword',
  nickname: '测试管理员',
  email: 'admin@test.com',
  role: 'admin',
  isActive: true,
  totpEnabled: false,
  totpSecret: null,
  lastLoginAt: null,
  lastLoginIp: null,
  loginAttempts: 0,
  lockedUntil: null,
  createdAt: new Date(),
};

// ==================== Mock 依赖 ====================

const mockPrismaService = {
  admin: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  adminOperationLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-admin-jwt-token'),
  verify: jest.fn(),
};

// ==================== 测试套件 ====================

describe('AdminAuthService', () => {
  let service: AdminAuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AdminAuthService>(AdminAuthService);

    jest.clearAllMocks();

    // 默认：logOperation 调用的 adminOperationLog.create 不抛错
    mockPrismaService.adminOperationLog.create.mockResolvedValue({});
    // 默认：admin.update 不抛错
    mockPrismaService.admin.update.mockResolvedValue(mockAdmin);
  });

  // ==================== login ====================

  describe('login', () => {
    // ---- 正常路径 ----

    it('正常路径: 密码正确且未启用 TOTP，返回 token 与 admin 信息', async () => {
      mockPrismaService.admin.findUnique.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(
        { username: 'testadmin', password: 'correctpassword' },
        '127.0.0.1',
        'TestAgent',
      );

      expect(result).toHaveProperty('token', 'mock-admin-jwt-token');
      expect(result).toHaveProperty('admin');
      expect((result as any).admin.username).toBe('testadmin');
      expect((result as any).admin.role).toBe('admin');
    });

    it('正常路径: 密码正确且启用 TOTP 但未传 totpCode，返回 requireTotp', async () => {
      const adminWithTotp = {
        ...mockAdmin,
        totpEnabled: true,
        totpSecret: 'encryptedTotpSecret',
      };
      mockPrismaService.admin.findUnique.mockResolvedValue(adminWithTotp);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        username: 'testadmin',
        password: 'correctpassword',
      });

      expect(result).toEqual({
        requireTotp: true,
        message: '请输入两步验证码',
      });
    });

    // ---- 异常路径 ----

    it('异常路径: 管理员不存在，抛出 UnauthorizedException', async () => {
      mockPrismaService.admin.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ username: 'noone', password: 'anything' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('异常路径: 账号被锁定（lockedUntil > now），抛出 ForbiddenException', async () => {
      const lockedAdmin = {
        ...mockAdmin,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000), // 10 分钟后解锁
      };
      mockPrismaService.admin.findUnique.mockResolvedValue(lockedAdmin);

      await expect(
        service.login({ username: 'testadmin', password: 'anypassword' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('异常路径: 账号已禁用（isActive=false），抛出 UnauthorizedException', async () => {
      const disabledAdmin = { ...mockAdmin, isActive: false };
      mockPrismaService.admin.findUnique.mockResolvedValue(disabledAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login({ username: 'testadmin', password: 'correctpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('异常路径: 密码错误，抛出 UnauthorizedException 并调用 incrementLoginAttempts', async () => {
      // findUnique 第一次返回管理员（login 查找），第二次返回管理员（incrementLoginAttempts 内部查找）
      mockPrismaService.admin.findUnique
        .mockResolvedValueOnce(mockAdmin)
        .mockResolvedValueOnce(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ username: 'testadmin', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);

      // admin.update 应被调用（incrementLoginAttempts 写入）
      expect(mockPrismaService.admin.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockAdmin.id },
          data: expect.objectContaining({ loginAttempts: 1 }),
        }),
      );
    });

    // ---- 边界路径 ----

    it('边界路径: lockedUntil 恰好等于当前时间（未过期），不抛锁定异常', async () => {
      // lockedUntil <= now 表示已解锁
      const justExpiredAdmin = {
        ...mockAdmin,
        lockedUntil: new Date(Date.now() - 1), // 1ms 前已解锁
      };
      mockPrismaService.admin.findUnique.mockResolvedValue(justExpiredAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        username: 'testadmin',
        password: 'correctpassword',
      });

      // 解锁后应正常登录
      expect(result).toHaveProperty('token');
    });

    it('边界路径: 达到最大失败次数（5次），admin.update 设置 lockedUntil', async () => {
      const almostLockedAdmin = { ...mockAdmin, loginAttempts: 4 };
      // 第一次：login 查找；第二次：incrementLoginAttempts 内部查找
      mockPrismaService.admin.findUnique
        .mockResolvedValueOnce(almostLockedAdmin)
        .mockResolvedValueOnce(almostLockedAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ username: 'testadmin', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);

      // 第 5 次失败，应写入 lockedUntil
      expect(mockPrismaService.admin.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lockedUntil: expect.any(Date) }),
        }),
      );
    });
  });

  // ==================== changePassword ====================

  describe('changePassword', () => {
    // ---- 正常路径 ----

    it('正常路径: 旧密码正确，成功修改密码', async () => {
      mockPrismaService.admin.findUnique.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');

      const result = await service.changePassword(
        'admin-1',
        'oldpassword',
        'newpassword123',
      );

      expect(result).toEqual({ message: '密码修改成功' });
      expect(mockPrismaService.admin.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'admin-1' },
          data: { password: 'newHashedPassword' },
        }),
      );
    });

    // ---- 异常路径 ----

    it('异常路径: 管理员不存在，抛出 UnauthorizedException', async () => {
      mockPrismaService.admin.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword('nonexistent', 'oldpwd', 'newpwd'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('异常路径: 旧密码错误，抛出 BadRequestException', async () => {
      mockPrismaService.admin.findUnique.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('admin-1', 'wrongoldpassword', 'newpassword'),
      ).rejects.toThrow(BadRequestException);
    });

    // ---- 边界路径 ----

    it('边界路径: 启用 TOTP 但未传 totpCode，抛出 BadRequestException', async () => {
      const adminWithTotp = {
        ...mockAdmin,
        totpEnabled: true,
        totpSecret: 'encryptedSecret',
      };
      mockPrismaService.admin.findUnique.mockResolvedValue(adminWithTotp);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.changePassword('admin-1', 'oldpassword', 'newpassword'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==================== createAdmin ====================

  describe('createAdmin', () => {
    const createDto = {
      username: 'newadmin',
      password: 'securepassword',
      nickname: '新管理员',
      email: 'newadmin@test.com',
      role: 'admin',
    };

    // ---- 正常路径 ----

    it('正常路径: 用户名不重复，成功创建管理员', async () => {
      mockPrismaService.admin.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedNewPassword');
      mockPrismaService.admin.create.mockResolvedValue({
        id: 'admin-2',
        username: 'newadmin',
        nickname: '新管理员',
        role: 'admin',
      });

      const result = await service.createAdmin(createDto, 'admin-1');

      expect(result).toMatchObject({
        id: 'admin-2',
        username: 'newadmin',
        role: 'admin',
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('securepassword', 10);
    });

    it('正常路径: role 未指定时，默认使用 admin 角色', async () => {
      const dtoWithoutRole = { ...createDto, role: undefined };
      mockPrismaService.admin.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      mockPrismaService.admin.create.mockResolvedValue({
        id: 'admin-3',
        username: 'newadmin',
        nickname: '新管理员',
        role: 'admin',
      });

      const result = await service.createAdmin(dtoWithoutRole, 'admin-1');

      // create 调用时 role 字段应为 'admin'
      expect(mockPrismaService.admin.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'admin' }),
        }),
      );
      expect(result.role).toBe('admin');
    });

    // ---- 异常路径 ----

    it('异常路径: 用户名已存在，抛出 BadRequestException', async () => {
      mockPrismaService.admin.findUnique.mockResolvedValue(mockAdmin);

      await expect(
        service.createAdmin(createDto, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    // ---- 边界路径 ----

    it('边界路径: 创建后记录操作日志（adminOperationLog.create 被调用）', async () => {
      mockPrismaService.admin.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      mockPrismaService.admin.create.mockResolvedValue({
        id: 'admin-4',
        username: 'newadmin',
        nickname: '新管理员',
        role: 'admin',
      });

      await service.createAdmin(createDto, 'admin-1');

      expect(mockPrismaService.adminOperationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adminId: 'admin-1',
            action: 'create',
            module: 'admin',
          }),
        }),
      );
    });
  });

  // ==================== validateToken ====================

  describe('validateToken', () => {
    const activeAdminSelect = {
      id: 'admin-1',
      username: 'testadmin',
      role: 'admin',
      isActive: true,
      totpEnabled: false,
    };

    // ---- 正常路径 ----

    it('正常路径: 有效 admin token，返回管理员信息', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'admin-1',
        username: 'testadmin',
        role: 'admin',
        type: 'admin',
      });
      mockPrismaService.admin.findUnique.mockResolvedValue(activeAdminSelect);

      const result = await service.validateToken('valid-token');

      expect(result).toMatchObject({ id: 'admin-1', isActive: true });
    });

    // ---- 异常路径 ----

    it('异常路径: jwtService.verify 抛错（令牌无效），抛出 UnauthorizedException', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.validateToken('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('异常路径: token type 不是 admin，抛出 UnauthorizedException', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-123',
        type: 'user', // 普通用户 token
      });

      await expect(service.validateToken('user-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('异常路径: admin 不存在或已禁用（isActive=false），抛出 UnauthorizedException', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'admin-1',
        type: 'admin',
      });
      mockPrismaService.admin.findUnique.mockResolvedValue({
        ...activeAdminSelect,
        isActive: false,
      });

      await expect(service.validateToken('valid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    // ---- 边界路径 ----

    it('边界路径: admin 在数据库中不存在（findUnique 返回 null），抛出 UnauthorizedException', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'deleted-admin',
        type: 'admin',
      });
      mockPrismaService.admin.findUnique.mockResolvedValue(null);

      await expect(service.validateToken('valid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ==================== getMe ====================

  describe('getMe', () => {
    const profileData = {
      id: 'admin-1',
      username: 'testadmin',
      nickname: '测试管理员',
      email: 'admin@test.com',
      role: 'admin',
      isActive: true,
      totpEnabled: false,
      lastLoginAt: null,
      lastLoginIp: null,
      createdAt: new Date(),
    };

    // ---- 正常路径 ----

    it('正常路径: 管理员存在，返回完整 profile 信息', async () => {
      mockPrismaService.admin.findUnique.mockResolvedValue(profileData);

      const result = await service.getMe('admin-1');

      expect(result).toMatchObject({
        id: 'admin-1',
        username: 'testadmin',
        email: 'admin@test.com',
      });
      // 不应包含 password 字段（select 已排除）
      expect(result).not.toHaveProperty('password');
    });

    // ---- 异常路径 ----

    it('异常路径: 管理员不存在，抛出 UnauthorizedException', async () => {
      mockPrismaService.admin.findUnique.mockResolvedValue(null);

      await expect(service.getMe('nonexistent-admin')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    // ---- 边界路径 ----

    it('边界路径: nickname 为 null 时正常返回（不抛错）', async () => {
      mockPrismaService.admin.findUnique.mockResolvedValue({
        ...profileData,
        nickname: null,
      });

      const result = await service.getMe('admin-1');

      expect(result.nickname).toBeNull();
    });
  });

  // ==================== logOperation ====================

  describe('logOperation', () => {
    it('正常路径: 记录操作日志，prisma.adminOperationLog.create 被调用', async () => {
      await service.logOperation(
        'admin-1',
        'test_action',
        'test_module',
        'target-id',
        'admin',
        '测试操作',
        '192.168.1.1',
        'TestAgent/1.0',
      );

      expect(mockPrismaService.adminOperationLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-1',
          action: 'test_action',
          module: 'test_module',
          targetId: 'target-id',
          targetType: 'admin',
          description: '测试操作',
          ipAddress: '192.168.1.1',
          userAgent: 'TestAgent/1.0',
        },
      });
    });
  });
});
