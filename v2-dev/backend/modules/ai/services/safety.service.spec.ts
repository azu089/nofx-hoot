import { Test, TestingModule } from '@nestjs/testing';
import { SafetyService, SafetyCheckInput } from './safety.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('SafetyService', () => {
  let service: SafetyService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SafetyService,
        {
          provide: PrismaService,
          useValue: {
            aiConfig: {
              findUnique: jest.fn(),
            },
            aiAnalysis: {
              count: jest.fn(),
              findFirst: jest.fn(),
            },
            position: {
              count: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<SafetyService>(SafetyService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createValidInput = (overrides: Partial<SafetyCheckInput> = {}): SafetyCheckInput => ({
    userId: 'test-user',
    symbol: 'BTC/USDT',
    direction: 'buy',
    action: 'open_long',
    confidence: 80,
    consensusScore: 4,
    positionSize: 100,
    leverage: 5,
    indicators: {
      rsi: 50,
      macd: { macd: 0, signal: 0, histogram: 0 },
      bollingerBands: { upper: 50000, middle: 48000, lower: 46000 },
      atr: 1000,
      atr3: 800,
      atr14: 1000,
      obv: 1000000,
      ema: { ema12: 48000, ema26: 47000, ema50: 46000 },
    },
    fundingRate: 0.0001,
    takeProfitPercent: 5,
    stopLossPercent: 2,
    ...overrides,
  });

  describe('checkAll - 正常路径', () => {
    it('should pass all checks with valid input', async () => {
      // Mock aiConfig
      jest.spyOn(prismaService.aiConfig, 'findUnique').mockResolvedValue({
        userId: 'test-user',
        isEnabled: true,
        maxPositionSize: 200,
        maxLeverage: 10,
        circuitBreaker: 5,
        maxDailyTrades: 10,
        cooldownMinutes: 15,
      } as any);

      // Mock aiAnalysis (无失败记录)
      jest.spyOn(prismaService.aiAnalysis, 'count').mockResolvedValue(0);
      jest.spyOn(prismaService.aiAnalysis, 'findFirst').mockResolvedValue(null);

      // Mock position (无持仓)
      jest.spyOn(prismaService.position, 'count').mockResolvedValue(0);
      jest.spyOn(prismaService.position, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prismaService.position, 'findMany').mockResolvedValue([]);

      const input = createValidInput();
      const result = await service.checkAll(input);

      expect(result.passed).toBe(true);
      expect(result.blockedBy).toBeNull();
      expect(result.blockedReason).toBeNull();
      expect(result.checks).toHaveLength(9);
      expect(result.checks.every((c) => c.passed)).toBe(true);
    });
  });

  describe('L1: 结构化输出验证', () => {
    it('should block invalid direction', async () => {
      const input = createValidInput({ direction: 'invalid' });
      const result = await service.checkAll(input);

      expect(result.passed).toBe(false);
      expect(result.blockedBy).toBe('L1');
      expect(result.blockedReason).toContain('无效的方向');
    });

    it('should block invalid confidence', async () => {
      const input = createValidInput({ confidence: 150 });
      const result = await service.checkAll(input);

      expect(result.passed).toBe(false);
      expect(result.blockedBy).toBe('L1');
      expect(result.blockedReason).toContain('无效的置信度');
    });

    it('should block invalid action', async () => {
      const input = createValidInput({ action: 'invalid_action' });
      const result = await service.checkAll(input);

      expect(result.passed).toBe(false);
      expect(result.blockedBy).toBe('L1');
      expect(result.blockedReason).toContain('无效的动作');
    });
  });

  describe('L2: 多模型共识检查', () => {
    it('should block low consensus score', async () => {
      const input = createValidInput({ consensusScore: 2 });
      const result = await service.checkAll(input);

      expect(result.passed).toBe(false);
      expect(result.blockedBy).toBe('L2');
      expect(result.blockedReason).toContain('共识不足');
    });

    it('should skip L2 for close action', async () => {
      jest.spyOn(prismaService.aiConfig, 'findUnique').mockResolvedValue({
        userId: 'test-user',
        isEnabled: true,
      } as any);
      jest.spyOn(prismaService.position, 'findMany').mockResolvedValue([]);

      const input = createValidInput({ action: 'close_long', consensusScore: 2 });
      const result = await service.checkAll(input);

      const l2Check = result.checks.find((c) => c.layer === 'L2');
      expect(l2Check?.passed).toBe(true);
      expect(l2Check?.detail).toContain('平仓动作');
    });
  });

  describe('L3: 指标硬约束', () => {
    it('should block buy when RSI > 80', async () => {
      const input = createValidInput({
        direction: 'buy',
        indicators: { ...createValidInput().indicators!, rsi: 85 },
      });
      const result = await service.checkAll(input);

      expect(result.passed).toBe(false);
      expect(result.blockedBy).toBe('L3');
      expect(result.blockedReason).toContain('RSI 超买');
    });

    it('should block sell when RSI < 20', async () => {
      const input = createValidInput({
        direction: 'sell',
        indicators: { ...createValidInput().indicators!, rsi: 15 },
      });
      const result = await service.checkAll(input);

      expect(result.passed).toBe(false);
      expect(result.blockedBy).toBe('L3');
      expect(result.blockedReason).toContain('RSI 超卖');
    });
  });

  describe('L5: 熔断机制', () => {
    it('should block when circuit breaker triggered', async () => {
      jest.spyOn(prismaService.aiConfig, 'findUnique').mockResolvedValue({
        userId: 'test-user',
        isEnabled: true,
        circuitBreaker: 3,
      } as any);

      jest.spyOn(prismaService.aiAnalysis, 'count').mockResolvedValue(5); // 失败次数超阈值

      const input = createValidInput();
      const result = await service.checkAll(input);

      expect(result.passed).toBe(false);
      expect(result.blockedBy).toBe('L5');
      expect(result.blockedReason).toContain('熔断触发');
    });
  });

  describe('L6: 冷却期检查', () => {
    it('should block when cooldown period not met', async () => {
      jest.spyOn(prismaService.aiConfig, 'findUnique').mockResolvedValue({
        userId: 'test-user',
        isEnabled: true,
        cooldownMinutes: 30,
      } as any);

      jest.spyOn(prismaService.aiAnalysis, 'count').mockResolvedValue(0);

      // Mock 最近有交易（5 分钟前）
      jest.spyOn(prismaService.aiAnalysis, 'findFirst').mockResolvedValue({
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
      } as any);

      const input = createValidInput();
      const result = await service.checkAll(input);

      expect(result.passed).toBe(false);
      expect(result.blockedBy).toBe('L6');
      expect(result.blockedReason).toContain('冷却期未满');
    });
  });

  describe('L8: 资金费率检查', () => {
    it('should block extreme funding rate', async () => {
      jest.spyOn(prismaService.aiConfig, 'findUnique').mockResolvedValue({
        userId: 'test-user',
        isEnabled: true,
      } as any);
      jest.spyOn(prismaService.aiAnalysis, 'count').mockResolvedValue(0);
      jest.spyOn(prismaService.aiAnalysis, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prismaService.position, 'findMany').mockResolvedValue([]);

      const input = createValidInput({
        direction: 'buy',
        fundingRate: 0.0015, // > 0.001
      });
      const result = await service.checkAll(input);

      expect(result.passed).toBe(false);
      expect(result.blockedBy).toBe('L8');
      expect(result.blockedReason).toContain('资金费率极端');
    });

    it('should pass with warning for high funding rate', async () => {
      jest.spyOn(prismaService.aiConfig, 'findUnique').mockResolvedValue({
        userId: 'test-user',
        isEnabled: true,
      } as any);
      jest.spyOn(prismaService.aiAnalysis, 'count').mockResolvedValue(0);
      jest.spyOn(prismaService.aiAnalysis, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prismaService.position, 'count').mockResolvedValue(0);
      jest.spyOn(prismaService.position, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prismaService.position, 'findMany').mockResolvedValue([]);

      const input = createValidInput({
        direction: 'buy',
        fundingRate: 0.0007, // > 0.0005 but < 0.001
      });
      const result = await service.checkAll(input);

      expect(result.passed).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('资金费率偏高');
    });
  });

  describe('L9: ATR 波动率守卫', () => {
    it('should block extreme ATR volatility', async () => {
      jest.spyOn(prismaService.aiConfig, 'findUnique').mockResolvedValue({
        userId: 'test-user',
        isEnabled: true,
      } as any);
      jest.spyOn(prismaService.aiAnalysis, 'count').mockResolvedValue(0);
      jest.spyOn(prismaService.aiAnalysis, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prismaService.position, 'findMany').mockResolvedValue([]);

      const input = createValidInput({
        indicators: {
          ...createValidInput().indicators!,
          atr3: 3500,
          atr14: 1000, // atr3/atr14 = 3.5 > 3.0
        },
      });
      const result = await service.checkAll(input);

      expect(result.passed).toBe(false);
      expect(result.blockedBy).toBe('L9');
      expect(result.blockedReason).toContain('波动率极端');
    });

    it('should block high ATR volatility with low confidence', async () => {
      jest.spyOn(prismaService.aiConfig, 'findUnique').mockResolvedValue({
        userId: 'test-user',
        isEnabled: true,
      } as any);
      jest.spyOn(prismaService.aiAnalysis, 'count').mockResolvedValue(0);
      jest.spyOn(prismaService.aiAnalysis, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prismaService.position, 'findMany').mockResolvedValue([]);

      const input = createValidInput({
        confidence: 70, // < 80
        indicators: {
          ...createValidInput().indicators!,
          atr3: 2500,
          atr14: 1000, // atr3/atr14 = 2.5 > 2.0
        },
      });
      const result = await service.checkAll(input);

      expect(result.passed).toBe(false);
      expect(result.blockedBy).toBe('L9');
      expect(result.blockedReason).toContain('波动率异常升高');
    });
  });

  describe('平仓动作豁免', () => {
    it('should skip L2/L3/L5/L6 for close_long action', async () => {
      jest.spyOn(prismaService.aiConfig, 'findUnique').mockResolvedValue({
        userId: 'test-user',
        isEnabled: true,
      } as any);
      jest.spyOn(prismaService.position, 'findMany').mockResolvedValue([]);

      const input = createValidInput({
        action: 'close_long',
        consensusScore: 2, // 通常会被 L2 拦截
        indicators: {
          ...createValidInput().indicators!,
          rsi: 85, // 通常会被 L3 拦截
        },
      });
      const result = await service.checkAll(input);

      const l2Check = result.checks.find((c) => c.layer === 'L2');
      const l3Check = result.checks.find((c) => c.layer === 'L3');
      const l5Check = result.checks.find((c) => c.layer === 'L5');
      const l6Check = result.checks.find((c) => c.layer === 'L6');

      expect(l2Check?.passed).toBe(true);
      expect(l3Check?.passed).toBe(true);
      expect(l5Check?.passed).toBe(true);
      expect(l6Check?.passed).toBe(true);

      expect(l2Check?.detail).toContain('平仓动作');
      expect(l3Check?.detail).toContain('平仓动作');
    });
  });
});
