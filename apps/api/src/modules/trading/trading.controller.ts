import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/dto/jwt-payload.dto';

/**
 * 交易机器人控制器
 * 路由前缀: /api/trading
 * 注意：这是 stub 实现，真实功能需要连接 Freqtrade
 */
@Controller('trading')
@UseGuards(JwtAuthGuard)
export class TradingController {
  /**
   * 获取当前持仓
   * GET /api/trading/positions
   */
  @Get('positions')
  async getPositions(@CurrentUser() user: JwtPayload) {
    // Stub: 返回空数组，真实实现需要从 Freqtrade 获取
    return {
      code: 0,
      message: 'success',
      data: [],
    };
  }

  /**
   * 获取订单
   * GET /api/trading/orders
   */
  @Get('orders')
  async getOrders(@CurrentUser() user: JwtPayload) {
    return {
      code: 0,
      message: 'success',
      data: [],
    };
  }

  /**
   * 获取机器人状态
   * GET /api/trading/bot/status
   */
  @Get('bot/status')
  async getBotStatus(@CurrentUser() user: JwtPayload) {
    // Stub: 返回未运行状态
    return {
      code: 0,
      message: 'success',
      data: {
        running: false,
        strategy_id: null,
        uptime: 0,
        trades_today: 0,
      },
    };
  }

  /**
   * 启动机器人
   * POST /api/trading/bot/start
   */
  @Post('bot/start')
  async startBot(
    @CurrentUser() user: JwtPayload,
    @Body() body: { strategy_id: string; config?: Record<string, unknown> },
  ) {
    // Stub: 返回启动中状态
    return {
      code: 0,
      message: '功能开发中',
      data: {
        id: 'bot-' + Date.now(),
        status: 'pending',
      },
    };
  }

  /**
   * 停止机器人
   * POST /api/trading/bot/stop
   */
  @Post('bot/stop')
  async stopBot(@CurrentUser() user: JwtPayload) {
    return {
      code: 0,
      message: '功能开发中',
      data: {
        status: 'stopped',
      },
    };
  }
}
