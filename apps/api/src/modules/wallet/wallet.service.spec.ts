import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { PrismaService } from '../../prisma/prisma.service';
import { HdWalletService } from '../blockchain/hd-wallet.service';
import { WithdrawService } from '../blockchain/withdraw.service';
import { Decimal } from '@prisma/client/runtime/library';

// uuid@13 使用 ESM，Jest(CommonJS 模式) 无法直接转换 pnpm 路径下的 .pnpm/uuid@13 包。
// 在 spec 层 mock 掉 uuid，使 wallet.service.ts 在测试环境中不依赖真实的 ESM 模块。
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-v4'),
}));

// ─── 辅助函数：创建 Prisma Decimal mock ───────────────────────────────────
function makeDecimal(value: string): Decimal {
  return new Decimal(value) as unknown as Decimal;
}

// ─── Mock: PrismaService ──────────────────────────────────────────────────
// $transaction 接受回调，用 mockTx 作为参数调用（模拟 Prisma 事务）
const mockTx = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  withdrawRequest: {
    create: jest.fn(),
  },
  transaction: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  transaction: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  withdrawRequest: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  depositAddress: {
    findFirst: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
  },
  // $transaction: 立即执行回调，将 mockTx 作为事务客户端传入
  $transaction: jest.fn((callback) => callback(mockTx)),
};

// ─── Mock: HdWalletService ────────────────────────────────────────────────
const mockHdWalletService = {
  getIsInitialized: jest.fn().mockReturnValue(false),
  generateDepositAddress: jest.fn(),
};

// ─── Mock: WithdrawService ────────────────────────────────────────────────
const mockWithdrawService = {
  processNewWithdraw: jest.fn().mockResolvedValue({ action: 'pending_review' }),
};

// ─────────────────────────────────────────────────────────────────────────
describe('WalletService', () => {
  let service: WalletService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: HdWalletService, useValue: mockHdWalletService },
        { provide: WithdrawService, useValue: mockWithdrawService },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);

    // 每个用例开始前重置所有 mock，防止测试间状态污染
    jest.clearAllMocks();

    // $transaction 默认行为：执行回调并传入 mockTx
    mockPrismaService.$transaction.mockImplementation((callback) =>
      callback(mockTx),
    );

    // WithdrawService 默认行为
    mockWithdrawService.processNewWithdraw.mockResolvedValue({
      action: 'pending_review',
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // getBalance
  // ═══════════════════════════════════════════════════════════════════════
  describe('getBalance', () => {
    // 正常路径：用户存在，返回三种余额字符串
    it('should return balance strings when user exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        usdtBalance: makeDecimal('100.00000000'),
        hootBalance: makeDecimal('500.00000000'),
        pointBalance: makeDecimal('50.00000000'),
      });

      const result = await service.getBalance('user-123');

      expect(result).toEqual({
        usdt: '100',
        hoot: '500',
        point: '50',
      });
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: {
          usdtBalance: true,
          hootBalance: true,
          pointBalance: true,
        },
      });
    });

    // 边界路径：用户不存在时，各余额返回 '0'（不抛出异常）
    it('should return "0" for all balances when user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.getBalance('nonexistent-user');

      expect(result).toEqual({
        usdt: '0',
        hoot: '0',
        point: '0',
      });
    });

    // 边界路径：余额为零时返回字符串 '0'
    it('should return "0" string when all balances are zero', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        usdtBalance: makeDecimal('0'),
        hootBalance: makeDecimal('0'),
        pointBalance: makeDecimal('0'),
      });

      const result = await service.getBalance('user-zero');

      expect(result.usdt).toBe('0');
      expect(result.hoot).toBe('0');
      expect(result.point).toBe('0');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // createWithdrawRequest
  // ═══════════════════════════════════════════════════════════════════════
  describe('createWithdrawRequest', () => {
    const baseDto = {
      asset: 'USDT' as const,
      amount: 50,
      chain: 'BSC' as const,
      address: '0xAbCd1234567890AbCd1234567890AbCd12345678',
    };

    const mockWithdrawRecord = {
      id: 'wr-uuid-001',
      asset: 'USDT',
      amount: makeDecimal('50'),
      fee: makeDecimal('0.05'),
      chain: 'BSC',
      address: '0xAbCd1234567890AbCd1234567890AbCd12345678',
      status: 'pending',
      txHash: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };

    // 正常路径：USDT 提现成功，验证手续费（0.1%）计算正确
    it('should create USDT withdraw request and calculate fee at 0.1%', async () => {
      // 事务内：用户有足够余额
      mockTx.user.findUnique.mockResolvedValue({
        usdtBalance: makeDecimal('200.00000000'),
        hootBalance: makeDecimal('0'),
      });
      mockTx.user.update.mockResolvedValue({});
      mockTx.withdrawRequest.create.mockResolvedValue(mockWithdrawRecord);
      mockTx.transaction.create.mockResolvedValue({});

      const result = await service.createWithdrawRequest('user-123', baseDto);

      // 返回值结构正确
      expect(result.id).toBe('wr-uuid-001');
      expect(result.asset).toBe('USDT');
      expect(result.status).toBe('pending');

      // 手续费 = amount × 0.001 = 50 × 0.001 = 0.05
      expect(mockTx.withdrawRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            asset: 'USDT',
            fee: expect.objectContaining({}), // Decimal(0.05)
          }),
        }),
      );

      // 确认事务被调用
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });

    // 异常路径：低于最小提现金额（USDT 最小 10）
    it('should throw BadRequestException when USDT amount is below minimum (10)', async () => {
      const dto = { ...baseDto, amount: 5 }; // 低于 MIN_WITHDRAW_AMOUNT.USDT = 10

      await expect(service.createWithdrawRequest('user-123', dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createWithdrawRequest('user-123', dto)).rejects.toThrow(
        'USDT 最小提现金额为 10',
      );

      // 最小金额检查在事务外，事务不应被调用
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    // 异常路径：HOOT 低于最小提现金额（最小 100）
    it('should throw BadRequestException when HOOT amount is below minimum (100)', async () => {
      const dto = {
        asset: 'HOOT' as const,
        amount: 50, // 低于 MIN_WITHDRAW_AMOUNT.HOOT = 100
        chain: 'BSC' as const,
        address: '0xAbCd1234567890AbCd1234567890AbCd12345678',
      };

      await expect(service.createWithdrawRequest('user-123', dto)).rejects.toThrow(
        'HOOT 最小提现金额为 100',
      );
    });

    // 异常路径：余额不足
    it('should throw BadRequestException when balance is insufficient', async () => {
      // 用户 USDT 余额只有 10，但提现 amount=50 + fee=0.05 = 50.05
      mockTx.user.findUnique.mockResolvedValue({
        usdtBalance: makeDecimal('10.00000000'),
        hootBalance: makeDecimal('0'),
      });

      await expect(
        service.createWithdrawRequest('user-123', baseDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createWithdrawRequest('user-123', baseDto),
      ).rejects.toThrow('余额不足');
    });

    // 验证手续费：50 USDT × 0.001 = 0.05，totalAmount = 50.05
    it('should deduct totalAmount (amount + fee) from user balance', async () => {
      mockTx.user.findUnique.mockResolvedValue({
        usdtBalance: makeDecimal('200.00000000'),
        hootBalance: makeDecimal('0'),
      });
      mockTx.user.update.mockResolvedValue({});
      mockTx.withdrawRequest.create.mockResolvedValue(mockWithdrawRecord);
      mockTx.transaction.create.mockResolvedValue({});

      await service.createWithdrawRequest('user-123', baseDto);

      // 验算: totalAmount = 50 + 50×0.001 = 50.05
      // user.update 应该用 decrement: totalAmount
      expect(mockTx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          data: expect.objectContaining({
            usdtBalance: expect.objectContaining({ decrement: expect.anything() }),
          }),
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // increaseBalance
  // ═══════════════════════════════════════════════════════════════════════
  describe('increaseBalance', () => {
    const txHash = '0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1';

    // 正常路径：首次充值，幂等 ID 不存在，执行余额增加
    it('should increase USDT balance on first deposit', async () => {
      // 幂等性检查：transaction 不存在
      mockPrismaService.transaction.findUnique.mockResolvedValue(null);
      mockTx.user.update.mockResolvedValue({});
      mockTx.transaction.create.mockResolvedValue({});

      await service.increaseBalance('user-123', 'USDT', '100', txHash, 'BSC');

      // 幂等性检查使用 deposit_<txHash> 作为 uniqueOrderId
      expect(mockPrismaService.transaction.findUnique).toHaveBeenCalledWith({
        where: { uniqueOrderId: `deposit_${txHash}` },
      });

      // 事务被执行
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);

      // 余额增加操作被调用
      expect(mockTx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          data: expect.objectContaining({
            usdtBalance: expect.objectContaining({ increment: expect.anything() }),
          }),
        }),
      );
    });

    // 幂等路径：相同 txHash 再次充值，直接返回，不执行事务
    it('should skip processing when txHash already exists (idempotent)', async () => {
      // 幂等性检查：transaction 已存在（重复充值请求）
      mockPrismaService.transaction.findUnique.mockResolvedValue({
        id: 'tx-existing',
        uniqueOrderId: `deposit_${txHash}`,
      });

      await service.increaseBalance('user-123', 'USDT', '100', txHash, 'BSC');

      // 不应执行事务（余额不重复增加）
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      expect(mockTx.user.update).not.toHaveBeenCalled();
    });

    // 正常路径：HOOT 充值使用 hootBalance 字段
    it('should use hootBalance field when asset is HOOT', async () => {
      mockPrismaService.transaction.findUnique.mockResolvedValue(null);
      mockTx.user.update.mockResolvedValue({});
      mockTx.transaction.create.mockResolvedValue({});

      await service.increaseBalance('user-456', 'HOOT', '500', txHash);

      expect(mockTx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-456' },
          data: expect.objectContaining({
            hootBalance: expect.objectContaining({ increment: expect.anything() }),
          }),
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // exchange
  // ═══════════════════════════════════════════════════════════════════════
  describe('exchange', () => {
    // 正常路径：USDT -> POINT，汇率 1:1
    it('should exchange USDT to POINT at 1:1 rate', async () => {
      mockTx.user.findUnique.mockResolvedValue({
        usdtBalance: makeDecimal('100.00000000'),
        hootBalance: makeDecimal('0'),
        pointBalance: makeDecimal('0'),
      });
      mockTx.user.update.mockResolvedValue({});
      mockTx.transaction.create.mockResolvedValue({});

      const result = await service.exchange('user-123', 'USDT', 'POINT', 50);

      expect(result.fromAmount).toBe('50');
      // USDT -> POINT 汇率 1:1，toAmount = 50.00000000
      expect(result.toAmount).toBe('50.00000000');
      expect(result.rate).toBe('1');
    });

    // 正常路径：USDT -> HOOT，汇率 = 1 / 0.15 ≈ 6.6667
    it('should exchange USDT to HOOT using env HOOT_PRICE_USDT (default 0.15)', async () => {
      // 默认 HOOT_PRICE_USDT = 0.15，汇率 = 1/0.15
      delete process.env.HOOT_PRICE_USDT;

      mockTx.user.findUnique.mockResolvedValue({
        usdtBalance: makeDecimal('100.00000000'),
        hootBalance: makeDecimal('0'),
        pointBalance: makeDecimal('0'),
      });
      mockTx.user.update.mockResolvedValue({});
      mockTx.transaction.create.mockResolvedValue({});

      const result = await service.exchange('user-123', 'USDT', 'HOOT', 15);

      expect(result.fromAmount).toBe('15');
      // 15 USDT / 0.15 = 100 HOOT
      expect(result.toAmount).toBe('100.00000000');
    });

    // 异常路径：来源和目标资产相同
    it('should throw BadRequestException when fromAsset equals toAsset', async () => {
      await expect(
        service.exchange('user-123', 'USDT', 'USDT', 50),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.exchange('user-123', 'USDT', 'USDT', 50),
      ).rejects.toThrow('来源和目标资产不能相同');

      // 来源/目标相同检查在事务外，事务不应被调用
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    // 异常路径：USDT 余额不足
    it('should throw BadRequestException when USDT balance is insufficient for exchange', async () => {
      mockTx.user.findUnique.mockResolvedValue({
        usdtBalance: makeDecimal('10.00000000'), // 只有 10 USDT
        hootBalance: makeDecimal('0'),
        pointBalance: makeDecimal('0'),
      });

      // 尝试兑换 50 USDT（大于余额）
      await expect(
        service.exchange('user-123', 'USDT', 'POINT', 50),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.exchange('user-123', 'USDT', 'POINT', 50),
      ).rejects.toThrow('USDT 余额不足');
    });

    // 正常路径：HOOT -> USDT，rate = HOOT_PRICE_USDT = 0.15
    it('should exchange HOOT to USDT at HOOT_PRICE_USDT rate', async () => {
      process.env.HOOT_PRICE_USDT = '0.15';

      mockTx.user.findUnique.mockResolvedValue({
        usdtBalance: makeDecimal('0'),
        hootBalance: makeDecimal('1000.00000000'),
        pointBalance: makeDecimal('0'),
      });
      mockTx.user.update.mockResolvedValue({});
      mockTx.transaction.create.mockResolvedValue({});

      const result = await service.exchange('user-123', 'HOOT', 'USDT', 100);

      // 100 HOOT × 0.15 = 15 USDT
      expect(result.toAmount).toBe('15.00000000');
      expect(result.rate).toBe('0.15');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // getTransactions
  // ═══════════════════════════════════════════════════════════════════════
  describe('getTransactions', () => {
    const mockTransactions = [
      {
        id: 'tx-001',
        type: 'deposit',
        asset: 'USDT',
        amount: makeDecimal('100'),
        status: 'completed',
        txHash: '0xabc',
        remark: null,
        createdAt: new Date('2026-01-01T10:00:00Z'),
      },
      {
        id: 'tx-002',
        type: 'withdraw',
        asset: 'USDT',
        amount: makeDecimal('-50'),
        status: 'pending',
        txHash: null,
        remark: '提现到 BSC 0xAbCd...',
        createdAt: new Date('2026-01-02T10:00:00Z'),
      },
    ];

    // 正常路径：无过滤条件，返回分页数据
    it('should return paginated transaction list with default page settings', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrismaService.transaction.count.mockResolvedValue(2);

      const result = await service.getTransactions('user-123', {
        page: 1,
        pageSize: 20,
      });

      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].id).toBe('tx-001');
      expect(result.items[0].amount).toBe('100');
      expect(result.items[1].remark).toBe('提现到 BSC 0xAbCd...');
    });

    // 正常路径：按 type 和 asset 过滤
    it('should apply type and asset filters to query', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([mockTransactions[0]]);
      mockPrismaService.transaction.count.mockResolvedValue(1);

      const result = await service.getTransactions('user-123', {
        type: 'deposit',
        asset: 'USDT',
        page: 1,
        pageSize: 10,
      });

      // 验证过滤条件传入 findMany
      expect(mockPrismaService.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
            type: 'deposit',
            asset: 'USDT',
          }),
        }),
      );

      expect(result.total).toBe(1);
      expect(result.items[0].type).toBe('deposit');
    });

    // 边界路径：空列表，total = 0
    it('should return empty items list when user has no transactions', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([]);
      mockPrismaService.transaction.count.mockResolvedValue(0);

      const result = await service.getTransactions('new-user', {
        page: 1,
        pageSize: 20,
      });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    // 正常路径：分页偏移计算正确（page=2, pageSize=10 => skip=10）
    it('should calculate correct skip offset for pagination', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([]);
      mockPrismaService.transaction.count.mockResolvedValue(25);

      await service.getTransactions('user-123', { page: 3, pageSize: 10 });

      expect(mockPrismaService.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (page-1) × pageSize = (3-1) × 10 = 20
          take: 10,
        }),
      );
    });
  });
});
