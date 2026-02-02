import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { PositionsService } from './positions.service';
import {
  ClosePositionDto,
  EmergencyCloseAllDto,
  TradeHistoryQueryDto,
} from './dto/position.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('trading/positions')
export class PositionsController {
  constructor(private positionsService: PositionsService) {}

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

  // 通过 Telegram ID 获取持仓 - 公开接口（TG Bot 调用）
  @Public()
  @Get('telegram/:telegramId')
  async getPositionsByTelegramId(@Param('telegramId') telegramId: string) {
    return this.positionsService.getPositionsByTelegramId(telegramId);
  }

  // 通过 Telegram ID 获取收益统计 - 公开接口（TG Bot 调用）
  @Public()
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
