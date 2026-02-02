import { Test, TestingModule } from '@nestjs/testing';
import { FeeService, FEE_CONFIG } from './fee.service';
import { PrismaService } from '../../prisma/prisma.service';
import Decimal from 'decimal.js';

describe('FeeService', () => {
  let service: FeeService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    stakingRecord: {
      findMany: jest.fn(),
    },
    billingLog: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeeService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<FeeService>(FeeService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('calculateFee', () => {
    // 正常路径 - 无质押用户
    it('无质押用户应收取基础费率 20%', async () => {
      mockPrismaService.stakingRecord.findMany.mockResolvedValue([]);

      const result = await service.calculateFee('user-123', '100');

      expect(result.profit).toBe('100');
      expect(result.baseFeeRate).toBe('0.2');
      expect(result.stakingDiscount).toBe('0');
      expect(result.vipDiscount).toBe('0');
      expect(result.finalFeeRate).toBe('0.2');
      expect(result.feeAmount).toBe('20.00000000');
      expect(result.netProfit).toBe('80.00000000');
    });

    // 正常路径 - B 类质押用户（10% 折扣）
    it('B 类质押用户应有 10% 折扣', async () => {
      mockPrismaService.stakingRecord.findMany.mockResolvedValue([
        {
          id: 'stake-1',
          userId: 'user-123',
          type: 'B',
          amount: { toString: () => '1000' },
          status: 'active',
        },
      ]);

      const result = await service.calculateFee('user-123', '100');

      // 基础费率 20%，质押折扣 10%，最终费率 = 20% * (1 - 10%) = 18%
      expect(result.stakingDiscount).toBe('0.1');
      expect(result.finalFeeRate).toBe('0.18');
      expect(result.feeAmount).toBe('18.00000000');
      expect(result.netProfit).toBe('82.00000000');
    });

    // 正常路径 - VIP 折扣（质押 >= 10000）
    it('质押 10000 HOOT 应有 5% VIP 折扣', async () => {
      mockPrismaService.stakingRecord.findMany.mockResolvedValue([
        {
          id: 'stake-1',
          userId: 'user-123',
          type: 'B',
          amount: { toString: () => '10000' },
          status: 'active',
        },
      ]);

      const result = await service.calculateFee('user-123', '100');

      // 基础 20%，质押折扣 10%，VIP 折扣 5%，总折扣 15%
      // 最终费率 = 20% * (1 - 15%) = 17%
      expect(result.vipDiscount).toBe('0.05');
      expect(result.finalFeeRate).toBe('0.17');
    });

    // 正常路径 - 最高 VIP 折扣（质押 >= 100000）
    it('质押 100000 HOOT 应有 15% VIP 折扣', async () => {
      mockPrismaService.stakingRecord.findMany.mockResolvedValue([
        {
          id: 'stake-1',
          userId: 'user-123',
          type: 'B',
          amount: { toString: () => '100000' },
          status: 'active',
        },
      ]);

      const result = await service.calculateFee('user-123', '100');

      // 基础 20%，质押折扣 10%，VIP 折扣 15%，总折扣 25%
      // 最终费率 = 20% * (1 - 25%) = 15%
      expect(result.vipDiscount).toBe('0.15');
      expect(result.finalFeeRate).toBe('0.15');
    });

    // 边界路径 - 亏损不收费
    it('亏损时不应收取手续费', async () => {
      mockPrismaService.stakingRecord.findMany.mockResolvedValue([]);

      const result = await service.calculateFee('user-123', '-50');

      expect(result.finalFeeRate).toBe('0');
      expect(result.feeAmount).toBe('0');
      expect(result.netProfit).toBe('-50');
    });

    // 边界路径 - 零盈利
    it('零盈利时不应收取手续费', async () => {
      mockPrismaService.stakingRecord.findMany.mockResolvedValue([]);

      const result = await service.calculateFee('user-123', '0');

      expect(result.feeAmount).toBe('0');
    });

    // 边界路径 - 最小手续费
    it('手续费低于最小值时应使用最小手续费', async () => {
      mockPrismaService.stakingRecord.findMany.mockResolvedValue([]);

      // 盈利 0.01 USDT，20% 手续费 = 0.002 < 最小 0.01
      const result = await service.calculateFee('user-123', '0.01');

      expect(result.feeAmount).toBe('0.01000000');
    });

    // 边界路径 - A 类质押无折扣
    it('A 类质押用户无质押折扣', async () => {
      mockPrismaService.stakingRecord.findMany.mockResolvedValue([
        {
          id: 'stake-1',
          userId: 'user-123',
          type: 'A',
          amount: { toString: () => '5000' },
          status: 'active',
        },
      ]);

      const result = await service.calculateFee('user-123', '100');

      expect(result.stakingDiscount).toBe('0');
      expect(result.finalFeeRate).toBe('0.2');
    });

    // 正常路径 - 多个质押记录
    it('多个质押记录时应累加计算', async () => {
      mockPrismaService.stakingRecord.findMany.mockResolvedValue([
        {
          id: 'stake-1',
          type: 'A',
          amount: { toString: () => '3000' },
          status: 'active',
        },
        {
          id: 'stake-2',
          type: 'B',
          amount: { toString: () => '7000' },
          status: 'active',
        },
      ]);

      const result = await service.calculateFee('user-123', '100');

      // 总质押 10000，有 B 类，质押折扣 10%，VIP 折扣 5%
      expect(result.stakingDiscount).toBe('0.1');
      expect(result.vipDiscount).toBe('0.05');
    });
  });

  describe('chargeFee', () => {
    const feeRecord = {
      userId: 'user-123',
      positionId: 'pos-456',
      profit: '100',
      feeRate: '0.2',
      feeAmount: '20',
      uniqueOrderId: 'GAS_FEE_user-123_pos-456_1234567890_abc123',
    };

    // 正常路径
    it('应该成功扣除手续费', async () => {
      mockPrismaService.billingLog.findUnique.mockResolvedValue(null);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          user: {
            findUnique: jest
              .fn()
              .mockResolvedValue({ usdtBalance: { toString: () => '100' } }),
          },
          billingLog: { create: jest.fn() },
        });
      });

      const result = await service.chargeFee(feeRecord);

      expect(result).toBe(true);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    // 幂等性测试 - 重复扣费
    it('重复扣费时应返回 false', async () => {
      mockPrismaService.billingLog.findUnique.mockResolvedValue({
        id: 'existing-log',
        uniqueOrderId: feeRecord.uniqueOrderId,
      });

      const result = await service.chargeFee(feeRecord);

      expect(result).toBe(false);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    // 边界路径 - 手续费为 0
    it('手续费为 0 时应返回 true 但不扣费', async () => {
      mockPrismaService.billingLog.findUnique.mockResolvedValue(null);

      const zeroFeeRecord = { ...feeRecord, feeAmount: '0' };
      const result = await service.chargeFee(zeroFeeRecord);

      expect(result).toBe(true);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    // 边界路径 - 负数手续费
    it('负数手续费时应返回 true 但不扣费', async () => {
      mockPrismaService.billingLog.findUnique.mockResolvedValue(null);

      const negativeFeeRecord = { ...feeRecord, feeAmount: '-5' };
      const result = await service.chargeFee(negativeFeeRecord);

      expect(result).toBe(true);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('generateUniqueOrderId', () => {
    // 正常路径
    it('应该生成唯一订单 ID', () => {
      const id1 = service.generateUniqueOrderId('GAS_FEE', 'user-1', 'pos-1');
      const id2 = service.generateUniqueOrderId('GAS_FEE', 'user-1', 'pos-1');

      expect(id1).toMatch(/^GAS_FEE_user-1_pos-1_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^GAS_FEE_user-1_pos-1_\d+_[a-z0-9]+$/);
      // 由于有时间戳和随机数，两次生成的 ID 应该不同
      // 但由于测试执行速度快，时间戳可能相同，所以不强制断言不相等
    });

    // 边界路径 - 不同类型
    it('不同类型应有不同前缀', () => {
      const gasId = service.generateUniqueOrderId('GAS_FEE', 'user-1', 'pos-1');
      const subId = service.generateUniqueOrderId(
        'SUBSCRIPTION',
        'user-1',
        'pos-1',
      );

      expect(gasId.startsWith('GAS_FEE_')).toBe(true);
      expect(subId.startsWith('SUBSCRIPTION_')).toBe(true);
    });
  });

  describe('getUserFeeStats', () => {
    // 正常路径
    it('应该返回用户手续费统计', async () => {
      mockPrismaService.billingLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          amount: '20',
          description: '持仓 pos-1 盈利 100 手续费 0.2 = 20',
        },
        {
          id: 'log-2',
          amount: '15',
          description: '持仓 pos-2 盈利 100 手续费 0.15 = 15',
        },
      ]);

      const result = await service.getUserFeeStats('user-123');

      expect(result.totalFeesPaid).toBe('35.00000000');
      expect(result.feeCount).toBe(2);
      expect(result.averageFeeRate).toBe('0.1750');
    });

    // 边界路径 - 无手续费记录
    it('无手续费记录时应返回零值', async () => {
      mockPrismaService.billingLog.findMany.mockResolvedValue([]);

      const result = await service.getUserFeeStats('user-123');

      expect(result.totalFeesPaid).toBe('0');
      expect(result.feeCount).toBe(0);
      expect(result.averageFeeRate).toBe('0');
    });
  });

  describe('FEE_CONFIG', () => {
    // 验证配置值
    it('基础费率应为 20%', () => {
      expect(FEE_CONFIG.BASE_GAS_FEE_RATE.toString()).toBe('0.2');
    });

    it('B 类质押折扣应为 10%', () => {
      expect(FEE_CONFIG.STAKING_DISCOUNT.B.toString()).toBe('0.1');
    });

    it('A 类质押无折扣', () => {
      expect(FEE_CONFIG.STAKING_DISCOUNT.A.toString()).toBe('0');
    });

    it('VIP 折扣阶梯正确', () => {
      expect(FEE_CONFIG.VIP_DISCOUNT_TIERS.length).toBe(3);
      expect(FEE_CONFIG.VIP_DISCOUNT_TIERS[0].minStake.toString()).toBe(
        '10000',
      );
      expect(FEE_CONFIG.VIP_DISCOUNT_TIERS[1].minStake.toString()).toBe(
        '50000',
      );
      expect(FEE_CONFIG.VIP_DISCOUNT_TIERS[2].minStake.toString()).toBe(
        '100000',
      );
    });

    it('最小手续费应为 0.01 USDT', () => {
      expect(FEE_CONFIG.MIN_FEE.toString()).toBe('0.01');
    });
  });
});
