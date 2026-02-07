/**
 * 管理后台 - 信号控制服务
 * 全局/策略/用户级别的信号急停控制
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminSignalService {
  private readonly logger = new Logger(AdminSignalService.name);

  constructor(private prisma: PrismaService) {}

  // 获取急停开关概览
  async getKillSwitchOverview() {
    const [globalConfig, strategies, stoppedUsers, recentLogs] =
      await Promise.all([
        this.getGlobalSignalConfig(),
        this.getStrategySignalStatus(),
        this.getStoppedUsers(),
        this.getKillSwitchLogs(20),
      ]);

    const runningStrategies = strategies.filter((s) => s.isActive).length;
    const stoppedStrategies = strategies.filter((s) => !s.isActive).length;
    const affectedUsers = strategies
      .filter((s) => !s.isActive)
      .reduce((sum, s) => sum + s.subscriberCount, 0);

    return {
      global: {
        enabled: globalConfig.signalEnabled,
        lastUpdated: globalConfig.updatedAt,
        updatedBy: globalConfig.updatedBy,
      },
      stats: {
        totalStrategies: strategies.length,
        runningStrategies,
        stoppedStrategies,
        stoppedUsers: stoppedUsers.length,
        affectedUsers,
      },
      strategies,
      stoppedUsers,
      recentLogs,
    };
  }

  // 获取全局信号配置
  async getGlobalSignalConfig() {
    const config = await this.prisma.platformConfig.findUnique({
      where: { key: 'signal_global_switch' },
    });

    if (!config) {
      // 创建默认配置（使用 key 作为 id 以避免默认值冲突）
      const newConfig = await this.prisma.platformConfig.create({
        data: {
          id: 'signal_global_switch',
          key: 'signal_global_switch',
          value: JSON.stringify({ enabled: true }),
          description: '全局信号开关',
        },
      });
      return {
        signalEnabled: true,
        updatedAt: newConfig.updatedAt,
        updatedBy: null,
      };
    }

    const parsed = JSON.parse(config.value);
    return {
      signalEnabled: parsed.enabled ?? true,
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy,
    };
  }

  // 设置全局信号开关
  async setGlobalSignalSwitch(
    enabled: boolean,
    adminId: string,
    reason: string,
  ) {
    const config = await this.prisma.platformConfig.upsert({
      where: { key: 'signal_global_switch' },
      create: {
        id: 'signal_global_switch',
        key: 'signal_global_switch',
        value: JSON.stringify({ enabled }),
        description: '全局信号开关',
        updatedBy: adminId,
      },
      update: {
        value: JSON.stringify({ enabled }),
        updatedBy: adminId,
      },
    });

    // 记录审计日志
    await this.logKillSwitchAction({
      type: 'global',
      targetId: 'global',
      targetName: '全局信号',
      action: enabled ? 'resume' : 'stop',
      reason,
      operatorId: adminId,
    });

    this.logger.log(
      `全局信号已${enabled ? '开启' : '关闭'}, 操作人: ${adminId}, 原因: ${reason}`,
    );

    return {
      enabled,
      updatedAt: config.updatedAt,
    };
  }

  // 获取所有策略的信号状态
  async getStrategySignalStatus() {
    const strategies = await this.prisma.strategy.findMany({
      select: {
        id: true,
        name: true,
        isActive: true,
        updatedAt: true,
        _count: {
          select: { subscriptions: { where: { isActive: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 获取每个策略的最后信号时间
    const strategyIds = strategies.map((s) => s.id);
    const lastSignals = await this.prisma.signal.groupBy({
      by: ['strategyId'],
      where: { strategyId: { in: strategyIds } },
      _max: { createdAt: true },
    });

    const signalMap = new Map(
      lastSignals.map((s) => [s.strategyId, s._max.createdAt]),
    );

    // 获取停止原因（从审计日志）
    const stopReasons = await this.prisma.auditLog.findMany({
      where: {
        action: 'strategy_signal_stop',
        resourceId: { in: strategyIds },
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['resourceId'],
    });

    const reasonMap = new Map(
      stopReasons.map((l) => [
        l.resourceId,
        {
          reason: l.details,
          stoppedBy: l.actorId,
          stoppedAt: l.createdAt,
        },
      ]),
    );

    return strategies.map((s) => ({
      id: s.id,
      name: s.name,
      isActive: s.isActive,
      subscriberCount: s._count.subscriptions,
      lastSignal: signalMap.get(s.id)?.toISOString() || null,
      ...(s.isActive ? {} : reasonMap.get(s.id) || {}),
    }));
  }

  // 设置策略信号状态
  async setStrategySignalStatus(
    strategyId: string,
    enabled: boolean,
    adminId: string,
    reason: string,
  ) {
    const strategy = await this.prisma.strategy.findUnique({
      where: { id: strategyId },
    });

    if (!strategy) {
      throw new NotFoundException('策略不存在');
    }

    await this.prisma.strategy.update({
      where: { id: strategyId },
      data: { isActive: enabled },
    });

    // 记录审计日志
    await this.logKillSwitchAction({
      type: 'strategy',
      targetId: strategyId,
      targetName: strategy.name,
      action: enabled ? 'resume' : 'stop',
      reason,
      operatorId: adminId,
    });

    this.logger.log(
      `策略 ${strategy.name} 已${enabled ? '开启' : '关闭'}, 操作人: ${adminId}, 原因: ${reason}`,
    );

    return { id: strategyId, isActive: enabled };
  }

  // 批量设置策略信号状态
  async batchSetStrategySignalStatus(
    enabled: boolean,
    adminId: string,
    reason: string,
  ) {
    const strategies = await this.prisma.strategy.findMany({
      where: { isActive: !enabled },
      select: { id: true, name: true },
    });

    if (strategies.length === 0) {
      return {
        count: 0,
        message: enabled ? '没有需要恢复的策略' : '没有需要停止的策略',
      };
    }

    await this.prisma.strategy.updateMany({
      where: { id: { in: strategies.map((s) => s.id) } },
      data: { isActive: enabled },
    });

    // 记录审计日志
    await this.logKillSwitchAction({
      type: 'batch_strategy',
      targetId: 'batch',
      targetName: `${strategies.length} 个策略`,
      action: enabled ? 'resume' : 'stop',
      reason,
      operatorId: adminId,
    });

    this.logger.log(
      `批量${enabled ? '恢复' : '停止'} ${strategies.length} 个策略, 操作人: ${adminId}`,
    );

    return {
      count: strategies.length,
      message: `已${enabled ? '恢复' : '停止'} ${strategies.length} 个策略`,
    };
  }

  // 获取被停止信号的用户列表
  async getStoppedUsers() {
    const users = await this.prisma.user.findMany({
      where: { signalEnabled: false },
      select: {
        id: true,
        email: true,
        nickname: true,
        signalEnabled: true,
        updatedAt: true,
      },
    });

    // 获取停止原因
    const userIds = users.map((u) => u.id);
    const stopReasons = await this.prisma.auditLog.findMany({
      where: {
        action: 'user_signal_stop',
        resourceId: { in: userIds },
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['resourceId'],
    });

    const reasonMap = new Map(
      stopReasons.map((l) => [
        l.resourceId,
        {
          reason: l.details,
          stoppedBy: l.actorId,
          stoppedAt: l.createdAt,
        },
      ]),
    );

    return users.map((u) => ({
      userId: u.id,
      email: u.email ?? '',
      username: u.nickname || (u.email ? u.email.split('@')[0] : 'unknown'),
      status: u.signalEnabled ? 'active' : 'stopped',
      ...(u.signalEnabled ? {} : reasonMap.get(u.id) || {}),
    }));
  }

  // 设置用户信号状态
  async setUserSignalStatus(
    userId: string,
    enabled: boolean,
    adminId: string,
    reason: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, nickname: true },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { signalEnabled: enabled },
    });

    // 记录审计日志
    const displayName = user.nickname || user.email || 'unknown';
    await this.logKillSwitchAction({
      type: 'user',
      targetId: userId,
      targetName: displayName,
      action: enabled ? 'resume' : 'stop',
      reason,
      operatorId: adminId,
    });

    this.logger.log(
      `用户 ${displayName} 信号已${enabled ? '开启' : '关闭'}, 操作人: ${adminId}, 原因: ${reason}`,
    );

    return { userId, signalEnabled: enabled };
  }

  // 搜索用户（用于用户级控制的下拉搜索）
  async searchUsers(keyword: string, limit: number = 20) {
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: keyword, mode: 'insensitive' } },
          { nickname: { contains: keyword, mode: 'insensitive' } },
        ],
      },
      take: limit,
      select: {
        id: true,
        email: true,
        nickname: true,
        signalEnabled: true,
      },
    });

    return users.map((u) => ({
      userId: u.id,
      email: u.email ?? '',
      username: u.nickname || (u.email ? u.email.split('@')[0] : 'unknown'),
      status: u.signalEnabled ? 'active' : 'stopped',
    }));
  }

  // 获取急停开关操作日志
  async getKillSwitchLogs(limit: number = 50) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            'global_signal_stop',
            'global_signal_resume',
            'strategy_signal_stop',
            'strategy_signal_resume',
            'user_signal_stop',
            'user_signal_resume',
            'batch_strategy_stop',
            'batch_strategy_resume',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id,
      type: this.parseLogType(log.action),
      target: log.resourceType,
      action: log.action.includes('resume') ? 'resume' : 'stop',
      operator: log.actorId,
      reason: log.details || '未提供原因',
      time: log.createdAt.toISOString(),
    }));
  }

  // 解析日志类型
  private parseLogType(action: string): string {
    if (action.includes('global')) return 'global';
    if (action.includes('batch_strategy')) return 'batch_strategy';
    if (action.includes('strategy')) return 'strategy';
    if (action.includes('user')) return 'user';
    return 'unknown';
  }

  // 记录急停开关操作
  private async logKillSwitchAction(data: {
    type: string;
    targetId: string;
    targetName: string;
    action: 'stop' | 'resume';
    reason: string;
    operatorId: string;
  }) {
    await this.prisma.auditLog.create({
      data: {
        actorId: data.operatorId,
        actorType: 'admin',
        action: `${data.type}_signal_${data.action}`,
        resourceType: data.targetName,
        resourceId: data.targetId,
        details: data.reason,
        metadata: {
          type: data.type,
          action: data.action,
        },
      },
    });
  }
}
