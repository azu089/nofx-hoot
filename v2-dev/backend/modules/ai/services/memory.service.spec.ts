import { Test, TestingModule } from '@nestjs/testing';
import { AiMemoryService, MemoryEntry } from './memory.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('AiMemoryService', () => {
  let service: AiMemoryService;
  let prisma: PrismaService;

  const mockPrismaService = {
    aiMemory: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiMemoryService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AiMemoryService>(AiMemoryService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ========================= buildSceneText =========================

  describe('buildSceneText', () => {
    it('should encode market data with RSI, MACD, funding rate', () => {
      const result = service.buildSceneText({
        symbol: 'BTC/USDT',
        timeframe: '4h',
        rsi: 65,
        macdTrend: 'bullish',
        fundingRate: 0.0003,
      });

      expect(result).toContain('BTC/USDT');
      expect(result).toContain('4h');
      expect(result).toContain('RSI=65');
      expect(result).toContain('RSI_bullish');
      expect(result).toContain('MACD_bullish');
      expect(result).toContain('funding_positive');
    });

    it('should add RSI_overbought tag when RSI > 70', () => {
      const result = service.buildSceneText({
        symbol: 'ETH/USDT',
        timeframe: '1h',
        rsi: 75,
      });

      expect(result).toContain('RSI=75');
      expect(result).toContain('RSI_overbought');
    });

    it('should add funding_negative when funding rate is negative', () => {
      const result = service.buildSceneText({
        symbol: 'BTC/USDT',
        timeframe: '4h',
        fundingRate: -0.0002,
      });

      expect(result).toContain('funding_negative');
    });
  });

  // ========================= retrieveSimilar =========================

  describe('retrieveSimilar', () => {
    it('should return empty array when no memories exist', async () => {
      mockPrismaService.aiMemory.findMany.mockResolvedValue([]);

      const result = await service.retrieveSimilar(
        'BTC/USDT 4h RSI=65',
        'user-123',
        5,
      );

      expect(result).toEqual([]);
    });

    it('should return matched memories in score order', async () => {
      const mockMemories = [
        {
          id: 'mem-1',
          userId: 'user-123',
          analysisId: 'ana-1',
          symbol: 'BTC/USDT',
          sceneText: 'BTC/USDT 4h RSI=65 MACD_bullish',
          action: 'buy',
          pnl: new Decimal(100),
          pnlPercent: new Decimal(5),
          isWin: true,
          lesson: null,
          createdAt: new Date(),
        },
        {
          id: 'mem-2',
          userId: 'user-123',
          analysisId: 'ana-2',
          symbol: 'ETH/USDT',
          sceneText: 'ETH/USDT 1h RSI=30 MACD_bearish',
          action: 'sell',
          pnl: new Decimal(-50),
          pnlPercent: new Decimal(-3),
          isWin: false,
          lesson: null,
          createdAt: new Date(),
        },
        {
          id: 'mem-3',
          userId: 'user-123',
          analysisId: 'ana-3',
          symbol: 'BTC/USDT',
          sceneText: 'BTC/USDT 4h RSI=64 MACD_bullish EMA_above',
          action: 'buy',
          pnl: new Decimal(200),
          pnlPercent: new Decimal(10),
          isWin: true,
          lesson: null,
          createdAt: new Date(),
        },
      ];

      mockPrismaService.aiMemory.findMany.mockResolvedValue(mockMemories);

      const result = await service.retrieveSimilar(
        'BTC/USDT 4h RSI=65 MACD_bullish',
        'user-123',
        3,
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].symbol).toBe('BTC/USDT');
      // First result should have highest score (most similar)
      if (result.length > 1) {
        expect(result[0].score).toBeGreaterThanOrEqual(result[1].score!);
      }
    });
  });

  // ========================= storeMemory =========================

  describe('storeMemory', () => {
    it('should create record with correct fields', async () => {
      mockPrismaService.aiMemory.create.mockResolvedValue({});

      await service.storeMemory({
        userId: 'user-123',
        analysisId: 'ana-123',
        symbol: 'BTC/USDT',
        sceneText: 'BTC/USDT 4h RSI=65',
        action: 'buy',
        pnl: 100,
        pnlPercent: 5,
      });

      expect(prisma.aiMemory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          analysisId: 'ana-123',
          symbol: 'BTC/USDT',
          sceneText: 'BTC/USDT 4h RSI=65',
          action: 'buy',
          pnl: expect.any(Decimal),
          pnlPercent: expect.any(Decimal),
          isWin: true,
        }),
      });
    });

    it('should auto-generate lesson for big loss (pnlPercent < -5)', async () => {
      mockPrismaService.aiMemory.create.mockResolvedValue({});

      await service.storeMemory({
        userId: 'user-123',
        analysisId: 'ana-123',
        symbol: 'BTC/USDT',
        sceneText: 'BTC/USDT 4h RSI=30',
        action: 'sell',
        pnl: -100,
        pnlPercent: -8,
      });

      expect(prisma.aiMemory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isWin: false,
          lesson: expect.stringContaining('亏损'),
        }),
      });
    });
  });

  // ========================= formatForPrompt =========================

  describe('formatForPrompt', () => {
    it('should return empty string when no memories', () => {
      const result = service.formatForPrompt([]);
      expect(result).toBe('');
    });

    it('should format 3 memories correctly with numbered list', () => {
      const memories: MemoryEntry[] = [
        {
          id: 'mem-1',
          sceneText: 'BTC/USDT 4h RSI=65 MACD_bullish',
          action: 'buy',
          symbol: 'BTC/USDT',
          pnl: 100,
          pnlPercent: 5,
          isWin: true,
          lesson: null,
        },
        {
          id: 'mem-2',
          sceneText: 'ETH/USDT 1h RSI=30',
          action: 'sell',
          symbol: 'ETH/USDT',
          pnl: -50,
          pnlPercent: -3,
          isWin: false,
          lesson: '教训内容',
        },
        {
          id: 'mem-3',
          sceneText: 'SOL/USDT 4h RSI=70',
          action: 'close',
          symbol: 'SOL/USDT',
          pnl: 200,
          pnlPercent: 10,
          isWin: true,
          lesson: null,
        },
      ];

      const result = service.formatForPrompt(memories);

      expect(result).toContain('=== 相似历史场景 (BM25 匹配) ===');
      expect(result).toContain('1.');
      expect(result).toContain('2.');
      expect(result).toContain('3.');
      expect(result).toContain('BTC/USDT');
      expect(result).toContain('ETH/USDT');
      expect(result).toContain('SOL/USDT');
      expect(result).toContain('决策: buy');
      expect(result).toContain('结果: 盈利 5.0%');
      expect(result).toContain('结果: 亏损 -3.0%');
      expect(result).toContain('教训: 教训内容');
    });
  });
});
