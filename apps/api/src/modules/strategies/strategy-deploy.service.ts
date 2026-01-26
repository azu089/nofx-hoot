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
import { ApiKeysService } from '../api-keys/api-keys.service';
import { NetworkWhitelistService } from '../../common/services/network-whitelist.service';
import { InstanceLogService } from '../instances/instance-log.service';
import { ConfigService } from '@nestjs/config';
import Decimal from 'decimal.js';
import * as crypto from 'crypto';

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
    private readonly apiKeysService: ApiKeysService,
    private readonly networkWhitelistService: NetworkWhitelistService,
    private readonly instanceLogService: InstanceLogService,
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

    // 3. 获取用户的 API Key（优先使用配置中指定的，否则取第一个活跃的）
    const apiKeyRecord = await this.prisma.client.api_keys.findFirst({
      where: {
        user_id: userId,
        is_active: true,
      },
    });

    if (!apiKeyRecord) {
      throw new BadRequestException('请先绑定交易所 API Key');
    }

    // 4. 解密 API Key（获取真实的 key 和 secret）
    const decryptedKeys = await this.apiKeysService.getDecryptedKeys(
      apiKeyRecord.id,
      userId,
    );

    // 5. 获取策略代码
    const strategy = userConfig.strategies;
    if (!strategy || !strategy.content) {
      throw new BadRequestException('策略代码不存在');
    }

    // 6. 生成 Freqtrade 配置（使用真实的 API Key 和 Token）
    const freqtradeConfig = this.generateFreqtradeConfig(
      userConfig,
      apiKeyRecord,
      strategy.name,
      decryptedKeys, // 传入解密后的密钥
      instance.id,   // 传入实例 ID 用于生成真实 Token
    );

    // 7. 生成实例 Token（确定性生成，用于 VPS 认证）
    const instanceToken = this.networkWhitelistService.generateInstanceToken(instance.id);

    // 8. 部署到 VPS
    if (this.isSandbox) {
      this.logger.log('[沙盒模式] 模拟部署成功');
    } else {
      try {
        await this.uploadStrategyToVps(
          instance.ip_address,
          strategy.name,
          strategy.content,
          freqtradeConfig,
          instanceToken,
        );
      } catch (error) {
        // 记录部署失败的系统日志
        await this.instanceLogService.error(
          userId,
          'deploy_fail',
          `交易机器人部署失败: ${error.message}`,
          {
            instanceId: instance.id,
            details: {
              strategyName: strategy.name,
              configId,
              error: error.message,
            },
          },
        );
        throw error; // 继续抛出异常
      }
    }

    // 9. 更新配置状态
    await this.prisma.client.user_strategy_configs.update({
      where: { id: configId },
      data: {
        is_active: true,
        updated_at: new Date(),
      },
    });

    this.logger.log(`策略部署成功: configId=${configId}, instance=${instance.id}`);

    // 10. 记录操作日志（交易日志）
    await this.instanceLogService.info(
      userId,
      'strategy_deploy',
      `策略 ${strategy.name} 部署成功`,
      {
        instanceId: instance.id,
        details: {
          strategyName: strategy.name,
          configId,
          exchange: apiKeyRecord.exchange,
        },
      },
    );

    // 11. 记录系统日志（部署成功）
    await this.instanceLogService.info(
      userId,
      'deploy_success',
      '交易机器人部署成功',
      {
        instanceId: instance.id,
        details: {
          strategyName: strategy.name,
          configId,
        },
      },
    );

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
   * @param apiKeyRecord API Key 数据库记录（包含交易所名称等）
   * @param strategyName 策略名称
   * @param decryptedKeys 解密后的 API Key（可选，如果提供则使用真实密钥）
   * @param instanceId VPS 实例 ID（用于生成真实的 API Token）
   * @returns Freqtrade 配置对象
   */
  generateFreqtradeConfig(
    userConfig: any,
    apiKeyRecord: any,
    strategyName: string,
    decryptedKeys?: { apiKey: string; secretKey: string },
    instanceId?: string,
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
    const exchangeName = (apiKeyRecord.exchange || 'binance').toLowerCase() as SupportedExchange;
    const exchangeConfig = EXCHANGE_CONFIGS[exchangeName] || EXCHANGE_CONFIGS.binance;

    // 确定使用的 API Key（真实或占位符）
    const exchangeKey = decryptedKeys?.apiKey || '{{API_KEY}}';
    const exchangeSecret = decryptedKeys?.secretKey || '{{API_SECRET}}';

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

      // 交易所配置（使用真实或占位符密钥）
      exchange: {
        name: exchangeConfig.ccxtName,
        key: exchangeKey,
        secret: exchangeSecret,
        ccxt_config: {
          enableRateLimit: true,
        },
        ccxt_async_config: {
          enableRateLimit: true,
        },
        pair_whitelist: pairWhitelist,
        pair_blacklist: pairBlacklist,
      },

      // API 服务配置（使用真实值而非占位符）
      api_server: {
        enabled: true,
        listen_ip_address: '0.0.0.0',
        listen_port: this.freqtradePort,
        verbosity: 'error',
        // 生成真实的 JWT Secret（每次部署生成新的）
        jwt_secret_key: crypto.randomBytes(32).toString('hex'),
        CORS_origins: ['*'],
        username: 'quantfi',
        // 使用确定性生成的 API Token（基于 instanceId）
        password: instanceId
          ? this.networkWhitelistService.generateFreqtradeToken(instanceId)
          : crypto.randomBytes(16).toString('hex'), // 降级为随机值
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
   * 通过 VPS 上的代理服务（端口 8081）更新配置和策略
   *
   * @param ip VPS IP 地址
   * @param strategyName 策略名称
   * @param strategyCode 策略代码
   * @param config Freqtrade 配置
   * @param instanceToken 实例 Token（用于验证）
   */
  private async uploadStrategyToVps(
    ip: string,
    strategyName: string,
    strategyCode: string,
    config: FreqtradeConfig,
    instanceToken?: string,
  ): Promise<void> {
    // 使用代理服务端口 8081
    const proxyUrl = `http://${ip}:8081`;

    try {
      this.logger.log(`部署策略到 VPS: ${ip}, 策略: ${strategyName}`);
      // 调试日志：记录 Token 信息（只记录前 8 位，保护安全）
      if (instanceToken) {
        this.logger.debug(
          `VPS 部署 Token: token前8位=${instanceToken.substring(0, 8)}, 长度=${instanceToken.length}`,
        );
      } else {
        this.logger.warn(`⚠️ VPS 部署没有提供 instanceToken！`);
      }

      // 调用代理服务的配置更新端点
      const response = await firstValueFrom(
        this.httpService.post(
          `${proxyUrl}/api/update-config`,
          {
            config,
            strategyName,
            strategyCode,
          },
          {
            timeout: 60000, // 60 秒超时（包含重启时间）
            headers: {
              'Content-Type': 'application/json',
              'X-Instance-Token': instanceToken || '',
            },
          },
        ),
      );

      this.logger.log(`策略部署成功: ${strategyName}, 响应: ${JSON.stringify(response.data)}`);
    } catch (error: any) {
      this.logger.error(`策略部署失败: ${error.message}`, error.stack);

      // 提供更友好的错误信息
      if (error.code === 'ECONNREFUSED') {
        throw new InternalServerErrorException(
          'VPS 代理服务未响应，请检查 VPS 状态或稍后重试',
        );
      }
      if (error.response?.status === 401) {
        // 详细记录 Token 验证失败的信息
        this.logger.error(
          `VPS Token 验证失败: ip=${ip}, 发送的token前8位=${instanceToken?.substring(0, 8) || 'N/A'}, ` +
          `响应状态=${error.response?.status}, 响应信息=${JSON.stringify(error.response?.data || {})}`,
        );
        throw new InternalServerErrorException(
          'VPS 验证失败，Token 无效。请检查后端日志确认 JWT_SECRET 和 ENCRYPTION_KEY 环境变量是否与 VPS 初始化时一致。',
        );
      }
      if (error.response?.status === 403) {
        this.logger.error(
          `VPS 访问被拒绝: ip=${ip}, 响应=${JSON.stringify(error.response?.data || {})}`,
        );
        throw new InternalServerErrorException('VPS 访问被拒绝，请检查权限配置');
      }

      throw new InternalServerErrorException(`策略部署失败: ${error.message}`);
    }
  }

  /**
   * 仅上传策略代码到 VPS（不更新配置，不重启）
   * 用于回测前上传策略代码
   *
   * @param ip VPS IP 地址
   * @param strategyName 策略名称
   * @param strategyCode 策略代码
   * @param instanceId 实例 ID（用于生成 Token）
   */
  async uploadStrategyOnly(
    ip: string,
    strategyName: string,
    strategyCode: string,
    instanceId: string,
  ): Promise<void> {
    const proxyUrl = `http://${ip}:8081`;
    const instanceToken = this.networkWhitelistService.generateInstanceToken(instanceId);

    try {
      this.logger.log(`上传策略代码到 VPS: ${ip}, 策略: ${strategyName}`);

      // 调用代理服务的策略上传端点（只上传策略，不更新配置）
      const response = await firstValueFrom(
        this.httpService.post(
          `${proxyUrl}/api/upload-strategy`,
          {
            strategyName,
            strategyCode,
          },
          {
            timeout: 30000,
            headers: {
              'Content-Type': 'application/json',
              'X-Instance-Token': instanceToken,
            },
          },
        ),
      );

      this.logger.log(`策略上传成功: ${strategyName}`);
    } catch (error: any) {
      this.logger.error(`策略上传失败: ${error.message}`);
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

    // 调用 Freqtrade 停止 API（传入认证 Token）
    if (!this.isSandbox) {
      const apiToken = this.networkWhitelistService.generateFreqtradeToken(instance.id);
      await this.freqtradeService.stop(instance.ip_address, apiToken);
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

    // 记录操作日志
    await this.instanceLogService.info(
      userId,
      'bot_stop',
      '交易机器人已停止',
      {
        instanceId: instance.id,
        details: { configId },
      },
    );

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
        strategies: true,
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

    // 调用 Freqtrade 启动 API（传入认证 Token）
    if (!this.isSandbox) {
      const apiToken = this.networkWhitelistService.generateFreqtradeToken(instance.id);
      await this.freqtradeService.start(instance.ip_address, apiToken);
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

    // 记录操作日志
    const strategyName = userConfig.strategies?.name || '未知策略';
    await this.instanceLogService.info(
      userId,
      'bot_start',
      `交易机器人已启动，策略: ${strategyName}`,
      {
        instanceId: instance.id,
        details: { configId, strategyName },
      },
    );

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
