import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/dto/jwt-payload.dto';
import { InstancesService } from '../instances/instances.service';
import { FreqtradeService } from '../freqtrade/freqtrade.service';
import { NetworkWhitelistService } from '../../common/services/network-whitelist.service';

/**
 * 交易机器人控制器
 * 路由前缀: /api/trading
 * 代理到用户的 VPS Freqtrade 实例
 */
@Controller('trading')
@UseGuards(JwtAuthGuard)
export class TradingController {
  private readonly logger = new Logger(TradingController.name);

  constructor(
    private readonly instancesService: InstancesService,
    private readonly freqtradeService: FreqtradeService,
    private readonly networkWhitelistService: NetworkWhitelistService,
  ) {}

  /**
   * 获取用户的活跃 VPS 实例
   * @returns VPS 实例（保证 ip_address 存在）或抛出异常
   */
  private async getUserActiveInstance(userId: string): Promise<{
    id: string;
    ip_address: string;
    status: string;
    created_at: Date;
  }> {
    const instances = await this.instancesService.findAllByUserId(userId);
    const activeInstance = instances.find(
      (i) => i.status === 'running' && i.ip_address,
    );

    if (!activeInstance || !activeInstance.ip_address) {
      throw new HttpException(
        {
          code: 40301,
          message: '您还没有活跃的 VPS 实例，请先购买或启动 VPS 服务',
          data: null,
        },
        HttpStatus.OK, // 返回 200 但 code 非 0，前端可以友好展示
      );
    }

    return {
      id: activeInstance.id,
      ip_address: activeInstance.ip_address,
      status: activeInstance.status,
      created_at: activeInstance.created_at,
    };
  }

  /**
   * 生成 Freqtrade API Token
   * @param instanceId 实例 ID
   * @returns API Token
   */
  private getApiToken(instanceId: string): string {
    return this.networkWhitelistService.generateFreqtradeToken(instanceId);
  }

  /**
   * 获取 Freqtrade 完整配置
   * GET /api/trading/config
   * 代理到 VPS Freqtrade: GET /api/v1/show_config
   */
  @Get('config')
  async getConfig(@CurrentUser() user: JwtPayload) {
    try {
      const instance = await this.getUserActiveInstance(user.sub);

      const apiToken = this.getApiToken(instance.id);
      const config = await this.freqtradeService.getConfig(instance.ip_address, apiToken);

      return {
        code: 0,
        message: 'success',
        data: config,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`获取配置失败: ${error.message}`, error.stack);
      return {
        code: 50001,
        message: '获取配置失败，请检查 VPS 状态',
        data: null,
      };
    }
  }

  /**
   * 获取当前持仓
   * GET /api/trading/positions
   * 代理到 VPS Freqtrade: GET /api/v1/status
   */
  @Get('positions')
  async getPositions(@CurrentUser() user: JwtPayload) {
    try {
      const instance = await this.getUserActiveInstance(user.sub);

      const apiToken = this.getApiToken(instance.id);
      const openTrades = await this.freqtradeService.getOpenTrades(
        instance.ip_address,
        apiToken,
      );

      // 转换 Freqtrade 格式为前端期望的格式
      const positions = openTrades.map((trade) => ({
        id: trade.trade_id.toString(),
        symbol: trade.pair,
        side: 'buy', // Freqtrade OpenTrade 默认是做多
        amount: trade.amount || '0',
        entry_price: trade.open_rate || '0',
        current_price: trade.current_rate || trade.open_rate || '0',
        unrealized_pnl: trade.current_profit || '0',
        unrealized_pnl_percent: trade.current_profit_pct || '0',
        leverage: trade.leverage || 1,
        stoploss_price: trade.stop_loss || null,
        take_profit_price: null, // Freqtrade DTO 中没有 take_profit
        opened_at: trade.open_date || new Date().toISOString(),
      }));

      return {
        code: 0,
        message: 'success',
        data: positions,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        // 如果是没有活跃 VPS，返回友好提示
        return error.getResponse();
      }
      // Freqtrade 连接失败时返回空数组，不抛出 500 错误
      this.logger.warn(`获取持仓失败: ${error.message}`);
      return {
        code: 0,
        message: 'success',
        data: [],
        notice: '交易机器人暂时不可用，请稍后重试',
      };
    }
  }

  /**
   * 获取订单
   * GET /api/trading/orders
   * 代理到 VPS Freqtrade: GET /api/v1/orders (如果支持)
   */
  @Get('orders')
  async getOrders(@CurrentUser() user: JwtPayload) {
    try {
      const instance = await this.getUserActiveInstance(user.sub);

      // Freqtrade 的 open trades 就是当前活跃订单
      const apiToken = this.getApiToken(instance.id);
      const openTrades = await this.freqtradeService.getOpenTrades(
        instance.ip_address,
        apiToken,
      );

      const orders = openTrades.map((trade) => ({
        id: trade.trade_id.toString(),
        symbol: trade.pair,
        side: 'buy', // Freqtrade OpenTrade 默认是做多
        type: 'limit',
        amount: trade.amount || '0',
        price: trade.open_rate || '0',
        status: 'open',
        created_at: trade.open_date || new Date().toISOString(),
      }));

      return {
        code: 0,
        message: 'success',
        data: orders,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        return error.getResponse();
      }
      this.logger.warn(`获取订单失败: ${error.message}`);
      return {
        code: 0,
        message: 'success',
        data: [],
        notice: '交易机器人暂时不可用，请稍后重试',
      };
    }
  }

  /**
   * 获取机器人状态
   * GET /api/trading/bot/status
   * 代理到 VPS Freqtrade: GET /api/v1/status + /api/v1/show_config
   */
  @Get('bot/status')
  async getBotStatus(@CurrentUser() user: JwtPayload) {
    try {
      const instance = await this.getUserActiveInstance(user.sub);

      const apiToken = this.getApiToken(instance.id);
      const [status, openTrades] = await Promise.all([
        this.freqtradeService.getStatus(instance.ip_address, apiToken),
        this.freqtradeService.getOpenTrades(instance.ip_address, apiToken),
      ]);

      // 计算运行时间（基于实例创建时间）
      const uptimeMs = Date.now() - new Date(instance.created_at).getTime();
      const uptimeSeconds = Math.floor(uptimeMs / 1000);

      return {
        code: 0,
        message: 'success',
        data: {
          running: status.state === 'running',
          state: status.state || 'unknown',
          strategy_id: status.strategy_name || null,
          strategy_name: status.strategy_name || null,
          uptime: uptimeSeconds,
          trades_today: openTrades.length, // 简化：当前持仓数作为今日交易数
          dry_run: status.dry_run ?? false,
          exchange: status.exchange || 'binance',
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        return error.getResponse();
      }
      this.logger.warn(`获取机器人状态失败: ${error.message}`);
      return {
        code: 0,
        message: 'success',
        data: {
          running: false,
          state: 'stopped',
          strategy_id: null,
          strategy_name: null,
          uptime: 0,
          trades_today: 0,
          notice: '交易机器人暂时不可用',
        },
      };
    }
  }

  /**
   * 启动机器人
   * POST /api/trading/bot/start
   * 代理到 VPS Freqtrade: POST /api/v1/start
   */
  @Post('bot/start')
  async startBot(
    @CurrentUser() user: JwtPayload,
    @Body() body: { strategy_id?: string; config?: Record<string, unknown> },
  ) {
    try {
      const instance = await this.getUserActiveInstance(user.sub);

      this.logger.log(
        `用户 ${user.sub} 启动机器人，策略: ${body.strategy_id || '默认'}`,
      );

      const apiToken = this.getApiToken(instance.id);
      const result = await this.freqtradeService.start(instance.ip_address, apiToken);

      return {
        code: 0,
        message: result.status || '机器人已启动',
        data: {
          status: 'running',
          instance_id: instance.id,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`启动机器人失败: ${error.message}`, error.stack);
      return {
        code: 50002,
        message: `启动失败: ${error.message}`,
        data: {
          status: 'error',
        },
      };
    }
  }

  /**
   * 停止机器人
   * POST /api/trading/bot/stop
   * 代理到 VPS Freqtrade: POST /api/v1/stop
   */
  @Post('bot/stop')
  async stopBot(@CurrentUser() user: JwtPayload) {
    try {
      const instance = await this.getUserActiveInstance(user.sub);

      this.logger.log(`用户 ${user.sub} 停止机器人`);

      const apiToken = this.getApiToken(instance.id);
      const result = await this.freqtradeService.stop(instance.ip_address, apiToken);

      return {
        code: 0,
        message: result.status || '机器人已停止',
        data: {
          status: 'stopped',
          instance_id: instance.id,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`停止机器人失败: ${error.message}`, error.stack);
      return {
        code: 50002,
        message: `停止失败: ${error.message}`,
        data: {
          status: 'error',
        },
      };
    }
  }

  /**
   * 获取账户余额
   * GET /api/trading/balance
   * 代理到 VPS Freqtrade: GET /api/v1/balance
   */
  @Get('balance')
  async getBalance(@CurrentUser() user: JwtPayload) {
    try {
      const instance = await this.getUserActiveInstance(user.sub);

      const apiToken = this.getApiToken(instance.id);
      const balance = await this.freqtradeService.getBalance(
        instance.ip_address,
        apiToken,
      );

      return {
        code: 0,
        message: 'success',
        data: balance,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`获取余额失败: ${error.message}`, error.stack);
      return {
        code: 50001,
        message: '获取余额失败，请检查 VPS 状态',
        data: null,
      };
    }
  }

  /**
   * 强制平仓单个交易
   * POST /api/trading/force-exit
   * 代理到 VPS Freqtrade: POST /api/v1/forceexit
   */
  @Post('force-exit')
  async forceExit(
    @CurrentUser() user: JwtPayload,
    @Body() body: { trade_id: string },
  ) {
    try {
      const instance = await this.getUserActiveInstance(user.sub);

      this.logger.warn(
        `用户 ${user.sub} 强制平仓交易 ${body.trade_id}`,
      );

      const apiToken = this.getApiToken(instance.id);
      const result = await this.freqtradeService.forceExit(
        instance.ip_address,
        body.trade_id,
        apiToken,
      );

      return {
        code: 0,
        message: result.status || '平仓指令已发送',
        data: {
          trade_id: body.trade_id,
          status: 'closing',
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`强制平仓失败: ${error.message}`, error.stack);
      return {
        code: 50003,
        message: `平仓失败: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * 一键清仓（紧急按钮）
   * POST /api/trading/force-exit-all
   * 代理到 VPS Freqtrade: POST /api/v1/forceexit (all trades)
   */
  @Post('force-exit-all')
  async forceExitAll(@CurrentUser() user: JwtPayload) {
    try {
      const instance = await this.getUserActiveInstance(user.sub);

      this.logger.warn(`用户 ${user.sub} 触发一键清仓！`);

      const apiToken = this.getApiToken(instance.id);
      const result = await this.freqtradeService.forceExitAll(
        instance.ip_address,
        apiToken,
      );

      return {
        code: 0,
        message: '清仓指令已发送到所有持仓',
        data: {
          closed_count: result.status ? 1 : 0, // 简化处理
          status: 'closing_all',
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`一键清仓失败: ${error.message}`, error.stack);
      return {
        code: 50003,
        message: `清仓失败: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * 获取 Freqtrade 日志
   * GET /api/trading/logs?limit=50
   * 代理到 VPS Freqtrade: GET /api/v1/logs
   */
  @Get('logs')
  async getLogs(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
  ) {
    try {
      const instance = await this.getUserActiveInstance(user.sub);

      const logLimit = limit ? parseInt(limit, 10) : 50;
      const apiToken = this.getApiToken(instance.id);
      const result = await this.freqtradeService.getLogs(
        instance.ip_address,
        logLimit,
        apiToken,
      );

      return {
        code: 0,
        message: 'success',
        data: result,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`获取日志失败: ${error.message}`, error.stack);
      return {
        code: 50001,
        message: '获取日志失败，请检查 VPS 状态',
        data: { logs: [], log_count: 0 },
      };
    }
  }

  /**
   * 获取 K 线数据
   * GET /api/trading/candles?pair=BTC/USDT&timeframe=5m&limit=500
   * 代理到 VPS Freqtrade: GET /api/v1/pair_candles
   */
  @Get('candles')
  async getCandles(
    @CurrentUser() user: JwtPayload,
    @Query('pair') pair: string,
    @Query('timeframe') timeframe?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      if (!pair) {
        return {
          code: 40001,
          message: '缺少必要参数: pair',
          data: null,
        };
      }

      const instance = await this.getUserActiveInstance(user.sub);

      const candleLimit = limit ? parseInt(limit, 10) : 500;
      const apiToken = this.getApiToken(instance.id);
      const result = await this.freqtradeService.getPairCandles(
        instance.ip_address,
        pair,
        timeframe || '5m',
        candleLimit,
        apiToken,
      );

      return {
        code: 0,
        message: 'success',
        data: result,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`获取K线数据失败: ${error.message}`, error.stack);
      return {
        code: 50001,
        message: '获取K线数据失败，请检查 VPS 状态',
        data: { pair, timeframe: timeframe || '5m', data: [] },
      };
    }
  }

  /**
   * 获取可用策略列表
   * GET /api/trading/strategies
   * 代理到 VPS Freqtrade: GET /api/v1/strategies
   */
  @Get('strategies')
  async getStrategies(@CurrentUser() user: JwtPayload) {
    try {
      const instance = await this.getUserActiveInstance(user.sub);

      const apiToken = this.getApiToken(instance.id);
      const strategies = await this.freqtradeService.getStrategies(
        instance.ip_address,
        apiToken,
      );

      return {
        code: 0,
        message: 'success',
        data: { strategies },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`获取策略列表失败: ${error.message}`, error.stack);
      return {
        code: 50001,
        message: '获取策略列表失败，请检查 VPS 状态',
        data: { strategies: [] },
      };
    }
  }

  /**
   * 获取可用交易对列表
   * GET /api/trading/available-pairs
   * 代理到 VPS Freqtrade: GET /api/v1/available_pairs
   */
  @Get('available-pairs')
  async getAvailablePairs(@CurrentUser() user: JwtPayload) {
    try {
      const instance = await this.getUserActiveInstance(user.sub);

      const apiToken = this.getApiToken(instance.id);
      const result = await this.freqtradeService.getAvailablePairs(
        instance.ip_address,
        apiToken,
      );

      return {
        code: 0,
        message: 'success',
        data: result,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`获取可用交易对失败: ${error.message}`, error.stack);
      return {
        code: 50001,
        message: '获取可用交易对失败，请检查 VPS 状态',
        data: { pairs: [], length: 0 },
      };
    }
  }

  /**
   * 执行策略回测
   * POST /api/trading/backtest
   * 代理到 VPS Freqtrade: POST /api/v1/backtest
   */
  @Post('backtest')
  async runBacktest(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      strategy_name: string;
      pairs: string[];
      start_date: string;
      end_date: string;
      initial_capital?: number;
    },
  ) {
    try {
      const instance = await this.getUserActiveInstance(user.sub);

      if (!body.strategy_name || !body.pairs?.length || !body.start_date || !body.end_date) {
        return {
          code: 40001,
          message: '缺少必要参数: strategy_name, pairs, start_date, end_date',
          data: null,
        };
      }

      this.logger.log(
        `用户 ${user.sub} 执行回测: 策略=${body.strategy_name}, 时间范围=${body.start_date}~${body.end_date}`,
      );

      const apiToken = this.getApiToken(instance.id);
      const result = await this.freqtradeService.runBacktest(
        instance.ip_address,
        body.strategy_name,
        {
          pairs: body.pairs,
          startDate: body.start_date,
          endDate: body.end_date,
          initialCapital: body.initial_capital || 10000,
        },
        apiToken,
      );

      return {
        code: 0,
        message: '回测完成',
        data: result,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`执行回测失败: ${error.message}`, error.stack);
      return {
        code: 50004,
        message: `回测失败: ${error.message}`,
        data: null,
      };
    }
  }
}
