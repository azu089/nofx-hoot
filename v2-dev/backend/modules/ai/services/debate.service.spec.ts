import { Test, TestingModule } from '@nestjs/testing';
import { DebateService, DebateEntry, MarketContext, DebateConfig } from './debate.service';
import { LLMService } from './llm.service';

describe('DebateService', () => {
  let service: DebateService;
  let llmService: jest.Mocked<LLMService>;

  const mockIndicators = {
    rsi: 55,
    rsi7: 58,
    macd: { macd: 0.5, signal: 0.3, histogram: 0.2 },
    bollingerBands: { upper: 52000, middle: 50000, lower: 48000 },
    atr: 450,
    atr3: 500,
    obv: 1000000,
    ema: { ema12: 50100, ema20: 50000, ema26: 49800, ema50: 49500 },
    donchian: { upper: 52000, middle: 50000, lower: 48000 },
  };

  const mockContext: MarketContext = {
    symbol: 'BTC/USDT:USDT',
    currentPrice: 50000,
    timeframe: '4h',
    indicators: mockIndicators,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DebateService,
        {
          provide: LLMService,
          useValue: {
            callModel: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DebateService>(DebateService);
    llmService = module.get(LLMService) as jest.Mocked<LLMService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==================== calculateConsensus ====================

  describe('calculateConsensus', () => {
    // 辅助：构造模拟辩论条目
    function createEntry(role: string, direction: string, confidence: number): DebateEntry {
      return {
        role,
        model: 'test-model',
        round: 3,
        direction,
        confidence,
        arguments: { action: direction, reasoning: 'test', keyPoints: [] },
        tokenUsage: 100,
        latencyMs: 500,
        cost: 0.001,
      };
    }

    it('应返回多数阵营的共识（看多阵营胜出）', () => {
      const entries = [
        createEntry('bull', 'open_long', 80),
        createEntry('analyst', 'open_long', 75),
        createEntry('contrarian', 'close_short', 70), // 看多阵营
        createEntry('bear', 'open_short', 60),
        createEntry('risk_manager', 'hold', 50),
      ];

      // 用私有方法测试（通过 any 绕过）
      const consensus = (service as any).calculateConsensus(entries);

      expect(consensus.direction).toBe('buy');
      expect(consensus.action).toMatch(/open_long|close_short/);
      expect(consensus.score).toBeGreaterThanOrEqual(3);
      expect(consensus.confidence).toBeGreaterThan(0);
    });

    it('应返回观望阵营的共识', () => {
      const entries = [
        createEntry('bull', 'hold', 50),
        createEntry('analyst', 'wait', 45),
        createEntry('contrarian', 'hold', 55),
        createEntry('bear', 'open_short', 60),
        createEntry('risk_manager', 'hold', 40),
      ];

      const consensus = (service as any).calculateConsensus(entries);
      expect(consensus.direction).toBe('hold');
      expect(consensus.action).toMatch(/hold|wait/);
    });

    it('应正确映射 6-action 到阵营', () => {
      // 测试 actionToCamp
      expect((service as any).actionToCamp('open_long')).toBe('BULLISH');
      expect((service as any).actionToCamp('close_short')).toBe('BULLISH');
      expect((service as any).actionToCamp('open_short')).toBe('BEARISH');
      expect((service as any).actionToCamp('close_long')).toBe('BEARISH');
      expect((service as any).actionToCamp('hold')).toBe('NEUTRAL');
      expect((service as any).actionToCamp('wait')).toBe('NEUTRAL');
    });

    it('应向后兼容旧格式 LONG/SHORT/NEUTRAL', () => {
      expect((service as any).actionToCamp('long')).toBe('BULLISH');
      expect((service as any).actionToCamp('short')).toBe('BEARISH');
      expect((service as any).actionToCamp('neutral')).toBe('NEUTRAL');
    });

    it('应正确标准化旧格式动作', () => {
      expect((service as any).normalizeAction('long')).toBe('open_long');
      expect((service as any).normalizeAction('short')).toBe('open_short');
      expect((service as any).normalizeAction('neutral')).toBe('hold');
      expect((service as any).normalizeAction('open_long')).toBe('open_long');
      expect((service as any).normalizeAction('close_short')).toBe('close_short');
    });
  });

  // ==================== convergence ====================

  describe('checkConvergence', () => {
    function createEntry(round: number, direction: string, confidence: number): DebateEntry {
      return {
        role: 'test',
        model: 'test-model',
        round,
        direction,
        confidence,
        arguments: { action: direction },
        tokenUsage: 100,
        latencyMs: 500,
        cost: 0.001,
      };
    }

    it('前 2 轮不应提前收敛', () => {
      const entries = [
        createEntry(1, 'open_long', 80),
        createEntry(2, 'open_long', 85),
      ];
      const converged = (service as any).checkConvergence(entries, 2);
      expect(converged).toBe(false);
    });

    it('连续两轮相同多数方向应收敛', () => {
      const roles = ['bull', 'analyst', 'contrarian', 'bear', 'risk_manager'];

      const entries: DebateEntry[] = [];
      // Round 2: 4 个 open_long, 1 个 open_short
      for (let i = 0; i < 4; i++) {
        entries.push({ ...createEntry(2, 'open_long', 80), role: roles[i] });
      }
      entries.push({ ...createEntry(2, 'open_short', 60), role: roles[4] });

      // Round 3: 同样 4 个 open_long, 1 个 open_short
      for (let i = 0; i < 4; i++) {
        entries.push({ ...createEntry(3, 'open_long', 85), role: roles[i] });
      }
      entries.push({ ...createEntry(3, 'open_short', 55), role: roles[4] });

      const converged = (service as any).checkConvergence(entries, 3);
      expect(converged).toBe(true);
    });
  });

  // ==================== parseResponse ====================

  describe('parseResponse', () => {
    it('应解析有效 JSON 响应', () => {
      const json = JSON.stringify({
        action: 'open_long',
        confidence: 75,
        reasoning: 'Strong bullish signals',
        keyPoints: ['RSI above 50', 'MACD bullish cross'],
      });

      const result = (service as any).parseResponse(json, 'bull');
      expect(result.confidence).toBe(75);
      expect(result.action).toBe('open_long');
    });

    it('应处理无效 JSON 并降级', () => {
      const invalidResponse = 'This is not valid JSON at all';
      const result = (service as any).parseResponse(invalidResponse, 'bull');
      expect(result).toBeDefined();
      expect(result.confidence).toBeDefined();
    });
  });
});
