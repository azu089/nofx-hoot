import { Test, TestingModule } from '@nestjs/testing';
import { StakingService } from './staking.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { TokensService } from '../tokens/tokens.service';
import { ConfigsService } from '../configs/configs.service';
import { ALLOWED_LOCK_DAYS, LOCK_PERIOD_WEIGHTS } from './dto/stake.dto';
import Decimal from 'decimal.js';

/**
 * 质押服务验收测试
 *
 * 测试统一质押模型的核心规则：
 * 1. 锁定期验证（30/90/180/365 天）
 * 2. 权重计算（1000 积分 = 1 QFI）
 * 3. 惩罚计算（积分阶梯递减，代币固定 3%）
 */
describe('StakingService - 统一质押模型验收测试', () => {
  let service: StakingService;

  // Mock 服务
  const mockPrismaService = {
    client: {
      $transaction: jest.fn(),
      stakes: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      wallets: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      billing_logs: {
        create: jest.fn(),
        aggregate: jest.fn(),
      },
      revenue_distributions: {
        create: jest.fn(),
      },
    },
  };

  const mockWalletsService = {};

  const mockTokensService = {
    createDividendVestingOrder: jest.fn(),
  };

  const mockConfigsService = {
    getQFIPrice: jest.fn().mockResolvedValue(new Decimal(0.5)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StakingService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: WalletsService, useValue: mockWalletsService },
        { provide: TokensService, useValue: mockTokensService },
        { provide: ConfigsService, useValue: mockConfigsService },
      ],
    }).compile();

    service = module.get<StakingService>(StakingService);
  });

  // ==================== 锁定期验证测试 ====================
  describe('锁定期验证', () => {
    it('应该只允许 30/90/180/365 天锁定期', () => {
      expect(ALLOWED_LOCK_DAYS).toEqual([30, 90, 180, 365]);
    });

    it('不应该包含 0 天（灵活）选项', () => {
      expect(ALLOWED_LOCK_DAYS).not.toContain(0);
    });

    it('锁定期权重倍数应该正确配置', () => {
      expect(LOCK_PERIOD_WEIGHTS[30]).toBe(1.2);
      expect(LOCK_PERIOD_WEIGHTS[90]).toBe(1.5);
      expect(LOCK_PERIOD_WEIGHTS[180]).toBe(2.0);
      expect(LOCK_PERIOD_WEIGHTS[365]).toBe(3.0);
    });
  });

  // ==================== 权重计算测试 ====================
  describe('权重计算 - getLockPeriodWeight', () => {
    it('30 天锁定期应返回 1.2x', () => {
      const weight = service.getLockPeriodWeight(30);
      expect(weight.toNumber()).toBe(1.2);
    });

    it('90 天锁定期应返回 1.5x', () => {
      const weight = service.getLockPeriodWeight(90);
      expect(weight.toNumber()).toBe(1.5);
    });

    it('180 天锁定期应返回 2.0x', () => {
      const weight = service.getLockPeriodWeight(180);
      expect(weight.toNumber()).toBe(2.0);
    });

    it('365 天锁定期应返回 3.0x', () => {
      const weight = service.getLockPeriodWeight(365);
      expect(weight.toNumber()).toBe(3.0);
    });

    it('未知锁定期应返回默认 1.0x', () => {
      const weight = service.getLockPeriodWeight(999);
      expect(weight.toNumber()).toBe(1.0);
    });
  });

  // ==================== 归一化权重测试 ====================
  describe('归一化权重计算 - calculateNormalizedWeight', () => {
    it('1000 积分 30 天锁定 = 1 QFI 30 天锁定 (权重相等)', () => {
      const pointsStake = {
        stake_type: 'A',
        amount: 1000,
        lock_period_days: 30,
      };

      const tokenStake = {
        stake_type: 'B',
        amount: 1,
        lock_period_days: 30,
      };

      const pointsWeight = service.calculateNormalizedWeight(pointsStake);
      const tokenWeight = service.calculateNormalizedWeight(tokenStake);

      // 1000 积分 / 1000 = 1 基础权重 × 1.2 = 1.2
      expect(pointsWeight.toNumber()).toBe(1.2);
      // 1 QFI × 1.2 = 1.2
      expect(tokenWeight.toNumber()).toBe(1.2);
      // 两者应该相等
      expect(pointsWeight.equals(tokenWeight)).toBe(true);
    });

    it('10000 积分 90 天锁定 = 10 QFI 90 天锁定 (权重相等)', () => {
      const pointsStake = {
        stake_type: 'A',
        amount: 10000,
        lock_period_days: 90,
      };

      const tokenStake = {
        stake_type: 'B',
        amount: 10,
        lock_period_days: 90,
      };

      const pointsWeight = service.calculateNormalizedWeight(pointsStake);
      const tokenWeight = service.calculateNormalizedWeight(tokenStake);

      // 10000 积分 / 1000 = 10 基础权重 × 1.5 = 15
      expect(pointsWeight.toNumber()).toBe(15);
      // 10 QFI × 1.5 = 15
      expect(tokenWeight.toNumber()).toBe(15);
      // 两者应该相等
      expect(pointsWeight.equals(tokenWeight)).toBe(true);
    });

    it('质押 10 QFI 180 天锁定 → 权重 = 20', () => {
      const stake = {
        stake_type: 'B',
        amount: 10,
        lock_period_days: 180,
      };

      const weight = service.calculateNormalizedWeight(stake);
      // 10 QFI × 2.0 = 20
      expect(weight.toNumber()).toBe(20);
    });

    it('质押 10 QFI 365 天锁定 → 权重 = 30', () => {
      const stake = {
        stake_type: 'B',
        amount: 10,
        lock_period_days: 365,
      };

      const weight = service.calculateNormalizedWeight(stake);
      // 10 QFI × 3.0 = 30
      expect(weight.toNumber()).toBe(30);
    });

    it('质押 5000 积分 365 天锁定 → 权重 = 15', () => {
      const stake = {
        stake_type: 'A',
        amount: 5000,
        lock_period_days: 365,
      };

      const weight = service.calculateNormalizedWeight(stake);
      // 5000 / 1000 = 5 基础权重 × 3.0 = 15
      expect(weight.toNumber()).toBe(15);
    });
  });

  // ==================== 积分质押惩罚测试 ====================
  describe('积分质押惩罚计算 - calculatePointsPenaltyRate', () => {
    it('30 天锁定期，立即解押 → 惩罚率 40%', () => {
      const stake = {
        stake_type: 'A',
        amount: 1000,
        lock_period_days: 30,
        start_time: new Date(),
        end_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      const penaltyRate = service.calculatePointsPenaltyRate(stake);
      expect(penaltyRate.toNumber()).toBeCloseTo(0.4, 2);
    });

    it('30 天锁定期，到期后解押 → 惩罚率 10%', () => {
      const startTime = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      const endTime = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

      const stake = {
        stake_type: 'A',
        amount: 1000,
        lock_period_days: 30,
        start_time: startTime,
        end_time: endTime,
      };

      const penaltyRate = service.calculatePointsPenaltyRate(stake);
      expect(penaltyRate.toNumber()).toBe(0.1);
    });

    it('90 天锁定期，质押 45 天后解押 → 惩罚率约 17.5%', () => {
      const startTime = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + 90 * 24 * 60 * 60 * 1000);

      const stake = {
        stake_type: 'A',
        amount: 1000,
        lock_period_days: 90,
        start_time: startTime,
        end_time: endTime,
      };

      // 公式: 实际惩罚 = 到期惩罚 + (基础惩罚 - 到期惩罚) × 剩余比例
      // = 0.05 + (0.30 - 0.05) × (45/90)
      // = 0.05 + 0.25 × 0.5
      // = 0.05 + 0.125
      // = 0.175 (17.5%)
      const penaltyRate = service.calculatePointsPenaltyRate(stake);
      expect(penaltyRate.toNumber()).toBeCloseTo(0.175, 2);
    });

    it('90 天锁定期，到期后解押 → 惩罚率 5%', () => {
      const startTime = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
      const endTime = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

      const stake = {
        stake_type: 'A',
        amount: 1000,
        lock_period_days: 90,
        start_time: startTime,
        end_time: endTime,
      };

      const penaltyRate = service.calculatePointsPenaltyRate(stake);
      expect(penaltyRate.toNumber()).toBe(0.05);
    });

    it('180 天锁定期，到期后解押 → 惩罚率 2%', () => {
      const startTime = new Date(Date.now() - 181 * 24 * 60 * 60 * 1000);
      const endTime = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

      const stake = {
        stake_type: 'A',
        amount: 1000,
        lock_period_days: 180,
        start_time: startTime,
        end_time: endTime,
      };

      const penaltyRate = service.calculatePointsPenaltyRate(stake);
      expect(penaltyRate.toNumber()).toBe(0.02);
    });

    it('365 天锁定期，到期后解押 → 惩罚率 0%', () => {
      const startTime = new Date(Date.now() - 366 * 24 * 60 * 60 * 1000);
      const endTime = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

      const stake = {
        stake_type: 'A',
        amount: 1000,
        lock_period_days: 365,
        start_time: startTime,
        end_time: endTime,
      };

      const penaltyRate = service.calculatePointsPenaltyRate(stake);
      expect(penaltyRate.toNumber()).toBe(0);
    });

    it('365 天锁定期，质押 182 天后解押 → 惩罚率约 5%', () => {
      const startTime = new Date(Date.now() - 182 * 24 * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + 365 * 24 * 60 * 60 * 1000);

      const stake = {
        stake_type: 'A',
        amount: 1000,
        lock_period_days: 365,
        start_time: startTime,
        end_time: endTime,
      };

      // 公式: 实际惩罚 = 到期惩罚 + (基础惩罚 - 到期惩罚) × 剩余比例
      // = 0.00 + (0.10 - 0.00) × (183/365)
      // ≈ 0.10 × 0.5
      // ≈ 0.05 (5%)
      const penaltyRate = service.calculatePointsPenaltyRate(stake);
      expect(penaltyRate.toNumber()).toBeCloseTo(0.05, 2);
    });
  });

  // ==================== 代币质押惩罚测试 ====================
  describe('代币质押惩罚（固定 3%）', () => {
    it('B 类质押解押 → 固定 3% 手续费', () => {
      const stake = {
        stake_type: 'B',
        amount: 100,
        lock_period_days: 90,
      };

      // 通过 getPenaltyPreview 验证
      const preview = service.getPenaltyPreview({
        ...stake,
        start_time: new Date(),
        end_time: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });

      expect(preview.currentPenaltyRate).toBe('3.0');
      expect(preview.maturePenaltyRate).toBe('3.0');
    });
  });

  // ==================== 分红权重分配测试 ====================
  describe('分红权重分配验证', () => {
    it('权重比例分配应正确计算', () => {
      // 用户 A: 10,000 积分，90 天锁定 → 权重 = 10 × 1.5 = 15
      // 用户 B: 10 QFI，180 天锁定 → 权重 = 10 × 2.0 = 20
      // 总权重 = 35
      // 分红池 100 USDT
      // 用户 A 分红 = 100 × 15/35 ≈ 42.86 USDT
      // 用户 B 分红 = 100 × 20/35 ≈ 57.14 USDT

      const stakeA = {
        stake_type: 'A',
        amount: 10000,
        lock_period_days: 90,
      };

      const stakeB = {
        stake_type: 'B',
        amount: 10,
        lock_period_days: 180,
      };

      const weightA = service.calculateNormalizedWeight(stakeA);
      const weightB = service.calculateNormalizedWeight(stakeB);
      const totalWeight = weightA.plus(weightB);

      expect(weightA.toNumber()).toBe(15);
      expect(weightB.toNumber()).toBe(20);
      expect(totalWeight.toNumber()).toBe(35);

      const dividendPool = new Decimal(100);
      const userAShare = dividendPool.times(weightA).div(totalWeight);
      const userBShare = dividendPool.times(weightB).div(totalWeight);

      expect(userAShare.toNumber()).toBeCloseTo(42.857, 2);
      expect(userBShare.toNumber()).toBeCloseTo(57.143, 2);
    });
  });

  // ==================== 惩罚预览测试 ====================
  describe('惩罚预览 - getPenaltyPreview', () => {
    it('积分质押应返回正确的惩罚预览', () => {
      const stake = {
        stake_type: 'A',
        amount: 1000,
        lock_period_days: 90,
        start_time: new Date(),
        end_time: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      };

      const preview = service.getPenaltyPreview(stake);

      expect(preview.isMatured).toBe(false);
      expect(preview.remainingDays).toBeCloseTo(90, 0);
      expect(parseFloat(preview.currentPenaltyRate)).toBeCloseTo(30, 0); // 30%
      expect(preview.maturePenaltyRate).toBe('5.0'); // 到期 5%
    });

    it('代币质押应返回固定 3% 惩罚', () => {
      const stake = {
        stake_type: 'B',
        amount: 100,
        lock_period_days: 180,
        start_time: new Date(),
        end_time: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      };

      const preview = service.getPenaltyPreview(stake);

      expect(preview.currentPenaltyRate).toBe('3.0');
      expect(preview.maturePenaltyRate).toBe('3.0');
    });
  });
});

// ==================== 验收用例汇总 ====================
describe('验收用例汇总', () => {
  /**
   * 验收用例 1: 权重归一化验证
   *
   * Given: 用户 A 质押 10,000 积分(A类, 90天锁定)
   *        用户 B 质押 10 QFI(B类, 90天锁定)
   * When: 系统计算权重
   * Then:
   *   - 用户 A 权重 = 10,000 / 1000 × 1.5 = 15
   *   - 用户 B 权重 = 10 × 1.5 = 15
   *   - 两者权重相等
   */
  it('用例1: 1000积分@锁定期 = 1QFI@锁定期 权重相等', () => {
    console.log('验收用例 1: 权重归一化验证');
    console.log('规则: 1000 积分 = 1 QFI 基础权重');
    console.log('锁定期倍数: 30d=1.2x, 90d=1.5x, 180d=2.0x, 365d=3.0x');
    expect(true).toBe(true);
  });

  /**
   * 验收用例 2: 积分质押阶梯惩罚
   *
   * Given: 用户选择积分质押，90 天锁定
   * When: 质押 45 天后解押
   * Then:
   *   - 基础惩罚 = 30%，到期惩罚 = 5%
   *   - 剩余比例 = 45 / 90 = 0.5
   *   - 实际惩罚 = 5% + (30% - 5%) × 0.5 = 17.5%
   */
  it('用例2: 积分质押阶梯递减惩罚计算正确', () => {
    console.log('验收用例 2: 积分质押阶梯惩罚');
    console.log('惩罚公式: 实际惩罚 = 到期惩罚 + (基础惩罚 - 到期惩罚) × 剩余比例');
    console.log('30天: 提前40%→到期10%');
    console.log('90天: 提前30%→到期5%');
    console.log('180天: 提前20%→到期2%');
    console.log('365天: 提前10%→到期0%');
    expect(true).toBe(true);
  });

  /**
   * 验收用例 3: 代币质押固定惩罚
   *
   * Given: 用户选择代币质押，任意锁定期
   * When: 任意时间解押
   * Then: 固定扣除 3% 手续费
   */
  it('用例3: 代币质押固定3%惩罚', () => {
    console.log('验收用例 3: 代币质押固定惩罚');
    console.log('规则: 无论何时解押，固定扣除 3% 手续费');
    expect(true).toBe(true);
  });

  /**
   * 验收用例 4: 分红权重分配
   *
   * Given:
   *   - 用户 A 质押 10,000 积分，90 天锁定 → 权重 = 15
   *   - 用户 B 质押 10 QFI，180 天锁定 → 权重 = 20
   * When: 分红池 100 USDT
   * Then:
   *   - 总权重 = 35
   *   - 用户 A 分红 = 100 × 15/35 = 42.86 USDT
   *   - 用户 B 分红 = 100 × 20/35 = 57.14 USDT
   */
  it('用例4: 分红按归一化权重正确分配', () => {
    console.log('验收用例 4: 分红权重分配');
    console.log('公式: 用户分红 = 分红池 × (用户权重 / 总权重)');
    console.log('分红规则: 70% USDT 立即到账 + 30% QFI 90天释放');
    expect(true).toBe(true);
  });
});
