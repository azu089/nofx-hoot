import { Test, TestingModule } from '@nestjs/testing';
import { StrategyService } from './strategy.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('StrategyService', () => {
  let service: StrategyService;
  let prisma: PrismaService;

  const mockStrategy = {
    id: 'strategy-123',
    name: 'Test Strategy',
    description: 'A test strategy',
    author: 'user-123',
    type: 'grid',
    riskLevel: 'medium',
    minInvestment: '100',
    expectedReturn: '10',
    status: 'active',
    isPublic: true,
    isActive: true,
    config: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSubscription = {
    id: 'sub-123',
    userId: 'user-123',
    strategyId: 'strategy-123',
    apiKeyId: 'key-123',
    investmentAmount: '1000',
    status: 'active',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StrategyService,
        {
          provide: PrismaService,
          useValue: {
            strategy: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            strategySubscription: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<StrategyService>(StrategyService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('findAll', () => {
    // 正常路径
    it('should return all public strategies', async () => {
      (prisma.strategy.findMany as jest.Mock).mockResolvedValue([mockStrategy]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test Strategy');
    });

    // 边界路径 - 空列表
    it('should return empty array when no strategies exist', async () => {
      (prisma.strategy.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    // 正常路径
    it('should return strategy by id', async () => {
      (prisma.strategy.findUnique as jest.Mock).mockResolvedValue(mockStrategy);

      const result = await service.findOne('strategy-123');

      expect(result.id).toBe('strategy-123');
      expect(result.name).toBe('Test Strategy');
    });

    // 异常路径
    it('should throw NotFoundException when strategy not found', async () => {
      (prisma.strategy.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('subscribe', () => {
    // 正常路径
    it('should create subscription successfully', async () => {
      (prisma.strategy.findUnique as jest.Mock).mockResolvedValue(mockStrategy);
      (prisma.strategySubscription.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.strategySubscription.create as jest.Mock).mockResolvedValue(mockSubscription);

      const result = await service.subscribe('user-123', 'strategy-123', {
        apiKeyId: 'key-123',
        investmentAmount: '1000',
      });

      expect(result.strategyId).toBe('strategy-123');
      expect(result.status).toBe('active');
    });

    // 异常路径 - 策略不存在
    it('should throw NotFoundException when strategy not found', async () => {
      (prisma.strategy.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.subscribe('user-123', 'nonexistent-id', {
          apiKeyId: 'key-123',
          investmentAmount: '1000',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    // 异常路径 - 重复订阅
    it('should throw ConflictException when already subscribed', async () => {
      (prisma.strategy.findUnique as jest.Mock).mockResolvedValue(mockStrategy);
      (prisma.strategySubscription.findFirst as jest.Mock).mockResolvedValue(mockSubscription);

      await expect(
        service.subscribe('user-123', 'strategy-123', {
          apiKeyId: 'key-123',
          investmentAmount: '1000',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('unsubscribe', () => {
    // 正常路径
    it('should cancel subscription successfully', async () => {
      (prisma.strategySubscription.findFirst as jest.Mock).mockResolvedValue(mockSubscription);
      (prisma.strategySubscription.update as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        status: 'cancelled',
      });

      const result = await service.unsubscribe('user-123', 'strategy-123');

      expect(result.status).toBe('cancelled');
    });

    // 异常路径
    it('should throw NotFoundException when subscription not found', async () => {
      (prisma.strategySubscription.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.unsubscribe('user-123', 'strategy-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMySubscriptions', () => {
    // 正常路径
    it('should return user subscriptions', async () => {
      (prisma.strategySubscription.findMany as jest.Mock).mockResolvedValue([
        { ...mockSubscription, strategy: mockStrategy },
      ]);

      const result = await service.getMySubscriptions('user-123');

      expect(result).toHaveLength(1);
      expect(result[0].strategyId).toBe('strategy-123');
    });
  });
});
