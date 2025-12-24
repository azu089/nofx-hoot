import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InstancesService } from '../instances.service';

/**
 * 僵尸节点检测定时任务
 *
 * 功能：
 * - 每 5 分钟执行一次检测
 * - 查找 status='running' 且 last_heartbeat < 15分钟前的实例
 * - 标记为 'zombie' 状态
 * - 输出告警日志
 *
 * 心跳超时阈值：15 分钟
 */
@Injectable()
export class ZombieDetectionTask {
  private readonly logger = new Logger(ZombieDetectionTask.name);

  constructor(private readonly instancesService: InstancesService) {}

  /**
   * 每 5 分钟执行一次僵尸节点检测
   */
  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'zombie-detection',
  })
  async handleCron() {
    this.logger.debug('开始执行僵尸节点检测任务');

    try {
      // 1. 查找僵尸节点
      const zombieInstances =
        await this.instancesService.findZombieInstances();

      if (zombieInstances.length === 0) {
        this.logger.debug('未发现僵尸节点');
        return;
      }

      this.logger.warn(
        `发现 ${zombieInstances.length} 个僵尸节点，开始标记`,
      );

      // 2. 标记每个僵尸节点
      const results = await Promise.allSettled(
        zombieInstances.map((instance) =>
          this.instancesService.markAsZombie(instance.id),
        ),
      );

      // 3. 统计结果
      const successCount = results.filter(
        (r) => r.status === 'fulfilled' && r.value !== null,
      ).length;
      const failedCount = results.filter(
        (r) => r.status === 'rejected' || r.value === null,
      ).length;

      this.logger.log(
        `僵尸节点检测完成: 成功标记 ${successCount} 个，失败 ${failedCount} 个`,
      );

      // 4. 输出失败详情
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          this.logger.error(
            `标记僵尸节点失败: ${zombieInstances[index].id}, 原因: ${result.reason}`,
          );
        }
      });
    } catch (error) {
      this.logger.error(
        `僵尸节点检测任务执行失败: ${error.message}`,
        error.stack,
      );
    }
  }
}
