import { Test, TestingModule } from '@nestjs/testing';
import { TradesService } from './trades.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FreqtradeService } from '../freqtrade/freqtrade.service';
import Decimal from 'decimal.js';

describe('TradesService', () => {
  let service: TradesService;

  const mockPrismaService = {
    client: {
      trade_history: {
        findMany: jest.fn(),
      },
      instances: {
        findUnique: jest.fn(),
      },
    },
  };

  const mockFreqtradeService = {
    getTrades: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: FreqtradeService, useValue: mockFreqtradeService },
      ],
    }).compile();

    service = module.get<TradesService>(TradesService);

    // 重置所有 mock
    jest.clearAllMocks();
  });

  describe('calculatePnL', () => {
    const userId = 'user-123';

    /**
     * 正常路径：多笔交易 -> 正确计算 total_pnl、win_rate
     */
    it('should calculate PnL correctly with multiple trades', async () => {
      // Mock 数据：3 笔盈利 + 2 笔亏损
      const mockTrades = [
        {
          id: '1',
          user_id: userId,
          status: 'closed',
          pnl: '100.50000000',
          gas_fee: '20.10000000',
        },
        {
          id: '2',
          user_id: userId,
          status: 'closed',
          pnl: '200.75000000',
          gas_fee: '15.50000000',
        },
        {
          id: '3',
          user_id: userId,
          status: 'closed',
          pnl: '-50.25000000',
          gas_fee: '10.00000000',
        },
        {
          id: '4',
          user_id: userId,
          status: 'closed',
          pnl: '150.00000000',
          gas_fee: '12.00000000',
        },
        {
          id: '5',
          user_id: userId,
          status: 'closed',
          pnl: '-30.00000000',
          gas_fee: '8.00000000',
        },
      ];

      mockPrismaService.client.trade_history.findMany.mockResolvedValue(
        mockTrades,
      );

      const result = await service.calculatePnL(userId);

      // 验证基础统计
      expect(result.total_trades).toBe(5);
      expect(result.closed_trades).toBe(5);
      expect(result.open_trades).toBe(0);
      expect(result.win_trades).toBe(3);
      expect(result.loss_trades).toBe(2);

      // 验证盈亏金额（8 位小数）
      const expectedTotalPnl = new Decimal('100.5')
        .plus('200.75')
        .plus('-50.25')
        .plus('150')
        .plus('-30');
      expect(result.total_pnl).toBe(expectedTotalPnl.toFixed(8));

      // 验证总盈利
      const expectedTotalProfit = new Decimal('100.5')
        .plus('200.75')
        .plus('150');
      expect(result.total_profit).toBe(expectedTotalProfit.toFixed(8));

      // 验证总亏损
      const expectedTotalLoss = new Decimal('-50.25').plus('-30');
      expect(result.total_loss).toBe(expectedTotalLoss.toFixed(8));

      // 验证胜率 (3/5 = 60%)
      expect(result.win_rate).toBe('60.00');

      // 验证最佳/最差交易
      expect(result.best_trade).toBe('200.75000000');
      expect(result.worst_trade).toBe('-50.25000000');

      // 验证平均盈亏
      const expectedAvgPnl = expectedTotalPnl.dividedBy(5);
      expect(result.avg_pnl_per_trade).toBe(expectedAvgPnl.toFixed(8));

      // 验证手续费总和
      const expectedTotalGasFee = new Decimal('20.1')
        .plus('15.5')
        .plus('10')
        .plus('12')
        .plus('8');
      expect(result.total_gas_fee).toBe(expectedTotalGasFee.toFixed(8));
    });

    /**
     * 边界路径：无交易 -> 返回 0
     */
    it('should return zeros when user has no trades', async () => {
      mockPrismaService.client.trade_history.findMany.mockResolvedValue([]);

      const result = await service.calculatePnL(userId);

      expect(result.total_trades).toBe(0);
      expect(result.closed_trades).toBe(0);
      expect(result.open_trades).toBe(0);
      expect(result.win_trades).toBe(0);
      expect(result.loss_trades).toBe(0);
      expect(result.win_rate).toBe('0.00');
      expect(result.total_pnl).toBe('0.00000000');
      expect(result.total_profit).toBe('0.00000000');
      expect(result.total_loss).toBe('0.00000000');
      expect(result.total_gas_fee).toBe('0.00000000');
      expect(result.avg_pnl_per_trade).toBe('0.00000000');
      expect(result.best_trade).toBe('0.00000000');
      expect(result.worst_trade).toBe('0.00000000');
    });

    /**
     * 边界路径：只有盈利交易 -> win_rate = 100%
     */
    it('should calculate 100% win rate when all trades are profitable', async () => {
      const mockTrades = [
        {
          id: '1',
          user_id: userId,
          status: 'closed',
          pnl: '50.00000000',
          gas_fee: '5.00000000',
        },
        {
          id: '2',
          user_id: userId,
          status: 'closed',
          pnl: '100.00000000',
          gas_fee: '10.00000000',
        },
        {
          id: '3',
          user_id: userId,
          status: 'closed',
          pnl: '75.50000000',
          gas_fee: '7.50000000',
        },
      ];

      mockPrismaService.client.trade_history.findMany.mockResolvedValue(
        mockTrades,
      );

      const result = await service.calculatePnL(userId);

      expect(result.win_trades).toBe(3);
      expect(result.loss_trades).toBe(0);
      expect(result.win_rate).toBe('100.00');

      // 验证总盈利 = 总盈亏（无亏损）
      expect(result.total_pnl).toBe(result.total_profit);
      expect(result.total_loss).toBe('0.00000000');

      // 验证最差交易为最小盈利值
      expect(result.worst_trade).toBe('0.00000000');
      expect(result.best_trade).toBe('100.00000000');
    });

    /**
     * 边界路径：只有亏损交易 -> win_rate = 0%
     */
    it('should calculate 0% win rate when all trades are losing', async () => {
      const mockTrades = [
        {
          id: '1',
          user_id: userId,
          status: 'closed',
          pnl: '-50.00000000',
          gas_fee: '5.00000000',
        },
        {
          id: '2',
          user_id: userId,
          status: 'closed',
          pnl: '-100.00000000',
          gas_fee: '10.00000000',
        },
        {
          id: '3',
          user_id: userId,
          status: 'closed',
          pnl: '-25.50000000',
          gas_fee: '2.50000000',
        },
      ];

      mockPrismaService.client.trade_history.findMany.mockResolvedValue(
        mockTrades,
      );

      const result = await service.calculatePnL(userId);

      expect(result.win_trades).toBe(0);
      expect(result.loss_trades).toBe(3);
      expect(result.win_rate).toBe('0.00');

      // 验证总盈利为 0
      expect(result.total_profit).toBe('0.00000000');

      // 验证总亏损 = 总盈亏（无盈利）
      expect(result.total_pnl).toBe(result.total_loss);

      // 验证最佳交易为 0（无盈利）
      expect(result.best_trade).toBe('0.00000000');
      expect(result.worst_trade).toBe('-100.00000000');
    });

    /**
     * 胜率计算测试：5 胜 5 负 -> win_rate = 50%
     */
    it('should calculate 50% win rate with equal wins and losses', async () => {
      const mockTrades = [
        // 5 笔盈利
        { id: '1', user_id: userId, status: 'closed', pnl: '10.00000000', gas_fee: '1.00000000' },
        { id: '2', user_id: userId, status: 'closed', pnl: '20.00000000', gas_fee: '2.00000000' },
        { id: '3', user_id: userId, status: 'closed', pnl: '30.00000000', gas_fee: '3.00000000' },
        { id: '4', user_id: userId, status: 'closed', pnl: '40.00000000', gas_fee: '4.00000000' },
        { id: '5', user_id: userId, status: 'closed', pnl: '50.00000000', gas_fee: '5.00000000' },
        // 5 笔亏损
        { id: '6', user_id: userId, status: 'closed', pnl: '-10.00000000', gas_fee: '1.00000000' },
        { id: '7', user_id: userId, status: 'closed', pnl: '-20.00000000', gas_fee: '2.00000000' },
        { id: '8', user_id: userId, status: 'closed', pnl: '-30.00000000', gas_fee: '3.00000000' },
        { id: '9', user_id: userId, status: 'closed', pnl: '-40.00000000', gas_fee: '4.00000000' },
        { id: '10', user_id: userId, status: 'closed', pnl: '-50.00000000', gas_fee: '5.00000000' },
      ];

      mockPrismaService.client.trade_history.findMany.mockResolvedValue(
        mockTrades,
      );

      const result = await service.calculatePnL(userId);

      expect(result.total_trades).toBe(10);
      expect(result.closed_trades).toBe(10);
      expect(result.win_trades).toBe(5);
      expect(result.loss_trades).toBe(5);
      expect(result.win_rate).toBe('50.00');
    });

    /**
     * 胜率计算测试：3 胜 7 负 -> win_rate = 30%
     */
    it('should calculate 30% win rate with 3 wins and 7 losses', async () => {
      const mockTrades = [
        // 3 笔盈利
        { id: '1', user_id: userId, status: 'closed', pnl: '10.00000000', gas_fee: '1.00000000' },
        { id: '2', user_id: userId, status: 'closed', pnl: '20.00000000', gas_fee: '2.00000000' },
        { id: '3', user_id: userId, status: 'closed', pnl: '30.00000000', gas_fee: '3.00000000' },
        // 7 笔亏损
        { id: '4', user_id: userId, status: 'closed', pnl: '-10.00000000', gas_fee: '1.00000000' },
        { id: '5', user_id: userId, status: 'closed', pnl: '-20.00000000', gas_fee: '2.00000000' },
        { id: '6', user_id: userId, status: 'closed', pnl: '-30.00000000', gas_fee: '3.00000000' },
        { id: '7', user_id: userId, status: 'closed', pnl: '-40.00000000', gas_fee: '4.00000000' },
        { id: '8', user_id: userId, status: 'closed', pnl: '-50.00000000', gas_fee: '5.00000000' },
        { id: '9', user_id: userId, status: 'closed', pnl: '-60.00000000', gas_fee: '6.00000000' },
        { id: '10', user_id: userId, status: 'closed', pnl: '-70.00000000', gas_fee: '7.00000000' },
      ];

      mockPrismaService.client.trade_history.findMany.mockResolvedValue(
        mockTrades,
      );

      const result = await service.calculatePnL(userId);

      expect(result.total_trades).toBe(10);
      expect(result.closed_trades).toBe(10);
      expect(result.win_trades).toBe(3);
      expect(result.loss_trades).toBe(7);
      expect(result.win_rate).toBe('30.00');
    });

    /**
     * Decimal 精度测试：小数位精度应为 8 位
     */
    it('should maintain 8 decimal precision in calculations', async () => {
      const mockTrades = [
        {
          id: '1',
          user_id: userId,
          status: 'closed',
          pnl: '0.00000001', // 最小单位
          gas_fee: '0.00000001',
        },
        {
          id: '2',
          user_id: userId,
          status: 'closed',
          pnl: '123.45678901', // 超过 8 位（应截断为 123.45678901）
          gas_fee: '0.12345678',
        },
      ];

      mockPrismaService.client.trade_history.findMany.mockResolvedValue(
        mockTrades,
      );

      const result = await service.calculatePnL(userId);

      // 验证精度保持 8 位小数
      expect(result.total_pnl).toMatch(/^\d+\.\d{8}$/);
      expect(result.total_profit).toMatch(/^\d+\.\d{8}$/);
      expect(result.total_gas_fee).toMatch(/^\d+\.\d{8}$/);

      // 验证最小值计算正确
      expect(result.total_pnl).toBe('123.45678902'); // 0.00000001 + 123.45678901
      expect(result.total_gas_fee).toBe('0.12345679'); // 0.00000001 + 0.12345678
    });

    /**
     * Decimal 精度测试：大数值计算不应溢出
     */
    it('should handle large numbers without overflow', async () => {
      const mockTrades = [
        {
          id: '1',
          user_id: userId,
          status: 'closed',
          pnl: '999999999.99999999', // 接近 10 亿
          gas_fee: '100000.00000000',
        },
        {
          id: '2',
          user_id: userId,
          status: 'closed',
          pnl: '888888888.88888888',
          gas_fee: '200000.00000000',
        },
      ];

      mockPrismaService.client.trade_history.findMany.mockResolvedValue(
        mockTrades,
      );

      const result = await service.calculatePnL(userId);

      // 验证大数值计算不溢出
      const expectedTotalPnl = new Decimal('999999999.99999999').plus(
        '888888888.88888888',
      );
      expect(result.total_pnl).toBe(expectedTotalPnl.toFixed(8));

      const expectedTotalGasFee = new Decimal('100000').plus('200000');
      expect(result.total_gas_fee).toBe(expectedTotalGasFee.toFixed(8));

      // 验证结果为合理值
      expect(parseFloat(result.total_pnl)).toBeGreaterThan(1_800_000_000);
      expect(parseFloat(result.total_gas_fee)).toBe(300000);
    });

    /**
     * 边界路径：包含未平仓交易（pnl 为 null）
     */
    it('should ignore open trades when calculating PnL', async () => {
      const mockTrades = [
        {
          id: '1',
          user_id: userId,
          status: 'closed',
          pnl: '100.00000000',
          gas_fee: '10.00000000',
        },
        {
          id: '2',
          user_id: userId,
          status: 'open', // 未平仓
          pnl: null,
          gas_fee: '0.00000000',
        },
        {
          id: '3',
          user_id: userId,
          status: 'closed',
          pnl: '-50.00000000',
          gas_fee: '5.00000000',
        },
      ];

      mockPrismaService.client.trade_history.findMany.mockResolvedValue(
        mockTrades,
      );

      const result = await service.calculatePnL(userId);

      // 验证总交易数包含未平仓
      expect(result.total_trades).toBe(3);
      expect(result.open_trades).toBe(1);
      expect(result.closed_trades).toBe(2);

      // 验证盈亏计算只包含已平仓交易
      const expectedTotalPnl = new Decimal('100').plus('-50');
      expect(result.total_pnl).toBe(expectedTotalPnl.toFixed(8));

      // 验证胜率基于已平仓交易
      expect(result.win_rate).toBe('50.00'); // 1 win / 2 closed = 50%
    });

    /**
     * 边界路径：pnl = 0 的交易（不算盈利也不算亏损）
     */
    it('should not count zero PnL trades as wins or losses', async () => {
      const mockTrades = [
        {
          id: '1',
          user_id: userId,
          status: 'closed',
          pnl: '0.00000000', // 持平
          gas_fee: '10.00000000',
        },
        {
          id: '2',
          user_id: userId,
          status: 'closed',
          pnl: '100.00000000',
          gas_fee: '10.00000000',
        },
        {
          id: '3',
          user_id: userId,
          status: 'closed',
          pnl: '-50.00000000',
          gas_fee: '5.00000000',
        },
      ];

      mockPrismaService.client.trade_history.findMany.mockResolvedValue(
        mockTrades,
      );

      const result = await service.calculatePnL(userId);

      // 验证 pnl = 0 的交易不计入盈亏统计
      expect(result.total_trades).toBe(3);
      expect(result.closed_trades).toBe(3);
      expect(result.win_trades).toBe(1); // 只有 1 笔盈利
      expect(result.loss_trades).toBe(1); // 只有 1 笔亏损

      // 验证胜率
      expect(result.win_rate).toBe('33.33'); // 1 / 3 = 33.33%
    });
  });
});
