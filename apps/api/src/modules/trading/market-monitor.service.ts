import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TradingService } from './trading.service';
import { NotificationsService } from '../notifications/notifications.service';
import Decimal from 'decimal.js';

interface BlackSwanConfig {
  blackSwanProtection: boolean;
  blackSwanType: 'account_loss' | 'coin_drop';
  blackSwanTrigger: number;  // 触发阈值 %
  blackSwanAction: 'close_all' | 'close_half' | 'pause';
}

interface UserMonitor {
  userId: string;
  apiKeyId: string;
  config: BlackSwanConfig;
  isPaused: boolean;
}

interface PriceSnapshot {
  symbol: string;
  price: number;
  timestamp: number;
}

@Injectable()
export class MarketMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketMonitorService.name);
  private userMonitors: Map<string, UserMonitor> = new Map();
  private priceHistory: Map<string, PriceSnapshot[]> = new Map();
  private monitorInterval: NodeJS.Timeout | null = null;
  private readonly MONITOR_INTERVAL_MS = 10000; // 10秒检查一次
  private readonly PRICE_HISTORY_WINDOW_MS = 5 * 60 * 1000; // 5分钟窗口

  // 主要监控的币种
  private readonly MONITORED_SYMBOLS = [
    'BTC/USDT',
    'ETH/USDT',
    'BNB/USDT',
    'SOL/USDT',
  ];

  constructor(
    private prisma: PrismaService,
    private tradingService: TradingService,
    private notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    await this.loadUserConfigs();
    this.startMonitoring();
  }

  onModuleDestroy() {
    this.stopMonitoring();
  }

  // 加载用户黑天鹅配置
  private async loadUserConfigs() {
    const subscriptions = await this.prisma.strategySubscription.findMany({
      where: {
        isActive: true,
        blackSwanProtection: true,
      },
      select: {
        userId: true,
        apiKeyId: true,
        blackSwanProtection: true,
        blackSwanType: true,
        blackSwanTrigger: true,
        blackSwanAction: true,
      },
    });

    for (const sub of subscriptions) {
      this.addUserMonitor({
        userId: sub.userId,
        apiKeyId: sub.apiKeyId,
        config: {
          blackSwanProtection: sub.blackSwanProtection || false,
          blackSwanType: (sub.blackSwanType as any) || 'coin_drop',
          blackSwanTrigger: sub.blackSwanTrigger
            ? new Decimal(sub.blackSwanTrigger).toNumber()
            : 10,
          blackSwanAction: (sub.blackSwanAction as any) || 'close_all',
        },
        isPaused: false,
      });
    }

    this.logger.log(`加载了 ${this.userMonitors.size} 个黑天鹅监控配置`);
  }

  // 添加用户监控
  addUserMonitor(monitor: UserMonitor) {
    if (!monitor.config.blackSwanProtection) return;
    this.userMonitors.set(monitor.userId, monitor);
  }

  // 移除用户监控
  removeUserMonitor(userId: string) {
    this.userMonitors.delete(userId);
  }

  // 恢复用户交易
  resumeUser(userId: string) {
    const monitor = this.userMonitors.get(userId);
    if (monitor) {
      monitor.isPaused = false;
      this.logger.log(`用户 ${userId} 交易已恢复`);
    }
  }

  // 检查用户是否被暂停
  isUserPaused(userId: string): boolean {
    return this.userMonitors.get(userId)?.isPaused || false;
  }

  // 启动监控
  private startMonitoring() {
    if (this.monitorInterval) return;

    this.monitorInterval = setInterval(async () => {
      await this.checkMarket();
    }, this.MONITOR_INTERVAL_MS);

    this.logger.log('行情监控已启动');
  }

  // 停止监控
  private stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      this.logger.log('行情监控已停止');
    }
  }

  // 检查市场行情
  private async checkMarket() {
    // 更新价格快照
    await this.updatePriceSnapshots();

    // 检查是否触发黑天鹅
    for (const symbol of this.MONITORED_SYMBOLS) {
      const dropPercent = this.calculateRecentDrop(symbol);
      if (dropPercent !== null && dropPercent >= 5) {
        // 5% 以上跌幅开始检查
        await this.checkBlackSwanForAllUsers(symbol, dropPercent);
      }
    }
  }

  // 更新价格快照
  private async updatePriceSnapshots() {
    const now = Date.now();

    for (const symbol of this.MONITORED_SYMBOLS) {
      try {
        // 使用第一个用户的 API Key 获取价格（公开数据）
        const firstUser = Array.from(this.userMonitors.values())[0];
        if (!firstUser) continue;

        const price = await this.tradingService.getCurrentPrice(
          firstUser.userId,
          firstUser.apiKeyId,
          symbol,
        );

        if (!price) continue;

        // 添加到历史记录
        if (!this.priceHistory.has(symbol)) {
          this.priceHistory.set(symbol, []);
        }

        const history = this.priceHistory.get(symbol)!;
        history.push({ symbol, price, timestamp: now });

        // 清理过期数据
        const cutoff = now - this.PRICE_HISTORY_WINDOW_MS;
        while (history.length > 0 && history[0].timestamp < cutoff) {
          history.shift();
        }
      } catch (error) {
        this.logger.warn(`获取 ${symbol} 价格失败: ${(error as Error).message}`);
      }
    }
  }

  // 计算最近的跌幅
  private calculateRecentDrop(symbol: string): number | null {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length < 2) return null;

    const oldestPrice = history[0].price;
    const currentPrice = history[history.length - 1].price;

    return ((oldestPrice - currentPrice) / oldestPrice) * 100;
  }

  // 检查所有用户的黑天鹅触发
  private async checkBlackSwanForAllUsers(symbol: string, dropPercent: number) {
    for (const [userId, monitor] of this.userMonitors) {
      if (monitor.isPaused) continue;

      const { config } = monitor;

      // 检查是否触发
      if (config.blackSwanType === 'coin_drop' && dropPercent >= config.blackSwanTrigger) {
        await this.triggerBlackSwanProtection(monitor, symbol, dropPercent);
      }
    }
  }

  // 检查账户亏损类型的黑天鹅
  async checkAccountLoss(userId: string, currentLossPercent: number) {
    const monitor = this.userMonitors.get(userId);
    if (!monitor || monitor.isPaused) return;

    const { config } = monitor;
    if (config.blackSwanType !== 'account_loss') return;

    if (currentLossPercent >= config.blackSwanTrigger) {
      await this.triggerBlackSwanProtection(monitor, 'ACCOUNT', currentLossPercent);
    }
  }

  // 触发黑天鹅保护
  private async triggerBlackSwanProtection(
    monitor: UserMonitor,
    symbol: string,
    dropPercent: number,
  ) {
    const { userId, apiKeyId, config } = monitor;

    this.logger.warn(
      `黑天鹅触发: 用户 ${userId}, ${symbol} 跌幅 ${dropPercent.toFixed(2)}%, 动作: ${config.blackSwanAction}`,
    );

    try {
      switch (config.blackSwanAction) {
        case 'close_all':
          await this.closeAllPositions(userId, apiKeyId);
          break;
        case 'close_half':
          await this.closeHalfPositions(userId, apiKeyId);
          break;
        case 'pause':
          monitor.isPaused = true;
          break;
      }

      // 发送通知
      const actionText = {
        close_all: '已全部平仓',
        close_half: '已平仓50%',
        pause: '已暂停交易',
      }[config.blackSwanAction];

      await this.notificationsService.sendNotification(userId, {
        type: 'black_swan_triggered',
        title: '黑天鹅保护触发',
        body: `${symbol} 跌幅 ${dropPercent.toFixed(2)}%，${actionText}`,
        data: {
          symbol,
          dropPercent,
          action: config.blackSwanAction,
        },
      });

      // 记录日志
      await this.prisma.riskLog.create({
        data: {
          userId,
          reason: 'black_swan',
          details: JSON.stringify({
            symbol,
            dropPercent,
            action: config.blackSwanAction,
          }),
        },
      });
    } catch (error) {
      this.logger.error(`黑天鹅保护执行失败: ${(error as Error).message}`);
    }
  }

  // 平仓所有持仓
  private async closeAllPositions(userId: string, apiKeyId: string) {
    const positions = await this.prisma.position.findMany({
      where: { userId, status: 'open' },
    });

    for (const pos of positions) {
      try {
        await this.tradingService.closePosition(
          userId,
          apiKeyId,
          pos.symbol,
          new Decimal(pos.amount).toNumber(),
          pos.side as 'long' | 'short',
        );

        await this.prisma.position.update({
          where: { id: pos.id },
          data: {
            status: 'closed',
            closedAt: new Date(),
            closeReason: 'black_swan',
          },
        });
      } catch (error) {
        this.logger.error(`平仓失败 ${pos.symbol}: ${(error as Error).message}`);
      }
    }

    this.logger.log(`用户 ${userId} 已全部平仓`);
  }

  // 平仓50%持仓
  private async closeHalfPositions(userId: string, apiKeyId: string) {
    const positions = await this.prisma.position.findMany({
      where: { userId, status: 'open' },
    });

    for (const pos of positions) {
      try {
        const halfAmount = new Decimal(pos.amount).div(2).toNumber();

        await this.tradingService.closePositionPartially(
          userId,
          apiKeyId,
          pos.symbol,
          new Decimal(pos.amount).toNumber(),
          0.5,
          pos.side as 'long' | 'short',
        );

        await this.prisma.position.update({
          where: { id: pos.id },
          data: {
            amount: new Decimal(pos.amount).div(2).toString(),
          },
        });
      } catch (error) {
        this.logger.error(`减仓失败 ${pos.symbol}: ${(error as Error).message}`);
      }
    }

    this.logger.log(`用户 ${userId} 已减仓50%`);
  }
}
