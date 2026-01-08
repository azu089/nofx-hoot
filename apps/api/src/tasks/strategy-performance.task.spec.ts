import { Test, TestingModule } from '@nestjs/testing';
import { StrategyPerformanceTask } from './strategy-performance.task';
import { PrismaService } from '../prisma/prisma.service';
import { RevenuePricingService } from '../modules/strategies/revenue-pricing.service';
import Decimal from 'decimal.js';

/**
 * StrategyPerformanceTask 单元测试
 *
 * 测试覆盖范围：
 * 1. 定时任务执行流程
 * 2. calculateTotalUsers - 用户数统计
 * 3. calculateTotalProfit - 累计盈利统计
 * 4. calculateAvgWinRate - 平均胜率计算
 * 5. calculateAvgSharpeRatio - 夏普比率计算
 * 6. updateStrategyPerformance - 性能更新
 * 7. 边界条件和异常处理
 *
 * 目标覆盖率：90%+
 */
describe('StrategyPerformanceTask', () => {
  let task: StrategyPerformanceTask;
  let prisma: PrismaService;
  let pricingService: RevenuePricingService;

  const strategyId = 'test-strategy-id';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StrategyPerformanceTask,
        {
          provide: PrismaService,
          useValue: {
            client: {
              strategies: {
                findMany: jest.fn(),
                findUnique: jest.fn(),
                update: jest.fn(),
              },
              trade_history: {
                groupBy: jest.fn(),
                findMany: jest.fn(),
              },
              strategy_revenue_logs: {
                aggregate: jest.fn(),
              },
            },
            $transaction: jest.fn((callback) => callback(prisma.client)),
          },
        },
        {
          provide: RevenuePricingService,
          useValue: {
            updateStrategyRevenueTier: jest.fn(),
          },
        },
      ],
    }).compile();

    task = module.get<StrategyPerformanceTask>(StrategyPerformanceTask);
    prisma = module.get<PrismaService>(PrismaService);
    pricingService = module.get<RevenuePricingService>(RevenuePricingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('定义测试', () => {
    it('应该被定义', () => {
      expect(task).toBeDefined();
    });
  });

  describe('handleStrategyPerformanceUpdate', () => {
    it('测试用例 1：成功执行定时任务（有策略需要更新）', async () => {
      // 准备：2 个用户策略
      const strategies = [
        { id: 'strategy-1', name: '策略1', uploader_id: 'user-1' },
        { id: 'strategy-2', name: '策略2', uploader_id: 'user-2' },
      ];

      jest
        .spyOn(prisma.client.strategies, 'findMany')
        .mockResolvedValue(strategies as any);

      // Mock 每个策略的性能更新成功
      jest.spyOn(prisma.client.trade_history, 'groupBy').mockResolvedValue([
        { user_id: 'user-1' },
        { user_id: 'user-2' },
      ] as any);

      jest.spyOn(prisma.client.strategy_revenue_logs, 'aggregate').mockResolvedValue({
        _sum: { revenue_amount: '1000' },
      } as any);

      jest.spyOn(prisma.client.trade_history, 'findMany').mockResolvedValue([
        { pnl: '100', entry_price: '1000', quantity: '1', closed_at: new Date() },
        { pnl: '50', entry_price: '1000', quantity: '1', closed_at: new Date() },
      ] as any);

      const updateSpy = jest
        .spyOn(prisma.client.strategies, 'update')
        .mockResolvedValue({} as any);

      const pricingUpdateSpy = jest
        .spyOn(pricingService, 'updateStrategyRevenueTier')
        .mockResolvedValue(undefined);

      // 执行
      await task.handleStrategyPerformanceUpdate();

      // 验证
      expect(updateSpy).toHaveBeenCalledTimes(2); // 2 个策略
      expect(pricingUpdateSpy).toHaveBeenCalledTimes(2); // 每个策略都调用定价更新
    });

    it('测试用例 2：无策略需要更新', async () => {
      // 准备：无用户策略
      jest.spyOn(prisma.client.strategies, 'findMany').mockResolvedValue([]);

      const updateSpy = jest.spyOn(prisma.client.strategies, 'update');

      // 执行
      await task.handleStrategyPerformanceUpdate();

      // 验证：不应调用更新
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('测试用例 3：部分策略更新失败（继续处理其他策略）', async () => {
      // 准备：2 个策略，第一个失败
      const strategies = [
        { id: 'strategy-fail', name: '失败策略', uploader_id: 'user-1' },
        { id: 'strategy-success', name: '成功策略', uploader_id: 'user-2' },
      ];

      jest
        .spyOn(prisma.client.strategies, 'findMany')
        .mockResolvedValue(strategies as any);

      // Mock 第一个策略失败
      let callCount = 0;
      jest.spyOn(prisma.client.trade_history, 'groupBy').mockImplementation((() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('数据库错误'));
        }
        return Promise.resolve([{ user_id: 'user-2' }] as any);
      }) as any);

      jest.spyOn(prisma.client.strategy_revenue_logs, 'aggregate').mockResolvedValue({
        _sum: { revenue_amount: '1000' },
      } as any);

      jest.spyOn(prisma.client.trade_history, 'findMany').mockResolvedValue([
        { pnl: '100', entry_price: '1000', quantity: '1', closed_at: new Date() },
      ] as any);

      const updateSpy = jest
        .spyOn(prisma.client.strategies, 'update')
        .mockResolvedValue({} as any);

      // 执行（不应抛出错误）
      await expect(task.handleStrategyPerformanceUpdate()).resolves.not.toThrow();

      // 验证：成功策略仍被更新
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'strategy-success' },
        }),
      );
    });
  });

  describe('calculateTotalUsers', () => {
    it('测试用例 4：计算使用策略的用户数', async () => {
      // 准备：3 个不同用户使用该策略
      const groupByResult = [
        { user_id: 'user-1' },
        { user_id: 'user-2' },
        { user_id: 'user-3' },
      ];

      jest
        .spyOn(prisma.client.trade_history, 'groupBy')
        .mockResolvedValue(groupByResult as any);

      // 执行（通过反射调用私有方法）
      const result = await (task as any).calculateTotalUsers(strategyId);

      // 验证
      expect(result).toBe(3);
      expect(prisma.client.trade_history.groupBy).toHaveBeenCalledWith({
        by: ['user_id'],
        where: { strategy_id: strategyId },
      });
    });

    it('测试用例 5：无用户使用该策略', async () => {
      // 准备：空结果
      jest.spyOn(prisma.client.trade_history, 'groupBy').mockResolvedValue([]);

      // 执行
      const result = await (task as any).calculateTotalUsers(strategyId);

      // 验证
      expect(result).toBe(0);
    });
  });

  describe('calculateTotalProfit', () => {
    it('测试用例 6：计算累计盈利（从收益分成记录汇总）', async () => {
      // 准备：累计盈利 5000 USDT
      jest.spyOn(prisma.client.strategy_revenue_logs, 'aggregate').mockResolvedValue({
        _sum: { revenue_amount: '5000.12345678' },
      } as any);

      // 执行
      const result = await (task as any).calculateTotalProfit(strategyId);

      // 验证
      expect(result).toBeInstanceOf(Decimal);
      expect(result.toString()).toBe('5000.12345678');
      expect(prisma.client.strategy_revenue_logs.aggregate).toHaveBeenCalledWith({
        where: {
          strategy_id: strategyId,
          status: 'settled',
        },
        _sum: {
          revenue_amount: true,
        },
      });
    });

    it('测试用例 7：无盈利记录（返回 0）', async () => {
      // 准备：无收益记录
      jest.spyOn(prisma.client.strategy_revenue_logs, 'aggregate').mockResolvedValue({
        _sum: { revenue_amount: null },
      } as any);

      // 执行
      const result = await (task as any).calculateTotalProfit(strategyId);

      // 验证
      expect(result.toString()).toBe('0');
    });
  });

  describe('calculateAvgWinRate', () => {
    it('测试用例 8：计算平均胜率（60% 胜率）', async () => {
      // 准备：10 笔交易，6 笔盈利
      const trades = [
        { pnl: '100' }, // 盈利
        { pnl: '50' }, // 盈利
        { pnl: '-30' }, // 亏损
        { pnl: '20' }, // 盈利
        { pnl: '-10' }, // 亏损
        { pnl: '80' }, // 盈利
        { pnl: '-50' }, // 亏损
        { pnl: '120' }, // 盈利
        { pnl: '-20' }, // 亏损
        { pnl: '60' }, // 盈利
      ];

      jest
        .spyOn(prisma.client.trade_history, 'findMany')
        .mockResolvedValue(trades as any);

      // 执行
      const result = await (task as any).calculateAvgWinRate(strategyId);

      // 验证：6/10 = 60%
      expect(result).toBeInstanceOf(Decimal);
      expect(result!.toNumber()).toBe(60);
    });

    it('测试用例 9：无交易记录（返回 null）', async () => {
      // 准备：空交易
      jest.spyOn(prisma.client.trade_history, 'findMany').mockResolvedValue([]);

      // 执行
      const result = await (task as any).calculateAvgWinRate(strategyId);

      // 验证
      expect(result).toBeNull();
    });

    it('测试用例 10：全部盈利（100% 胜率）', async () => {
      // 准备：5 笔全盈利
      const trades = [
        { pnl: '100' },
        { pnl: '50' },
        { pnl: '80' },
        { pnl: '120' },
        { pnl: '60' },
      ];

      jest
        .spyOn(prisma.client.trade_history, 'findMany')
        .mockResolvedValue(trades as any);

      // 执行
      const result = await (task as any).calculateAvgWinRate(strategyId);

      // 验证：5/5 = 100%
      expect(result!.toNumber()).toBe(100);
    });

    it('测试用例 11：全部亏损（0% 胜率）', async () => {
      // 准备：5 笔全亏损
      const trades = [
        { pnl: '-100' },
        { pnl: '-50' },
        { pnl: '-80' },
        { pnl: '-120' },
        { pnl: '-60' },
      ];

      jest
        .spyOn(prisma.client.trade_history, 'findMany')
        .mockResolvedValue(trades as any);

      // 执行
      const result = await (task as any).calculateAvgWinRate(strategyId);

      // 验证：0/5 = 0%
      expect(result!.toNumber()).toBe(0);
    });
  });

  describe('calculateAvgSharpeRatio', () => {
    it('测试用例 12：计算夏普比率（正常交易数据）', async () => {
      // 准备：20 笔最近 30 天交易
      const now = new Date();
      const trades = Array.from({ length: 20 }, (_, i) => ({
        pnl: i % 2 === 0 ? '100' : '-50', // 交替盈亏
        entry_price: '10000',
        quantity: '1',
        closed_at: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
      }));

      jest
        .spyOn(prisma.client.trade_history, 'findMany')
        .mockResolvedValue(trades as any);

      // 执行
      const result = await (task as any).calculateAvgSharpeRatio(strategyId);

      // 验证：应该返回 Decimal 类型
      expect(result).toBeInstanceOf(Decimal);
      expect(result).not.toBeNull();
    });

    it('测试用例 13：交易数不足 10 笔（返回 null）', async () => {
      // 准备：只有 5 笔交易
      const trades = Array.from({ length: 5 }, (_, i) => ({
        pnl: '100',
        entry_price: '10000',
        quantity: '1',
        closed_at: new Date(),
      }));

      jest
        .spyOn(prisma.client.trade_history, 'findMany')
        .mockResolvedValue(trades as any);

      // 执行
      const result = await (task as any).calculateAvgSharpeRatio(strategyId);

      // 验证
      expect(result).toBeNull();
    });

    it('测试用例 14：标准差接近 0（计算夏普比率）', async () => {
      // 准备：20 笔相同 pnl，但 quantity 不同导致收益率不同
      const trades = Array.from({ length: 20 }, (_, i) => ({
        pnl: '100',
        entry_price: '10000',
        quantity: `${1 + i * 0.01}`, // 数量略有不同
        closed_at: new Date(),
      }));

      jest
        .spyOn(prisma.client.trade_history, 'findMany')
        .mockResolvedValue(trades as any);

      // 执行
      const result = await (task as any).calculateAvgSharpeRatio(strategyId);

      // 验证：标准差虽小但不为 0，能计算夏普比率
      expect(result).toBeInstanceOf(Decimal);
    });

    it('测试用例 15：交易总数不足 10 笔（返回 null）', async () => {
      // 准备：只有 9 笔交易（不满足 10 笔最小要求）
      const trades = Array.from({ length: 9 }, () => ({
        pnl: '100',
        entry_price: '10000',
        quantity: '1',
        closed_at: new Date(),
      }));

      jest
        .spyOn(prisma.client.trade_history, 'findMany')
        .mockResolvedValue(trades as any);

      // 执行（trades.length < 10，在过滤前就返回 null）
      const result = await (task as any).calculateAvgSharpeRatio(strategyId);

      // 验证：总数不足 10 笔，返回 null
      expect(result).toBeNull();
    });
  });

  describe('updateStrategyPerformance', () => {
    it('测试用例 16：完整更新策略性能', async () => {
      // 准备：Mock 所有计算方法
      jest.spyOn(prisma.client.trade_history, 'groupBy').mockResolvedValue([
        { user_id: 'user-1' },
        { user_id: 'user-2' },
      ] as any);

      jest.spyOn(prisma.client.strategy_revenue_logs, 'aggregate').mockResolvedValue({
        _sum: { revenue_amount: '10000' },
      } as any);

      jest.spyOn(prisma.client.trade_history, 'findMany').mockResolvedValue([
        { pnl: '100', entry_price: '10000', quantity: '1', closed_at: new Date() },
        { pnl: '50', entry_price: '10000', quantity: '1', closed_at: new Date() },
        { pnl: '-30', entry_price: '10000', quantity: '1', closed_at: new Date() },
      ] as any);

      const updateSpy = jest
        .spyOn(prisma.client.strategies, 'update')
        .mockResolvedValue({} as any);

      const pricingUpdateSpy = jest
        .spyOn(pricingService, 'updateStrategyRevenueTier')
        .mockResolvedValue(undefined);

      // 执行
      await (task as any).updateStrategyPerformance(strategyId);

      // 验证：调用 update 更新策略（avg_sharpe_ratio 为 undefined 因为 calculateAvgSharpeRatio 返回 null）
      const updateCall = updateSpy.mock.calls[0][0];
      expect(updateCall.where).toEqual({ id: strategyId });
      expect(updateCall.data.total_users).toBe(2);
      expect(updateCall.data.total_profit).toBe('10000');
      expect(updateCall.data.avg_win_rate).toMatch(/\d+\.?\d*/); // 数字字符串
      expect(updateCall.data.avg_sharpe_ratio).toBeUndefined(); // null 转为 undefined
      expect(updateCall.data.last_performance_calc).toBeInstanceOf(Date);

      // 验证：调用定价服务更新等级
      expect(pricingUpdateSpy).toHaveBeenCalledWith(strategyId);
    });

    it('测试用例 17：更新包含夏普比率的策略', async () => {
      // 准备：足够的交易数据计算夏普比率
      const trades = Array.from({ length: 20 }, (_, i) => ({
        pnl: i % 2 === 0 ? '100' : '-50',
        entry_price: '10000',
        quantity: '1',
        closed_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
      }));

      jest.spyOn(prisma.client.trade_history, 'groupBy').mockResolvedValue([
        { user_id: 'user-1' },
      ] as any);

      jest.spyOn(prisma.client.strategy_revenue_logs, 'aggregate').mockResolvedValue({
        _sum: { revenue_amount: '5000' },
      } as any);

      jest
        .spyOn(prisma.client.trade_history, 'findMany')
        .mockResolvedValue(trades as any);

      const updateSpy = jest
        .spyOn(prisma.client.strategies, 'update')
        .mockResolvedValue({} as any);

      jest
        .spyOn(pricingService, 'updateStrategyRevenueTier')
        .mockResolvedValue(undefined);

      // 执行
      await (task as any).updateStrategyPerformance(strategyId);

      // 验证：avg_sharpe_ratio 不为 null
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: strategyId },
        data: expect.objectContaining({
          avg_sharpe_ratio: expect.any(String), // 应该有值
        }),
      });
    });
  });
});
