import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { FreqtradeService } from '../freqtrade/freqtrade.service';
import { ConfigService } from '@nestjs/config';
import Decimal from 'decimal.js';

/**
 * Freqtrade 配置接口
 * 对应 Freqtrade 的 config.json 格式
 */
export interface FreqtradeConfig {
  // 核心配置
  max_open_trades: number;
  stake_currency: string;
  stake_amount: number | 'unlimited';
  tradable_balance_ratio: number;
  fiat_display_currency: string;
  dry_run: boolean;
  dry_run_wallet: number;

  // 策略配置
  strategy: string;
  timeframe: string;

  // 风控配置
  stoploss: number;
  minimal_roi: Record<string, number>;
  trailing_stop: boolean;
  trailing_stop_positive?: number;
  trailing_stop_positive_offset?: number;
  trailing_only_offset_is_reached?: boolean;
  stoploss_on_exchange?: boolean; // 交易所止损

  // 杠杆配置（合约）
  trading_mode?: 'spot' | 'futures';
  margin_mode?: 'isolated' | 'cross';
  leverage?: number;

  // 交易所配置
  exchange: {
    name: string;
    key: string;
    secret: string;
    ccxt_config?: Record<string, any>;
    ccxt_sync_config?: Record<string, any>;
    ccxt_async_config?: Record<string, any>;
    pair_whitelist: string[];
    pair_blacklist: string[];
  };

  // API 服务配置
  api_server?: {
    enabled: boolean;
    listen_ip_address: string;
    listen_port: number;
    verbosity: string;
    jwt_secret_key: string;
    CORS_origins: string[];
    username: string;
    password: string;
  };

  // 其他配置
  bot_name?: string;
  initial_state?: 'running' | 'stopped';
  force_entry_enable?: boolean;
  internals?: {
    process_throttle_secs?: number;
  };
}

/**
 * 支持的交易所枚举
 */
export type SupportedExchange = 'binance' | 'okx' | 'bybit';

/**
 * 交易所配置
 */
const EXCHANGE_CONFIGS: Record<SupportedExchange, { name: string; ccxtName: string }> = {
  binance: { name: 'Binance', ccxtName: 'binance' },
  okx: { name: 'OKX', ccxtName: 'okx' },
  bybit: { name: 'Bybit', ccxtName: 'bybit' },
};

/**
 * 策略部署服务
 * 负责将用户配置的策略部署到 VPS Freqtrade
 *
 * 部署流程：
 * 1. 验证用户配置和 VPS 状态
 * 2. 生成 Freqtrade config.json
 * 3. 通过 HTTP API 上传策略代码和配置
 * 4. 重启 Freqtrade 服务
 * 5. 更新数据库状态
 */
@Injectable()
export class StrategyDeployService {
  private readonly logger = new Logger(StrategyDeployService.name);
  private readonly isSandbox: boolean;
  private readonly freqtradePort = 8080;

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly freqtradeService: FreqtradeService,
    private readonly configService: ConfigService,
  ) {
    this.isSandbox = this.configService.get('SANDBOX_MODE') === 'true';
  }

  /**
   * 部署策略到 VPS
   * @param userId 用户 ID
   * @param configId 用户策略配置 ID
   * @returns 部署结果
   */
  async deployStrategy(userId: string, configId: string): Promise<{
    success: boolean;
    message: string;
    instanceId?: string;
    strategy?: string;
  }> {
    this.logger.log(`开始部署策略: userId=${userId}, configId=${configId}`);

    // 1. 获取用户策略配置
    const userConfig = await this.prisma.client.user_strategy_configs.findFirst({
      where: {
        id: configId,
        user_id: userId,
      },
      include: {
        strategies: true,
        instances: true,
      },
    });

    if (!userConfig) {
      throw new NotFoundException('策略配置不存在');
    }

    // 2. 检查是否绑定了 VPS 实例
    if (!userConfig.instance_id) {
      throw new BadRequestException('请先绑定 VPS 实例');
    }

    const instance = userConfig.instances;
    if (!instance) {
      throw new NotFoundException('VPS 实例不存在');
    }

    if (instance.status !== 'running' && instance.status !== 'stopped') {
      throw new BadRequestException(`VPS 实例状态异常: ${instance.status}`);
    }

    if (!instance.ip_address) {
      throw new BadRequestException('VPS 实例没有 IP 地址');
    }

    // 3. 获取用户的 API Key
    const apiKey = await this.prisma.client.api_keys.findFirst({
      where: {
        user_id: userId,
        is_active: true,
      },
    });

    if (!apiKey) {
      throw new BadRequestException('请先绑定交易所 API Key');
    }

    // 4. 获取策略代码
    const strategy = userConfig.strategies;
    if (!strategy || !strategy.content) {
      throw new BadRequestException('策略代码不存在');
    }

    // 5. 生成 Freqtrade 配置
    const freqtradeConfig = this.generateFreqtradeConfig(
      userConfig,
      apiKey,
      strategy.name,
    );

    // 6. 部署到 VPS
    if (this.isSandbox) {
      this.logger.log('[沙盒模式] 模拟部署成功');
    } else {
      await this.uploadStrategyToVps(
        instance.ip_address,
        strategy.name,
        strategy.content,
        freqtradeConfig,
      );
    }

    // 7. 更新配置状态
    await this.prisma.client.user_strategy_configs.update({
      where: { id: configId },
      data: {
        is_active: true,
        updated_at: new Date(),
      },
    });

    this.logger.log(`策略部署成功: configId=${configId}, instance=${instance.id}`);

    return {
      success: true,
      message: '策略部署成功',
      instanceId: instance.id,
      strategy: strategy.name,
    };
  }

  /**
   * 生成 Freqtrade 配置
   * @param userConfig 用户策略配置
   * @param apiKey API Key 记录
   * @param strategyName 策略名称
   * @returns Freqtrade 配置对象
   */
  generateFreqtradeConfig(
    userConfig: any,
    apiKey: any,
    strategyName: string,
  ): FreqtradeConfig {
    // 解析自定义配置
    const customConfig = (userConfig.custom_config || {}) as Record<string, any>;

    // 解析 minimal_roi（分阶段止盈）
    // 如果用户设置了简单止盈 (take_profit)，转换为 minimal_roi
    const minimalRoi = this.parseMinimalRoiWithTakeProfit(
      customConfig.minimal_roi,
      customConfig.take_profit,
    );

    // 获取交易所名称
    const exchangeName = (apiKey.exchange || 'binance').toLowerCase() as SupportedExchange;
    const exchangeConfig = EXCHANGE_CONFIGS[exchangeName] || EXCHANGE_CONFIGS.binance;

    // 解析交易对白名单
    const pairWhitelist = this.parsePairWhitelist(customConfig.pair_whitelist || []);

    // 解析黑名单
    const pairBlacklist = Array.isArray(userConfig.blacklist)
      ? userConfig.blacklist.map((s: string) => `${s}/USDT`)
      : [];

    // 获取 K 线周期
    const timeframe = customConfig.timeframe || '5m';

    // 获取交易模式
    const tradingMode = customConfig.trading_mode || 'futures';
    const marginMode = customConfig.margin_mode || 'isolated';

    // 解析追踪止损偏移量（从 custom_config 读取）
    const trailingStopOffset = customConfig.trailing_stop_offset !== undefined
      ? new Decimal(customConfig.trailing_stop_offset).toNumber()
      : undefined;

    // 解析仅偏移后触发
    const trailingOnlyOffsetReached = customConfig.trailing_only_offset_reached !== undefined
      ? customConfig.trailing_only_offset_reached
      : true;

    // 解析交易所止损
    const stoplossOnExchange = customConfig.stoploss_on_exchange === true;

    // 构建配置
    const config: FreqtradeConfig = {
      // 核心配置
      max_open_trades: userConfig.max_open_trades || 3,
      stake_currency: 'USDT',
      stake_amount: userConfig.stake_amount
        ? new Decimal(userConfig.stake_amount).toNumber()
        : 100,
      tradable_balance_ratio: 0.99,
      fiat_display_currency: 'USD',
      dry_run: customConfig.dry_run ?? false,
      dry_run_wallet: 10000,

      // 策略配置
      strategy: strategyName,
      timeframe: timeframe,

      // 风控配置
      stoploss: userConfig.stoploss
        ? new Decimal(userConfig.stoploss).toNumber()
        : -0.1,
      minimal_roi: minimalRoi,
      trailing_stop: userConfig.trailing_stop || false,
      trailing_stop_positive: userConfig.trailing_stop_positive
        ? new Decimal(userConfig.trailing_stop_positive).toNumber()
        : undefined,
      trailing_stop_positive_offset: trailingStopOffset,
      trailing_only_offset_is_reached: userConfig.trailing_stop ? trailingOnlyOffsetReached : undefined,
      stoploss_on_exchange: stoplossOnExchange,

      // 杠杆配置
      trading_mode: tradingMode,
      margin_mode: marginMode,
      leverage: userConfig.leverage || 1,

      // 交易所配置
      exchange: {
        name: exchangeConfig.ccxtName,
        key: '{{API_KEY}}', // 占位符，实际部署时替换
        secret: '{{API_SECRET}}', // 占位符，实际部署时替换
        ccxt_config: {
          enableRateLimit: true,
        },
        ccxt_async_config: {
          enableRateLimit: true,
        },
        pair_whitelist: pairWhitelist,
        pair_blacklist: pairBlacklist,
      },

      // API 服务配置
      api_server: {
        enabled: true,
        listen_ip_address: '0.0.0.0',
        listen_port: this.freqtradePort,
        verbosity: 'error',
        jwt_secret_key: '{{JWT_SECRET}}', // 占位符
        CORS_origins: ['*'],
        username: 'quantfi',
        password: '{{FREQTRADE_API_TOKEN}}', // 占位符
      },

      // 其他配置
      bot_name: `quantfi_${strategyName}`,
      initial_state: 'stopped',
      force_entry_enable: false,
      internals: {
        process_throttle_secs: 5,
      },
    };

    this.logger.debug(`生成 Freqtrade 配置: stoploss=${config.stoploss}, trailing_stop=${config.trailing_stop}, stoploss_on_exchange=${config.stoploss_on_exchange}`);

    return config;
  }

  /**
   * 解析 minimal_roi（分阶段止盈），支持简单止盈转换
   * @param minimalRoi 用户配置的分阶段止盈
   * @param takeProfit 用户配置的简单止盈（百分比小数，如 0.1 = 10%）
   * @returns Freqtrade 格式的 minimal_roi
   */
  private parseMinimalRoiWithTakeProfit(
    minimalRoi: any,
    takeProfit?: number,
  ): Record<string, number> {
    // 如果有分阶段止盈配置，优先使用
    if (minimalRoi && typeof minimalRoi === 'object' && Object.keys(minimalRoi).length > 0) {
      return this.parseMinimalRoi(minimalRoi);
    }

    // 如果有简单止盈配置，转换为 minimal_roi
    if (takeProfit !== undefined && takeProfit > 0) {
      // 简单止盈转换：立即达到止盈目标就平仓
      // 同时设置递减止盈，持仓越久要求越低
      const tp = takeProfit; // 已经是小数形式，如 0.1 = 10%
      return {
        '0': tp,              // 立即: 目标止盈
        '60': tp * 0.7,       // 60分钟: 目标的70%
        '120': tp * 0.5,      // 120分钟: 目标的50%
        '240': tp * 0.3,      // 240分钟: 目标的30%
      };
    }

    // 默认止盈配置
    return {
      '0': 0.1,    // 立即: 10%
      '30': 0.05,  // 30分钟: 5%
      '60': 0.02,  // 60分钟: 2%
      '120': 0.01, // 120分钟: 1%
    };
  }

  /**
   * 解析 minimal_roi（分阶段止盈）
   * @param minimalRoi 用户配置的止盈
   * @returns Freqtrade 格式的 minimal_roi
   */
  private parseMinimalRoi(minimalRoi: any): Record<string, number> {
    if (!minimalRoi || typeof minimalRoi !== 'object') {
      // 默认止盈配置
      return {
        '0': 0.1,    // 立即: 10%
        '30': 0.05,  // 30分钟: 5%
        '60': 0.02,  // 60分钟: 2%
        '120': 0.01, // 120分钟: 1%
      };
    }

    // 验证并转换配置
    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(minimalRoi)) {
      const minutes = parseInt(key, 10);
      const roi = parseFloat(value as string);

      if (!isNaN(minutes) && !isNaN(roi) && minutes >= 0 && roi >= 0 && roi <= 10) {
        result[String(minutes)] = roi;
      }
    }

    // 至少有一个配置
    if (Object.keys(result).length === 0) {
      return { '0': 0.1 };
    }

    return result;
  }

  /**
   * 解析交易对白名单
   * @param whitelist 用户选择的币种
   * @returns Freqtrade 格式的交易对
   */
  private parsePairWhitelist(whitelist: string[]): string[] {
    if (!Array.isArray(whitelist) || whitelist.length === 0) {
      // 默认交易对
      return ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT'];
    }

    return whitelist.map((symbol) => {
      // 如果已经是 XXX/USDT 格式，直接返回
      if (symbol.includes('/')) {
        return symbol;
      }
      // 否则添加 /USDT 后缀
      return `${symbol}/USDT`;
    });
  }

  /**
   * 上传策略到 VPS
   * @param ip VPS IP 地址
   * @param strategyName 策略名称
   * @param strategyCode 策略代码
   * @param config Freqtrade 配置
   */
  private async uploadStrategyToVps(
    ip: string,
    strategyName: string,
    strategyCode: string,
    config: FreqtradeConfig,
  ): Promise<void> {
    const baseUrl = `http://${ip}:${this.freqtradePort}`;

    try {
      // 1. 上传策略代码
      this.logger.log(`上传策略代码: ${strategyName}`);
      await firstValueFrom(
        this.httpService.post(
          `${baseUrl}/api/v1/strategy/upload`,
          {
            name: strategyName,
            code: strategyCode,
          },
          {
            timeout: 30000,
            headers: this.getAuthHeaders(),
          },
        ),
      );

      // 2. 上传配置文件
      this.logger.log(`上传配置文件`);
      await firstValueFrom(
        this.httpService.post(
          `${baseUrl}/api/v1/config/upload`,
          { config },
          {
            timeout: 30000,
            headers: this.getAuthHeaders(),
          },
        ),
      );

      // 3. 重载配置
      this.logger.log(`重载配置`);
      await firstValueFrom(
        this.httpService.post(
          `${baseUrl}/api/v1/reload_config`,
          {},
          {
            timeout: 30000,
            headers: this.getAuthHeaders(),
          },
        ),
      );

      this.logger.log(`策略上传完成: ${strategyName}`);
    } catch (error: any) {
      this.logger.error(`策略上传失败: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`策略上传失败: ${error.message}`);
    }
  }

  /**
   * 获取 Freqtrade API 认证头
   */
  private getAuthHeaders(): Record<string, string> {
    const username = 'quantfi';
    const password = this.configService.get('FREQTRADE_API_TOKEN') || 'quantfi_token';
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');

    return {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * 停止 VPS 上的策略
   * @param userId 用户 ID
   * @param configId 配置 ID
   */
  async stopStrategy(userId: string, configId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    this.logger.log(`停止策略: userId=${userId}, configId=${configId}`);

    const userConfig = await this.prisma.client.user_strategy_configs.findFirst({
      where: {
        id: configId,
        user_id: userId,
      },
      include: {
        instances: true,
      },
    });

    if (!userConfig) {
      throw new NotFoundException('策略配置不存在');
    }

    const instance = userConfig.instances;
    if (!instance || !instance.ip_address) {
      throw new BadRequestException('VPS 实例不可用');
    }

    // 调用 Freqtrade 停止 API
    if (!this.isSandbox) {
      await this.freqtradeService.stop(instance.ip_address);
    }

    // 更新状态
    await this.prisma.client.user_strategy_configs.update({
      where: { id: configId },
      data: {
        is_active: false,
        updated_at: new Date(),
      },
    });

    this.logger.log(`策略已停止: configId=${configId}`);

    return {
      success: true,
      message: '策略已停止',
    };
  }

  /**
   * 启动 VPS 上的策略
   * @param userId 用户 ID
   * @param configId 配置 ID
   */
  async startStrategy(userId: string, configId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    this.logger.log(`启动策略: userId=${userId}, configId=${configId}`);

    const userConfig = await this.prisma.client.user_strategy_configs.findFirst({
      where: {
        id: configId,
        user_id: userId,
      },
      include: {
        instances: true,
      },
    });

    if (!userConfig) {
      throw new NotFoundException('策略配置不存在');
    }

    const instance = userConfig.instances;
    if (!instance || !instance.ip_address) {
      throw new BadRequestException('VPS 实例不可用');
    }

    if (instance.status !== 'running') {
      throw new BadRequestException(`VPS 实例未运行: ${instance.status}`);
    }

    // 调用 Freqtrade 启动 API
    if (!this.isSandbox) {
      await this.freqtradeService.start(instance.ip_address);
    }

    // 更新状态
    await this.prisma.client.user_strategy_configs.update({
      where: { id: configId },
      data: {
        is_active: true,
        updated_at: new Date(),
      },
    });

    this.logger.log(`策略已启动: configId=${configId}`);

    return {
      success: true,
      message: '策略已启动',
    };
  }

  /**
   * 获取支持的交易所列表
   */
  getSupportedExchanges(): Array<{ id: SupportedExchange; name: string }> {
    return Object.entries(EXCHANGE_CONFIGS).map(([id, config]) => ({
      id: id as SupportedExchange,
      name: config.name,
    }));
  }

  /**
   * 获取支持的 K 线周期列表
   */
  getSupportedTimeframes(): Array<{ value: string; label: string }> {
    return [
      { value: '1m', label: '1 分钟' },
      { value: '5m', label: '5 分钟' },
      { value: '15m', label: '15 分钟' },
      { value: '1h', label: '1 小时' },
      { value: '4h', label: '4 小时' },
      { value: '1d', label: '1 天' },
    ];
  }
}
