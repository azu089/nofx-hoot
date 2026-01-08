import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { FreqtradeService } from '../modules/freqtrade/freqtrade.service';
import { ConfigService } from '@nestjs/config';
import Decimal from 'decimal.js';

/**
 * 价格缓存条目
 */
interface PriceEntry {
  price: number;
  timestamp: number;
}

/**
 * 黑天鹅/瀑布防护任务
 *
 * 功能：
 * - 每分钟检查主要交易对的价格变动
 * - 当价格在指定时间内下跌超过阈值时，暂停相关策略
 * - 防止极端行情下的损失扩大
 *
 * 工作流程：
 * 1. 获取所有启用了 crash_protection 的策略配置
 * 2. 监控相关交易对的价格
 * 3. 检测价格跌幅是否超过用户设置的阈值
 * 4. 超过阈值时，调用 Freqtrade API 暂停策略
 * 5. 发送通知给用户
 */
@Injectable()
export class CrashProtectionTask {
  private readonly logger = new Logger(CrashProtectionTask.name);
  private readonly isSandbox: boolean;

  // 价格历史缓存：{ symbol: PriceEntry[] }
  private priceHistory: Map<string, PriceEntry[]> = new Map();

  // 最大缓存时间（毫秒）- 保留 60 分钟数据
  private readonly MAX_CACHE_TIME = 60 * 60 * 1000;

  // 已触发保护的策略（防止重复触发）
  private triggeredProtections: Set<string> = new Set();

  constructor(
    private readonly prisma: PrismaService,
    private readonly freqtradeService: FreqtradeService,
    private readonly configService: ConfigService,
  ) {
    this.isSandbox = this.configService.get('SANDBOX_MODE') === 'true';
  }

  /**
   * 每分钟执行一次价格监控
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleCrashProtection() {
    try {
      // 1. 获取所有启用了黑天鹅防护的活跃策略配置
      const activeConfigs = await this.getActiveProtectedConfigs();

      if (activeConfigs.length === 0) {
        return;
      }

      this.logger.debug(`检查 ${activeConfigs.length} 个启用黑天鹅防护的策略`);

      // 2. 收集需要监控的交易对
      const symbolsToMonitor = this.collectSymbols(activeConfigs);

      // 3. 获取当前价格
      const currentPrices = await this.fetchCurrentPrices(symbolsToMonitor);

      // 4. 更新价格历史
      this.updatePriceHistory(currentPrices);

      // 5. 检查每个策略是否需要触发保护
      for (const config of activeConfigs) {
        await this.checkAndTriggerProtection(config, currentPrices);
      }
    } catch (error) {
      this.logger.error(`黑天鹅防护检查失败: ${error.message}`, error.stack);
    }
  }

  /**
   * 获取启用了黑天鹅防护的活跃策略配置
   */
  private async getActiveProtectedConfigs(): Promise<any[]> {
    const configs = await this.prisma.client.user_strategy_configs.findMany({
      where: {
        is_active: true,
      },
      include: {
        instances: true,
        users: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // 过滤出启用了 crash_protection 的配置
    return configs.filter((config) => {
      const customConfig = (config.custom_config as Record<string, any>) || {};
      return customConfig.crash_protection === true;
    });
  }

  /**
   * 收集需要监控的交易对
   */
  private collectSymbols(configs: any[]): Set<string> {
    const symbols = new Set<string>();

    for (const config of configs) {
      const customConfig = (config.custom_config as Record<string, any>) || {};
      const pairWhitelist = customConfig.pair_whitelist || [];

      for (const pair of pairWhitelist) {
        // 转换为标准格式，如 BTC/USDT -> BTCUSDT
        const symbol = pair.replace('/', '');
        symbols.add(symbol);
      }
    }

    // 默认监控主要交易对
    symbols.add('BTCUSDT');
    symbols.add('ETHUSDT');

    return symbols;
  }

  /**
   * 获取当前价格
   * 使用 Binance 公开 API
   */
  private async fetchCurrentPrices(
    symbols: Set<string>,
  ): Promise<Map<string, number>> {
    const prices = new Map<string, number>();

    if (this.isSandbox) {
      // 沙盒模式：返回模拟价格
      for (const symbol of symbols) {
        const basePrice = symbol.startsWith('BTC') ? 45000 : 3000;
        // 添加随机波动 ±2%
        const volatility = (Math.random() - 0.5) * 0.04;
        prices.set(symbol, basePrice * (1 + volatility));
      }
      return prices;
    }

    try {
      // 使用 Binance 公开 API 获取价格
      const symbolList = Array.from(symbols).join(',');
      const response = await fetch(
        `https://api.binance.com/api/v3/ticker/price?symbols=[${symbolList
          .split(',')
          .map((s) => `"${s}"`)
          .join(',')}]`,
      );

      if (response.ok) {
        const data = await response.json();
        for (const item of data) {
          prices.set(item.symbol, parseFloat(item.price));
        }
      }
    } catch (error) {
      this.logger.warn(`获取价格失败: ${error.message}`);
      // 获取失败时不执行保护检查
    }

    return prices;
  }

  /**
   * 更新价格历史
   */
  private updatePriceHistory(currentPrices: Map<string, number>) {
    const now = Date.now();

    for (const [symbol, price] of currentPrices) {
      let history = this.priceHistory.get(symbol) || [];

      // 添加新价格
      history.push({ price, timestamp: now });

      // 清理过期数据
      history = history.filter(
        (entry) => now - entry.timestamp < this.MAX_CACHE_TIME,
      );

      this.priceHistory.set(symbol, history);
    }
  }

  /**
   * 检查并触发保护
   */
  private async checkAndTriggerProtection(
    config: any,
    currentPrices: Map<string, number>,
  ) {
    const customConfig = (config.custom_config as Record<string, any>) || {};
    const threshold = customConfig.crash_threshold || -10; // 默认 -10%
    const timeframe = customConfig.crash_timeframe || 5; // 默认 5 分钟

    // 检查是否已经触发过（1小时内不重复触发）
    const protectionKey = `${config.id}_${Math.floor(Date.now() / 3600000)}`;
    if (this.triggeredProtections.has(protectionKey)) {
      return;
    }

    const pairWhitelist = customConfig.pair_whitelist || ['BTC/USDT'];

    for (const pair of pairWhitelist) {
      const symbol = pair.replace('/', '');
      const currentPrice = currentPrices.get(symbol);

      if (!currentPrice) continue;

      // 计算时间窗口内的最高价
      const history = this.priceHistory.get(symbol) || [];
      const windowStart = Date.now() - timeframe * 60 * 1000;
      const windowPrices = history.filter(
        (entry) => entry.timestamp >= windowStart,
      );

      if (windowPrices.length < 2) continue;

      const maxPrice = Math.max(...windowPrices.map((e) => e.price));
      const priceChange = ((currentPrice - maxPrice) / maxPrice) * 100;

      // 检查是否触发保护（跌幅超过阈值）
      if (priceChange <= threshold) {
        this.logger.warn(
          `触发黑天鹅防护: ${pair} 在 ${timeframe} 分钟内下跌 ${priceChange.toFixed(2)}%（阈值: ${threshold}%）`,
        );

        await this.triggerProtection(config, pair, priceChange);
        this.triggeredProtections.add(protectionKey);
        break; // 一个交易对触发即可
      }
    }
  }

  /**
   * 触发保护：暂停策略
   */
  private async triggerProtection(
    config: any,
    pair: string,
    priceChange: number,
  ) {
    const instance = config.instances;

    if (!instance || !instance.ip_address) {
      this.logger.warn(`策略 ${config.id} 没有绑定 VPS，无法暂停`);
      return;
    }

    try {
      // 1. 调用 Freqtrade API 停止策略
      if (!this.isSandbox) {
        await this.freqtradeService.stop(instance.ip_address);
      }

      // 2. 更新数据库状态
      await this.prisma.client.user_strategy_configs.update({
        where: { id: config.id },
        data: {
          is_active: false,
          custom_config: {
            ...(config.custom_config as object),
            crash_protection_triggered: true,
            crash_protection_triggered_at: new Date().toISOString(),
            crash_protection_reason: `${pair} 下跌 ${priceChange.toFixed(2)}%`,
          },
        },
      });

      // 3. 记录事件日志
      this.logger.log(
        `黑天鹅防护已触发: 策略=${config.id}, 用户=${config.user_id}, 原因=${pair} 下跌 ${priceChange.toFixed(2)}%`,
      );

      // TODO: 4. 发送通知给用户（邮件/站内信）
      // await this.notificationService.send(config.user_id, {
      //   title: '黑天鹅防护已触发',
      //   content: `您的策略已被自动暂停，原因：${pair} 在短时间内下跌 ${Math.abs(priceChange).toFixed(2)}%`,
      // });
    } catch (error) {
      this.logger.error(
        `触发保护失败: 策略=${config.id}, 错误=${error.message}`,
      );
    }
  }

  /**
   * 手动重置保护状态（供 API 调用）
   */
  async resetProtection(configId: string) {
    // 清除触发记录
    for (const key of this.triggeredProtections) {
      if (key.startsWith(configId)) {
        this.triggeredProtections.delete(key);
      }
    }

    // 清除数据库中的触发标记
    const config = await this.prisma.client.user_strategy_configs.findUnique({
      where: { id: configId },
    });

    if (config) {
      const customConfig = (config.custom_config as Record<string, any>) || {};
      delete customConfig.crash_protection_triggered;
      delete customConfig.crash_protection_triggered_at;
      delete customConfig.crash_protection_reason;

      await this.prisma.client.user_strategy_configs.update({
        where: { id: configId },
        data: {
          custom_config: customConfig,
        },
      });
    }

    this.logger.log(`已重置策略 ${configId} 的黑天鹅防护状态`);
  }

  /**
   * 获取价格变动统计（供 API 调用）
   */
  getPriceStats(symbol: string, minutes: number = 5): {
    current: number | null;
    high: number | null;
    low: number | null;
    change: number | null;
  } {
    const history = this.priceHistory.get(symbol) || [];
    const windowStart = Date.now() - minutes * 60 * 1000;
    const windowPrices = history.filter(
      (entry) => entry.timestamp >= windowStart,
    );

    if (windowPrices.length === 0) {
      return { current: null, high: null, low: null, change: null };
    }

    const prices = windowPrices.map((e) => e.price);
    const current = prices[prices.length - 1];
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const change = ((current - high) / high) * 100;

    return { current, high, low, change };
  }
}
