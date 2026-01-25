import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { DigitalOceanService } from '../../digitalocean/digitalocean.service';
import { FreqtradeService } from '../../freqtrade/freqtrade.service';
import { NetworkWhitelistService } from '../../../common/services/network-whitelist.service';
import { InstanceLogService } from '../instance-log.service';
import { InstanceDiagnosisService } from '../instance-diagnosis.service';
import { InstanceRepairService } from '../instance-repair.service';

/**
 * VPS 状态同步定时任务
 *
 * 功能：
 * - 每 2 分钟执行一次
 * - 查询 status='pending' 或 'provisioning' 的实例（且有 droplet_id）
 * - 调用 DO API 获取真实状态
 * - 超过 10 分钟仍在 pending/provisioning → 标记为 error
 * - 同步 IP 地址到数据库
 * - DO 状态 active → 实例状态 running
 * - DO 状态 off → 实例状态 stopped
 *
 * 心跳监控与自动修复：
 * - 每 30 秒检测心跳
 * - 心跳超过 2 分钟 → 触发诊断和自动修复
 * - 心跳超过 15 分钟 → 自动销毁
 */
@Injectable()
export class StatusSyncTask {
  private readonly logger = new Logger(StatusSyncTask.name);
  private readonly PROVISIONING_TIMEOUT = 10 * 60 * 1000; // 10 分钟
  private readonly HEARTBEAT_WARNING = 2 * 60 * 1000; // 2 分钟触发诊断
  private readonly HEARTBEAT_TIMEOUT = 15 * 60 * 1000; // 15 分钟自动销毁

  constructor(
    private readonly prisma: PrismaService,
    private readonly digitalOceanService: DigitalOceanService,
    private readonly freqtradeService: FreqtradeService,
    private readonly networkWhitelistService: NetworkWhitelistService,
    private readonly instanceLogService: InstanceLogService,
    private readonly diagnosisService: InstanceDiagnosisService,
    private readonly repairService: InstanceRepairService,
  ) {}

  /**
   * 每 2 分钟执行状态同步
   */
  @Cron('*/2 * * * *') // 每 2 分钟执行
  async handleStatusSync() {
    this.logger.debug('[状态同步] 开始执行');

    try {
      // 1. 查询所有 pending 或 provisioning 状态的实例（需要同步状态）
      const provisioningInstances = await this.prisma.client.instances.findMany(
        {
          where: {
            status: { in: ['pending', 'provisioning'] },
            droplet_id: { not: null }, // 必须有 droplet_id 才能同步
          },
        },
      );

      if (provisioningInstances.length === 0) {
        this.logger.debug('[状态同步] 无待同步实例（pending/provisioning）');
        return;
      }

      this.logger.log(
        `[状态同步] 找到 ${provisioningInstances.length} 个待同步实例（pending/provisioning）`,
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
      // 使用 provisioned_at 或 created_at 作为超时计算基准
      const startTime = instance.provisioned_at
        ? new Date(instance.provisioned_at).getTime()
        : new Date(instance.created_at).getTime();

      if (now - startTime > this.PROVISIONING_TIMEOUT) {
        const retryCount = instance.retry_count || 0;
        const MAX_RETRIES = 3;

        if (retryCount < MAX_RETRIES) {
          // 重试创建：销毁当前 Droplet，重新创建
          this.logger.warn(
            `[状态同步] 实例 ${instance.id} 创建超时，尝试重试 (${retryCount + 1}/${MAX_RETRIES})`,
          );

          try {
            // 销毁旧 Droplet（如果存在）
            if (instance.droplet_id) {
              await this.digitalOceanService.destroyDroplet(instance.droplet_id);
            }

            // 更新重试计数，重置状态为 pending
            await this.prisma.client.instances.update({
              where: { id: instance.id },
              data: {
                status: 'pending',
                droplet_id: null,
                ip_address: null,
                retry_count: retryCount + 1,
                last_retry_at: new Date(),
                destroy_reason: null,
              },
            });

            this.logger.log(
              `[状态同步] 实例 ${instance.id} 已重置为 pending，等待重新创建`,
            );

            // 记录重试日志
            await this.instanceLogService.warn(
              instance.user_id,
              'instance_retry',
              `VPS 创建超时，正在重试 (${retryCount + 1}/${MAX_RETRIES})`,
              {
                instanceId: instance.id,
                details: { retryCount: retryCount + 1 },
              },
            );
          } catch (retryError) {
            this.logger.error(
              `[状态同步] 实例 ${instance.id} 重试失败: ${retryError.message}`,
            );
          }
        } else {
          // 已达最大重试次数，标记为 error
          this.logger.error(
            `[状态同步] 实例 ${instance.id} 创建超时，已达最大重试次数 (${MAX_RETRIES})，标记为 error`,
          );

          await this.prisma.client.instances.update({
            where: { id: instance.id },
            data: {
              status: 'error',
              destroy_reason: `创建超时（已重试 ${MAX_RETRIES} 次）`,
            },
          });

          await this.instanceLogService.error(
            instance.user_id,
            'instance_create_failed',
            `VPS 创建失败，已重试 ${MAX_RETRIES} 次`,
            {
              instanceId: instance.id,
              details: { retryCount: MAX_RETRIES },
            },
          );
        }

        return;
      }

      // 2. 如果没有 droplet_id，无法同步（已在查询时过滤，这里作为安全检查）
      if (!instance.droplet_id) {
        this.logger.warn(
          `[状态同步] 实例 ${instance.id} 缺少 droplet_id，跳过同步`,
        );
        return;
      }

      this.logger.debug(
        `[状态同步] 同步实例 ${instance.id}，当前状态: ${instance.status}，Droplet: ${instance.droplet_id}`,
      );

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

        // 记录 VPS 就绪日志（从 pending/provisioning → running）
        await this.instanceLogService.info(
          instance.user_id,
          'instance_ready',
          `VPS 初始化完成，交易机器人已部署 (IP: ${dropletStatus.ip})`,
          {
            instanceId: instance.id,
            details: {
              ip: dropletStatus.ip,
              previousStatus: instance.status,
            },
          },
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
   * 每 2 分钟同步运行中实例的 Freqtrade 策略状态
   */
  @Cron('*/2 * * * *')
  async handleFreqtradeStatusSync() {
    this.logger.debug('[策略同步] 开始执行');

    try {
      // 查询所有运行中的实例
      const runningInstances = await this.prisma.client.instances.findMany({
        where: {
          status: 'running',
          ip_address: { not: null },
        },
      });

      if (runningInstances.length === 0) {
        this.logger.debug('[策略同步] 无运行中的实例');
        return;
      }

      this.logger.debug(`[策略同步] 找到 ${runningInstances.length} 个运行中的实例`);

      for (const instance of runningInstances) {
        await this.syncFreqtradeStatus(instance);
      }

      this.logger.debug('[策略同步] 执行完成');
    } catch (error) {
      this.logger.error(`[策略同步] 执行失败: ${error.message}`, error.stack);
    }
  }

  /**
   * 同步单个实例的 Freqtrade 状态
   */
  private async syncFreqtradeStatus(instance: any) {
    try {
      if (!instance.ip_address) return;

      // 生成 API Token
      const apiToken = this.networkWhitelistService.generateFreqtradeToken(instance.id);

      // 调用 Freqtrade API 获取状态
      const ftStatus = await this.freqtradeService.getStatus(
        instance.ip_address,
        apiToken,
      ).catch(() => null);

      if (!ftStatus) {
        // Freqtrade 无响应，可能未启动
        if (instance.freqtrade_status !== 'stopped') {
          await this.prisma.client.instances.update({
            where: { id: instance.id },
            data: {
              freqtrade_status: 'stopped',
              current_strategy: null,
            },
          });
          this.logger.debug(`[策略同步] 实例 ${instance.id} Freqtrade 无响应，标记为 stopped`);
        }
        return;
      }

      // 更新策略状态
      const updateData: any = {
        last_heartbeat: new Date(),
      };

      // 更新 Freqtrade 状态
      if (ftStatus.state !== instance.freqtrade_status) {
        updateData.freqtrade_status = ftStatus.state;
      }

      // 更新当前策略名称
      const strategyName = ftStatus.strategy_name || null;
      if (strategyName !== instance.current_strategy) {
        updateData.current_strategy = strategyName;
      }

      if (Object.keys(updateData).length > 1) {  // > 1 因为 last_heartbeat 总是存在
        await this.prisma.client.instances.update({
          where: { id: instance.id },
          data: updateData,
        });
        this.logger.debug(
          `[策略同步] 实例 ${instance.id} 状态已更新: ${ftStatus.state}, 策略: ${strategyName || '无'}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[策略同步] 实例 ${instance.id} 同步失败: ${error.message}`,
      );
    }
  }

  /**
   * 手动触发状态同步（用于测试）
   */
  async manualSync() {
    this.logger.log('[状态同步] 手动触发');
    await this.handleStatusSync();
  }

  /**
   * 每分钟检查需要重试重建的实例
   * - status = 'pending'
   * - droplet_id = null
   * - retry_count > 0 (表示这是重试，不是新建)
   */
  @Cron('*/1 * * * *') // 每分钟执行
  async handleRetryRebuild() {
    try {
      // 查询需要重试重建的实例
      const retryInstances = await this.prisma.client.instances.findMany({
        where: {
          status: 'pending',
          droplet_id: null,
          retry_count: { gt: 0 }, // 重试次数 > 0，表示这是重试
        },
        include: {
          users: {
            select: { id: true },
          },
        },
      });

      if (retryInstances.length === 0) {
        return;
      }

      this.logger.log(
        `[重试重建] 找到 ${retryInstances.length} 个需要重建的实例`,
      );

      for (const instance of retryInstances) {
        await this.rebuildInstance(instance);
      }
    } catch (error) {
      this.logger.error(`[重试重建] 执行失败: ${error.message}`, error.stack);
    }
  }

  /**
   * 重建单个实例
   */
  private async rebuildInstance(instance: any) {
    try {
      const userId = instance.user_id;
      this.logger.log(
        `[重试重建] 开始重建实例 ${instance.id}，重试次数: ${instance.retry_count}`,
      );

      // 1. 调用 DO API 创建新 Droplet
      const droplet = await this.digitalOceanService.createDroplet(
        {
          name: `quantfi-${userId.substring(0, 8)}-${instance.id.substring(0, 8)}`,
          region: instance.region,
          size: instance.size,
          tags: ['quantfi', `user-${userId}`, `instance-${instance.id}`],
        },
        instance.id, // 传递 instanceId 用于生成 User Data
      );

      this.logger.log(
        `[重试重建] Droplet 创建成功: ${droplet.id}, IP: ${droplet.ip}, 实例: ${instance.id}`,
      );

      // 2. 更新实例记录
      await this.prisma.client.instances.update({
        where: { id: instance.id },
        data: {
          droplet_id: droplet.id,
          ip_address: droplet.ip || null,
          status: droplet.status === 'active' ? 'provisioning' : 'pending',
          provisioned_at: new Date(),
        },
      });

      // 3. 记录重建成功日志
      await this.instanceLogService.info(
        userId,
        'instance_rebuild',
        `VPS 重建成功 (重试第 ${instance.retry_count} 次)`,
        {
          instanceId: instance.id,
          details: {
            dropletId: droplet.id,
            ip: droplet.ip,
          },
        },
      );

      this.logger.log(
        `[重试重建] 实例 ${instance.id} 重建完成，等待初始化`,
      );
    } catch (error) {
      this.logger.error(
        `[重试重建] 实例 ${instance.id} 重建失败: ${error.message}`,
      );

      // 重建失败，标记为 error
      await this.prisma.client.instances.update({
        where: { id: instance.id },
        data: {
          status: 'error',
          destroy_reason: `重建失败: ${error.message}`,
        },
      });

      await this.instanceLogService.error(
        instance.user_id,
        'instance_rebuild_failed',
        `VPS 重建失败: ${error.message}`,
        { instanceId: instance.id },
      );
    }
  }

  // ==================== 心跳监控与自动修复 ====================

  /**
   * 每 30 秒检测心跳状态
   * - 心跳超过 2 分钟 → 触发诊断和自动修复
   * - 心跳超过 15 分钟 → 自动销毁
   */
  @Cron('*/30 * * * * *') // 每 30 秒执行
  async handleHeartbeatMonitor() {
    try {
      // 查询所有需要监控的实例（running, unhealthy, zombie 状态）
      const instances = await this.prisma.client.instances.findMany({
        where: {
          status: { in: ['running', 'unhealthy', 'zombie'] },
          ip_address: { not: null },
        },
      });

      if (instances.length === 0) {
        return;
      }

      const now = Date.now();

      for (const instance of instances) {
        // 核心逻辑：只有收到过心跳的实例才进行超时检测
        // last_heartbeat 为 null 表示实例还在初始化，尚未收到 ready 回调或首次心跳
        // ready 回调和 heartbeat 方法都会设置 last_heartbeat
        if (!instance.last_heartbeat) {
          this.logger.debug(
            `[心跳监控] 实例 ${instance.id} 尚未收到首次心跳，跳过检测（等待初始化完成）`,
          );
          continue;
        }

        const lastHeartbeat = new Date(instance.last_heartbeat).getTime();
        const timeSinceLastHeartbeat = now - lastHeartbeat;

        // 情况 1：超过 15 分钟，自动销毁
        if (timeSinceLastHeartbeat > this.HEARTBEAT_TIMEOUT) {
          await this.autoDestroy(instance, '心跳超时超过15分钟，自动销毁');
          continue;
        }

        // 情况 2：超过 2 分钟，触发诊断修复
        if (timeSinceLastHeartbeat > this.HEARTBEAT_WARNING) {
          if (instance.status === 'running') {
            // 首次检测到异常，开始诊断修复
            await this.handleUnhealthyInstance(instance);
          } else if (instance.status === 'unhealthy' || instance.status === 'zombie') {
            // 已经在异常状态，检查是否需要继续修复
            // 避免重复诊断，检查最后诊断时间
            const lastDiagnosis = instance.last_diagnosis_at
              ? new Date(instance.last_diagnosis_at).getTime()
              : 0;
            const timeSinceLastDiagnosis = now - lastDiagnosis;

            // 每 5 分钟重试一次诊断修复
            if (timeSinceLastDiagnosis > 5 * 60 * 1000) {
              await this.handleUnhealthyInstance(instance);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(`[心跳监控] 执行失败: ${error.message}`, error.stack);
    }
  }

  /**
   * 处理异常实例：诊断 + 自动修复
   */
  private async handleUnhealthyInstance(instance: any) {
    this.logger.warn(
      `[心跳监控] 实例 ${instance.id} 心跳异常，开始诊断修复`,
    );

    // 1. 更新状态为 unhealthy
    await this.prisma.client.instances.update({
      where: { id: instance.id },
      data: {
        status: 'unhealthy',
        last_diagnosis_at: new Date(),
      },
    });

    // 2. 记录诊断开始日志
    await this.instanceLogService.warn(
      instance.user_id,
      'diagnosis_started',
      '检测到心跳中断，开始智能诊断',
      { instanceId: instance.id },
    );

    // 3. 执行诊断
    const diagnosis = await this.diagnosisService.diagnose(instance.ip_address);

    // 4. 记录诊断结果
    await this.instanceLogService.info(
      instance.user_id,
      'diagnosis_result',
      `诊断完成: SSH=${diagnosis.sshReachable}, Proxy=${diagnosis.proxyStatus}, Freqtrade=${diagnosis.freqtradeStatus}`,
      {
        instanceId: instance.id,
        details: {
          sshReachable: diagnosis.sshReachable,
          proxyStatus: diagnosis.proxyStatus,
          freqtradeStatus: diagnosis.freqtradeStatus,
          diskUsagePercent: diagnosis.diskUsagePercent,
          memoryAvailableMB: diagnosis.memoryAvailableMB,
          repairActions: diagnosis.repairActions.map((a) =>
            a.type === 'none' ? `none: ${a.reason}` : a.type,
          ),
        },
      },
    );

    // 5. 如果 SSH 不可达，标记为 zombie 等待超时销毁
    if (!diagnosis.sshReachable) {
      this.logger.error(
        `[心跳监控] 实例 ${instance.id} SSH 不可达，标记为 zombie`,
      );
      await this.prisma.client.instances.update({
        where: { id: instance.id },
        data: {
          status: 'zombie',
          destroy_reason: 'SSH 不可达',
        },
      });
      return;
    }

    // 6. 尝试修复
    this.logger.log(
      `[心跳监控] 实例 ${instance.id} 开始自动修复，动作: ${diagnosis.repairActions.length}`,
    );
    const repairResult = await this.repairService.executeRepair(
      instance.ip_address,
      diagnosis.repairActions,
    );

    // 7. 验证修复结果
    const isHealthy = await this.repairService.verifyRepair(instance.ip_address);

    if (isHealthy) {
      // 修复成功
      this.logger.log(`[心跳监控] 实例 ${instance.id} 修复成功`);
      await this.prisma.client.instances.update({
        where: { id: instance.id },
        data: {
          status: 'running',
          destroy_reason: null,
          last_heartbeat: new Date(),
        },
      });

      await this.instanceLogService.info(
        instance.user_id,
        'repair_success',
        '自动修复成功，服务已恢复',
        {
          instanceId: instance.id,
          details: {
            actionsExecuted: repairResult.actionsExecuted,
          },
        },
      );
    } else {
      // 修复失败，保持 unhealthy 状态等待下次重试或超时销毁
      this.logger.warn(
        `[心跳监控] 实例 ${instance.id} 修复失败，等待重试或超时销毁`,
      );

      await this.instanceLogService.warn(
        instance.user_id,
        'repair_failed',
        '自动修复失败，将在15分钟后自动销毁',
        {
          instanceId: instance.id,
          details: {
            actionsExecuted: repairResult.actionsExecuted,
            actionsFailed: repairResult.actionsFailed,
            logs: repairResult.logs,
          },
        },
      );
    }
  }

  /**
   * 自动销毁实例
   */
  private async autoDestroy(instance: any, reason: string) {
    this.logger.error(
      `[心跳监控] 实例 ${instance.id} 自动销毁: ${reason}`,
    );

    try {
      // 1. 更新状态为 destroying
      await this.prisma.client.instances.update({
        where: { id: instance.id },
        data: { status: 'destroying' },
      });

      // 2. 记录日志
      await this.instanceLogService.error(
        instance.user_id,
        'auto_destroy',
        `VPS 自动销毁: ${reason}`,
        { instanceId: instance.id },
      );

      // 3. 调用 DO API 销毁
      if (instance.droplet_id) {
        await this.digitalOceanService.destroyDroplet(instance.droplet_id);
      }

      // 4. 更新状态为已销毁
      await this.prisma.client.instances.update({
        where: { id: instance.id },
        data: {
          status: 'destroyed',
          destroyed_at: new Date(),
          destroy_reason: reason,
        },
      });

      // 5. 重置用户 API Key 验证状态（VPS 销毁后需要重新验证）
      await this.prisma.client.api_keys.updateMany({
        where: { user_id: instance.user_id },
        data: { last_verified_at: null },
      });
      this.logger.log(`[心跳监控] 已重置用户 ${instance.user_id} 的 API Key 验证状态`);

      this.logger.log(`[心跳监控] 实例 ${instance.id} 已销毁`);
    } catch (error) {
      this.logger.error(
        `[心跳监控] 实例 ${instance.id} 销毁失败: ${error.message}`,
      );

      // 即使 DO API 失败，也标记为销毁
      await this.prisma.client.instances.update({
        where: { id: instance.id },
        data: {
          status: 'destroyed',
          destroyed_at: new Date(),
          destroy_reason: `${reason} (销毁过程中出错: ${error.message})`,
        },
      });

      // 重置 API Key 验证状态
      await this.prisma.client.api_keys.updateMany({
        where: { user_id: instance.user_id },
        data: { last_verified_at: null },
      });
    }
  }
}
