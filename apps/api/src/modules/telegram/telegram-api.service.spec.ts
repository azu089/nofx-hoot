import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { TelegramApiService } from './telegram-api.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('TelegramApiService', () => {
  let service: TelegramApiService;
  let prismaService: jest.Mocked<PrismaService>;

  const TEST_USER_ID = 'test-user-uuid';
  const TEST_STRATEGY_ID = 'test-strategy-uuid';

  beforeEach(async () => {
    // 创建 mock PrismaClient
    const mockPrismaClient = {
      users: {
        findUnique: jest.fn(),
      },
      wallets: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      trade_history: {
        findMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      user_strategy_configs: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      strategies: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      instances: {
        findFirst: jest.fn(),
      },
      announcements: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      billing_logs: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      agent_commissions: {
        aggregate: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    prismaService = {
      client: mockPrismaClient,
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramApiService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'TELEGRAM_BOT_USERNAME') return 'QuantFiBot';
              if (key === 'WEB_APP_URL') return 'https://quantfi.app';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<TelegramApiService>(TelegramApiService);
  });

  // ==================== getDashboard 测试 ====================

  describe('getDashboard', () => {
    // 正常路径
    it('should return dashboard data for valid user', async () => {
      const mockUser = {
        id: TEST_USER_ID,
        email: 'test@example.com',
        telegram_username: 'testuser',
        telegram_first_name: 'Test',
        vip_level: 1,
        wallets: {
          usdt_balance: 1000,
          points_balance: 500,
          token_balance: 100,
        },
      };

      (prismaService.client.users.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.client.trade_history.findMany as jest.Mock).mockResolvedValue([
        { pnl: '50' },
        { pnl: '-20' },
      ]);
      (prismaService.client.user_strategy_configs.count as jest.Mock).mockResolvedValue(2);
      (prismaService.client.instances.findFirst as jest.Mock).mockResolvedValue({
        status: 'running',
      });
      (prismaService.client.announcements.findFirst as jest.Mock).mockResolvedValue({
        id: 'ann-1',
        title: '系统公告',
        type: 'info',
      });

      const result = await service.getDashboard(TEST_USER_ID);

      expect(result.user.id).toBe(TEST_USER_ID);
      expect(result.user.vipLevel).toBe(1);
      expect(result.wallet.usdtBalance).toBe('1000');
      expect(result.todayPnl.amount).toBe('30.00000000');
      expect(result.activeStrategies).toBe(2);
      expect(result.instanceStatus).toBe('running');
    });

    // 异常路径
    it('should throw NotFoundException when user not found', async () => {
      (prismaService.client.users.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getDashboard('non-existent')).rejects.toThrow(NotFoundException);
    });

    // 边界路径
    it('should handle user with no trades today', async () => {
      const mockUser = {
        id: TEST_USER_ID,
        email: 'tg_123@telegram.local',
        vip_level: 0,
        wallets: { usdt_balance: 0, points_balance: 0, token_balance: 0 },
      };

      (prismaService.client.users.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.client.trade_history.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.client.user_strategy_configs.count as jest.Mock).mockResolvedValue(0);
      (prismaService.client.instances.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.client.announcements.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getDashboard(TEST_USER_ID);

      expect(result.todayPnl.amount).toBe('0.00000000');
      expect(result.todayPnl.trades).toBe(0);
      expect(result.instanceStatus).toBe('none');
      expect(result.latestAnnouncement).toBeUndefined();
      // Telegram 用户邮箱应该隐藏
      expect(result.user.email).toBeUndefined();
    });
  });

  // ==================== getStrategies 测试 ====================

  describe('getStrategies', () => {
    // 正常路径
    it('should return strategies list with subscription status', async () => {
      const mockStrategies = [
        {
          id: 'strategy-1',
          name: 'Alpha Strategy',
          description: '高频交易策略',
          backtest_win_rate: 75.5,
          backtest_sharpe_ratio: 2.1,
          backtest_max_drawdown: 15,
          tier: 'gold',
          total_users: 100,
        },
        {
          id: 'strategy-2',
          name: 'Beta Strategy',
          description: null,
          backtest_win_rate: 60,
          backtest_sharpe_ratio: 1.5,
          backtest_max_drawdown: 20,
          tier: 'silver',
          total_users: 50,
        },
      ];

      (prismaService.client.strategies.findMany as jest.Mock).mockResolvedValue(mockStrategies);
      (prismaService.client.user_strategy_configs.findMany as jest.Mock).mockResolvedValue([
        { strategy_id: 'strategy-1' },
      ]);

      const result = await service.getStrategies(TEST_USER_ID);

      expect(result.strategies.length).toBe(2);
      expect(result.strategies[0].isSubscribed).toBe(true);
      expect(result.strategies[1].isSubscribed).toBe(false);
    });

    // 边界路径
    it('should handle empty strategies list', async () => {
      (prismaService.client.strategies.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.client.user_strategy_configs.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getStrategies(TEST_USER_ID);

      expect(result.strategies.length).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  // ==================== getWallet 测试 ====================

  describe('getWallet', () => {
    // 正常路径
    it('should return wallet data', async () => {
      const mockWallet = {
        usdt_balance: 1000.5,
        usdt_frozen: 50,
        card_balance: 200,
        points_balance: 500,
        token_balance: 100,
        token_locked: 50,
      };

      (prismaService.client.wallets.findUnique as jest.Mock).mockResolvedValue(mockWallet);

      const result = await service.getWallet(TEST_USER_ID);

      expect(result.usdtBalance).toBe('1000.5');
      expect(result.usdtFrozen).toBe('50');
      expect(result.depositAddresses.length).toBeGreaterThan(0);
    });

    // 异常路径
    it('should throw NotFoundException when wallet not found', async () => {
      (prismaService.client.wallets.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getWallet(TEST_USER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ==================== checkin 测试 ====================

  describe('checkin', () => {
    // 正常路径
    it('should allow first checkin of the day', async () => {
      (prismaService.client.billing_logs.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.client.billing_logs.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.client.$transaction as jest.Mock).mockImplementation(async (cb) => {
        return cb({
          billing_logs: { create: jest.fn() },
          wallets: { update: jest.fn() },
        });
      });

      const result = await service.checkin(TEST_USER_ID);

      expect(result.success).toBe(true);
      expect(result.alreadyCheckedIn).toBe(false);
      expect(parseFloat(result.pointsEarned)).toBeGreaterThanOrEqual(10);
    });

    // 异常路径 - 已签到
    it('should return already checked in status', async () => {
      (prismaService.client.billing_logs.findFirst as jest.Mock).mockResolvedValue({
        id: 'checkin-log',
        billing_type: 'checkin',
      });

      const result = await service.checkin(TEST_USER_ID);

      expect(result.success).toBe(false);
      expect(result.alreadyCheckedIn).toBe(true);
      expect(result.pointsEarned).toBe('0');
    });

    // 边界路径 - 连续签到奖励
    it('should calculate streak bonus correctly', async () => {
      // 模拟昨天已签到
      (prismaService.client.billing_logs.findFirst as jest.Mock)
        .mockResolvedValueOnce(null) // 今天未签到
        .mockResolvedValueOnce({ id: 'yesterday-checkin' }); // 昨天已签到

      // 模拟连续 5 天签到记录
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      (prismaService.client.billing_logs.findMany as jest.Mock).mockResolvedValue([
        { created_at: yesterday },
        { created_at: twoDaysAgo },
      ]);

      (prismaService.client.$transaction as jest.Mock).mockImplementation(async (cb) => {
        return cb({
          billing_logs: { create: jest.fn() },
          wallets: { update: jest.fn() },
        });
      });

      const result = await service.checkin(TEST_USER_ID);

      expect(result.success).toBe(true);
      expect(result.streakDays).toBeGreaterThanOrEqual(1);
    });
  });

  // ==================== subscribeStrategy 测试 ====================

  describe('subscribeStrategy', () => {
    // 正常路径
    it('should subscribe to strategy successfully', async () => {
      const mockStrategy = {
        id: TEST_STRATEGY_ID,
        name: 'Test Strategy',
        is_public: true,
        is_active: true,
        total_users: 10,
      };

      (prismaService.client.strategies.findUnique as jest.Mock).mockResolvedValue(mockStrategy);
      (prismaService.client.user_strategy_configs.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.client.wallets.findUnique as jest.Mock).mockResolvedValue({
        usdt_balance: 1000,
      });
      (prismaService.client.user_strategy_configs.create as jest.Mock).mockResolvedValue({
        id: 'config-uuid',
      });
      (prismaService.client.strategies.update as jest.Mock).mockResolvedValue({});

      const result = await service.subscribeStrategy(TEST_USER_ID, TEST_STRATEGY_ID, '100');

      expect(result.success).toBe(true);
      expect(result.configId).toBe('config-uuid');
    });

    // 异常路径 - 策略不存在
    it('should throw NotFoundException when strategy not found', async () => {
      (prismaService.client.strategies.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.subscribeStrategy(TEST_USER_ID, 'non-existent', '100'),
      ).rejects.toThrow(NotFoundException);
    });

    // 异常路径 - 策略不可订阅
    it('should throw BadRequestException when strategy not public', async () => {
      (prismaService.client.strategies.findUnique as jest.Mock).mockResolvedValue({
        id: TEST_STRATEGY_ID,
        is_public: false,
        is_active: true,
      });

      await expect(
        service.subscribeStrategy(TEST_USER_ID, TEST_STRATEGY_ID, '100'),
      ).rejects.toThrow('该策略不可订阅');
    });

    // 异常路径 - 已订阅
    it('should throw ConflictException when already subscribed', async () => {
      (prismaService.client.strategies.findUnique as jest.Mock).mockResolvedValue({
        id: TEST_STRATEGY_ID,
        is_public: true,
        is_active: true,
      });
      (prismaService.client.user_strategy_configs.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-config',
      });

      await expect(
        service.subscribeStrategy(TEST_USER_ID, TEST_STRATEGY_ID, '100'),
      ).rejects.toThrow('您已订阅该策略');
    });

    // 边界路径 - 余额不足
    it('should throw BadRequestException when balance insufficient', async () => {
      (prismaService.client.strategies.findUnique as jest.Mock).mockResolvedValue({
        id: TEST_STRATEGY_ID,
        is_public: true,
        is_active: true,
      });
      (prismaService.client.user_strategy_configs.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.client.wallets.findUnique as jest.Mock).mockResolvedValue({
        usdt_balance: 50, // 余额不足
      });

      await expect(
        service.subscribeStrategy(TEST_USER_ID, TEST_STRATEGY_ID, '100'),
      ).rejects.toThrow('余额不足');
    });
  });

  // ==================== unsubscribeStrategy 测试 ====================

  describe('unsubscribeStrategy', () => {
    // 正常路径
    it('should unsubscribe from stopped strategy', async () => {
      (prismaService.client.user_strategy_configs.findFirst as jest.Mock).mockResolvedValue({
        id: 'config-uuid',
        is_active: false,
      });
      (prismaService.client.user_strategy_configs.delete as jest.Mock).mockResolvedValue({});
      (prismaService.client.strategies.update as jest.Mock).mockResolvedValue({});

      const result = await service.unsubscribeStrategy(TEST_USER_ID, TEST_STRATEGY_ID);

      expect(result.success).toBe(true);
    });

    // 异常路径 - 配置不存在
    it('should throw NotFoundException when config not found', async () => {
      (prismaService.client.user_strategy_configs.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.unsubscribeStrategy(TEST_USER_ID, TEST_STRATEGY_ID),
      ).rejects.toThrow(NotFoundException);
    });

    // 异常路径 - 策略运行中
    it('should throw BadRequestException when strategy is running', async () => {
      (prismaService.client.user_strategy_configs.findFirst as jest.Mock).mockResolvedValue({
        id: 'config-uuid',
        is_active: true,
      });

      await expect(
        service.unsubscribeStrategy(TEST_USER_ID, TEST_STRATEGY_ID),
      ).rejects.toThrow('请先停止策略运行');
    });
  });

  // ==================== startTrade / stopTrade 测试 ====================

  describe('startTrade', () => {
    // 正常路径
    it('should start strategy successfully', async () => {
      (prismaService.client.user_strategy_configs.findFirst as jest.Mock).mockResolvedValue({
        id: 'config-uuid',
        is_active: false,
      });
      (prismaService.client.user_strategy_configs.update as jest.Mock).mockResolvedValue({});

      const result = await service.startTrade(TEST_USER_ID, 'config-uuid');

      expect(result.success).toBe(true);
      expect(result.message).toBe('策略已启动');
    });

    // 异常路径 - 配置不存在
    it('should throw NotFoundException when config not found', async () => {
      (prismaService.client.user_strategy_configs.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.startTrade(TEST_USER_ID, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    // 边界路径 - 已在运行
    it('should return failure when already running', async () => {
      (prismaService.client.user_strategy_configs.findFirst as jest.Mock).mockResolvedValue({
        id: 'config-uuid',
        is_active: true,
      });

      const result = await service.startTrade(TEST_USER_ID, 'config-uuid');

      expect(result.success).toBe(false);
      expect(result.message).toBe('策略已在运行中');
    });
  });

  describe('stopTrade', () => {
    // 正常路径
    it('should stop strategy successfully', async () => {
      (prismaService.client.user_strategy_configs.findFirst as jest.Mock).mockResolvedValue({
        id: 'config-uuid',
        is_active: true,
      });
      (prismaService.client.user_strategy_configs.update as jest.Mock).mockResolvedValue({});

      const result = await service.stopTrade(TEST_USER_ID, 'config-uuid');

      expect(result.success).toBe(true);
      expect(result.message).toBe('策略已停止');
    });

    // 边界路径 - 未在运行
    it('should return failure when not running', async () => {
      (prismaService.client.user_strategy_configs.findFirst as jest.Mock).mockResolvedValue({
        id: 'config-uuid',
        is_active: false,
      });

      const result = await service.stopTrade(TEST_USER_ID, 'config-uuid');

      expect(result.success).toBe(false);
      expect(result.message).toBe('策略未在运行');
    });
  });

  // ==================== panic 测试 ====================

  describe('panic', () => {
    // 正常路径
    it('should stop all strategies when confirmed', async () => {
      (prismaService.client.user_strategy_configs.updateMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      const result = await service.panic(TEST_USER_ID, { confirm: true });

      expect(result.success).toBe(true);
      expect(result.stoppedStrategies).toBe(3);
    });

    // 异常路径 - 未确认
    it('should return failure when not confirmed', async () => {
      const result = await service.panic(TEST_USER_ID, { confirm: false });

      expect(result.success).toBe(false);
      expect(result.error).toBe('请确认紧急平仓操作');
    });

    // 边界路径 - 指定实例
    it('should stop strategies for specific instance', async () => {
      (prismaService.client.user_strategy_configs.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const result = await service.panic(TEST_USER_ID, {
        confirm: true,
        instanceId: 'instance-uuid',
      });

      expect(result.success).toBe(true);
      expect(prismaService.client.user_strategy_configs.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            instance_id: 'instance-uuid',
          }),
        }),
      );
    });
  });

  // ==================== getProfile 测试 ====================

  describe('getProfile', () => {
    // 正常路径
    it('should return user profile with stats', async () => {
      const mockUser = {
        id: TEST_USER_ID,
        email: 'test@example.com',
        password_hash: 'hashed',
        telegram_id: BigInt(123456789),
        telegram_username: 'testuser',
        telegram_first_name: 'Test',
        telegram_photo_url: 'https://photo.url',
        telegram_linked_at: new Date(),
        vip_level: 1,
        invite_code: 'ABCD1234',
        role: 'user',
        status: 'active',
        created_at: new Date(),
        last_login_at: new Date(),
        wallets: {
          usdt_balance: 1000,
          usdt_frozen: 50,
          points_balance: 500,
          token_balance: 100,
        },
      };

      (prismaService.client.users.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.client.trade_history.count as jest.Mock).mockResolvedValue(50);
      (prismaService.client.user_strategy_configs.count as jest.Mock).mockResolvedValue(2);
      (prismaService.client.trade_history.aggregate as jest.Mock).mockResolvedValue({
        _sum: { pnl: 500 },
      });

      const result = await service.getProfile(TEST_USER_ID);

      expect(result.id).toBe(TEST_USER_ID);
      expect(result.email).toBe('test@example.com');
      expect(result.hasPassword).toBe(true);
      expect(result.stats.totalTrades).toBe(50);
      expect(result.stats.activeStrategies).toBe(2);
    });

    // 异常路径
    it('should throw NotFoundException when user not found', async () => {
      (prismaService.client.users.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getProfile('non-existent')).rejects.toThrow(NotFoundException);
    });

    // 边界路径 - Telegram 用户无邮箱
    it('should hide email for telegram-only users', async () => {
      const mockUser = {
        id: TEST_USER_ID,
        email: 'tg_123@telegram.local',
        password_hash: '',
        telegram_id: BigInt(123456789),
        vip_level: 0,
        role: 'user',
        status: 'active',
        wallets: null,
      };

      (prismaService.client.users.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.client.trade_history.count as jest.Mock).mockResolvedValue(0);
      (prismaService.client.user_strategy_configs.count as jest.Mock).mockResolvedValue(0);
      (prismaService.client.trade_history.aggregate as jest.Mock).mockResolvedValue({
        _sum: { pnl: null },
      });

      const result = await service.getProfile(TEST_USER_ID);

      expect(result.email).toBeNull();
      expect(result.hasPassword).toBe(false);
    });
  });

  // ==================== getTrades 测试 ====================

  describe('getTrades', () => {
    // 正常路径
    it('should return paginated trade history', async () => {
      const mockTrades = [
        {
          id: 'trade-1',
          symbol: 'BTCUSDT',
          side: 'buy',
          entry_price: 50000,
          exit_price: 51000,
          quantity: 0.1,
          pnl: 100,
          pnl_percentage: 2,
          status: 'closed',
          opened_at: new Date(),
          closed_at: new Date(),
          strategies: { id: 'strategy-1', name: 'Alpha' },
        },
      ];

      (prismaService.client.trade_history.findMany as jest.Mock).mockResolvedValue(mockTrades);
      (prismaService.client.trade_history.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getTrades(TEST_USER_ID, 1, 10);

      expect(result.trades.length).toBe(1);
      expect(result.trades[0].symbol).toBe('BTCUSDT');
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    // 边界路径 - 空交易历史
    it('should handle empty trade history', async () => {
      (prismaService.client.trade_history.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.client.trade_history.count as jest.Mock).mockResolvedValue(0);

      const result = await service.getTrades(TEST_USER_ID, 1, 10);

      expect(result.trades.length).toBe(0);
      expect(result.total).toBe(0);
    });
  });
});
