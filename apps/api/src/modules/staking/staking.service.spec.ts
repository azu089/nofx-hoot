import { Test, TestingModule } from '@nestjs/testing';
import { StakingService } from './staking.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';

describe('StakingService', () => {
  let service: StakingService;
  let prisma: PrismaService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    hootBalance: new Decimal('1000'),
  };

  const mockStakingRecord = {
    id: 'stake-123',
    userId: 'user-123',
    amount: new Decimal('500'),
    type: 'flexible',
    lockDays: 0,
    weight: new Decimal('1.0'),
    startDate: new Date(),
    endDate: null,
    status: 'active',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StakingService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            stakingRecord: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              aggregate: jest.fn(),
            },
            stakingDividend: {
              findMany: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback(prisma)),
          },
        },
      ],
    }).compile();

    service = module.get<StakingService>(StakingService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('stake', () => {
    // 正常路径
    it('should stake HOOT tokens successfully', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.stakingRecord.create as jest.Mock).mockResolvedValue(mockStakingRecord);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        hootBalance: new Decimal('500'),
      });

      const result = await service.stake('user-123', {
        amount: '500',
        lockDays: 0,
      });

      expect(result.amount.toString()).toBe('500');
      expect(result.status).toBe('active');
    });

    // 异常路径 - 余额不足
    it('should throw BadRequestException when insufficient balance', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        hootBalance: new Decimal('100'),
      });

      await expect(
        service.stake('user-123', {
          amount: '500',
          lockDays: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    // 边界路径 - 最小质押金额
    it('should throw BadRequestException when amount is zero', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        service.stake('user-123', {
          amount: '0',
          lockDays: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('unstake', () => {
    // 正常路径
    it('should unstake successfully for flexible staking', async () => {
      (prisma.stakingRecord.findUnique as jest.Mock).mockResolvedValue(mockStakingRecord);
      (prisma.stakingRecord.update as jest.Mock).mockResolvedValue({
        ...mockStakingRecord,
        status: 'unstaked',
      });
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.unstake('user-123', 'stake-123');

      expect(result.status).toBe('unstaked');
    });

    // 异常路径 - 质押记录不存在
    it('should throw NotFoundException when staking record not found', async () => {
      (prisma.stakingRecord.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.unstake('user-123', 'nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    // 异常路径 - 锁定期未到
    it('should throw BadRequestException when lock period not ended', async () => {
      const lockedStaking = {
        ...mockStakingRecord,
        type: 'locked',
        lockDays: 30,
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      };
      (prisma.stakingRecord.findUnique as jest.Mock).mockResolvedValue(lockedStaking);

      await expect(service.unstake('user-123', 'stake-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMyStakings', () => {
    // 正常路径
    it('should return user staking records', async () => {
      (prisma.stakingRecord.findMany as jest.Mock).mockResolvedValue([mockStakingRecord]);
      (prisma.stakingRecord.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: new Decimal('500') },
      });

      const result = await service.getMyStakings('user-123');

      expect(result.stakingRecords).toHaveLength(1);
      expect(result.totalStaked).toBe('500');
    });
  });

  describe('calculateWeight', () => {
    it('should return 1.0 for flexible staking', () => {
      const weight = service['calculateWeight'](0);
      expect(weight.toString()).toBe('1');
    });

    it('should return higher weight for longer lock period', () => {
      const weight30 = service['calculateWeight'](30);
      const weight90 = service['calculateWeight'](90);
      const weight180 = service['calculateWeight'](180);

      expect(weight30.greaterThan(new Decimal('1'))).toBe(true);
      expect(weight90.greaterThan(weight30)).toBe(true);
      expect(weight180.greaterThan(weight90)).toBe(true);
    });

    it('should cap weight at 3.0', () => {
      const weight = service['calculateWeight'](365);
      expect(weight.lessThanOrEqualTo(new Decimal('3'))).toBe(true);
    });
  });
});
