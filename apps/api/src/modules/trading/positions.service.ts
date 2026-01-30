import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TradingService } from './trading.service';
import { Decimal } from '@prisma/client/runtime/library';
import {
  PositionResponse,
  PositionListResponse,
} from './dto/position.dto';

@Injectable()
export class PositionsService {
  private readonly logger = new Logger(PositionsService.name);

  constructor(
    private prisma: PrismaService,
    private tradingService: TradingService,
  ) {}

  // 获取用户持仓列表
  async findAll(userId: string): Promise<PositionListResponse> {
    const positions = await this.prisma.position.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // 计算总 PnL
    let totalPnl = new Decimal(0);

    const items: PositionResponse[] = positions.map((p) => {
      const pnl = p.pnl ? new Decimal(p.pnl.toString()) : new Decimal(0);
      if (p.status === 'closed') {
        totalPnl = totalPnl.plus(pnl);
      }

      return {
        id: p.id,
        exchange: p.exchange,
        symbol: p.symbol,
        side: p.side,
        entryPrice: p.entryPrice.toString(),
        amount: p.amount.toString(),
        pnl: p.pnl?.toString(),
        status: p.status,
        exchangeOrderId: p.exchangeOrderId || undefined,
        createdAt: p.createdAt,
      };
    });

    return {
      items,
      total: positions.length,
      totalPnl: totalPnl.toString(),
    };
  }

  // 获取活跃持仓
  async getOpenPositions(userId: string): Promise<PositionResponse[]> {
    const positions = await this.prisma.position.findMany({
      where: {
        userId,
        status: 'open',
      },
      orderBy: { createdAt: 'desc' },
    });

    return positions.map((p) => ({
      id: p.id,
      exchange: p.exchange,
      symbol: p.symbol,
      side: p.side,
      entryPrice: p.entryPrice.toString(),
      amount: p.amount.toString(),
      status: p.status,
      exchangeOrderId: p.exchangeOrderId || undefined,
      createdAt: p.createdAt,
    }));
  }

  // 通过 Telegram ID 获取持仓（TG Bot 使用）
  async getPositionsByTelegramId(telegramId: string): Promise<PositionResponse[]> {
    // 先查找用户
    const user = await this.prisma.user.findUnique({
      where: { telegramId },
      select: { id: true },
    });

    if (!user) {
      return [];
    }

    // 获取活跃持仓
    const positions = await this.prisma.position.findMany({
      where: {
        userId: user.id,
        status: 'open',
      },
      orderBy: { createdAt: 'desc' },
    });

    return positions.map((p) => ({
      id: p.id,
      exchange: p.exchange,
      symbol: p.symbol,
      side: p.side,
      entryPrice: p.entryPrice.toString(),
      amount: p.amount.toString(),
      pnl: p.pnl?.toString(),
      status: p.status,
      exchangeOrderId: p.exchangeOrderId || undefined,
      createdAt: p.createdAt,
    }));
  }

  // 手动平仓
  async closePosition(
    userId: string,
    positionId: string,
    apiKeyId: string,
  ): Promise<PositionResponse> {
    // 查找持仓
    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
    });

    if (!position) {
      throw new NotFoundException('持仓不存在');
    }

    if (position.userId !== userId) {
      throw new ForbiddenException('无权操作此持仓');
    }

    if (position.status !== 'open') {
      throw new ForbiddenException('持仓已关闭');
    }

    this.logger.log(`手动平仓: ${positionId}`);

    try {
      // 执行平仓
      const result = await this.tradingService.closePosition(
        userId,
        apiKeyId,
        position.symbol,
        parseFloat(position.amount.toString()),
        position.side as 'long' | 'short',
      );

      // 计算盈亏
      const entryPrice = new Decimal(position.entryPrice.toString());
      const closePrice = new Decimal(result.price);
      const amount = new Decimal(position.amount.toString());

      let pnl: Decimal;
      if (position.side === 'long') {
        pnl = closePrice.minus(entryPrice).times(amount);
      } else {
        pnl = entryPrice.minus(closePrice).times(amount);
      }

      // 更新持仓状态
      const updated = await this.prisma.position.update({
        where: { id: positionId },
        data: {
          status: 'closed',
          closedAt: new Date(),
          closePrice: closePrice,
          pnl: pnl,
        },
      });

      return {
        id: updated.id,
        exchange: updated.exchange,
        symbol: updated.symbol,
        side: updated.side,
        entryPrice: updated.entryPrice.toString(),
        amount: updated.amount.toString(),
        pnl: updated.pnl?.toString(),
        status: updated.status,
        exchangeOrderId: updated.exchangeOrderId || undefined,
        createdAt: updated.createdAt,
      };
    } catch (error) {
      this.logger.error(`平仓失败: ${error}`);
      throw error;
    }
  }
}
