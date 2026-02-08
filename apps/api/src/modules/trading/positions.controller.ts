import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { PositionsService } from './positions.service';
import { PositionSyncService, SyncedPosition } from './position-sync.service';
import {
  ClosePositionDto,
  EmergencyCloseAllDto,
  TradeHistoryQueryDto,
} from './dto/position.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { TelegramBotGuard } from '../../common/guards/telegram-bot.guard';

@Controller('trading/positions')
export class PositionsController {
  constructor(
    private positionsService: PositionsService,
    private positionSyncService: PositionSyncService,
  ) {}

  // 获取所有持仓
  @Get()
  async findAll(@CurrentUser() user: { id: string }) {
    return this.positionsService.findAll(user.id);
  }

  // 获取活跃持仓
  @Get('open')
  async getOpenPositions(@CurrentUser() user: { id: string }) {
    return this.positionsService.getOpenPositions(user.id);
  }

  // 同步持仓数据（从交易所获取实时数据）
  @Post('sync')
  async syncPositions(
    @CurrentUser() user: { id: string },
    @Body('apiKeyId') apiKeyId: string,
  ): Promise<SyncedPosition[]> {
    return this.positionSyncService.syncUserPositions(user.id, apiKeyId);
  }

  // 获取同步后的持仓（实时数据）
  @Get('synced')
  async getSyncedPositions(
    @CurrentUser() user: { id: string },
    @Query('apiKeyId') apiKeyId: string,
  ): Promise<SyncedPosition[]> {
    if (!apiKeyId) {
      // 如果没有指定 apiKeyId，返回数据库中的持仓（含已同步的实时数据）
      const dbPositions = await this.positionsService.getOpenPositions(user.id);
      return dbPositions.map((pos) => ({
        id: pos.id,
        symbol: pos.symbol,
        side: pos.side,
        entryPrice: pos.entryPrice,
        markPrice: pos.markPrice || pos.entryPrice,
        liquidationPrice: pos.liquidationPrice || '0',
        amount: pos.amount,
        notionalValue: '0',
        margin: pos.margin || '0',
        leverage: pos.leverage || 1,
        marginMode: pos.marginMode || 'cross',
        unrealizedPnl: pos.unrealizedPnl || pos.pnl || '0',
        roe: pos.pnlPercent || '0',
        status: pos.status,
        tradingType: pos.tradingType || 'spot',
        strategyName: pos.strategyName,
        createdAt: pos.createdAt,
        syncedAt: pos.lastSyncAt || new Date(),
        syncSource: 'database' as const,
      }));
    }
    return this.positionSyncService.syncUserPositions(user.id, apiKeyId);
  }

  // 获取盈亏统计
  @Get('pnl-stats')
  async getPnlStats(@CurrentUser() user: { id: string }) {
    return this.positionsService.getPnlStats(user.id);
  }

  // 获取交易历史
  @Get('history')
  async getTradeHistory(
    @CurrentUser() user: { id: string },
    @Query() query: TradeHistoryQueryDto,
  ) {
    return this.positionsService.getTradeHistory(user.id, query);
  }

  // 获取执行日志
  @Get('logs')
  async getExecutionLogs(
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: string,
  ) {
    return this.positionsService.getExecutionLogs(
      user.id,
      limit ? parseInt(limit) : 50,
    );
  }

  // 通过 Telegram ID 获取持仓 - TG Bot 专用（需验证 Bot 密钥）
  @Public()
  @UseGuards(TelegramBotGuard)
  @Get('telegram/:telegramId')
  async getPositionsByTelegramId(@Param('telegramId') telegramId: string) {
    return this.positionsService.getPositionsByTelegramId(telegramId);
  }

  // 通过 Telegram ID 获取收益统计 - TG Bot 专用（需验证 Bot 密钥）
  @Public()
  @UseGuards(TelegramBotGuard)
  @Get('earnings/telegram/:telegramId')
  async getEarningsByTelegramId(@Param('telegramId') telegramId: string) {
    return this.positionsService.getEarningsByTelegramId(telegramId);
  }

  // 紧急清仓所有持仓
  @Post('close-all')
  async emergencyCloseAll(
    @CurrentUser() user: { id: string },
    @Body() dto: EmergencyCloseAllDto,
  ) {
    return this.positionsService.emergencyCloseAll(user.id, dto.apiKeyId);
  }

  // 手动平仓单个持仓
  @Post(':id/close')
  async closePosition(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: ClosePositionDto,
  ) {
    return this.positionsService.closePosition(user.id, id, dto.apiKeyId);
  }
}
