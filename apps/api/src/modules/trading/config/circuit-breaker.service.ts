import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TradingConfigService } from './config.service';

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerInfo {
  name: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureAt?: Date;
  openedAt?: Date;
  closeScheduledAt?: Date;
  canExecute: boolean;
}

/**
 * 熔断器服务
 * 防止系统在故障时继续发送请求，保护下游服务
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  // 内存中的滑动窗口统计
  private failureWindows: Map<string, number[]> = new Map();
  private successWindows: Map<string, number[]> = new Map();

  constructor(
    private prisma: PrismaService,
    private configService: TradingConfigService,
  ) {}

  /**
   * 检查是否可以执行
   */
  async canExecute(name: string): Promise<boolean> {
    const info = await this.getCircuitInfo(name);
    return info.canExecute;
  }

  /**
   * 获取熔断器信息
   */
  async getCircuitInfo(name: string): Promise<CircuitBreakerInfo> {
    const state = await this.prisma.circuitBreakerState.findUnique({
      where: { name },
    });

    if (!state) {
      // 不存在则创建
      await this.prisma.circuitBreakerState.create({
        data: { name, state: 'closed' },
      });

      return {
        name,
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        canExecute: true,
      };
    }

    const now = new Date();
    let canExecute = true;

    // 根据状态判断
    if (state.state === 'open') {
      // 检查是否可以转为半开状态
      if (state.closeScheduledAt && state.closeScheduledAt <= now) {
        await this.transitionTo(name, 'half_open');
        canExecute = true;
      } else {
        canExecute = false;
      }
    } else if (state.state === 'half_open') {
      // 半开状态允许少量请求
      const config = await this.configService.getPlatformConfig();
      canExecute = state.successCount < config.circuitBreaker.halfOpenRequests;
    }

    return {
      name,
      state: state.state as CircuitState,
      failureCount: state.failureCount,
      successCount: state.successCount,
      lastFailureAt: state.lastFailureAt || undefined,
      openedAt: state.openedAt || undefined,
      closeScheduledAt: state.closeScheduledAt || undefined,
      canExecute,
    };
  }

  /**
   * 记录成功
   */
  async recordSuccess(name: string): Promise<void> {
    const state = await this.prisma.circuitBreakerState.findUnique({
      where: { name },
    });

    if (!state) return;

    // 添加到成功窗口
    this.addToWindow(this.successWindows, name, Date.now());

    if (state.state === 'half_open') {
      const config = await this.configService.getPlatformConfig();
      const newSuccessCount = state.successCount + 1;

      if (newSuccessCount >= config.circuitBreaker.halfOpenRequests) {
        // 足够的成功请求，关闭熔断器
        await this.transitionTo(name, 'closed');
        this.logger.log(`熔断器已关闭: ${name}`);
      } else {
        await this.prisma.circuitBreakerState.update({
          where: { name },
          data: { successCount: newSuccessCount },
        });
      }
    } else if (state.state === 'closed') {
      // 关闭状态下重置失败计数
      await this.prisma.circuitBreakerState.update({
        where: { name },
        data: { failureCount: 0 },
      });
    }
  }

  /**
   * 记录失败
   */
  async recordFailure(name: string, error?: string): Promise<void> {
    const config = await this.configService.getPlatformConfig();
    const { circuitBreaker: cbConfig } = config;

    if (!cbConfig.enabled) return;

    // 添加到失败窗口
    this.addToWindow(this.failureWindows, name, Date.now());

    // 清理过期记录
    this.cleanWindow(
      this.failureWindows,
      name,
      cbConfig.failureWindowSeconds * 1000,
    );

    const state = await this.prisma.circuitBreakerState.findUnique({
      where: { name },
    });

    const now = new Date();
    const recentFailures = this.getWindowCount(this.failureWindows, name);

    if (!state) {
      await this.prisma.circuitBreakerState.create({
        data: {
          name,
          state: 'closed',
          failureCount: 1,
          lastFailureAt: now,
        },
      });
      return;
    }

    // 更新失败计数
    await this.prisma.circuitBreakerState.update({
      where: { name },
      data: {
        failureCount: { increment: 1 },
        lastFailureAt: now,
      },
    });

    if (state.state === 'half_open') {
      // 半开状态下失败，重新打开
      await this.transitionTo(name, 'open');
      this.logger.warn(`熔断器重新打开: ${name} (半开状态失败)`);
    } else if (state.state === 'closed') {
      // 检查是否需要打开熔断器
      if (recentFailures >= cbConfig.maxConsecutiveFailures) {
        await this.transitionTo(name, 'open');
        this.logger.warn(
          `熔断器已打开: ${name} (连续失败 ${recentFailures} 次)`,
        );
      }

      // 检查错误率
      const recentSuccess = this.getWindowCount(this.successWindows, name);
      const totalRequests = recentFailures + recentSuccess;

      if (totalRequests >= cbConfig.minRequestsForErrorRate) {
        const errorRate = (recentFailures / totalRequests) * 100;
        if (errorRate >= cbConfig.errorRateThreshold) {
          await this.transitionTo(name, 'open');
          this.logger.warn(
            `熔断器已打开: ${name} (错误率 ${errorRate.toFixed(1)}%)`,
          );
        }
      }
    }
  }

  /**
   * 状态转换
   */
  private async transitionTo(
    name: string,
    newState: CircuitState,
  ): Promise<void> {
    const config = await this.configService.getPlatformConfig();
    const now = new Date();

    const updateData: any = {
      state: newState,
      failureCount: 0,
      successCount: 0,
    };

    if (newState === 'open') {
      updateData.openedAt = now;
      updateData.closeScheduledAt = new Date(
        now.getTime() + config.circuitBreaker.cooldownSeconds * 1000,
      );
    } else if (newState === 'closed') {
      updateData.openedAt = null;
      updateData.closeScheduledAt = null;
    }

    await this.prisma.circuitBreakerState.update({
      where: { name },
      data: updateData,
    });

    // 清除窗口
    this.failureWindows.delete(name);
    this.successWindows.delete(name);
  }

  /**
   * 手动重置熔断器
   */
  async reset(name: string): Promise<void> {
    await this.transitionTo(name, 'closed');
    this.logger.log(`熔断器已手动重置: ${name}`);
  }

  /**
   * 手动打开熔断器
   */
  async forceOpen(name: string, durationSeconds: number): Promise<void> {
    const now = new Date();

    await this.prisma.circuitBreakerState.upsert({
      where: { name },
      update: {
        state: 'open',
        openedAt: now,
        closeScheduledAt: new Date(now.getTime() + durationSeconds * 1000),
      },
      create: {
        name,
        state: 'open',
        openedAt: now,
        closeScheduledAt: new Date(now.getTime() + durationSeconds * 1000),
      },
    });

    this.logger.warn(`熔断器已手动打开: ${name} (${durationSeconds}秒)`);
  }

  /**
   * 获取所有熔断器状态
   */
  async getAllCircuits(): Promise<CircuitBreakerInfo[]> {
    const states = await this.prisma.circuitBreakerState.findMany();

    return Promise.all(
      states.map(async (s) => {
        const info = await this.getCircuitInfo(s.name);
        return info;
      }),
    );
  }

  // ========== 滑动窗口工具方法 ==========

  private addToWindow(
    windows: Map<string, number[]>,
    name: string,
    timestamp: number,
  ): void {
    if (!windows.has(name)) {
      windows.set(name, []);
    }
    windows.get(name)!.push(timestamp);
  }

  private cleanWindow(
    windows: Map<string, number[]>,
    name: string,
    windowMs: number,
  ): void {
    const window = windows.get(name);
    if (!window) return;

    const cutoff = Date.now() - windowMs;
    const filtered = window.filter((t) => t > cutoff);
    windows.set(name, filtered);
  }

  private getWindowCount(windows: Map<string, number[]>, name: string): number {
    return windows.get(name)?.length || 0;
  }
}
