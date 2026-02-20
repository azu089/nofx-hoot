import { Test, TestingModule } from '@nestjs/testing';
import { EvolutionService } from './evolution.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('EvolutionService', () => {
  let service: EvolutionService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvolutionService,
        {
          provide: PrismaService,
          useValue: {
            position: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
            aiConfig: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<EvolutionService>(EvolutionService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('calculateRollingSharpe', () => {
    it('应该在交易记录少于 5 笔时返回 null', async () => {
      jest.spyOn(prisma.position, 'findMany').mockResolvedValue([
        { id: '1', realizedPnl: new Decimal(10), margin: new Decimal(100), closedAt: new Date() },
        { id: '2', realizedPnl: new Decimal(5), margin: new Decimal(100), closedAt: new Date() },
      ]);

      const result = await service.calculateRollingSharpe('user1');
      expect(result).toBeNull();
    });

    it('应该为盈利交易返回正的 Sharpe', async () => {
      // 模拟 10 笔盈利交易
      const positions = Array.from({ length: 10 }, (_, i) => ({
        id: `${i + 1}`,
        realizedPnl: new Decimal(10 + i), // 逐渐增加的盈利
        margin: new Decimal(100),
        closedAt: new Date(),
      }));

      jest.spyOn(prisma.position, 'findMany').mockResolvedValue(positions);

      const result = await service.calculateRollingSharpe('user1');
      expect(result).toBeGreaterThan(0);
    });

    it('应该为亏损交易返回负的 Sharpe', async () => {
      // 模拟 10 笔亏损交易
      const positions = Array.from({ length: 10 }, (_, i) => ({
        id: `${i + 1}`,
        realizedPnl: new Decimal(-10 - i), // 逐渐增加的亏损
        margin: new Decimal(100),
        closedAt: new Date(),
      }));

      jest.spyOn(prisma.position, 'findMany').mockResolvedValue(positions);

      const result = await service.calculateRollingSharpe('user1');
      expect(result).toBeLessThan(0);
    });

    it('应该在所有回报相同时处理零标准差（盈利）', async () => {
      // 模拟 10 笔完全相同的盈利交易
      const positions = Array.from({ length: 10 }, (_, i) => ({
        id: `${i + 1}`,
        realizedPnl: new Decimal(10), // 相同的盈利
        margin: new Decimal(100),
        closedAt: new Date(),
      }));

      jest.spyOn(prisma.position, 'findMany').mockResolvedValue(positions);

      const result = await service.calculateRollingSharpe('user1');
      expect(result).toBe(3.0); // mean > 0 应返回 3.0
    });

    it('应该在所有回报相同时处理零标准差（亏损）', async () => {
      // 模拟 10 笔完全相同的亏损交易
      const positions = Array.from({ length: 10 }, (_, i) => ({
        id: `${i + 1}`,
        realizedPnl: new Decimal(-10), // 相同的亏损
        margin: new Decimal(100),
        closedAt: new Date(),
      }));

      jest.spyOn(prisma.position, 'findMany').mockResolvedValue(positions);

      const result = await service.calculateRollingSharpe('user1');
      expect(result).toBe(0); // mean <= 0 应返回 0
    });
  });

  describe('determineTier', () => {
    it('null Sharpe 应返回 Tier 0', () => {
      const result = service.determineTier(null);
      expect(result.tier).toBe(0);
      expect(result.label).toBe('暂停');
    });

    it('Sharpe -1.0 应返回 Tier 0', () => {
      const result = service.determineTier(-1.0);
      expect(result.tier).toBe(0);
      expect(result.label).toBe('暂停');
    });

    it('Sharpe -0.3 应返回 Tier 1', () => {
      const result = service.determineTier(-0.3);
      expect(result.tier).toBe(1);
      expect(result.label).toBe('保守');
    });

    it('Sharpe 0.3 应返回 Tier 2', () => {
      const result = service.determineTier(0.3);
      expect(result.tier).toBe(2);
      expect(result.label).toBe('正常');
    });

    it('Sharpe 1.0 应返回 Tier 3', () => {
      const result = service.determineTier(1.0);
      expect(result.tier).toBe(3);
      expect(result.label).toBe('激进');
    });

    it('边界值：Sharpe -0.5 应返回 Tier 0', () => {
      const result = service.determineTier(-0.5);
      expect(result.tier).toBe(0);
      expect(result.label).toBe('暂停');
    });

    it('边界值：Sharpe 0 应返回 Tier 2', () => {
      const result = service.determineTier(0);
      expect(result.tier).toBe(2);
      expect(result.label).toBe('正常');
    });

    it('边界值：Sharpe 0.7 应返回 Tier 3', () => {
      const result = service.determineTier(0.7);
      expect(result.tier).toBe(3);
      expect(result.label).toBe('激进');
    });
  });

  describe('getEvolutionPrompt', () => {
    it('Tier 0 应返回空字符串', () => {
      const result = service.getEvolutionPrompt(0, -1.0);
      expect(result).toBe('');
    });

    it('Tier 1 应包含"保守"相关内容', () => {
      const result = service.getEvolutionPrompt(1, -0.3);
      expect(result).toContain('CONSERVATIVELY');
      expect(result).toContain('-0.3');
    });

    it('Tier 2 应包含"正常"相关内容', () => {
      const result = service.getEvolutionPrompt(2, 0.3);
      expect(result).toContain('normal');
      expect(result).toContain('0.3');
    });

    it('Tier 3 应包含"激进"相关内容', () => {
      const result = service.getEvolutionPrompt(3, 1.0);
      expect(result).toContain('aggressive');
      expect(result).toContain('1.0');
    });

    it('无效 tier 应返回空字符串', () => {
      const result = service.getEvolutionPrompt(999, 0.5);
      expect(result).toBe('');
    });
  });
});
