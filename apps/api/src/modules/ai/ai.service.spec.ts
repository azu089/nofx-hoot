import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AiService', () => {
  let service: AiService;
  let prisma: PrismaService;

  const mockPrismaService = {
    client: {
      users: {
        findUnique: jest.fn(),
      },
      ai_generations: {
        count: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      trade_history: {
        findMany: jest.fn(),
      },
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'OPENAI_API_KEY') return undefined; // 沙盒模式
      if (key === 'OPENAI_MODEL') return 'gpt-4';
      return undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkQuota', () => {
    it('should return correct quota for VIP 0', async () => {
      mockPrismaService.client.users.findUnique.mockResolvedValue({
        vip_level: 0,
      });
      mockPrismaService.client.ai_generations.count.mockResolvedValue(1);

      const result = await service.checkQuota('user-id');

      expect(result).toEqual({
        remaining: 2, // 3 - 1
        limit: 3,
      });
    });

    it('should return unlimited for VIP 3', async () => {
      mockPrismaService.client.users.findUnique.mockResolvedValue({
        vip_level: 3,
      });

      const result = await service.checkQuota('user-id');

      expect(result).toEqual({
        remaining: -1,
        limit: -1,
      });
    });
  });

  describe('generateStrategy', () => {
    it('should generate mock strategy in sandbox mode', async () => {
      mockPrismaService.client.users.findUnique.mockResolvedValue({
        vip_level: 1,
      });
      mockPrismaService.client.ai_generations.count.mockResolvedValue(0);
      mockPrismaService.client.ai_generations.create.mockResolvedValue({
        id: 'generation-id',
      });

      const result = await service.generateStrategy('user-id', {
        description: '测试策略',
        riskLevel: 'medium',
      });

      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('explanation');
      expect(result.code).toContain('IStrategy');
    });

    it('should throw error when quota exceeded', async () => {
      mockPrismaService.client.users.findUnique.mockResolvedValue({
        vip_level: 0,
      });
      mockPrismaService.client.ai_generations.count.mockResolvedValue(3);

      await expect(
        service.generateStrategy('user-id', {
          description: '测试策略',
          riskLevel: 'low',
        }),
      ).rejects.toThrow('本月 AI 生成配额已用完');
    });
  });

  describe('analyzeTrades', () => {
    it('should generate mock analysis when no trades', async () => {
      mockPrismaService.client.trade_history.findMany.mockResolvedValue([]);

      const result = await service.analyzeTrades('user-id', {
        timeRange: '7d',
      });

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('strengths');
      expect(result).toHaveProperty('weaknesses');
      expect(result).toHaveProperty('suggestions');
      expect(result).toHaveProperty('emotionalScore');
      expect(result).toHaveProperty('riskScore');
    });

    it('should analyze trades correctly', async () => {
      mockPrismaService.client.trade_history.findMany.mockResolvedValue([
        {
          pnl: '10.5',
          pnl_percentage: '5.2',
          side: 'buy',
          created_at: new Date('2024-01-01'),
          closed_at: new Date('2024-01-02'),
        },
        {
          pnl: '-3.2',
          pnl_percentage: '-2.1',
          side: 'sell',
          created_at: new Date('2024-01-03'),
          closed_at: new Date('2024-01-04'),
        },
      ]);

      const result = await service.analyzeTrades('user-id', {
        timeRange: '30d',
      });

      expect(result).toHaveProperty('summary');
      expect(Array.isArray(result.strengths)).toBe(true);
      expect(Array.isArray(result.weaknesses)).toBe(true);
      expect(Array.isArray(result.suggestions)).toBe(true);
      expect(typeof result.emotionalScore).toBe('number');
      expect(typeof result.riskScore).toBe('number');
    });
  });
});
