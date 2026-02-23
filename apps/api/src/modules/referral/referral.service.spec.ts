import { Test, TestingModule } from '@nestjs/testing';
import { ReferralService } from './referral.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ReferralService', () => {
  let service: ReferralService;
  let prisma: PrismaService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    inviteCode: 'ABC123',
    invitedBy: null,
  };

  const mockInvitee = {
    id: 'user-456',
    email: 'invitee@example.com',
    invitedBy: 'user-123',
    createdAt: new Date(),
  };

  const mockReward = {
    id: 'reward-123',
    userId: 'user-123',
    fromUserId: 'user-456',
    amount: '10.00',
    type: 'commission',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
            referralReward: {
              findMany: jest.fn(),
              aggregate: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ReferralService>(ReferralService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getOrCreateInviteCode', () => {
    // 正常路径 - 已有邀请码
    it('should return existing invite code', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.getOrCreateInviteCode('user-123');

      expect(result).toBe('ABC123');
    });

    // 正常路径 - 生成新邀请码
    it('should create new invite code if not exists', async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce({ ...mockUser, inviteCode: null }) // 查当前用户
        .mockResolvedValueOnce(null); // 检查邀请码唯一性（不存在=可用）
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        inviteCode: 'NEW123',
      });

      const result = await service.getOrCreateInviteCode('user-123');

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('bindInviteCode', () => {
    // 正常路径
    it('should bind invite code successfully', async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce({ ...mockUser, invitedBy: null }) // Current user
        .mockResolvedValueOnce({ ...mockUser, id: 'inviter-123' }); // Inviter
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        invitedBy: 'inviter-123',
      });

      await service.bindInviteCode('user-123', 'ABC123');

      expect(prisma.user.update).toHaveBeenCalled();
    });

    // 异常路径 - 已绑定
    it('should throw BadRequestException if already bound', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        invitedBy: 'other-user',
      });

      await expect(
        service.bindInviteCode('user-123', 'ABC123'),
      ).rejects.toThrow(BadRequestException);
    });

    // 异常路径 - 无效邀请码
    it('should throw NotFoundException for invalid invite code', async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce({ ...mockUser, invitedBy: null })
        .mockResolvedValueOnce(null);

      await expect(
        service.bindInviteCode('user-123', 'INVALID'),
      ).rejects.toThrow(NotFoundException);
    });

    // 异常路径 - 自己邀请自己
    it('should throw BadRequestException when binding own code', async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce({ ...mockUser, invitedBy: null })
        .mockResolvedValueOnce(mockUser); // Same user

      await expect(
        service.bindInviteCode('user-123', 'ABC123'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getInvitees', () => {
    // 正常路径
    it('should return list of invitees', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([{
        ...mockInvitee,
        nickname: 'invitee',
      }]);
      (prisma.referralReward.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: '10.00' },
      });

      const result = await service.getInvitees('user-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('user-456');
    });

    // 边界路径
    it('should return empty array when no invitees', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getInvitees('user-123');

      expect(result).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    // 正常路径
    it('should return referral statistics', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.count as jest.Mock).mockResolvedValue(1);
      (prisma.referralReward.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { amount: '100.00' } })
        .mockResolvedValueOnce({ _sum: { amount: '20.00' } });

      const result = await service.getStats('user-123');

      expect(result.inviteCode).toBe('ABC123');
      expect(result.totalInvites).toBe(1);
    });
  });

  describe('getRewardRecords', () => {
    // 正常路径
    it('should return reward records', async () => {
      (prisma.referralReward.findMany as jest.Mock).mockResolvedValue([
        { ...mockReward, amount: { toString: () => '10.00' }, asset: 'USDT', status: 'completed' },
      ]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 'user-456', nickname: 'invitee' },
      ]);

      const result = await service.getRewardRecords('user-123');

      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe('10.00');
    });
  });
});
