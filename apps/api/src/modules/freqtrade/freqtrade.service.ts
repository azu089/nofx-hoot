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

/**
 * Freqtrade 认证信息接口
 */
interface FreqtradeAuth {
  username: string;
  password: string; // Freqtrade API Token
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

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.isSandbox = this.configService.get('SANDBOX_MODE') === 'true';
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
    const url = this.buildUrl(instanceIp, path);

    try {
      this.logger.debug(`Freqtrade GET: ${url}`);

      const auth: FreqtradeAuth | undefined = apiToken
        ? { username: this.defaultUsername, password: apiToken }
        : undefined;

      const response = await firstValueFrom(
        this.httpService.get<T>(url, {
          timeout: 10000, // 10 秒超时
          headers: this.buildAuthHeaders(auth),
        }),
      );

      return response.data as T;
    } catch (error: any) {
      this.logger.error(
        `Freqtrade GET 失败: ${url}, 错误: ${error.message}`,
        error.stack,
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
    const url = this.buildUrl(instanceIp, path);

    try {
      this.logger.debug(`Freqtrade POST: ${url}`);

      const auth: FreqtradeAuth | undefined = apiToken
        ? { username: this.defaultUsername, password: apiToken }
        : undefined;

      const response = await firstValueFrom(
        this.httpService.post<T>(url, data, {
          timeout: 10000,
          headers: this.buildAuthHeaders(auth),
        }),
      );

      return response.data as T;
    } catch (error: any) {
      this.logger.error(
        `Freqtrade POST 失败: ${url}, 错误: ${error.message}`,
        error.stack,
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
}
