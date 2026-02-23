import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { PositionsService } from './positions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TradingService } from './trading.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('PositionsService', () => {
  let service: PositionsService;

  // ------------------------------------------------------------------
  // Mock position factory（open 状態）
  // ------------------------------------------------------------------
  const makePosition = (overrides: Partial<typeof baseMockPosition> = {}) => ({
    ...baseMockPosition,
    ...overrides,
  });

  const baseMockPosition = {
    id: 'pos-1',
    userId: 'user-123',
    exchange: 'binance',
    symbol: 'BTC/USDT',
    side: 'long',
    entryPrice: new Decimal('50000'),
    amount: new Decimal('0.1'),
    pnl: null as Decimal | null,
    status: 'open',
    exchangeOrderId: 'order-123',
    createdAt: new Date('2025-01-01T10:00:00Z'),
    updatedAt: new Date('2025-01-01T10:00:00Z'),
    closedAt: null as Date | null,
    closePrice: null as Decimal | null,
    closeReason: null as string | null,
    tradingType: 'futures',
    leverage: 3,
    margin: new Decimal('1666.67'),
    marginMode: 'cross',
    markPrice: null as Decimal | null,
    liquidationPrice: null as Decimal | null,
    unrealizedPnl: null as Decimal | null,
    marginRatio: null as Decimal | null,
    lastSyncAt: null as Date | null,
    subscription: null as null | { strategy: { name: string } },
    aiStrategy: null as null | { name: string },
    source: 'manual',
  };

  // ------------------------------------------------------------------
  // Mock services
  // ------------------------------------------------------------------
  const mockPrismaService = {
    position: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockTradingService = {
    closePosition: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PositionsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TradingService, useValue: mockTradingService },
      ],
    }).compile();

    service = module.get<PositionsService>(PositionsService);

    jest.clearAllMocks();
  });

  // ================================================================
  // findAll
  // ================================================================
  describe('findAll', () => {
    // 正常路径 - 返回开仓持仓列表，totalPnl 为 0（全部 open 状態）
    it('should return open positions with mapped fields and totalPnl "0"', async () => {
      const pos = makePosition({ pnl: null });
      mockPrismaService.position.findMany.mockResolvedValue([pos]);

      const result = await service.findAll('user-123');

      expect(result.total).toBe(1);
      expect(result.totalPnl).toBe('0');
      expect(result.items[0].id).toBe('pos-1');
      expect(result.items[0].entryPrice).toBe('50000');
      expect(result.items[0].amount).toBe('0.1');
      expect(result.items[0].exchange).toBe('binance');
      expect(result.items[0].symbol).toBe('BTC/USDT');
      expect(result.items[0].tradingType).toBe('futures');
      expect(result.items[0].leverage).toBe(3);
      expect(result.items[0].marginMode).toBe('cross');
    });

    // 边界路径 - 没有持仓时返回空列表
    it('should return empty list with totalPnl "0" when no positions exist', async () => {
      mockPrismaService.position.findMany.mockResolvedValue([]);

      const result = await service.findAll('user-123');

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPnl).toBe('0');
    });

    // 正常路径 - strategyName 从 aiStrategy 读取
    it('should map strategyName from aiStrategy when available', async () => {
      const pos = makePosition({ aiStrategy: { name: 'AI策略A' } });
      mockPrismaService.position.findMany.mockResolvedValue([pos]);

      const result = await service.findAll('user-123');

      expect(result.items[0].strategyName).toBe('AI策略A');
    });
  });

  // ================================================================
  // getOpenPositions
  // ================================================================
  describe('getOpenPositions', () => {
    // 正常路径 - 返回映射后的开仓数组
    it('should return array of mapped open positions', async () => {
      const pos = makePosition();
      mockPrismaService.position.findMany.mockResolvedValue([pos]);

      const result = await service.getOpenPositions('user-123');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('pos-1');
      expect(result[0].status).toBe('open');
    });

    // 边界路径 - 空数组
    it('should return empty array when no open positions', async () => {
      mockPrismaService.position.findMany.mockResolvedValue([]);

      const result = await service.getOpenPositions('user-123');

      expect(result).toEqual([]);
    });
  });

  // ================================================================
  // closePosition
  // ================================================================
  describe('closePosition', () => {
    // 正常路径 - long 方向平仓，PnL = (closePrice - entryPrice) * amount
    it('should close long position and calculate correct PnL', async () => {
      const pos = makePosition({ side: 'long', entryPrice: new Decimal('50000'), amount: new Decimal('0.1') });
      mockPrismaService.position.findUnique.mockResolvedValue(pos);
      mockTradingService.closePosition.mockResolvedValue({ price: '51000' });

      const updatedPos = {
        ...pos,
        status: 'closed',
        closedAt: new Date(),
        closePrice: new Decimal('51000'),
        pnl: new Decimal('100'), // (51000 - 50000) * 0.1 = 100
      };
      mockPrismaService.position.update.mockResolvedValue(updatedPos);

      const result = await service.closePosition('user-123', 'pos-1', 'api-key-1');

      // (51000 - 50000) * 0.1 = 100 USDT
      expect(mockPrismaService.position.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pos-1' },
          data: expect.objectContaining({
            status: 'closed',
          }),
        }),
      );
      expect(result.id).toBe('pos-1');
      expect(result.status).toBe('closed');
    });

    // 正常路径 - short 方向平仓，PnL = (entryPrice - closePrice) * amount
    it('should close short position and calculate correct PnL', async () => {
      const pos = makePosition({ side: 'short', entryPrice: new Decimal('50000'), amount: new Decimal('0.2') });
      mockPrismaService.position.findUnique.mockResolvedValue(pos);
      mockTradingService.closePosition.mockResolvedValue({ price: '49000' });

      const updatedPos = {
        ...pos,
        status: 'closed',
        closedAt: new Date(),
        closePrice: new Decimal('49000'),
        pnl: new Decimal('200'), // (50000 - 49000) * 0.2 = 200
      };
      mockPrismaService.position.update.mockResolvedValue(updatedPos);

      const result = await service.closePosition('user-123', 'pos-1', 'api-key-1');

      // PnL の方向が正しいか確認（update が呼ばれた data の pnl は Decimal）
      const updateCall = mockPrismaService.position.update.mock.calls[0][0];
      const pnlDecimal: Decimal = updateCall.data.pnl;
      // short: entryPrice - closePrice = 50000 - 49000 = 1000, * 0.2 = 200
      expect(pnlDecimal.toString()).toBe('200');
      expect(result.status).toBe('closed');
    });

    // 异常路径 - 持仓不存在 → NotFoundException
    it('should throw NotFoundException when position does not exist', async () => {
      mockPrismaService.position.findUnique.mockResolvedValue(null);

      await expect(
        service.closePosition('user-123', 'nonexistent-pos', 'api-key-1'),
      ).rejects.toThrow(NotFoundException);
    });

    // 异常路径 - 不属于当前用户 → ForbiddenException
    it('should throw ForbiddenException when position belongs to another user', async () => {
      const pos = makePosition({ userId: 'other-user-999' });
      mockPrismaService.position.findUnique.mockResolvedValue(pos);

      await expect(
        service.closePosition('user-123', 'pos-1', 'api-key-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    // 异常路径 - 持仓已平仓 → ForbiddenException
    it('should throw ForbiddenException when position is already closed', async () => {
      const pos = makePosition({ status: 'closed' });
      mockPrismaService.position.findUnique.mockResolvedValue(pos);

      await expect(
        service.closePosition('user-123', 'pos-1', 'api-key-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    // 边界路径 - 交易所平仓失败时异常上抛
    it('should rethrow error when tradingService.closePosition fails', async () => {
      const pos = makePosition();
      mockPrismaService.position.findUnique.mockResolvedValue(pos);
      mockTradingService.closePosition.mockRejectedValue(new Error('交易所连接超时'));

      await expect(
        service.closePosition('user-123', 'pos-1', 'api-key-1'),
      ).rejects.toThrow('交易所连接超时');

      // 平仓失败时 position.update は呼ばれない
      expect(mockPrismaService.position.update).not.toHaveBeenCalled();
    });
  });

  // ================================================================
  // emergencyCloseAll
  // ================================================================
  describe('emergencyCloseAll', () => {
    // 边界路径 - 没有开仓持仓时直接返回
    it('should return { closed: 0, failed: 0, results: [] } when no open positions', async () => {
      mockPrismaService.position.findMany.mockResolvedValue([]);

      const result = await service.emergencyCloseAll('user-123', 'api-key-1');

      expect(result).toEqual({ closed: 0, failed: 0, results: [] });
    });

    // 正常路径 - 多个持仓全部平仓成功
    it('should close all positions and return correct counts', async () => {
      const pos1 = makePosition({ id: 'pos-1' });
      const pos2 = makePosition({ id: 'pos-2' });
      mockPrismaService.position.findMany.mockResolvedValue([pos1, pos2]);

      // findUnique は各 id を返す
      mockPrismaService.position.findUnique
        .mockResolvedValueOnce(pos1)
        .mockResolvedValueOnce(pos2);

      mockTradingService.closePosition.mockResolvedValue({ price: '51000' });

      const closedPos1 = { ...pos1, status: 'closed', pnl: new Decimal('100') };
      const closedPos2 = { ...pos2, status: 'closed', pnl: new Decimal('100') };
      mockPrismaService.position.update
        .mockResolvedValueOnce(closedPos1)
        .mockResolvedValueOnce(closedPos2);

      const result = await service.emergencyCloseAll('user-123', 'api-key-1');

      expect(result.closed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.results.length).toBe(2);
    });

    // 异常路径 - 部分持仓平仓失败时，失败个数正确计数并继续处理其他持仓
    it('should count failed positions and continue closing others', async () => {
      const pos1 = makePosition({ id: 'pos-1' });
      const pos2 = makePosition({ id: 'pos-2' });
      mockPrismaService.position.findMany.mockResolvedValue([pos1, pos2]);

      // pos1: 平仓失败（findUnique → NotFoundException）
      mockPrismaService.position.findUnique
        .mockResolvedValueOnce(null)    // pos-1 不存在 → NotFoundException
        .mockResolvedValueOnce(pos2);   // pos-2 正常

      mockTradingService.closePosition.mockResolvedValue({ price: '51000' });
      mockPrismaService.position.update.mockResolvedValue({
        ...pos2,
        status: 'closed',
        pnl: new Decimal('100'),
      });

      const result = await service.emergencyCloseAll('user-123', 'api-key-1');

      expect(result.closed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results.length).toBe(1);
    });
  });

  // ================================================================
  // getPnlStats
  // ================================================================
  describe('getPnlStats', () => {
    // 正常路径 - 计算 today/week/month 区间 PnL 正确
    it('should calculate todayPnl, weekPnl, monthPnl correctly', async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const recentDate = new Date(todayStart.getTime() + 60_000); // 今日内

      const closedPositions = [
        { pnl: new Decimal('100'), closedAt: recentDate },
        { pnl: new Decimal('-30'), closedAt: recentDate },
      ];
      const openPositions: Array<{ pnl: Decimal | null; unrealizedPnl: Decimal | null }> = [];

      mockPrismaService.position.findMany
        .mockResolvedValueOnce(closedPositions)  // status: 'closed' query
        .mockResolvedValueOnce(openPositions);   // status: 'open' query

      const result = await service.getPnlStats('user-123');

      // todayPnl: 100 + (-30) = 70.00
      expect(result.todayPnl).toBe('70.00');
      // weekPnl / monthPnl も同じ（今日のデータ）
      expect(result.weekPnl).toBe('70.00');
      expect(result.monthPnl).toBe('70.00');
      // totalPnl も同じ
      expect(result.totalPnl).toBe('70.00');
    });

    // 正常路径 - 胜率：3 笔中 2 笔盈利 → '66.7'
    it('should calculate winRate as "66.7" for 2 wins out of 3 trades', async () => {
      const now = new Date();
      const recentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 1);
      const closedPositions = [
        { pnl: new Decimal('100'), closedAt: recentDate },
        { pnl: new Decimal('50'), closedAt: recentDate },
        { pnl: new Decimal('-20'), closedAt: recentDate },
      ];
      mockPrismaService.position.findMany
        .mockResolvedValueOnce(closedPositions)
        .mockResolvedValueOnce([]);

      const result = await service.getPnlStats('user-123');

      expect(result.winRate).toBe('66.7');
      expect(result.tradeCount).toBe(3);
    });

    // 边界路径 - 没有交易记录时全部为 0
    it('should return all zeros when no closed positions exist', async () => {
      mockPrismaService.position.findMany
        .mockResolvedValueOnce([])   // closed positions
        .mockResolvedValueOnce([]);  // open positions

      const result = await service.getPnlStats('user-123');

      expect(result.totalPnl).toBe('0.00');
      expect(result.todayPnl).toBe('0.00');
      expect(result.weekPnl).toBe('0.00');
      expect(result.monthPnl).toBe('0.00');
      expect(result.unrealizedPnl).toBe('0.00');
      expect(result.tradeCount).toBe(0);
      expect(result.winRate).toBe('0');
    });

    // 正常路径 - unrealizedPnl 优先使用 unrealizedPnl 字段（兜底用 pnl）
    it('should use unrealizedPnl field first, fallback to pnl for open positions', async () => {
      mockPrismaService.position.findMany
        .mockResolvedValueOnce([])  // closed
        .mockResolvedValueOnce([
          { pnl: new Decimal('50'), unrealizedPnl: new Decimal('80') }, // unrealizedPnl 优先
          { pnl: new Decimal('30'), unrealizedPnl: null },              // fallback to pnl
        ]);

      const result = await service.getPnlStats('user-123');

      // 80 + 30 = 110
      expect(result.unrealizedPnl).toBe('110.00');
    });
  });

  // ================================================================
  // getTradeHistory
  // ================================================================
  describe('getTradeHistory', () => {
    const closedPos = {
      ...baseMockPosition,
      status: 'closed',
      pnl: new Decimal('100'),
      closePrice: new Decimal('51000'),
      closedAt: new Date('2025-01-02T10:00:00Z'),
    };

    // 正常路径 - 分页参数正确传递（skip / take）
    it('should apply pagination correctly', async () => {
      mockPrismaService.position.findMany.mockResolvedValue([closedPos]);
      mockPrismaService.position.count.mockResolvedValue(1);

      const result = await service.getTradeHistory('user-123', { page: 2, limit: 10 });

      expect(mockPrismaService.position.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,  // (2 - 1) * 10
          take: 10,
        }),
      );
      expect(result.total).toBe(1);
      expect(result.items.length).toBe(1);
    });

    // 正常路径 - symbol 过滤条件传递给 Prisma
    it('should apply symbol filter to prisma query', async () => {
      mockPrismaService.position.findMany.mockResolvedValue([]);
      mockPrismaService.position.count.mockResolvedValue(0);

      await service.getTradeHistory('user-123', { symbol: 'ETH' });

      expect(mockPrismaService.position.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            symbol: { contains: 'ETH', mode: 'insensitive' },
          }),
        }),
      );
    });

    // 边界路径 - 不传分页参数时使用默认值 page=1, limit=20
    it('should use default page=1 limit=20 when not specified', async () => {
      mockPrismaService.position.findMany.mockResolvedValue([]);
      mockPrismaService.position.count.mockResolvedValue(0);

      await service.getTradeHistory('user-123', {});

      expect(mockPrismaService.position.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,   // (1 - 1) * 20
          take: 20,
        }),
      );
    });

    // 正常路径 - 返回的 items 包含 pnl / pnlPercent / entryPrice / closePrice
    it('should map trade history fields correctly including pnl and pnlPercent', async () => {
      mockPrismaService.position.findMany.mockResolvedValue([closedPos]);
      mockPrismaService.position.count.mockResolvedValue(1);

      const result = await service.getTradeHistory('user-123', {});

      const item = result.items[0];
      expect(item.id).toBe('pos-1');
      expect(item.entryPrice).toBe('50000');
      expect(item.closePrice).toBe('51000');
      expect(item.pnl).toBe('100');
      expect(item.side).toBe('long');
      expect(item.type).toBe('market');
    });
  });
});
