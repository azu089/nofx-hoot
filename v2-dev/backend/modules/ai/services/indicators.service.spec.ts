import { Test, TestingModule } from '@nestjs/testing';
import { IndicatorsService, OHLCV, IndicatorsResult } from './indicators.service';

describe('IndicatorsService', () => {
  let service: IndicatorsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IndicatorsService],
    }).compile();

    service = module.get<IndicatorsService>(IndicatorsService);
  });

  // 生成测试用的 OHLCV 数据（50 根 BTC K 线，价格在 50000 附近波动）
  function generateOHLCV(count: number): OHLCV[] {
    const basePrice = 50000;
    const ohlcv: OHLCV[] = [];
    const startTime = Date.now() - count * 60000; // 每分钟一根 K 线

    for (let i = 0; i < count; i++) {
      const volatility = Math.random() * 1000 - 500; // ±500 波动
      const open = basePrice + volatility;
      const close = open + (Math.random() * 400 - 200);
      const high = Math.max(open, close) + Math.random() * 200;
      const low = Math.min(open, close) - Math.random() * 200;
      const volume = 100 + Math.random() * 50;

      ohlcv.push({
        timestamp: startTime + i * 60000,
        open,
        high,
        low,
        close,
        volume,
      });
    }

    return ohlcv;
  }

  describe('calculateAll', () => {
    // 正常路径1: 50+ K 线返回有效的 RSI (0-100)
    it('should return valid RSI between 0-100 with 50+ candles', () => {
      const ohlcv = generateOHLCV(50);
      const result: IndicatorsResult = service.calculateAll(ohlcv);

      expect(result.rsi).not.toBeNull();
      expect(result.rsi).toBeGreaterThanOrEqual(0);
      expect(result.rsi).toBeLessThanOrEqual(100);
    });

    // 正常路径2: MACD 包含 macd, signal, histogram 字段
    it('should return MACD with macd, signal, histogram fields', () => {
      const ohlcv = generateOHLCV(50);
      const result: IndicatorsResult = service.calculateAll(ohlcv);

      expect(result.macd).toBeDefined();
      expect(result.macd).toHaveProperty('macd');
      expect(result.macd).toHaveProperty('signal');
      expect(result.macd).toHaveProperty('histogram');

      // MACD 值应该存在（50 根 K 线足够计算）
      expect(result.macd.macd).not.toBeNull();
      expect(result.macd.signal).not.toBeNull();
      expect(result.macd.histogram).not.toBeNull();
    });

    // 正常路径3: 布林带 upper > middle > lower
    it('should return Bollinger bands with upper > middle > lower', () => {
      const ohlcv = generateOHLCV(50);
      const result: IndicatorsResult = service.calculateAll(ohlcv);

      expect(result.bollingerBands).toBeDefined();
      expect(result.bollingerBands.upper).not.toBeNull();
      expect(result.bollingerBands.middle).not.toBeNull();
      expect(result.bollingerBands.lower).not.toBeNull();

      // 验证 upper > middle > lower
      expect(result.bollingerBands.upper!).toBeGreaterThan(result.bollingerBands.middle!);
      expect(result.bollingerBands.middle!).toBeGreaterThan(result.bollingerBands.lower!);
    });

    // 边界路径1: 空 OHLCV 返回 null/默认值，不崩溃
    it('should return null values for empty OHLCV without crashing', () => {
      const result: IndicatorsResult = service.calculateAll([]);

      expect(result).toBeDefined();
      expect(result.rsi).toBeNull();
      expect(result.rsi7).toBeNull();
      expect(result.macd.macd).toBeNull();
      expect(result.macd.signal).toBeNull();
      expect(result.macd.histogram).toBeNull();
      expect(result.bollingerBands.upper).toBeNull();
      expect(result.bollingerBands.middle).toBeNull();
      expect(result.bollingerBands.lower).toBeNull();
      expect(result.atr).toBeNull();
      expect(result.atr3).toBeNull();
      expect(result.obv).toBeNull();
      expect(result.ema.ema12).toBeNull();
      expect(result.ema.ema20).toBeNull();
      expect(result.ema.ema26).toBeNull();
      expect(result.ema.ema50).toBeNull();
      expect(result.donchian.upper).toBeNull();
      expect(result.donchian.middle).toBeNull();
      expect(result.donchian.lower).toBeNull();
    });

    // 边界路径2: 数据不足（< 14 根 K 线）返回默认值
    it('should return default values when insufficient data (< 14 candles)', () => {
      const ohlcv = generateOHLCV(10); // 只有 10 根 K 线
      const result: IndicatorsResult = service.calculateAll(ohlcv);

      // RSI 需要至少 14 根 K 线，应返回 null
      expect(result.rsi).toBeNull();

      // ATR 也需要 14 根，应返回 null
      expect(result.atr).toBeNull();

      // OBV 只需要 2 根，应该有值
      expect(result.obv).not.toBeNull();
    });

    // 正常路径4: EMA12 和 EMA26 正确计算（都存在）
    it('should calculate EMA12 and EMA26 correctly', () => {
      const ohlcv = generateOHLCV(50);
      const result: IndicatorsResult = service.calculateAll(ohlcv);

      expect(result.ema).toBeDefined();
      expect(result.ema.ema12).not.toBeNull();
      expect(result.ema.ema26).not.toBeNull();

      // EMA12 和 EMA26 都应该是合理的价格范围（接近 BTC 价格）
      expect(result.ema.ema12!).toBeGreaterThan(40000);
      expect(result.ema.ema12!).toBeLessThan(60000);
      expect(result.ema.ema26!).toBeGreaterThan(40000);
      expect(result.ema.ema26!).toBeLessThan(60000);
    });

    // 正常路径5: 短周期指标（RSI7, ATR3）存在
    it('should calculate short-period indicators (RSI7, ATR3)', () => {
      const ohlcv = generateOHLCV(50);
      const result: IndicatorsResult = service.calculateAll(ohlcv);

      // RSI7 应该存在（50 根足够）
      expect(result.rsi7).not.toBeNull();
      expect(result.rsi7).toBeGreaterThanOrEqual(0);
      expect(result.rsi7).toBeLessThanOrEqual(100);

      // ATR3 应该存在
      expect(result.atr3).not.toBeNull();
      expect(result.atr3!).toBeGreaterThan(0);
    });

    // 正常路径6: Donchian Channel 上轨 > 中轨 > 下轨
    it('should calculate Donchian Channel with upper > middle > lower', () => {
      const ohlcv = generateOHLCV(50);
      const result: IndicatorsResult = service.calculateAll(ohlcv);

      expect(result.donchian).toBeDefined();
      expect(result.donchian.upper).not.toBeNull();
      expect(result.donchian.middle).not.toBeNull();
      expect(result.donchian.lower).not.toBeNull();

      // 验证 upper > middle > lower
      expect(result.donchian.upper!).toBeGreaterThan(result.donchian.middle!);
      expect(result.donchian.middle!).toBeGreaterThan(result.donchian.lower!);
    });
  });
});
