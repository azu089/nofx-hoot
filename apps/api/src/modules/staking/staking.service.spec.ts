import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { StakingService } from './staking.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('StakingService', () => {
  let service: StakingService;

  // --- 固定常量 ---
  const MOCK_USER_ID = 'user-abc-123';
  const MOCK_STAKING_ID = 'staking-xyz-456';
  const NOW = new Date('2026-01-01T12:00:00.000Z');

  // futureLockUntil 必须相对于测试执行时的真实时间，否则 Date.now() 比较会误判为过期
  const futureLockUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const pastLockUntil = new Date(Date.now() - 1000); // 1 秒前已过期

  // 活期质押记录（status='active'，lockUntil=null）
  const mockActiveStaking = {
    id: MOCK_STAKING_ID,
    userId: MOCK_USER_ID,
    amount: new Decimal('100'),
    lockDays: 0,
    lockUntil: null,
    weight: 1.0,
    status: 'active',
    stakedAt: NOW,
    unstakedAt: null,
    totalDividends: new Decimal('0'),
  };

  // 定期质押记录（lockDays=30，status='locked'，lockUntil 在真实未来）
  const mockLockedStaking = {
    id: 'staking-locked-789',
    userId: MOCK_USER_ID,
    amount: new Decimal('100'),
    lockDays: 30,
    lockUntil: futureLockUntil,
    weight: 1.0 + (30 / 365) * 2.0,
    status: 'locked',
    stakedAt: NOW,
    unstakedAt: null,
    totalDividends: new Decimal('0'),
  };

  // --- mock tx 对象（事务内部使用） ---
  const mockTx = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    stakingRecord: {
      create: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
    },
  };

  // --- mockPrismaService ---
  const mockPrismaService = {
    stakingRecord: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    dividendPool: {
      findFirst: jest.fn(),
    },
    // $transaction 调用 callback 并传入 mockTx
    $transaction: jest.fn((callback: (tx: typeof mockTx) => Promise<unknown>) =>
      callback(mockTx),
    ),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StakingService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<StakingService>(StakingService);

    jest.clearAllMocks();

    // clearAllMocks 会清除 mockImplementation，在此恢复 $transaction 默认行为
    mockPrismaService.$transaction.mockImplementation(
      (callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx),
    );
  });

  // ============================================================
  // calculateWeight — 纯函数测试
  // ============================================================
  describe('calculateWeight', () => {
    // 正常路径：活期
    it('lockDays=0 应返回基础权重 1.0（活期）', () => {
      const weight = service.calculateWeight(NOW, 0);
      expect(weight).toBe(1.0);
    });

    // 正常路径：90 天
    it('lockDays=90 应返回约 1.493', () => {
      const weight = service.calculateWeight(NOW, 90);
      // 1.0 + (90/365) * 2.0 ≈ 1.4932
      expect(weight).toBeCloseTo(1.4932, 3);
    });

    // 边界路径：恰好 365 天，权重 = 3.0
    it('lockDays=365 应返回上限权重 3.0', () => {
      const weight = service.calculateWeight(NOW, 365);
      expect(weight).toBe(3.0);
    });

    // 边界路径：超过 365 天，权重仍被 cap 在 3.0
    it('lockDays=730 超出上限后应仍返回 3.0', () => {
      const weight = service.calculateWeight(NOW, 730);
      expect(weight).toBe(3.0);
    });
  });

  // ============================================================
  // stake — 创建质押
  // ============================================================
  describe('stake', () => {
    const dto = { amount: 100, lockDays: 0 };

    // 正常路径：余额充足，活期质押
    it('正常路径：余额充足时应创建活期质押记录，weight=1.0，status=active', async () => {
      mockTx.user.findUnique.mockResolvedValue({ hootBalance: new Decimal('500') });
      mockTx.user.update.mockResolvedValue({});
      mockTx.stakingRecord.create.mockResolvedValue({
        ...mockActiveStaking,
        stakedAt: NOW,
      });

      const result = await service.stake(MOCK_USER_ID, dto);

      expect(mockTx.user.findUnique).toHaveBeenCalledWith({
        where: { id: MOCK_USER_ID },
        select: { hootBalance: true },
      });
      expect(mockTx.stakingRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: MOCK_USER_ID,
            status: 'active',
            lockDays: 0,
            lockUntil: null,
          }),
        }),
      );
      expect(result.weight).toBe('1.00');
      expect(result.status).toBe('active');
    });

    // 异常路径：用户不存在
    it('异常路径：用户不存在时应抛出 NotFoundException', async () => {
      mockTx.user.findUnique.mockResolvedValue(null);

      await expect(service.stake(MOCK_USER_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    // 异常路径：HOOT 余额不足
    it('异常路径：HOOT 余额不足时应抛出 BadRequestException', async () => {
      mockTx.user.findUnique.mockResolvedValue({ hootBalance: new Decimal('50') });

      await expect(
        service.stake(MOCK_USER_ID, { amount: 100, lockDays: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    // 边界路径：lockDays=0 → status='active'，lockUntil=null
    it('边界路径：lockDays=0 时 lockUntil 为 null，status 为 active', async () => {
      mockTx.user.findUnique.mockResolvedValue({ hootBalance: new Decimal('500') });
      mockTx.user.update.mockResolvedValue({});
      mockTx.stakingRecord.create.mockResolvedValue({
        ...mockActiveStaking,
        stakedAt: NOW,
      });

      await service.stake(MOCK_USER_ID, { amount: 100, lockDays: 0 });

      expect(mockTx.stakingRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lockUntil: null,
            status: 'active',
          }),
        }),
      );
    });

    // 边界路径：lockDays=30 → status='locked'，lockUntil 被设置
    it('边界路径：lockDays=30 时 status 为 locked，lockUntil 为 30 天后', async () => {
      mockTx.user.findUnique.mockResolvedValue({ hootBalance: new Decimal('500') });
      mockTx.user.update.mockResolvedValue({});
      mockTx.stakingRecord.create.mockResolvedValue({
        ...mockLockedStaking,
        stakedAt: NOW,
      });

      await service.stake(MOCK_USER_ID, { amount: 100, lockDays: 30 });

      expect(mockTx.stakingRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'locked',
            lockDays: 30,
          }),
        }),
      );
      // lockUntil 应该存在（非 null）
      const callData = mockTx.stakingRecord.create.mock.calls[0][0].data;
      expect(callData.lockUntil).not.toBeNull();
    });
  });

  // ============================================================
  // unstake — 解除质押
  // ============================================================
  describe('unstake', () => {
    // 正常路径：锁定期已过，无惩罚，返还全额
    it('正常路径：锁定期已过时解押无惩罚，返还全额', async () => {
      mockPrismaService.stakingRecord.findUnique.mockResolvedValue({
        ...mockActiveStaking,
        lockUntil: pastLockUntil, // 过去的时间，锁定期已到
        status: 'active',
      });
      mockTx.stakingRecord.update.mockResolvedValue({});
      mockTx.user.update.mockResolvedValue({});

      const result = await service.unstake(MOCK_USER_ID, MOCK_STAKING_ID);

      expect(result.returnedAmount).toBe('100');
      expect(result.message).toBe('解押成功');
      // 无惩罚时不创建 staking_penalty 交易记录
      expect(mockTx.transaction.create).not.toHaveBeenCalled();
    });

    // 正常路径：活期（lockUntil=null），无惩罚，返还全额
    it('正常路径：活期质押（lockUntil=null）解押无惩罚', async () => {
      mockPrismaService.stakingRecord.findUnique.mockResolvedValue({
        ...mockActiveStaking,
        lockUntil: null,
        status: 'active',
      });
      mockTx.stakingRecord.update.mockResolvedValue({});
      mockTx.user.update.mockResolvedValue({});

      const result = await service.unstake(MOCK_USER_ID, MOCK_STAKING_ID);

      expect(result.returnedAmount).toBe('100');
      expect(result.message).toBe('解押成功');
    });

    // 正常路径：提前解押，应扣 10% 惩罚
    it('正常路径：提前解押时应扣除 10% 惩罚并创建 staking_penalty 记录', async () => {
      mockPrismaService.stakingRecord.findUnique.mockResolvedValue({
        ...mockActiveStaking,
        lockUntil: futureLockUntil, // 真实未来，仍在锁定期内
        status: 'active',
      });
      mockTx.stakingRecord.update.mockResolvedValue({});
      mockTx.user.update.mockResolvedValue({});
      mockTx.transaction.create.mockResolvedValue({});

      const result = await service.unstake(MOCK_USER_ID, MOCK_STAKING_ID);

      // 100 - 10% 惩罚 = 90
      expect(result.returnedAmount).toBe('90');
      // 提前解押惩罚信息含 10 HOOT
      expect(result.message).toContain('10');
      expect(mockTx.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'staking_penalty',
            asset: 'HOOT',
            userId: MOCK_USER_ID,
          }),
        }),
      );
    });

    // 异常路径：质押记录不存在
    it('异常路径：质押记录不存在时应抛出 NotFoundException', async () => {
      mockPrismaService.stakingRecord.findUnique.mockResolvedValue(null);

      await expect(
        service.unstake(MOCK_USER_ID, 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    // 异常路径：userId 不匹配（越权操作）
    it('异常路径：userId 不匹配时应抛出 BadRequestException', async () => {
      mockPrismaService.stakingRecord.findUnique.mockResolvedValue({
        ...mockActiveStaking,
        userId: 'other-user-id', // 属于其他用户
      });

      await expect(
        service.unstake(MOCK_USER_ID, MOCK_STAKING_ID),
      ).rejects.toThrow(BadRequestException);
    });

    // 异常路径：status 不为 'active'（已解押）
    it('异常路径：status 非 active 时应抛出 BadRequestException', async () => {
      mockPrismaService.stakingRecord.findUnique.mockResolvedValue({
        ...mockActiveStaking,
        status: 'unstaked',
      });

      await expect(
        service.unstake(MOCK_USER_ID, MOCK_STAKING_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================================
  // getMyStakings — 获取质押列表
  // ============================================================
  describe('getMyStakings', () => {
    // 正常路径：返回映射后的列表，weight 和 weightedAmount 已计算
    it('正常路径：应返回含 weight 和 weightedAmount 的质押列表', async () => {
      mockPrismaService.stakingRecord.findMany.mockResolvedValue([
        mockActiveStaking,
        mockLockedStaking,
      ]);

      const result = await service.getMyStakings(MOCK_USER_ID);

      expect(result).toHaveLength(2);

      // 验证活期记录：lockDays=0 → weight.toFixed(2)="1.00"
      const active = result.find((r) => r.lockDays === 0);
      expect(active).toBeDefined();
      expect(active!.weight).toBe('1.00');
      expect(active!.weightedAmount).toBe('100.00000000');
      expect(active!.status).toBe('active');

      // 验证定期记录：lockDays=30
      // calculateWeight(30) = 1.0 + (30/365)*2.0 ≈ 1.1644...，toFixed(2) = "1.16"
      const locked = result.find((r) => r.lockDays === 30);
      expect(locked).toBeDefined();
      expect(locked!.weight).toBe('1.16');
    });

    // 边界路径：无质押记录时返回空数组
    it('边界路径：无质押记录时应返回空数组', async () => {
      mockPrismaService.stakingRecord.findMany.mockResolvedValue([]);

      const result = await service.getMyStakings(MOCK_USER_ID);

      expect(result).toEqual([]);
    });

    // 验证查询条件：只查 active/locked 状态
    it('应仅查询 status 为 active 或 locked 的记录', async () => {
      mockPrismaService.stakingRecord.findMany.mockResolvedValue([]);

      await service.getMyStakings(MOCK_USER_ID);

      expect(mockPrismaService.stakingRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: MOCK_USER_ID,
            status: { in: ['active', 'locked'] },
          },
        }),
      );
    });
  });

  // ============================================================
  // getMyStats — 获取质押统计
  // ============================================================
  describe('getMyStats', () => {
    // 正常路径：有质押记录和分红池
    it('正常路径：应正确计算 totalStaked、totalWeighted 和 estimatedWeeklyDividend', async () => {
      // 两条质押：100 活期(weight=1.0) + 100 锁365天(weight=3.0)
      const staking365 = {
        ...mockActiveStaking,
        id: 'staking-365',
        lockDays: 365,
        weight: 3.0,
      };
      mockPrismaService.stakingRecord.findMany.mockResolvedValue([
        mockActiveStaking, // 100 * 1.0 = 100 weighted
        staking365,        // 100 * 3.0 = 300 weighted
      ]);

      // 分红池：总权重 400，总金额 80 USDT
      mockPrismaService.dividendPool.findFirst.mockResolvedValue({
        id: 'pool-1',
        status: 'pending',
        totalWeighted: new Decimal('400'),
        totalAmount: new Decimal('80'),
        periodEnd: new Date(),
      });

      const result = await service.getMyStats(MOCK_USER_ID);

      // totalStaked = 100 + 100 = 200
      expect(result.totalStaked).toBe('200');
      // totalWeighted = 100 + 300 = 400
      expect(result.totalWeighted).toBe('400.00000000');
      // estimatedWeeklyDividend = 80 * (400/400) = 80
      expect(result.estimatedWeeklyDividend).toBe('80.00000000');
      // nextDividendDate 应为 Date 对象
      expect(result.nextDividendDate).toBeInstanceOf(Date);
    });

    // 边界路径：无质押记录时应返回全零统计
    it('边界路径：无质押记录时 totalStaked 和 totalWeighted 均为 0', async () => {
      mockPrismaService.stakingRecord.findMany.mockResolvedValue([]);
      mockPrismaService.dividendPool.findFirst.mockResolvedValue(null);

      const result = await service.getMyStats(MOCK_USER_ID);

      expect(result.totalStaked).toBe('0');
      expect(result.totalWeighted).toBe('0.00000000');
      expect(result.estimatedWeeklyDividend).toBe('0.00000000');
    });

    // 边界路径：无分红池时 estimatedWeeklyDividend 为 0
    it('边界路径：无分红池时 estimatedWeeklyDividend 应为 0', async () => {
      mockPrismaService.stakingRecord.findMany.mockResolvedValue([
        mockActiveStaking,
      ]);
      mockPrismaService.dividendPool.findFirst.mockResolvedValue(null);

      const result = await service.getMyStats(MOCK_USER_ID);

      expect(result.estimatedWeeklyDividend).toBe('0.00000000');
    });
  });
});
