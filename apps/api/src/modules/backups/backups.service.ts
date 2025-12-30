import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

/**
 * 备份服务
 * 处理 VPS 实例数据的 S3 备份与恢复
 *
 * 备份内容：
 * - trades.sqlite (Freqtrade 交易数据库)
 * - config.json (策略配置)
 *
 * 备份时机：
 * - VPS 销毁前自动备份
 * - 手动触发备份
 *
 * 恢复时机：
 * - 新 VPS 创建时检查并恢复
 */
@Injectable()
export class BackupsService {
  private readonly logger = new Logger(BackupsService.name);
  private readonly s3Client: S3Client | null;
  private readonly bucket: string;
  private readonly sandboxMode: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.sandboxMode = this.configService.get<string>('SANDBOX_MODE') === 'true';
    this.bucket = this.configService.get<string>('S3_BUCKET') || 'quantfi-backups';

    // 初始化 S3 客户端（DigitalOcean Spaces 兼容 S3 API）
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_KEY');
    const region = this.configService.get<string>('S3_REGION') || 'sgp1';

    if (endpoint && accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        endpoint,
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        forcePathStyle: false, // Spaces 使用虚拟主机样式
      });
      this.logger.log('S3 客户端初始化成功');
    } else {
      this.s3Client = null;
      this.logger.warn('S3 配置不完整，备份功能将使用沙盒模式');
    }
  }

  /**
   * 备份 VPS 实例数据
   * @param instanceId 实例 ID
   * @param data 备份数据（trades.sqlite + config.json 的 Buffer）
   */
  async backupInstance(instanceId: string, data: {
    tradesData?: Buffer;
    configData?: Buffer;
  }): Promise<{ backupId: string; s3Key: string }> {
    this.logger.log(`开始备份实例 ${instanceId}`);

    // 1. 查询实例
    const instance = await this.prisma.client.instances.findUnique({
      where: { id: instanceId },
    });

    if (!instance) {
      throw new NotFoundException('实例不存在');
    }

    // 2. 生成 S3 路径
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const s3Key = `backups/${instance.user_id}/${instanceId}/${timestamp}`;
    const totalSize = BigInt((data.tradesData?.length || 0) + (data.configData?.length || 0));

    // 3. 沙盒模式
    if (this.sandboxMode || !this.s3Client) {
      this.logger.log(`[沙盒模式] 模拟备份到 ${s3Key}`);

      // 创建备份记录
      const backup = await this.prisma.client.instance_backups.create({
        data: {
          instance_id: instanceId,
          user_id: instance.user_id,
          s3_bucket: this.bucket,
          s3_key: s3Key,
          file_size_bytes: totalSize,
          backup_type: 'auto',
          status: 'completed',
          includes: ['trades.sqlite', 'config.json'],
        },
      });

      return { backupId: backup.id, s3Key };
    }

    // 4. 上传到 S3
    try {
      // 上传 trades.sqlite
      if (data.tradesData) {
        await this.s3Client.send(new PutObjectCommand({
          Bucket: this.bucket,
          Key: `${s3Key}/trades.sqlite`,
          Body: data.tradesData,
          ContentType: 'application/x-sqlite3',
        }));
        this.logger.log(`上传 trades.sqlite 成功: ${s3Key}/trades.sqlite`);
      }

      // 上传 config.json
      if (data.configData) {
        await this.s3Client.send(new PutObjectCommand({
          Bucket: this.bucket,
          Key: `${s3Key}/config.json`,
          Body: data.configData,
          ContentType: 'application/json',
        }));
        this.logger.log(`上传 config.json 成功: ${s3Key}/config.json`);
      }

      // 5. 创建备份记录
      const backup = await this.prisma.client.instance_backups.create({
        data: {
          instance_id: instanceId,
          user_id: instance.user_id,
          s3_bucket: this.bucket,
          s3_key: s3Key,
          file_size_bytes: totalSize,
          backup_type: 'auto',
          status: 'completed',
          includes: ['trades.sqlite', 'config.json'],
        },
      });

      this.logger.log(`实例 ${instanceId} 备份成功: ${backup.id}`);
      return { backupId: backup.id, s3Key };
    } catch (error) {
      this.logger.error(`备份失败: ${error.message}`, error.stack);

      // 记录失败的备份
      await this.prisma.client.instance_backups.create({
        data: {
          instance_id: instanceId,
          user_id: instance.user_id,
          s3_bucket: this.bucket,
          s3_key: s3Key,
          file_size_bytes: BigInt(0),
          backup_type: 'auto',
          status: 'failed',
          error_message: error.message,
        },
      });

      throw error;
    }
  }

  /**
   * 恢复 VPS 实例数据
   * @param instanceId 新实例 ID
   * @param userId 用户 ID（用于查找旧备份）
   */
  async restoreInstance(instanceId: string, userId: string): Promise<{
    restored: boolean;
    backupId?: string;
    tradesData?: Buffer;
    configData?: Buffer;
  }> {
    this.logger.log(`检查用户 ${userId} 的备份以恢复到实例 ${instanceId}`);

    // 1. 查找最新的成功备份（直接用 user_id 字段查询）
    const latestBackup = await this.prisma.client.instance_backups.findFirst({
      where: {
        user_id: userId,
        status: 'completed',
      },
      orderBy: { created_at: 'desc' },
    });

    if (!latestBackup) {
      this.logger.log('没有找到可恢复的备份');
      return { restored: false };
    }

    // 2. 沙盒模式
    if (this.sandboxMode || !this.s3Client) {
      this.logger.log(`[沙盒模式] 模拟恢复备份 ${latestBackup.id}`);

      // 更新备份记录
      await this.prisma.client.instance_backups.update({
        where: { id: latestBackup.id },
        data: {
          restored_at: new Date(),
          restored_to_instance_id: instanceId,
        },
      });

      return {
        restored: true,
        backupId: latestBackup.id,
        tradesData: Buffer.from('sandbox_trades_data'),
        configData: Buffer.from('{"sandbox": true}'),
      };
    }

    // 3. 从 S3 下载
    try {
      let tradesData: Buffer | undefined;
      let configData: Buffer | undefined;

      // 下载 trades.sqlite
      try {
        const tradesResponse = await this.s3Client.send(new GetObjectCommand({
          Bucket: latestBackup.s3_bucket,
          Key: `${latestBackup.s3_key}/trades.sqlite`,
        }));
        tradesData = await this.streamToBuffer(tradesResponse.Body as Readable);
        this.logger.log('下载 trades.sqlite 成功');
      } catch (e) {
        this.logger.warn('trades.sqlite 不存在或下载失败');
      }

      // 下载 config.json
      try {
        const configResponse = await this.s3Client.send(new GetObjectCommand({
          Bucket: latestBackup.s3_bucket,
          Key: `${latestBackup.s3_key}/config.json`,
        }));
        configData = await this.streamToBuffer(configResponse.Body as Readable);
        this.logger.log('下载 config.json 成功');
      } catch (e) {
        this.logger.warn('config.json 不存在或下载失败');
      }

      // 4. 更新备份记录
      await this.prisma.client.instance_backups.update({
        where: { id: latestBackup.id },
        data: {
          restored_at: new Date(),
          restored_to_instance_id: instanceId,
        },
      });

      this.logger.log(`实例 ${instanceId} 恢复成功，来自备份 ${latestBackup.id}`);
      return {
        restored: true,
        backupId: latestBackup.id,
        tradesData,
        configData,
      };
    } catch (error) {
      this.logger.error(`恢复失败: ${error.message}`, error.stack);
      return { restored: false };
    }
  }

  /**
   * 获取用户的备份列表
   */
  async getBackupsByUser(userId: string) {
    const backups = await this.prisma.client.instance_backups.findMany({
      where: {
        user_id: userId,
      },
      orderBy: { created_at: 'desc' },
      take: 20,
      include: {
        instances_instance_backups_instance_idToinstances: {
          select: {
            id: true,
            ip_address: true,
            region: true,
          },
        },
      },
    });

    return backups.map((b) => ({
      id: b.id,
      instanceId: b.instance_id,
      instanceIp: b.instances_instance_backups_instance_idToinstances?.ip_address,
      s3Key: b.s3_key,
      s3Bucket: b.s3_bucket,
      sizeBytes: b.file_size_bytes ? Number(b.file_size_bytes) : 0,
      backupType: b.backup_type,
      status: b.status,
      restoredAt: b.restored_at,
      createdAt: b.created_at,
    }));
  }

  /**
   * 删除过期备份
   * 默认保留最近 30 天的备份
   */
  async cleanupExpiredBackups(retentionDays: number = 30) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - retentionDays);

    const expiredBackups = await this.prisma.client.instance_backups.findMany({
      where: {
        created_at: { lt: expiryDate },
        status: 'completed',
      },
    });

    this.logger.log(`找到 ${expiredBackups.length} 个过期备份待清理`);

    for (const backup of expiredBackups) {
      try {
        // 从 S3 删除
        if (this.s3Client && !this.sandboxMode) {
          await this.s3Client.send(new DeleteObjectCommand({
            Bucket: backup.s3_bucket,
            Key: `${backup.s3_key}/trades.sqlite`,
          }));
          await this.s3Client.send(new DeleteObjectCommand({
            Bucket: backup.s3_bucket,
            Key: `${backup.s3_key}/config.json`,
          }));
        }

        // 更新状态为 expired
        await this.prisma.client.instance_backups.update({
          where: { id: backup.id },
          data: { status: 'expired' },
        });

        this.logger.log(`清理过期备份 ${backup.id}`);
      } catch (error) {
        this.logger.error(`清理备份 ${backup.id} 失败: ${error.message}`);
      }
    }

    return { cleaned: expiredBackups.length };
  }

  /**
   * 将 Stream 转换为 Buffer
   */
  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
