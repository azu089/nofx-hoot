import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TradesService } from './trades.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/dto/jwt-payload.dto';
import { QueryTradesDto } from './dto/trade-response.dto';

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
   * 获取交易统计
   * GET /api/trades/stats
   */
  @Get('stats')
  async getStats(@CurrentUser() user: JwtPayload) {
    return this.tradesService.calculatePnL(user.sub);
  }
}
