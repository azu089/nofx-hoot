import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { DigitalOceanService } from '../../digitalocean/digitalocean.service';

/**
 * VPS 状态同步定时任务
 *
 * 功能：
 * - 每 2 分钟执行一次
 * - 查询 status='provisioning' 的实例
 * - 调用 DO API 获取真实状态
 * - 超过 10 分钟仍在 provisioning → 标记为 error
 * - 同步 IP 地址到数据库
 */
@Injectable()
export class StatusSyncTask {
  private readonly logger = new Logger(StatusSyncTask.name);
  private readonly PROVISIONING_TIMEOUT = 10 * 60 * 1000; // 10 分钟

  constructor(
    private readonly prisma: PrismaService,
    private readonly digitalOceanService: DigitalOceanService,
  ) {}

  /**
   * 每 2 分钟执行状态同步
   */
  @Cron('*/2 * * * *') // 每 2 分钟执行
  async handleStatusSync() {
    this.logger.debug('[状态同步] 开始执行');

    try {
      // 1. 查询所有 provisioning 状态的实例
      const provisioningInstances = await this.prisma.client.instances.findMany(
        {
          where: {
            status: 'provisioning',
          },
        },
      );

      if (provisioningInstances.length === 0) {
        this.logger.debug('[状态同步] 无待同步实例');
        return;
      }

      this.logger.log(
        `[状态同步] 找到 ${provisioningInstances.length} 个待同步实例`,
      );

      // 2. 遍历每个实例，同步状态
      for (const instance of provisioningInstances) {
        await this.syncInstanceStatus(instance);
      }

      this.logger.log('[状态同步] 执行完成');
    } catch (error) {
      this.logger.error(`[状态同步] 执行失败: ${error.message}`, error.stack);
    }
  }

  /**
   * 同步单个实例状态
   */
  private async syncInstanceStatus(instance: any) {
    try {
      // 1. 检查是否超时（超过 10 分钟）
      const now = Date.now();
      const provisionedAt = instance.provisioned_at
        ? new Date(instance.provisioned_at).getTime()
        : now;

      if (now - provisionedAt > this.PROVISIONING_TIMEOUT) {
        this.logger.warn(
          `[状态同步] 实例 ${instance.id} 创建超时（超过 10 分钟），标记为 error`,
        );

        await this.prisma.client.instances.update({
          where: { id: instance.id },
          data: {
            status: 'error',
            destroy_reason: '创建超时（超过 10 分钟）',
          },
        });

        return;
      }

      // 2. 如果没有 droplet_id，无法同步
      if (!instance.droplet_id) {
        this.logger.warn(
          `[状态同步] 实例 ${instance.id} 缺少 droplet_id，跳过同步`,
        );
        return;
      }

      // 3. 调用 DO API 获取真实状态
      const dropletStatus = await this.digitalOceanService.getDropletStatus(
        instance.droplet_id,
      );

      this.logger.debug(
        `[状态同步] 实例 ${instance.id} 真实状态: ${dropletStatus.status}, IP: ${dropletStatus.ip}`,
      );

      // 4. 根据 DO 返回的状态更新数据库
      const updateData: any = {};

      // 同步 IP 地址
      if (dropletStatus.ip && dropletStatus.ip !== instance.ip_address) {
        updateData.ip_address = dropletStatus.ip;
        this.logger.log(
          `[状态同步] 实例 ${instance.id} IP 地址已更新: ${dropletStatus.ip}`,
        );
      }

      // 同步状态
      if (dropletStatus.status === 'active') {
        updateData.status = 'running';
        this.logger.log(
          `[状态同步] 实例 ${instance.id} 已激活，更新为 running`,
        );
      } else if (dropletStatus.status === 'off') {
        updateData.status = 'stopped';
        this.logger.log(
          `[状态同步] 实例 ${instance.id} 已停止，更新为 stopped`,
        );
      } else if (dropletStatus.status === 'error') {
        updateData.status = 'error';
        updateData.destroy_reason = 'DO Droplet 状态异常';
        this.logger.error(`[状态同步] 实例 ${instance.id} 创建失败`);
      }
      // 如果仍是 new，保持 provisioning 不变

      // 5. 更新数据库
      if (Object.keys(updateData).length > 0) {
        await this.prisma.client.instances.update({
          where: { id: instance.id },
          data: updateData,
        });

        this.logger.log(`[状态同步] 实例 ${instance.id} 状态已同步`);
      }
    } catch (error) {
      this.logger.error(
        `[状态同步] 实例 ${instance.id} 同步失败: ${error.message}`,
        error.stack,
      );

      // 同步失败不影响其他实例
    }
  }

  /**
   * 手动触发状态同步（用于测试）
   */
  async manualSync() {
    this.logger.log('[状态同步] 手动触发');
    await this.handleStatusSync();
  }
}
