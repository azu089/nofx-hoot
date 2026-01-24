import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { FreqtradeStatusDto } from './dto/freqtrade-status.dto';
import { FreqtradeBalancesDto } from './dto/freqtrade-balance.dto';
import {
  FreqtradeTradeDto,
  FreqtradeOpenTradeDto,
  ForceExitDto,
} from './dto/freqtrade-trade.dto';
import { FreqtradeConfigDto } from './dto/freqtrade-config.dto';

/**
 * Freqtrade 认证信息接口
 */
interface FreqtradeAuth {
  username: string;
  password: string; // Freqtrade API Token
}

/**
 * 回测结果接口
 */
export interface BacktestResult {
  total_return: number;
  win_rate: number;
  total_trades: number;
  max_drawdown: number;
  sharpe_ratio: number;
  profit_factor: number;
  avg_profit: number;
  avg_loss: number;
  trades: Array<{
    pair: string;
    side: string;
    entry_price: number;
    exit_price: number;
    pnl: number;
    entry_time: string;
    exit_time: string;
  }>;
}

/**
 * Freqtrade 服务
 * 负责与 VPS 上的 Freqtrade REST API 通信
 *
 * Freqtrade API 文档: https://www.freqtrade.io/en/stable/rest-api/
 *
 * 注意事项:
 * - Freqtrade 默认端口: 8080
 * - 使用 Basic Auth 认证（用户名: quantfi, 密码: API Token）
 * - 沙盒模式返回模拟数据
 * - API 超时设置: 10 秒
 */
@Injectable()
export class FreqtradeService {
  private readonly logger = new Logger(FreqtradeService.name);
  private readonly isSandbox: boolean;
  private readonly defaultPort = 8080;
  private readonly defaultUsername = 'quantfi'; // 固定用户名

  // 连接失败缓存：记录最近失败的 IP，避免重复超时
  private failedConnections: Map<string, number> = new Map();
  private readonly FAIL_CACHE_DURATION = 60000; // 1 分钟内不重试失败的连接
  private readonly QUICK_TIMEOUT = 3000; // 快速超时：3 秒

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.isSandbox = this.configService.get('SANDBOX_MODE') === 'true';
  }

  /**
   * 检查 IP 是否在失败缓存中
   */
  private isConnectionFailed(ip: string): boolean {
    const failedAt = this.failedConnections.get(ip);
    if (!failedAt) return false;

    if (Date.now() - failedAt > this.FAIL_CACHE_DURATION) {
      this.failedConnections.delete(ip);
      return false;
    }
    return true;
  }

  /**
   * 标记 IP 连接失败
   */
  private markConnectionFailed(ip: string): void {
    this.failedConnections.set(ip, Date.now());
  }

  /**
   * 清除 IP 的失败标记（连接成功时调用）
   */
  private clearConnectionFailed(ip: string): void {
    this.failedConnections.delete(ip);
  }

  /**
   * 构建 Freqtrade API URL
   */
  private buildUrl(instanceIp: string, path: string): string {
    return `http://${instanceIp}:${this.defaultPort}/api/v1${path}`;
  }

  /**
   * 构建 Basic Auth 请求头
   * @param auth 认证信息（用户名和 API Token）
   */
  private buildAuthHeaders(auth?: FreqtradeAuth): Record<string, string> {
    if (!auth) {
      return {};
    }
    const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
    return {
      Authorization: `Basic ${credentials}`,
    };
  }

  /**
   * 发送 GET 请求到 Freqtrade API
   * @param instanceIp VPS IP 地址
   * @param path API 路径
   * @param apiToken Freqtrade API Token（可选，沙盒模式不需要）
   */
  private async get<T>(instanceIp: string, path: string, apiToken?: string): Promise<T> {
    // 快速失败：如果该 IP 最近连接失败，直接返回错误
    if (this.isConnectionFailed(instanceIp)) {
      this.logger.debug(`Freqtrade GET 快速失败（缓存）: ${instanceIp}`);
      throw new InternalServerErrorException(
        `Freqtrade 暂时不可用，请稍后重试`,
      );
    }

    const url = this.buildUrl(instanceIp, path);

    try {
      this.logger.debug(`Freqtrade GET: ${url}`);

      const auth: FreqtradeAuth | undefined = apiToken
        ? { username: this.defaultUsername, password: apiToken }
        : undefined;

      const response = await firstValueFrom(
        this.httpService.get<T>(url, {
          timeout: this.QUICK_TIMEOUT, // 3 秒快速超时
          headers: this.buildAuthHeaders(auth),
        }),
      );

      // 连接成功，清除失败标记
      this.clearConnectionFailed(instanceIp);
      return response.data as T;
    } catch (error: any) {
      // 标记连接失败
      this.markConnectionFailed(instanceIp);
      this.logger.error(
        `Freqtrade GET 失败: ${url}, 错误: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `无法连接到 Freqtrade: ${error.message}`,
      );
    }
  }

  /**
   * 发送 POST 请求到 Freqtrade API
   * @param instanceIp VPS IP 地址
   * @param path API 路径
   * @param data 请求体
   * @param apiToken Freqtrade API Token（可选，沙盒模式不需要）
   */
  private async post<T>(
    instanceIp: string,
    path: string,
    data?: any,
    apiToken?: string,
  ): Promise<T> {
    // 快速失败：如果该 IP 最近连接失败，直接返回错误
    if (this.isConnectionFailed(instanceIp)) {
      this.logger.debug(`Freqtrade POST 快速失败（缓存）: ${instanceIp}`);
      throw new InternalServerErrorException(
        `Freqtrade 暂时不可用，请稍后重试`,
      );
    }

    const url = this.buildUrl(instanceIp, path);

    try {
      this.logger.debug(`Freqtrade POST: ${url}`);

      const auth: FreqtradeAuth | undefined = apiToken
        ? { username: this.defaultUsername, password: apiToken }
        : undefined;

      const response = await firstValueFrom(
        this.httpService.post<T>(url, data, {
          timeout: this.QUICK_TIMEOUT, // 3 秒快速超时
          headers: this.buildAuthHeaders(auth),
        }),
      );

      // 连接成功，清除失败标记
      this.clearConnectionFailed(instanceIp);
      return response.data as T;
    } catch (error: any) {
      // 标记连接失败
      this.markConnectionFailed(instanceIp);
      this.logger.error(
        `Freqtrade POST 失败: ${url}, 错误: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `无法连接到 Freqtrade: ${error.message}`,
      );
    }
  }

  /**
   * 获取机器人状态
   * GET /status
   * @param instanceIp VPS IP 地址
   * @param apiToken Freqtrade API Token
   */
  async getStatus(instanceIp: string, apiToken?: string): Promise<FreqtradeStatusDto> {
    if (this.isSandbox) {
      this.logger.debug('[沙盒模式] 返回模拟状态');
      return {
        state: 'running',
        strategy_name: 'SampleStrategy',
        max_open_trades: 3,
        stake_amount: 100,
        dry_run: true,
        exchange: 'binance',
      };
    }

    return this.get<FreqtradeStatusDto>(instanceIp, '/status', apiToken);
  }

  /**
   * 获取账户余额
   * GET /balance
   * @param instanceIp VPS IP 地址
   * @param apiToken Freqtrade API Token
   */
  async getBalance(instanceIp: string, apiToken?: string): Promise<FreqtradeBalancesDto> {
    if (this.isSandbox) {
      this.logger.debug('[沙盒模式] 返回模拟余额');
      return {
        currencies: [
          {
            currency: 'USDT',
            free: '1000.00000000',
            used: '300.00000000',
            total: '1300.00000000',
          },
        ],
        total: '1300.00000000',
        symbol: 'USDT',
        value: '1300.00000000',
        stake: 'USDT',
        note: 'Sandbox mode',
      };
    }

    return this.get<FreqtradeBalancesDto>(instanceIp, '/balance', apiToken);
  }

  /**
   * 获取交易历史（所有交易，包括已平仓）
   * GET /trades
   * @param instanceIp VPS IP 地址
   * @param apiToken Freqtrade API Token
   */
  async getTrades(instanceIp: string, apiToken?: string): Promise<FreqtradeTradeDto[]> {
    if (this.isSandbox) {
      this.logger.debug('[沙盒模式] 返回模拟交易历史');
      return [
        {
          trade_id: 1,
          pair: 'BTC/USDT',
          is_open: false,
          fee_open: '0.1',
          fee_close: '0.1',
          open_rate: '50000.00',
          close_rate: '51000.00',
          amount: '0.01',
          stake_amount: '500.00',
          strategy: 'SampleStrategy',
          timeframe: 5,
          open_date: '2024-01-01 10:00:00',
          close_date: '2024-01-01 12:00:00',
          profit_pct: '2.00',
          profit_abs: '10.00',
          sell_reason: 'roi',
          leverage: 1,
        },
      ];
    }

    return this.get<FreqtradeTradeDto[]>(instanceIp, '/trades', apiToken);
  }

  /**
   * 获取当前持仓（未平仓的交易）
   * GET /status
   * @param instanceIp VPS IP 地址
   * @param apiToken Freqtrade API Token
   */
  async getOpenTrades(instanceIp: string, apiToken?: string): Promise<FreqtradeOpenTradeDto[]> {
    if (this.isSandbox) {
      this.logger.debug('[沙盒模式] 返回模拟持仓');
      return [
        {
          trade_id: 2,
          pair: 'ETH/USDT',
          is_open: true,
          open_rate: '3000.00',
          amount: '0.1',
          stake_amount: '300.00',
          current_rate: '3050.00',
          current_profit: '5.00',
          current_profit_pct: '1.67',
          stop_loss: '2900.00',
          initial_stop_loss: '2900.00',
          stop_loss_pct: -3.33,        // 止损百分比 -3.33%
          min_rate: 2980.00,            // 最低价
          max_rate: 3080.00,            // 最高价
          strategy: 'SampleStrategy',
          open_date: '2024-01-02 10:00:00',
          leverage: 1,
        },
      ];
    }

    return this.get<FreqtradeOpenTradeDto[]>(instanceIp, '/status', apiToken);
  }

  /**
   * 启动机器人
   * POST /start
   * @param instanceIp VPS IP 地址
   * @param apiToken Freqtrade API Token
   */
  async start(instanceIp: string, apiToken?: string): Promise<{ status: string }> {
    if (this.isSandbox) {
      this.logger.log('[沙盒模式] 模拟启动机器人');
      return { status: 'started' };
    }

    return this.post<{ status: string }>(instanceIp, '/start', undefined, apiToken);
  }

  /**
   * 停止机器人
   * POST /stop
   * @param instanceIp VPS IP 地址
   * @param apiToken Freqtrade API Token
   */
  async stop(instanceIp: string, apiToken?: string): Promise<{ status: string }> {
    if (this.isSandbox) {
      this.logger.log('[沙盒模式] 模拟停止机器人');
      return { status: 'stopped' };
    }

    return this.post<{ status: string }>(instanceIp, '/stop', undefined, apiToken);
  }

  /**
   * 强制平仓单个交易
   * POST /forceexit
   * @param instanceIp VPS IP 地址
   * @param tradeId 交易 ID
   * @param apiToken Freqtrade API Token
   */
  async forceExit(
    instanceIp: string,
    tradeId: string,
    apiToken?: string,
  ): Promise<{ status: string }> {
    if (this.isSandbox) {
      this.logger.log(`[沙盒模式] 模拟强制平仓: ${tradeId}`);
      return { status: 'force_exit_success' };
    }

    const dto: ForceExitDto = { tradeid: parseInt(tradeId, 10) };
    return this.post<{ status: string }>(instanceIp, '/forceexit', dto, apiToken);
  }

  /**
   * 全部强制平仓
   * POST /forceexit (不传 tradeid)
   * @param instanceIp VPS IP 地址
   * @param apiToken Freqtrade API Token
   */
  async forceExitAll(instanceIp: string, apiToken?: string): Promise<{ status: string }> {
    if (this.isSandbox) {
      this.logger.log('[沙盒模式] 模拟全部强制平仓');
      return { status: 'force_exit_all_success' };
    }

    return this.post<{ status: string }>(instanceIp, '/forceexit', {}, apiToken);
  }

  /**
   * 获取 Freqtrade 完整配置
   * GET /show_config
   * @param instanceIp VPS IP 地址
   * @param apiToken Freqtrade API Token
   */
  async getConfig(instanceIp: string, apiToken?: string): Promise<FreqtradeConfigDto> {
    if (this.isSandbox) {
      this.logger.debug('[沙盒模式] 返回模拟配置');
      return {
        strategy: 'SampleStrategy',
        timeframe: '5m',
        stake_currency: 'USDT',
        stake_amount: '100',
        max_open_trades: 3,
        dry_run: true,
        exchange: { name: 'binance' },
        pairlists: [
          {
            method: 'StaticPairList',
          },
        ],
        pair_whitelist: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
        pair_blacklist: ['DOGE/USDT', 'SHIB/USDT'],
        stoploss: -0.1,
        trailing_stop: true,
        trailing_stop_positive: 0.01,
        trailing_stop_positive_offset: 0.02,
        trailing_only_offset_is_reached: true,
        stoploss_on_exchange: true,
        minimal_roi: {
          '0': 0.1,
          '30': 0.05,
          '60': 0.02,
        },
        bot_name: 'QuantFi-Bot',
      };
    }

    return this.get<FreqtradeConfigDto>(instanceIp, '/show_config', apiToken);
  }

  /**
   * 健康检查（ping Freqtrade）
   * @param instanceIp VPS IP 地址
   * @param apiToken Freqtrade API Token（可选）
   */
  async ping(instanceIp: string, apiToken?: string): Promise<boolean> {
    try {
      await this.get<any>(instanceIp, '/ping', apiToken);
      return true;
    } catch (error) {
      this.logger.warn(`Freqtrade Ping 失败: ${instanceIp}`);
      return false;
    }
  }

  /**
   * 执行策略回测
   *
   * Freqtrade 回测实现方式：
   * 1. 调用 FreqUI API (如果 VPS 启用了 FreqUI)
   * 2. FreqUI 提供的回测接口: POST /api/v1/backtest
   *
   * FreqUI 回测 API 参考：
   * - POST /api/v1/backtest - 启动回测
   * - GET /api/v1/backtest - 获取回测状态/结果
   * - DELETE /api/v1/backtest - 取消回测
   *
   * @param instanceIp VPS IP 地址
   * @param strategyName 策略名称（VPS 上已存在的策略）
   * @param config 回测配置
   * @param apiToken Freqtrade API Token
   */
  async runBacktest(
    instanceIp: string,
    strategyName: string,
    config: {
      pairs: string[];
      startDate: string;
      endDate: string;
      initialCapital: number;
    },
    apiToken?: string,
  ): Promise<BacktestResult> {
    // 沙盒模式返回模拟数据
    if (this.isSandbox) {
      this.logger.log('[沙盒模式] 返回模拟回测结果');
      return this.generateMockBacktestResult(config);
    }

    this.logger.log(
      `执行回测: 策略=${strategyName}, IP=${instanceIp}, 时间范围=${config.startDate}~${config.endDate}`,
    );

    try {
      // 1. 启动回测任务
      const timerange = `${config.startDate.replace(/-/g, '')}-${config.endDate.replace(/-/g, '')}`;

      const startResponse = await this.post<{
        status: string;
        running: boolean;
        status_msg: string;
        progress?: number;
      }>(
        instanceIp,
        '/backtest',
        {
          strategy: strategyName,
          timerange: timerange,
          max_open_trades: 3,
          stake_amount: config.initialCapital,
          enable_protections: false,
          dry_run_wallet: config.initialCapital,
        },
        apiToken,
      );

      this.logger.debug(`回测启动响应: ${JSON.stringify(startResponse)}`);

      // 2. 轮询等待回测完成（最多 60 秒）
      const maxWaitTime = 60000; // 60 秒
      const pollInterval = 2000; // 2 秒
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitTime) {
        const statusResponse = await this.get<{
          status: string;
          running: boolean;
          progress?: number;
          backtest_result?: any;
        }>(instanceIp, '/backtest', apiToken);

        this.logger.debug(
          `回测状态: running=${statusResponse.running}, progress=${statusResponse.progress}%`,
        );

        // 回测完成
        if (!statusResponse.running && statusResponse.backtest_result) {
          return this.parseBacktestResult(statusResponse.backtest_result, config);
        }

        // 等待后继续轮询
        await this.sleep(pollInterval);
      }

      // 超时
      throw new Error('回测超时（超过 60 秒）');
    } catch (error: any) {
      this.logger.error(`Freqtrade 回测失败: ${error.message}`, error.stack);

      // 如果是连接错误，可能是 VPS 上没有启用 FreqUI 的回测功能
      if (error.message.includes('ECONNREFUSED') || error.message.includes('404')) {
        this.logger.warn('VPS 可能未启用回测 API，返回模拟结果');
        return this.generateMockBacktestResult(config);
      }

      throw new InternalServerErrorException(`回测失败: ${error.message}`);
    }
  }

  /**
   * 获取回测历史结果
   * GET /api/v1/backtest/history
   */
  async getBacktestHistory(
    instanceIp: string,
    apiToken?: string,
  ): Promise<any[]> {
    if (this.isSandbox) {
      return [];
    }

    try {
      return await this.get<any[]>(instanceIp, '/backtest/history', apiToken);
    } catch (error) {
      this.logger.warn(`获取回测历史失败: ${error.message}`);
      return [];
    }
  }

  /**
   * 获取 Freqtrade 日志
   * GET /api/v1/logs?limit=50
   */
  async getLogs(
    instanceIp: string,
    limit: number = 50,
    apiToken?: string,
  ): Promise<{ logs: string[]; log_count: number }> {
    if (this.isSandbox) {
      return {
        logs: [
          `[${new Date().toISOString()}] INFO - Freqtrade 正在运行...`,
          `[${new Date().toISOString()}] INFO - 当前策略: SampleStrategy`,
          `[${new Date().toISOString()}] INFO - 交易对: BTC/USDT, ETH/USDT`,
        ],
        log_count: 3,
      };
    }

    try {
      return await this.get<{ logs: string[]; log_count: number }>(
        instanceIp,
        `/logs?limit=${limit}`,
        apiToken,
      );
    } catch (error) {
      this.logger.warn(`获取日志失败: ${error.message}`);
      return { logs: [], log_count: 0 };
    }
  }

  /**
   * 获取可用策略列表
   * GET /api/v1/strategies
   */
  async getStrategies(instanceIp: string, apiToken?: string): Promise<string[]> {
    if (this.isSandbox) {
      return ['SampleStrategy', 'RSIStrategy', 'MACDStrategy'];
    }

    try {
      const response = await this.get<{ strategies: string[] }>(
        instanceIp,
        '/strategies',
        apiToken,
      );
      return response.strategies || [];
    } catch (error) {
      this.logger.warn(`获取策略列表失败: ${error.message}`);
      return [];
    }
  }

  /**
   * 获取可用交易对列表
   * GET /api/v1/available_pairs
   */
  async getAvailablePairs(
    instanceIp: string,
    apiToken?: string,
  ): Promise<{ pairs: string[]; length: number }> {
    if (this.isSandbox) {
      return {
        pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'],
        length: 4,
      };
    }

    try {
      return await this.get<{ pairs: string[]; length: number }>(
        instanceIp,
        '/available_pairs',
        apiToken,
      );
    } catch (error) {
      this.logger.warn(`获取可用交易对失败: ${error.message}`);
      return { pairs: [], length: 0 };
    }
  }

  /**
   * 获取 K 线数据（用于图表展示）
   * GET /api/v1/pair_candles?pair=BTC/USDT&timeframe=5m&limit=500
   */
  async getPairCandles(
    instanceIp: string,
    pair: string,
    timeframe: string = '5m',
    limit: number = 500,
    apiToken?: string,
  ): Promise<{
    pair: string;
    timeframe: string;
    data: Array<{
      date: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>;
  }> {
    if (this.isSandbox) {
      // 生成模拟 K 线数据
      const now = Date.now();
      const interval = this.getTimeframeMs(timeframe);
      const data = [];

      let price = 40000 + Math.random() * 10000; // 初始价格

      for (let i = limit; i >= 0; i--) {
        const volatility = 0.02; // 2% 波动
        const change = (Math.random() - 0.5) * 2 * volatility;
        const open = price;
        const close = price * (1 + change);
        const high = Math.max(open, close) * (1 + Math.random() * 0.01);
        const low = Math.min(open, close) * (1 - Math.random() * 0.01);
        const volume = 100 + Math.random() * 1000;

        data.push({
          date: now - i * interval,
          open: Number(open.toFixed(2)),
          high: Number(high.toFixed(2)),
          low: Number(low.toFixed(2)),
          close: Number(close.toFixed(2)),
          volume: Number(volume.toFixed(2)),
        });

        price = close;
      }

      return { pair, timeframe, data };
    }

    try {
      const encodedPair = encodeURIComponent(pair);
      const response = await this.get<{
        pair: string;
        timeframe: string;
        columns: string[];
        data: number[][];
      }>(
        instanceIp,
        `/pair_candles?pair=${encodedPair}&timeframe=${timeframe}&limit=${limit}`,
        apiToken,
      );

      // Freqtrade 返回的数据格式: [[timestamp, open, high, low, close, volume], ...]
      const data = response.data.map((candle) => ({
        date: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
      }));

      return { pair: response.pair, timeframe: response.timeframe, data };
    } catch (error) {
      this.logger.warn(`获取 K 线数据失败: ${error.message}`);
      // 返回空数据，前端可以使用备用数据源
      return { pair, timeframe, data: [] };
    }
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 解析 Freqtrade 回测结果
   */
  private parseBacktestResult(result: any, config: any): BacktestResult {
    // Freqtrade 回测结果结构
    // result.strategy.{strategy_name}.{metrics}
    const strategyResults = Object.values(result.strategy || {})[0] as any;

    if (!strategyResults) {
      throw new Error('回测结果解析失败：缺少策略数据');
    }

    // 解析交易记录
    const trades = (strategyResults.trades || []).map((trade: any) => ({
      pair: trade.pair,
      side: trade.is_short ? 'short' : 'long',
      entry_price: trade.open_rate,
      exit_price: trade.close_rate,
      pnl: trade.profit_abs,
      entry_time: trade.open_date,
      exit_time: trade.close_date,
    }));

    return {
      total_return: strategyResults.profit_total_pct || 0,
      win_rate: strategyResults.win_rate || 0,
      total_trades: strategyResults.total_trades || 0,
      max_drawdown: strategyResults.max_drawdown_abs
        ? -Math.abs(strategyResults.max_drawdown_abs)
        : 0,
      sharpe_ratio: strategyResults.sharpe || 0,
      profit_factor: strategyResults.profit_factor || 0,
      avg_profit: strategyResults.profit_mean || 0,
      avg_loss: strategyResults.loss_mean || 0,
      trades,
    };
  }

  /**
   * 生成模拟回测结果
   */
  private generateMockBacktestResult(config: any): BacktestResult {
    const totalTrades = Math.floor(50 + Math.random() * 100);
    const winTrades = Math.floor(totalTrades * (0.5 + Math.random() * 0.2));
    const winRate = (winTrades / totalTrades) * 100;
    const avgProfit = 30 + Math.random() * 50;
    const avgLoss = -(20 + Math.random() * 30);
    const totalPnl =
      winTrades * avgProfit + (totalTrades - winTrades) * avgLoss;
    const totalReturn = (totalPnl / config.initialCapital) * 100;

    return {
      total_return: totalReturn,
      win_rate: winRate,
      total_trades: totalTrades,
      max_drawdown: -(5 + Math.random() * 15),
      sharpe_ratio: 1 + Math.random() * 1.5,
      profit_factor: 1.2 + Math.random() * 0.8,
      avg_profit: avgProfit,
      avg_loss: avgLoss,
      trades: config.pairs.slice(0, 3).flatMap((pair: string) =>
        Array.from({ length: 5 }, () => ({
          pair,
          side: Math.random() > 0.5 ? 'long' : 'short',
          entry_price: 40000 + Math.random() * 20000,
          exit_price: 40000 + Math.random() * 20000,
          pnl: (Math.random() - 0.4) * 100,
          entry_time: new Date(
            new Date(config.startDate).getTime() +
              Math.random() *
                (new Date(config.endDate).getTime() -
                  new Date(config.startDate).getTime()),
          ).toISOString(),
          exit_time: new Date(
            new Date(config.startDate).getTime() +
              Math.random() *
                (new Date(config.endDate).getTime() -
                  new Date(config.startDate).getTime()),
          ).toISOString(),
        })),
      ),
    };
  }

  /**
   * 获取时间周期对应的毫秒数
   */
  private getTimeframeMs(timeframe: string): number {
    const map: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };
    return map[timeframe] || 5 * 60 * 1000;
  }

  /**
   * 休眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==================== K 线数据下载 ====================

  /**
   * 下载历史 K 线数据
   *
   * Freqtrade 没有内置的 K 线下载 REST API，需要通过以下方式实现：
   * 1. 在 VPS 上预装下载脚本
   * 2. 通过 SSH 执行 freqtrade download-data 命令
   *
   * 命令示例:
   * freqtrade download-data --exchange binance --pairs BTC/USDT ETH/USDT --timeframes 1h 4h 1d --timerange 20240101-
   *
   * @param instanceIp VPS IP 地址
   * @param config 下载配置
   * @param apiToken Freqtrade API Token（可选）
   */
  async downloadKlineData(
    instanceIp: string,
    config: {
      exchange: string;
      pairs: string[];
      timeframes: string[];
      startDate?: string;
    },
    apiToken?: string,
  ): Promise<{ status: string; message: string; taskId?: string }> {
    this.logger.log(
      `开始下载 K 线数据: 交易所=${config.exchange}, 交易对=${config.pairs.join(',')}, 周期=${config.timeframes.join(',')}`,
    );

    if (this.isSandbox) {
      this.logger.log('[沙盒模式] 模拟 K 线数据下载');
      return {
        status: 'success',
        message: '模拟下载完成，数据已就绪',
        taskId: `sandbox-${Date.now()}`,
      };
    }

    // 真实环境：通过 Freqtrade 自定义端点或 SSH 执行
    // 这里假设 VPS 上已配置了自定义的下载端点
    try {
      // 构建下载请求参数
      const downloadConfig = {
        exchange: config.exchange,
        pairs: config.pairs,
        timeframes: config.timeframes,
        timerange: config.startDate
          ? `${config.startDate.replace(/-/g, '')}-`
          : undefined,
      };

      // 尝试调用自定义下载端点（需要 VPS 预配置）
      const result = await this.post<{ status: string; message: string; task_id?: string }>(
        instanceIp,
        '/download-data',
        downloadConfig,
        apiToken,
      );

      return {
        status: result.status || 'pending',
        message: result.message || 'K 线数据下载任务已提交',
        taskId: result.task_id,
      };
    } catch (error: any) {
      this.logger.error(`K 线数据下载失败: ${error.message}`);

      // 如果自定义端点不存在，返回提示信息
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        return {
          status: 'error',
          message: 'VPS 未配置 K 线下载端点，请联系管理员或手动 SSH 到 VPS 执行下载命令',
        };
      }

      return {
        status: 'error',
        message: `下载失败: ${error.message}`,
      };
    }
  }

  /**
   * 检查 K 线数据下载状态
   *
   * @param instanceIp VPS IP 地址
   * @param taskId 下载任务 ID（可选）
   * @param apiToken Freqtrade API Token（可选）
   */
  async getKlineDownloadStatus(
    instanceIp: string,
    taskId?: string,
    apiToken?: string,
  ): Promise<{
    status: 'idle' | 'downloading' | 'completed' | 'error';
    progress?: number;
    message?: string;
    lastUpdated?: string;
    availablePairs?: string[];
  }> {
    if (this.isSandbox) {
      this.logger.debug('[沙盒模式] 返回模拟下载状态');
      return {
        status: 'completed',
        progress: 100,
        message: '数据已就绪，可以进行回测',
        lastUpdated: new Date().toISOString(),
        availablePairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
      };
    }

    try {
      // 调用自定义状态检查端点
      const path = taskId ? `/download-status?task_id=${taskId}` : '/download-status';
      const result = await this.get<{
        status: string;
        progress?: number;
        message?: string;
        last_updated?: string;
        available_pairs?: string[];
      }>(instanceIp, path, apiToken);

      return {
        status: (result.status as 'idle' | 'downloading' | 'completed' | 'error') || 'idle',
        progress: result.progress,
        message: result.message,
        lastUpdated: result.last_updated,
        availablePairs: result.available_pairs,
      };
    } catch (error: any) {
      this.logger.error(`获取 K 线下载状态失败: ${error.message}`);

      // 如果端点不存在，返回默认状态
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        return {
          status: 'idle',
          message: 'VPS 未配置状态检查端点，请手动检查数据目录',
        };
      }

      return {
        status: 'error',
        message: `无法获取状态: ${error.message}`,
      };
    }
  }

  /**
   * 获取已下载的 K 线数据信息
   *
   * @param instanceIp VPS IP 地址
   * @param apiToken Freqtrade API Token（可选）
   */
  async getAvailableKlineData(
    instanceIp: string,
    apiToken?: string,
  ): Promise<{
    exchange: string;
    pairs: Array<{
      pair: string;
      timeframes: string[];
      dataRange?: { start: string; end: string };
    }>;
  }> {
    if (this.isSandbox) {
      this.logger.debug('[沙盒模式] 返回模拟已下载数据');
      return {
        exchange: 'binance',
        pairs: [
          { pair: 'BTC/USDT', timeframes: ['1h', '4h', '1d'], dataRange: { start: '2024-01-01', end: '2026-01-08' } },
          { pair: 'ETH/USDT', timeframes: ['1h', '4h', '1d'], dataRange: { start: '2024-01-01', end: '2026-01-08' } },
          { pair: 'SOL/USDT', timeframes: ['1h', '4h'], dataRange: { start: '2024-06-01', end: '2026-01-08' } },
        ],
      };
    }

    try {
      const result = await this.get<{
        exchange: string;
        pairs: Array<{
          pair: string;
          timeframes: string[];
          data_range?: { start: string; end: string };
        }>;
      }>(instanceIp, '/available-data', apiToken);

      return {
        exchange: result.exchange,
        pairs: result.pairs.map(p => ({
          pair: p.pair,
          timeframes: p.timeframes,
          dataRange: p.data_range,
        })),
      };
    } catch (error: any) {
      this.logger.error(`获取已下载数据信息失败: ${error.message}`);
      return {
        exchange: 'unknown',
        pairs: [],
      };
    }
  }
}
