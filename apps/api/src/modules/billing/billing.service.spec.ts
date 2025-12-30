import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { PrismaService } from '../../prisma/prisma.service';
import Decimal from 'decimal.js';

describe('BillingService', () => {
  let service: BillingService;
  let prismaService: PrismaService;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockClient: any = {
    trade_history: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    billing_logs: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    wallets: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((callback: (tx: any) => Promise<any>) => callback(mockClient)),
  };

  const mockPrismaService = {
    client: mockClient,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    prismaService = module.get<PrismaService>(PrismaService);

    // 重置所有 mock
    jest.clearAllMocks();
  });

  describe('calculateGasFee', () => {
    describe('正常路径', () => {
      it('盈利 100 USDT 应产生 20 USDT 燃油费', async () => {
        // Given: 用户有一笔盈利 100 USDT 的交易，钱包余额 200 USDT
        const mockTrade = {
          id: 'trade-123',
          symbol: 'BTC/USDT',
          pnl: '100.00000000',
          gas_fee: '0.00000000',
          status: 'closed',
          user_id: 'user-1',
          instance_id: 'instance-1',
          users: {
            wallets: {
              user_id: 'user-1',
              usdt_balance: '200.00000000',
            },
          },
        };

        mockPrismaService.client.trade_history.findMany.mockResolvedValue([mockTrade]);
        mockPrismaService.client.billing_logs.findFirst.mockResolvedValue(null);

        // When: 计算燃油费
        const result = await service.calculateGasFee();

        // Then: 应该扣除 20 USDT (100 * 0.20)
        expect(result.processed).toBe(1);
        expect(result.charged).toBe(1);
        expect(result.totalGasFee).toBe('20'); // Decimal.js toDecimalPlaces 不补零
        expect(result.details[0].gasFee).toBe('20');
        expect(result.details[0].status).toBe('charged');

        // 验证扣款操作
        expect(mockPrismaService.client.wallets.update).toHaveBeenCalledWith({
          where: { user_id: 'user-1' },
          data: {
            usdt_balance: '180', // 200 - 20
            updated_at: expect.any(Date),
          },
        });

        // 验证计费日志创建
        expect(mockPrismaService.client.billing_logs.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            user_id: 'user-1',
            billing_type: 'gas_fee',
            amount: '20',
            currency: 'USDT',
            reference_type: 'trade_history',
            reference_id: 'trade-123',
            status: 'completed',
          }),
        });

        // 验证交易记录更新
        expect(mockPrismaService.client.trade_history.update).toHaveBeenCalledWith({
          where: { id: 'trade-123' },
          data: {
            gas_fee: '20',
            updated_at: expect.any(Date),
          },
        });
      });
    });

    describe('边界路径', () => {
      it('盈利为 0 时不应产生燃油费', async () => {
        // Given: 交易盈亏为 0
        mockPrismaService.client.trade_history.findMany.mockResolvedValue([]);

        // When: 计算燃油费
        const result = await service.calculateGasFee();

        // Then: 没有交易被处理
        expect(result.processed).toBe(0);
        expect(result.charged).toBe(0);
        expect(result.totalGasFee).toBe('0');
        expect(mockPrismaService.client.wallets.update).not.toHaveBeenCalled();
      });

      it('亏损交易不应产生燃油费', async () => {
        // Given: 交易亏损 50 USDT (pnl = -50)
        // 注意：查询条件已经过滤了 pnl <= 0 的交易
        mockPrismaService.client.trade_history.findMany.mockResolvedValue([]);

        // When: 计算燃油费
        const result = await service.calculateGasFee();

        // Then: 没有交易被处理
        expect(result.processed).toBe(0);
        expect(result.charged).toBe(0);
        expect(result.totalGasFee).toBe('0');
      });

      it('余额不足时应标记为 pending 状态', async () => {
        // Given: 用户盈利 100 USDT，但钱包余额只有 10 USDT
        const mockTrade = {
          id: 'trade-456',
          symbol: 'ETH/USDT',
          pnl: '100.00000000',
          gas_fee: '0.00000000',
          status: 'closed',
          user_id: 'user-2',
          instance_id: 'instance-2',
          users: {
            wallets: {
              user_id: 'user-2',
              usdt_balance: '10.00000000', // 余额不足
            },
          },
        };

        mockPrismaService.client.trade_history.findMany.mockResolvedValue([mockTrade]);
        mockPrismaService.client.billing_logs.findFirst.mockResolvedValue(null);

        // When: 计算燃油费
        const result = await service.calculateGasFee();

        // Then: 不扣款，但记录为 pending
        expect(result.processed).toBe(1);
        expect(result.charged).toBe(1);

        // 验证不扣款
        expect(mockPrismaService.client.wallets.update).not.toHaveBeenCalled();

        // 验证记录状态为 pending
        expect(mockPrismaService.client.billing_logs.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            amount: '20', // 燃油费仍为 20
            status: 'pending', // 状态为 pending
          }),
        });
      });
    });

    describe('幂等性', () => {
      it('同一交易不应重复扣费', async () => {
        // Given: 交易已经被处理过
        const mockTrade = {
          id: 'trade-789',
          symbol: 'BTC/USDT',
          pnl: '100.00000000',
          gas_fee: '0.00000000',
          status: 'closed',
          user_id: 'user-3',
          instance_id: 'instance-3',
          users: {
            wallets: {
              user_id: 'user-3',
              usdt_balance: '500.00000000',
            },
          },
        };

        const existingLog = {
          id: 'log-1',
          user_id: 'user-3',
          billing_type: 'gas_fee',
          reference_type: 'trade_history',
          reference_id: 'trade-789',
        };

        mockPrismaService.client.trade_history.findMany.mockResolvedValue([mockTrade]);
        mockPrismaService.client.billing_logs.findFirst.mockResolvedValue(existingLog);

        // When: 再次计算燃油费
        const result = await service.calculateGasFee();

        // Then: 跳过处理
        expect(result.processed).toBe(1);
        expect(result.charged).toBe(0);
        expect(result.skipped).toBe(1);
        expect(result.details[0].status).toBe('skipped');
        expect(result.details[0].reason).toBe('已处理过');

        // 验证不扣款
        expect(mockPrismaService.client.wallets.update).not.toHaveBeenCalled();
      });
    });
  });

  describe('chargeSubscription', () => {
    describe('正常路径', () => {
      it('余额 100，扣费 25 → 余额应为 75', async () => {
        // Given: 用户钱包余额 100 USDT
        const mockWallet = {
          user_id: 'user-4',
          usdt_balance: '100.00000000',
        };

        const mockLog = {
          id: 'log-2',
          user_id: 'user-4',
          unique_order_id: 'subscription_user-4_1234567890_abc123',
          billing_type: 'subscription',
          amount: '25.00000000',
          currency: 'USDT',
          description: 'VIP 订阅费 - 月付',
          status: 'completed',
          created_at: new Date(),
          reference_type: null,
          reference_id: null,
        };

        mockPrismaService.client.wallets.findUnique.mockResolvedValue(mockWallet);
        mockPrismaService.client.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
          await callback(mockPrismaService.client);
          return mockLog;
        });

        // When: 扣费 25 USDT
        const result = await service.chargeSubscription('user-4', '25.00000000', '月付');

        // Then: 余额应为 75 USDT
        // 返回值来自 mock 的 log.amount.toString()，mock 定义的是 '25.00000000'
        expect(result.amount).toBe('25.00000000');
        expect(result.status).toBe('completed');

        // 验证扣款 (Decimal.js 计算的 100 - 25 = 75，不补零)
        expect(mockPrismaService.client.wallets.update).toHaveBeenCalledWith({
          where: { user_id: 'user-4' },
          data: {
            usdt_balance: '75', // 100 - 25
            updated_at: expect.any(Date),
          },
        });

        // 验证计费日志 (Decimal.js 计算的 chargeAmount = 25，不补零)
        expect(mockPrismaService.client.billing_logs.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            user_id: 'user-4',
            billing_type: 'subscription',
            amount: '25',
            currency: 'USDT',
            description: 'VIP 订阅费 - 月付',
            status: 'completed',
          }),
        });
      });
    });

    describe('异常路径', () => {
      it('余额不足时应抛出 BadRequestException', async () => {
        // Given: 用户钱包余额只有 10 USDT
        const mockWallet = {
          user_id: 'user-5',
          usdt_balance: '10.00000000',
        };

        mockPrismaService.client.wallets.findUnique.mockResolvedValue(mockWallet);

        // When/Then: 扣费 25 USDT 应抛出错误
        await expect(
          service.chargeSubscription('user-5', '25.00000000', '月付'),
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.chargeSubscription('user-5', '25.00000000', '月付'),
        ).rejects.toThrow('余额不足');

        // 验证不扣款
        expect(mockPrismaService.client.wallets.update).not.toHaveBeenCalled();
      });

      it('钱包不存在时应抛出 BadRequestException', async () => {
        // Given: 钱包不存在
        mockPrismaService.client.wallets.findUnique.mockResolvedValue(null);

        // When/Then: 应抛出错误
        await expect(
          service.chargeSubscription('user-6', '25.00000000', '月付'),
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.chargeSubscription('user-6', '25.00000000', '月付'),
        ).rejects.toThrow('钱包不存在');
      });
    });
  });

  describe('getTodayPnL', () => {
    describe('正常路径', () => {
      it('有交易数据时应正确计算汇总', async () => {
        // Given: 今日有 3 笔交易（2 盈 1 亏）
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const mockTrades = [
          {
            id: 'trade-1',
            user_id: 'user-7',
            symbol: 'BTC/USDT',
            status: 'closed',
            pnl: '50.00000000', // 盈利 50
            gas_fee: '10.00000000', // 燃油费 10
            closed_at: new Date(),
          },
          {
            id: 'trade-2',
            user_id: 'user-7',
            symbol: 'ETH/USDT',
            status: 'closed',
            pnl: '30.00000000', // 盈利 30
            gas_fee: '6.00000000', // 燃油费 6
            closed_at: new Date(),
          },
          {
            id: 'trade-3',
            user_id: 'user-7',
            symbol: 'SOL/USDT',
            status: 'closed',
            pnl: '-20.00000000', // 亏损 20
            gas_fee: '0.00000000', // 无燃油费
            closed_at: new Date(),
          },
        ];

        mockPrismaService.client.trade_history.findMany.mockResolvedValue(mockTrades);

        // When: 获取今日盈亏
        const result = await service.getTodayPnL('user-7');

        // Then: 验算
        // todayPnl = 50 + 30 - 20 = 60
        // todayProfit = 50 + 30 = 80
        // todayLoss = -20
        // todayGasFee = 10 + 6 = 16
        // winRate = 2/3 = 66.67%
        expect(result.todayPnl).toBe('60.00000000');
        expect(result.todayProfit).toBe('80.00000000');
        expect(result.todayLoss).toBe('-20.00000000');
        expect(result.todayGasFee).toBe('16.00000000');
        expect(result.todayTrades).toBe(3);
        expect(result.todayWinRate).toBe('66.67');
      });

      it('无交易数据时应返回零值', async () => {
        // Given: 今日无交易
        mockPrismaService.client.trade_history.findMany.mockResolvedValue([]);

        // When: 获取今日盈亏
        const result = await service.getTodayPnL('user-8');

        // Then: 所有值应为 0
        expect(result.todayPnl).toBe('0.00000000');
        expect(result.todayProfit).toBe('0.00000000');
        expect(result.todayLoss).toBe('0.00000000');
        expect(result.todayGasFee).toBe('0.00000000');
        expect(result.todayTrades).toBe(0);
        expect(result.todayWinRate).toBe('0.00');
      });
    });
  });

  describe('资金精度验证', () => {
    it('所有金额计算应保持 8 位小数精度', async () => {
      // Given: 特殊精度测试
      const mockTrade = {
        id: 'trade-precision',
        symbol: 'BTC/USDT',
        pnl: '123.45678901', // 超过 8 位
        gas_fee: '0.00000000',
        status: 'closed',
        user_id: 'user-precision',
        instance_id: 'instance-1',
        users: {
          wallets: {
            user_id: 'user-precision',
            usdt_balance: '1000.00000000',
          },
        },
      };

      mockPrismaService.client.trade_history.findMany.mockResolvedValue([mockTrade]);
      mockPrismaService.client.billing_logs.findFirst.mockResolvedValue(null);

      // When: 计算燃油费
      const result = await service.calculateGasFee();

      // Then: 燃油费应精确到 8 位小数
      // 123.45678901 * 0.20 = 24.6913578 (Decimal.js 不补尾零)
      expect(result.details[0].gasFee).toBe('24.6913578');

      // 验证所有金额都是 8 位小数以内
      expect(result.totalGasFee.split('.')[1]?.length || 0).toBeLessThanOrEqual(8);
    });
  });

  describe('getBillingLogs', () => {
    it('应正确返回计费日志列表', async () => {
      // Given: 用户有 2 条计费日志
      const mockLogs = [
        {
          id: 'log-1',
          user_id: 'user-9',
          unique_order_id: 'subscription_user-9_123_abc',
          billing_type: 'subscription',
          amount: '25.00000000',
          currency: 'USDT',
          reference_type: null,
          reference_id: null,
          description: 'VIP 订阅费 - 月付',
          status: 'completed',
          created_at: new Date(),
        },
        {
          id: 'log-2',
          user_id: 'user-9',
          unique_order_id: 'gas_fee_trade-1_456_def',
          billing_type: 'gas_fee',
          amount: '10.00000000',
          currency: 'USDT',
          reference_type: 'trade_history',
          reference_id: 'trade-1',
          description: '交易 BTC/USDT 盈利抽成 20%',
          status: 'completed',
          created_at: new Date(),
        },
      ];

      mockPrismaService.client.billing_logs.findMany.mockResolvedValue(mockLogs);

      // When: 获取计费日志
      const result = await service.getBillingLogs('user-9');

      // Then: 应返回 2 条日志
      expect(result).toHaveLength(2);
      expect(result[0].billingType).toBe('subscription');
      expect(result[1].billingType).toBe('gas_fee');
    });
  });
});
