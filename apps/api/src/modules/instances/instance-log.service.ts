import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 日志级别
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/**
 * 日志操作类型
 */
export type LogAction =
  // === 交易日志类型 ===
  | 'api_key_bind'      // API Key 绑定
  | 'api_key_verify'    // API Key 验证
  | 'api_key_delete'    // API Key 删除
  | 'strategy_deploy'   // 策略部署（交易日志）
  | 'strategy_save'     // 策略保存
  | 'bot_start'         // 机器人启动
  | 'bot_stop'          // 机器人停止
  | 'bot_panic'         // 紧急平仓
  | 'config_update'     // 配置更新
  // === 系统日志类型 ===
  | 'instance_create'   // VPS 创建
  | 'instance_destroy'  // VPS 销毁
  | 'instance_ready'    // VPS 就绪（初始化完成）
  | 'instance_retry'    // VPS 重试创建
  | 'instance_create_failed' // VPS 创建失败（达到最大重试次数）
  | 'instance_rebuild'  // VPS 重建成功
  | 'instance_rebuild_failed' // VPS 重建失败
  | 'deploy_success'    // 部署成功（系统层面）
  | 'deploy_fail'       // 部署失败（系统层面）
  | 'heartbeat'         // 心跳
  | 'system'            // 系统消息
  | 'error'             // 错误
  // === 诊断修复日志类型 ===
  | 'diagnosis_started' // 诊断开始
  | 'diagnosis_result'  // 诊断结果
  | 'repair_success'    // 修复成功
  | 'repair_failed'     // 修复失败
  | 'auto_destroy';     // 自动销毁

/**
 * 交易相关的日志类型（显示在交易日志 Tab）
 */
export const TRADING_LOG_ACTIONS: LogAction[] = [
  'api_key_bind',
  'api_key_verify',
  'api_key_delete',
  'strategy_deploy',
  'strategy_save',
  'bot_start',
  'bot_stop',
  'bot_panic',
  'config_update',
];

/**
 * VPS 基础设施相关的日志类型（显示在系统日志 Tab）
 */
export const SYSTEM_LOG_ACTIONS: LogAction[] = [
  'instance_create',
  'instance_destroy',
  'instance_ready',
  'deploy_success',
  'deploy_fail',
  'heartbeat',
  'system',
  'error',
  'diagnosis_started',
  'diagnosis_result',
  'repair_success',
  'repair_failed',
  'auto_destroy',
];

/**
 * 实例操作日志服务
 * 记录所有 VPS 相关的系统操作日志
 */
@Injectable()
export class InstanceLogService {
  private readonly logger = new Logger(InstanceLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 记录日志
   */
  async log(
    userId: string,
    action: LogAction,
    message: string,
    options?: {
      instanceId?: string;
      level?: LogLevel;
      details?: Record<string, any>;
      ipAddress?: string;
    },
  ): Promise<void> {
    try {
      await this.prisma.client.instance_logs.create({
        data: {
          user_id: userId,
          instance_id: options?.instanceId || null,
          action,
          level: options?.level || 'info',
          message,
          details: options?.details || {},
          ip_address: options?.ipAddress || null,
        },
      });
    } catch (error) {
      // 日志记录失败不应影响主流程
      this.logger.error(`记录实例日志失败: ${error.message}`);
    }
  }

  /**
   * 记录 info 级别日志
   */
  async info(
    userId: string,
    action: LogAction,
    message: string,
    options?: { instanceId?: string; details?: Record<string, any>; ipAddress?: string },
  ): Promise<void> {
    return this.log(userId, action, message, { ...options, level: 'info' });
  }

  /**
   * 记录 warn 级别日志
   */
  async warn(
    userId: string,
    action: LogAction,
    message: string,
    options?: { instanceId?: string; details?: Record<string, any>; ipAddress?: string },
  ): Promise<void> {
    return this.log(userId, action, message, { ...options, level: 'warn' });
  }

  /**
   * 记录 error 级别日志
   */
  async error(
    userId: string,
    action: LogAction,
    message: string,
    options?: { instanceId?: string; details?: Record<string, any>; ipAddress?: string },
  ): Promise<void> {
    return this.log(userId, action, message, { ...options, level: 'error' });
  }

  /**
   * 获取用户的日志（支持按类型过滤）
   * @param userId 用户 ID
   * @param limit 返回数量
   * @param instanceId 可选，过滤特定实例的日志
   * @param actions 可选，只返回指定操作类型的日志
   */
  async getUserLogs(
    userId: string,
    limit: number = 100,
    instanceId?: string,
    actions?: LogAction[],
  ): Promise<{
    logs: Array<{
      id: string;
      timestamp: string;
      level: string;
      action: string;
      message: string;
      details?: Record<string, any>;
    }>;
    log_count: number;
  }> {
    const where: any = { user_id: userId };
    if (instanceId) {
      where.instance_id = instanceId;
    }
    if (actions && actions.length > 0) {
      where.action = { in: actions };
    }

    const logs = await this.prisma.client.instance_logs.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: Math.min(limit, 500),
      select: {
        id: true,
        created_at: true,
        level: true,
        action: true,
        message: true,
        details: true,
      },
    });

    return {
      logs: logs.map((log) => ({
        id: log.id,
        timestamp: log.created_at.toISOString(),
        level: log.level,
        action: log.action,
        message: log.message,
        details: log.details as Record<string, any> | undefined,
      })),
      log_count: logs.length,
    };
  }

  /**
   * 获取交易相关日志（API Key、策略操作等）
   */
  async getTradingLogs(
    userId: string,
    limit: number = 100,
    instanceId?: string,
  ) {
    return this.getUserLogs(userId, limit, instanceId, TRADING_LOG_ACTIONS);
  }

  /**
   * 获取 VPS 系统日志（实例创建/销毁、心跳等）
   */
  async getSystemLogs(
    userId: string,
    limit: number = 100,
    instanceId?: string,
  ) {
    return this.getUserLogs(userId, limit, instanceId, SYSTEM_LOG_ACTIONS);
  }

  /**
   * 获取实例的日志
   */
  async getInstanceLogs(
    instanceId: string,
    limit: number = 100,
  ): Promise<{
    logs: Array<{
      id: string;
      timestamp: string;
      level: string;
      action: string;
      message: string;
    }>;
    log_count: number;
  }> {
    const logs = await this.prisma.client.instance_logs.findMany({
      where: { instance_id: instanceId },
      orderBy: { created_at: 'desc' },
      take: Math.min(limit, 500),
      select: {
        id: true,
        created_at: true,
        level: true,
        action: true,
        message: true,
      },
    });

    return {
      logs: logs.map((log) => ({
        id: log.id,
        timestamp: log.created_at.toISOString(),
        level: log.level,
        action: log.action,
        message: log.message,
      })),
      log_count: logs.length,
    };
  }
}
