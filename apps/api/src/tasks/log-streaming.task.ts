import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { FreqtradeService } from '../modules/freqtrade/freqtrade.service';
import { EventsGateway } from '../events/events.gateway';

/**
 * 日志流推送定时任务
 *
 * 功能：
 * - 每 5 秒轮询所有运行中的 VPS 实例
 * - 从 Freqtrade 获取最新日志
 * - 通过 WebSocket 推送给订阅的客户端
 *
 * 注意：
 * - 使用内存缓存记录每个实例最后推送的日志数量
 * - 只推送增量日志，避免重复
 */
@Injectable()
export class LogStreamingTask {
  private readonly logger = new Logger(LogStreamingTask.name);

  // 记录每个实例最后已知的日志数量，用于增量推送
  private lastLogCounts = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly freqtradeService: FreqtradeService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  /**
   * 每 5 秒执行一次日志轮询
   */
  @Interval(5000)
  async handleLogPolling() {
    try {
      // 1. 获取所有运行中的 VPS 实例
      const runningInstances = await this.prisma.client.instances.findMany({
        where: {
          status: 'running',
          ip_address: { not: null },
        },
        select: {
          id: true,
          ip_address: true,
          user_id: true,
        },
      });

      if (runningInstances.length === 0) {
        return;
      }

      // 2. 并发获取所有实例的日志
      const logPromises = runningInstances.map(async (instance) => {
        try {
          if (!instance.ip_address) return;

          const result = await this.freqtradeService.getLogs(
            instance.ip_address,
            100, // 获取最新 100 条
          );

          // 3. 检查是否有新日志
          const lastCount = this.lastLogCounts.get(instance.id) || 0;
          const currentCount = result.log_count;

          if (currentCount > lastCount) {
            // 有新日志，计算增量
            const newLogsCount = currentCount - lastCount;
            const newLogs = result.logs.slice(0, newLogsCount);

            // 4. 推送新日志到 WebSocket
            newLogs.reverse().forEach((log) => {
              this.eventsGateway.pushLog(instance.id, {
                message: log,
                level: this.parseLogLevel(log),
                timestamp: this.extractTimestamp(log),
              });
            });

            // 5. 更新缓存
            this.lastLogCounts.set(instance.id, currentCount);

            this.logger.debug(
              `推送 ${newLogsCount} 条新日志到实例 ${instance.id}`,
            );
          }
        } catch (error) {
          // 单个实例失败不影响其他实例
          this.logger.warn(
            `获取实例 ${instance.id} 日志失败: ${error.message}`,
          );
        }
      });

      await Promise.all(logPromises);
    } catch (error) {
      this.logger.error(`日志轮询任务失败: ${error.message}`, error.stack);
    }
  }

  /**
   * 解析日志级别
   */
  private parseLogLevel(log: string): 'info' | 'warn' | 'error' | 'debug' {
    if (log.includes('ERROR') || log.includes('Error')) return 'error';
    if (log.includes('WARNING') || log.includes('Warn')) return 'warn';
    if (log.includes('DEBUG')) return 'debug';
    return 'info';
  }

  /**
   * 从日志中提取时间戳
   */
  private extractTimestamp(log: string): string {
    // Freqtrade 日志格式: [2024-01-01 10:00:00] INFO - ...
    const match = log.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
    if (match) {
      return new Date(match[1]).toISOString();
    }
    return new Date().toISOString();
  }

  /**
   * 清理实例的日志缓存（当实例销毁时调用）
   */
  clearInstanceCache(instanceId: string) {
    this.lastLogCounts.delete(instanceId);
  }
}
