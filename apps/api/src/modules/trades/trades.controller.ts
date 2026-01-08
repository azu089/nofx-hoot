import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TradesService } from './trades.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/dto/jwt-payload.dto';
import { QueryTradesDto } from './dto/trade-response.dto';
import { PeriodStatsQueryDto } from './dto/period-stats.dto';

/**
 * 交易历史控制器
 * 路由前缀: /api/trades
 */
@Controller('trades')
@UseGuards(JwtAuthGuard)
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  /**
   * 获取我的交易历史
   * GET /api/trades
   */
  @Get()
  async findMyTrades(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryTradesDto,
  ) {
    return this.tradesService.findByUser(user.sub, query);
  }

  /**
   * 获取交易统计（全部时间）
   * GET /api/trades/stats
   */
  @Get('stats')
  async getStats(@CurrentUser() user: JwtPayload) {
    return this.tradesService.calculatePnL(user.sub);
  }

  /**
   * 按时间段获取盈亏统计
   * GET /api/trades/stats/period?period=today|week|month|custom&start_date=&end_date=
   *
   * 示例:
   * - 今日: GET /api/trades/stats/period?period=today
   * - 本周: GET /api/trades/stats/period?period=week
   * - 本月: GET /api/trades/stats/period?period=month
   * - 自定义: GET /api/trades/stats/period?period=custom&start_date=2024-01-01&end_date=2024-01-31
   */
  @Get('stats/period')
  async getStatsByPeriod(
    @CurrentUser() user: JwtPayload,
    @Query() query: PeriodStatsQueryDto,
  ) {
    return this.tradesService.calculatePnLByPeriod(user.sub, query);
  }
}
