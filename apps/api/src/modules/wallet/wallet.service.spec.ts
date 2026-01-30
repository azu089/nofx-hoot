import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234-5678-90ab-cdef12345678'),
}));

describe('WalletService', () => {
  let service: WalletService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    depositAddress: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    withdrawRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('getBalance', () => {
    // 正常路径
    it('应该返回用户余额', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        usdtBalance: new Decimal('100.12345678'),
        hootBalance: new Decimal('500.00000000'),
      });

      const result = await service.getBalance('user-123');

      expect(result.usdt).toBe('100.12345678');
      expect(result.hoot).toBe('500');
    });

    // 边界路径 - 用户不存在
    it('用户不存在时应返回 0', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.getBalance('non-existent');

      expect(result.usdt).toBe('0');
      expect(result.hoot).toBe('0');
    });
  });

  describe('getTransactions', () => {
    // 正常路径
    it('应该返回交易记录列表', async () => {
      const mockTransactions = [
        {
          id: 'tx-1',
          type: 'deposit',
          asset: 'USDT',
          amount: new Decimal('100'),
          status: 'completed',
          txHash: '0x123',
          remark: null,
          createdAt: new Date(),
        },
        {
          id: 'tx-2',
          type: 'withdraw',
          asset: 'USDT',
          amount: new Decimal('-50'),
          status: 'pending',
          txHash: null,
          remark: '提现中',
          createdAt: new Date(),
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrismaService.transaction.count.mockResolvedValue(2);

      const result = await service.getTransactions('user-123', { page: 1, pageSize: 20 });

      expect(result.items.length).toBe(2);
      expect(result.total).toBe(2);
      expect(result.items[0].id).toBe('tx-1');
    });

    // 边界路径 - 空列表
    it('无交易记录时应返回空列表', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([]);
      mockPrismaService.transaction.count.mockResolvedValue(0);

      const result = await service.getTransactions('user-123', { page: 1, pageSize: 20 });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    // 正常路径 - 带筛选条件
    it('应该支持按类型筛选', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([]);
      mockPrismaService.transaction.count.mockResolvedValue(0);

      await service.getTransactions('user-123', { type: 'deposit', page: 1, pageSize: 20 });

      expect(mockPrismaService.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
            type: 'deposit',
          }),
        }),
      );
    });
  });

  describe('getDepositAddress', () => {
    // 正常路径 - 返回已有地址
    it('应该返回已有的充值地址', async () => {
      const mockAddress = {
        chain: 'BSC',
        asset: 'USDT',
        address: '0x1234567890abcdef',
      };

      mockPrismaService.depositAddress.findUnique.mockResolvedValue(mockAddress);

      const result = await service.getDepositAddress('user-123', 'BSC', 'USDT');

      expect(result.address).toBe(mockAddress.address);
      expect(result.chain).toBe('BSC');
      expect(result.asset).toBe('USDT');
    });

    // 正常路径 - 生成新地址
    it('应该生成新的充值地址', async () => {
      mockPrismaService.depositAddress.findUnique.mockResolvedValue(null);
      mockPrismaService.depositAddress.create.mockImplementation(({ data }) => ({
        chain: data.chain,
        asset: data.asset,
        address: data.address,
      }));

      const result = await service.getDepositAddress('user-123', 'BSC', 'USDT');

      expect(result.address).toBeDefined();
      expect(result.address.startsWith('0x')).toBe(true);
      expect(result.chain).toBe('BSC');
    });
  });

  describe('createWithdrawRequest', () => {
    const withdrawDto = {
      asset: 'USDT',
      amount: 100,
      chain: 'BSC',
      address: '0x1234567890abcdef1234567890abcdef12345678',
    };

    // 正常路径
    it('应该成功创建提现申请', async () => {
      const mockUser = {
        usdtBalance: new Decimal('200'),
        hootBalance: new Decimal('1000'),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          user: { update: jest.fn() },
          withdrawRequest: {
            create: jest.fn().mockResolvedValue({
              id: 'withdraw-123',
              asset: 'USDT',
              amount: new Decimal('100'),
              fee: new Decimal('0.1'),
              chain: 'BSC',
              address: withdrawDto.address,
              status: 'pending',
              createdAt: new Date(),
            }),
          },
          transaction: { create: jest.fn() },
        });
      });

      const result = await service.createWithdrawRequest('user-123', withdrawDto);

      expect(result.id).toBe('withdraw-123');
      expect(result.amount).toBe('100');
      expect(result.status).toBe('pending');
    });

    // 异常路径 - 低于最小提现金额
    it('低于最小提现金额时应抛出 BadRequestException', async () => {
      const lowAmountDto = { ...withdrawDto, amount: 5 };

      await expect(
        service.createWithdrawRequest('user-123', lowAmountDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createWithdrawRequest('user-123', lowAmountDto),
      ).rejects.toThrow('USDT 最小提现金额为 10');
    });

    // 异常路径 - 余额不足
    it('余额不足时应抛出 BadRequestException', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        usdtBalance: new Decimal('50'),
        hootBalance: new Decimal('0'),
      });

      await expect(
        service.createWithdrawRequest('user-123', withdrawDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createWithdrawRequest('user-123', withdrawDto),
      ).rejects.toThrow('余额不足');
    });

    // 边界路径 - 刚好够余额（含手续费）
    it('余额刚好够时应成功', async () => {
      // 提现 100，手续费 0.1%，总共 100.1
      mockPrismaService.user.findUnique.mockResolvedValue({
        usdtBalance: new Decimal('100.1'),
        hootBalance: new Decimal('0'),
      });

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          user: { update: jest.fn() },
          withdrawRequest: {
            create: jest.fn().mockResolvedValue({
              id: 'withdraw-456',
              asset: 'USDT',
              amount: new Decimal('100'),
              fee: new Decimal('0.1'),
              chain: 'BSC',
              address: withdrawDto.address,
              status: 'pending',
              createdAt: new Date(),
            }),
          },
          transaction: { create: jest.fn() },
        });
      });

      const result = await service.createWithdrawRequest('user-123', withdrawDto);

      expect(result.id).toBe('withdraw-456');
    });
  });

  describe('getWithdrawRequests', () => {
    // 正常路径
    it('应该返回提现记录列表', async () => {
      const mockRequests = [
        {
          id: 'wr-1',
          asset: 'USDT',
          amount: new Decimal('100'),
          fee: new Decimal('0.1'),
          chain: 'BSC',
          address: '0x123',
          status: 'completed',
          txHash: '0xabc',
          createdAt: new Date(),
        },
      ];

      mockPrismaService.withdrawRequest.findMany.mockResolvedValue(mockRequests);

      const result = await service.getWithdrawRequests('user-123');

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('wr-1');
      expect(result[0].amount).toBe('100');
    });
  });

  describe('increaseBalance', () => {
    // 正常路径
    it('应该成功增加用户余额', async () => {
      mockPrismaService.transaction.findUnique.mockResolvedValue(null);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          user: { update: jest.fn() },
          transaction: { create: jest.fn() },
        });
      });

      await service.increaseBalance('user-123', 'USDT', '100', '0xabc123');

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    // 幂等性测试 - 重复充值
    it('重复充值时应跳过处理', async () => {
      mockPrismaService.transaction.findUnique.mockResolvedValue({
        id: 'existing-tx',
        uniqueOrderId: 'deposit_0xabc123',
      });

      await service.increaseBalance('user-123', 'USDT', '100', '0xabc123');

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    // 正常路径 - HOOT 充值
    it('应该支持 HOOT 充值', async () => {
      mockPrismaService.transaction.findUnique.mockResolvedValue(null);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          user: { update: jest.fn() },
          transaction: { create: jest.fn() },
        };
        return callback(mockTx);
      });

      await service.increaseBalance('user-123', 'HOOT', '500', '0xdef456');

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });
});
