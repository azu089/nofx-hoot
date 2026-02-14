/**
 * CcxtAdapter 单元测试
 *
 * 测试用例:
 *   1. 正常路径: 构造器正确设置属性 (CEX + DEX)
 *   2. 异常路径: 不支持的交易所抛出错误
 *   3. 精度路径: formatQuantity 3 层降级策略
 */

import { CcxtAdapter, CcxtAdapterConfig } from '../ccxt.adapter';

// Mock ccxt 模块
jest.mock('ccxt', () => {
  const mockExchange = {
    loadMarkets: jest.fn().mockResolvedValue({}),
    fetchBalance: jest.fn().mockResolvedValue({
      total: { USDT: '1000' },
      free: { USDT: '800' },
    }),
    fetchPositions: jest.fn().mockResolvedValue([]),
    amountToPrecision: jest.fn((symbol: string, amount: number) => {
      // 模拟 CCXT 精度格式化
      return amount.toFixed(3);
    }),
    market: jest.fn((symbol: string) => ({
      precision: { amount: 3, price: 2 },
      limits: { amount: { min: 0.001 }, cost: { min: 5 } },
    })),
    createMarketOrder: jest.fn().mockResolvedValue({
      id: 'order-123',
      symbol: 'BTC/USDT:USDT',
      side: 'buy',
      average: 50000,
      amount: 0.1,
      filled: 0.1,
      fee: { cost: 0.05 },
      status: 'closed',
    }),
    setLeverage: jest.fn().mockResolvedValue(undefined),
    setMarginMode: jest.fn().mockResolvedValue(undefined),
  };

  // 返回模拟的 CCXT 模块
  return {
    binanceusdm: jest.fn().mockImplementation(() => mockExchange),
    okx: jest.fn().mockImplementation(() => mockExchange),
    hyperliquid: jest.fn().mockImplementation(() => mockExchange),
    // 不包含 'invalidexchange'，用于测试异常路径
  };
});

describe('CcxtAdapter', () => {
  // ========================= 正常路径 =========================

  describe('构造器 + 属性', () => {
    it('CEX (Binance) 模式正确设置属性', () => {
      const config: CcxtAdapterConfig = {
        exchangeType: 'binance',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        isTestnet: false,
      };

      const adapter = new CcxtAdapter(config);

      expect(adapter.exchangeType).toBe('binance');
      expect(adapter.isDex).toBe(false);
      expect(adapter.isTestnet).toBe(false);
      expect(adapter.category).toBe('cex');
    });

    it('DEX (Hyperliquid) 模式正确设置属性', () => {
      const config: CcxtAdapterConfig = {
        exchangeType: 'hyperliquid',
        walletAddress: '0x1234567890abcdef',
        privateKey: '0xabc123',
        isTestnet: true,
      };

      const adapter = new CcxtAdapter(config);

      expect(adapter.exchangeType).toBe('hyperliquid');
      expect(adapter.isDex).toBe(true);
      expect(adapter.isTestnet).toBe(true);
      expect(adapter.category).toBe('dex');
    });

    it('Binance 初始化加载市场', async () => {
      const config: CcxtAdapterConfig = {
        exchangeType: 'binance',
        apiKey: 'key',
        apiSecret: 'secret',
        isTestnet: false,
      };

      const adapter = new CcxtAdapter(config);
      await adapter.initialize();

      const exchange = adapter.getExchange();
      expect(exchange.loadMarkets).toHaveBeenCalled();
    });
  });

  // ========================= 异常路径 =========================

  describe('异常处理', () => {
    it('未初始化时调用 getExchange 抛出错误', () => {
      const config: CcxtAdapterConfig = {
        exchangeType: 'binance',
        apiKey: 'key',
        apiSecret: 'secret',
        isTestnet: false,
      };

      const adapter = new CcxtAdapter(config);

      expect(() => adapter.getExchange()).toThrow('适配器未初始化');
    });

    it('不支持的交易所初始化抛出错误', async () => {
      const config: CcxtAdapterConfig = {
        exchangeType: 'nonexistent_exchange',
        apiKey: 'key',
        apiSecret: 'secret',
        isTestnet: false,
      };

      const adapter = new CcxtAdapter(config);

      await expect(adapter.initialize()).rejects.toThrow('CCXT 不支持交易所');
    });
  });

  // ========================= 精度路径 =========================

  describe('formatQuantity 精度格式化', () => {
    let adapter: CcxtAdapter;

    beforeEach(async () => {
      const config: CcxtAdapterConfig = {
        exchangeType: 'binance',
        apiKey: 'key',
        apiSecret: 'secret',
        isTestnet: false,
      };
      adapter = new CcxtAdapter(config);
      await adapter.initialize();
    });

    it('正常: amountToPrecision 格式化成功', async () => {
      const result = await adapter.formatQuantity('BTC/USDT:USDT', 0.12345);

      // mock 返回 3 位小数
      expect(result).toBe('0.123');
    });

    it('amountToPrecision 失败时使用 limits.amount.min 降级', async () => {
      const exchange = adapter.getExchange();
      // 模拟 amountToPrecision 抛出错误
      (exchange.amountToPrecision as jest.Mock).mockImplementationOnce(() => {
        throw new Error('precision error');
      });

      const result = await adapter.formatQuantity('BTC/USDT:USDT', 0.12345);

      // fallback 到 market.limits.amount.min (0.001)
      // Math.floor(0.12345 / 0.001) * 0.001 = 0.123
      expect(result).toBe('0.123');
    });

    it('getMarketPrecision 返回正确的精度信息', async () => {
      const prec = await adapter.getMarketPrecision('BTC/USDT:USDT');

      expect(prec.symbol).toBe('BTC/USDT:USDT');
      expect(prec.quantityPrecision).toBe(3);
      expect(prec.pricePrecision).toBe(2);
      expect(prec.minQuantity).toBe(0.001);
    });
  });

  // ========================= 余额查询 =========================

  describe('getBalance', () => {
    it('返回正确的 USDT 余额', async () => {
      const config: CcxtAdapterConfig = {
        exchangeType: 'binance',
        apiKey: 'key',
        apiSecret: 'secret',
        isTestnet: false,
      };
      const adapter = new CcxtAdapter(config);
      await adapter.initialize();

      const balance = await adapter.getBalance();

      expect(balance.totalEquity).toBe(1000);
      expect(balance.availableBalance).toBe(800);
      expect(balance.usedMargin).toBe(200);
    });
  });

  // ========================= 清理 =========================

  describe('dispose', () => {
    it('dispose 后无法使用交易所实例', async () => {
      const config: CcxtAdapterConfig = {
        exchangeType: 'binance',
        apiKey: 'key',
        apiSecret: 'secret',
        isTestnet: false,
      };
      const adapter = new CcxtAdapter(config);
      await adapter.initialize();

      await adapter.dispose();

      expect(() => adapter.getExchange()).toThrow('适配器未初始化');
    });
  });
});
